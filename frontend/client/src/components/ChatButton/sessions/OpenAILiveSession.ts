import {
  type ChatSession,
  invokeNavigationTool,
  type NavigationCallbacks,
} from "./types";

// This is the only browser code that knows the Live wire protocol. Session
// configuration and credentials are owned by StartChat on the server.
// https://developers.openai.com/api/docs/guides/voice-webrtc
// https://developers.openai.com/api/docs/guides/live-delegation
export type LiveSessionOptions = NavigationCallbacks & {
  createSession: (
    sdpOffer: string,
    signal: AbortSignal,
  ) => Promise<{ sdpAnswer: string; startMessage: string }>;
  microphoneDeviceId?: string;
  speakerDeviceId?: string;
  onError: (error: Error) => void;
  onClosed: () => void;
};

export class OpenAILiveSession implements ChatSession {
  private readonly abort = new AbortController();
  private readonly peer = new RTCPeerConnection();
  private readonly audio = new Audio();
  private readonly channel = this.peer.createDataChannel("oai-events");
  private microphone?: MediaStream;
  private stopped = false;
  private started = false;
  private startMessage = "";
  private closingTimer?: ReturnType<typeof setTimeout>;
  private resolveReady?: () => void;
  private rejectReady?: (error: Error) => void;
  private readonly calls = new Set<string>();
  private readonly responsesWithTools = new Set<string>();
  private readonly activeResponses = new Map<string, string>();

  constructor(private readonly options: LiveSessionOptions) {
    this.audio.autoplay = true;
    this.peer.ontrack = ({ track, streams }) => {
      if (this.stopped) return;
      this.audio.srcObject = streams[0] ?? new MediaStream([track]);
      void this.audio.play().catch((error) => this.fail(error));
    };
    this.channel.onmessage = ({ data }) => {
      try {
        this.handleEvent(JSON.parse(data));
      } catch (error) {
        this.fail(error);
      }
    };
    this.channel.onerror = () =>
      this.fail(new Error("Live event channel failed."));
    this.channel.onclose = () => {
      if (!this.stopped)
        this.fail(new Error("Live event channel closed unexpectedly."));
      else this.release();
    };
    this.peer.onconnectionstatechange = () => {
      if (this.peer.connectionState === "failed")
        this.fail(new Error("Live media connection failed."));
    };
  }

  async start(): Promise<void> {
    // Arm readiness before negotiation: session.started can arrive immediately
    // after the SDP answer is applied. Abort also rejects a pending startup.
    const ready = new Promise<void>((resolve, reject) => {
      this.resolveReady = resolve;
      this.rejectReady = reject;
    });
    // Startup can fail before awaiting ready. Attach a rejection handler now.
    void ready.catch(() => {});
    const timeout = setTimeout(
      () => this.fail(new Error("Live connection timed out.")),
      30_000,
    );
    try {
      this.abort.signal.throwIfAborted();
      this.microphone = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: this.options.microphoneDeviceId
            ? { exact: this.options.microphoneDeviceId }
            : undefined,
        },
      });
      if (this.stopped) {
        for (const track of this.microphone.getTracks()) track.stop();
        this.abort.signal.throwIfAborted();
      }
      if (this.options.speakerDeviceId && "setSinkId" in this.audio) {
        await this.audio.setSinkId(this.options.speakerDeviceId);
      }
      this.abort.signal.throwIfAborted();
      for (const track of this.microphone.getTracks())
        this.peer.addTrack(track, this.microphone);
      await this.peer.setLocalDescription(await this.peer.createOffer());
      await this.waitForIce();
      this.abort.signal.throwIfAborted();
      const offer = this.peer.localDescription?.sdp;
      if (!offer)
        throw new Error("Live connection did not produce an SDP offer.");
      const { sdpAnswer, startMessage } = await this.options.createSession(
        offer,
        this.abort.signal,
      );
      this.abort.signal.throwIfAborted();
      if (!sdpAnswer)
        throw new Error("Live session did not return an SDP answer.");
      this.startMessage = startMessage;
      await this.peer.setRemoteDescription({ type: "answer", sdp: sdpAnswer });
      await ready;
    } catch (error) {
      this.stop();
      throw error;
    } finally {
      clearTimeout(timeout);
      this.resolveReady = undefined;
      this.rejectReady = undefined;
    }
  }

  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    this.abort.abort();
    this.rejectReady?.(new Error("Live session stopped."));
    for (const track of this.microphone?.getTracks() ?? []) track.stop();
    this.audio.pause();
    this.audio.srcObject = null;
    // Give the API a chance to finalize the session before closing transport.
    // A bounded fallback also releases resources when no terminal event arrives.
    if (this.channel.readyState === "open") {
      this.closingTimer = setTimeout(() => this.release(), 2_000);
      try {
        this.send({ type: "session.close" });
      } catch {
        this.release();
      }
    } else this.release();
  }

  private release(): void {
    clearTimeout(this.closingTimer);
    this.channel.onclose = null;
    this.peer.onconnectionstatechange = null;
    this.channel.close();
    this.peer.close();
  }

  private fail(error: unknown): void {
    if (this.stopped) return;
    this.stop();
    this.options.onError(
      error instanceof Error ? error : new Error(String(error)),
    );
  }

  private send(event: Record<string, unknown>): void {
    this.channel.send(
      JSON.stringify({ ...event, event_id: crypto.randomUUID() }),
    );
  }

  private handleEvent(event: LiveEvent): void {
    if (event.type === "session.closed") {
      const unexpected = !this.stopped;
      this.stop();
      this.release();
      if (unexpected) this.options.onClosed();
      return;
    }
    if (this.stopped) return;
    if (event.type === "session.started") {
      if (this.started) return;
      this.started = true;
      // Startup history is context, not a request to generate a response. Send
      // the same localized opening message as Realtime, using Live's backend
      // input protocol, and explicitly run that backend before waiting for speech.
      if (this.startMessage) {
        this.send({
          type: "response.item.create",
          item: {
            type: "message",
            role: "user",
            content: [{ type: "input_text", text: this.startMessage }],
          },
        });
        this.send({ type: "response.create" });
      }
      this.resolveReady?.();
    } else if (event.type === "error" || event.type === "session.error") {
      this.fail(new Error(event.error?.message ?? "Live session error."));
    } else if (this.started && event.type === "response.event" && event.event) {
      const response = event.event;
      // Track each response within its delegation. Lifecycle snapshots omit
      // output, so collect finished function items and continue after all results.
      const delegation = event.delegation_id ?? "";
      const responseId =
        response.response?.id ?? this.activeResponses.get(delegation);
      if (response.type === "response.created" && responseId) {
        this.activeResponses.set(delegation, responseId);
      } else if (
        response.type === "response.output_item.done" &&
        response.item?.type === "function_call"
      ) {
        const call = response.item;
        if (
          !responseId ||
          !call.call_id ||
          !call.name ||
          typeof call.arguments !== "string"
        ) {
          throw new Error("Live returned an incomplete navigation call.");
        }
        if (this.calls.has(call.call_id)) return;
        this.calls.add(call.call_id);
        let output: string;
        try {
          output = invokeNavigationTool(
            this.options,
            call.name,
            call.arguments,
          );
        } catch (error) {
          output = JSON.stringify({
            error: error instanceof Error ? error.message : String(error),
          });
        }
        this.send({
          type: "response.item.create",
          item: { type: "function_call_output", call_id: call.call_id, output },
        });
        this.responsesWithTools.add(responseId);
      } else if (response.type === "response.completed" && responseId) {
        if (this.activeResponses.get(delegation) === responseId)
          this.activeResponses.delete(delegation);
        if (this.responsesWithTools.delete(responseId))
          this.send({ type: "response.create" });
      } else if (response.type === "response.failed") {
        this.fail(
          new Error(
            response.response?.error?.message ??
              "Live backend response failed.",
          ),
        );
      }
    }
  }

  private async waitForIce(): Promise<void> {
    if (this.peer.iceGatheringState === "complete") return;
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        this.peer.removeEventListener("icegatheringstatechange", check);
        this.abort.signal.removeEventListener("abort", cancel);
      };
      const check = () => {
        if (this.peer.iceGatheringState === "complete") {
          cleanup();
          resolve();
        }
      };
      const cancel = () => {
        cleanup();
        reject(new Error("Live session stopped."));
      };
      this.peer.addEventListener("icegatheringstatechange", check);
      this.abort.signal.addEventListener("abort", cancel, { once: true });
      if (this.abort.signal.aborted) cancel();
      else check();
    });
  }
}

// Describe only the events this adapter consumes; tolerate additional event types.
type LiveEvent = {
  type: string;
  delegation_id?: string | null;
  error?: { message?: string };
  event?: {
    type: string;
    item?: {
      type: string;
      call_id?: string;
      name?: string;
      arguments?: string;
    };
    response?: { id?: string; error?: { message?: string } };
  };
};
