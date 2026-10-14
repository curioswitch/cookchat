import { StartChatRequest_ModelProvider } from "@cookchat/frontend-api";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { HiMicrophone, HiStop } from "react-icons/hi2";
import { RingBuffer } from "ringbuf.js";
import { twMerge } from "tailwind-merge";

import type { ChatEvent } from "../../events";
import { useFrontendQueries } from "../../hooks/rpc";
import { useSettingsStore } from "../../stores";
import ChatWorker from "../../workers/ChatWorker?worker";
import MicWorkletURL from "../../workers/MicWorklet?worker&url";
import SpeakerWorkletURL from "../../workers/SpeakerWorklet?worker&url";

import { OpenAILiveSession } from "./sessions/OpenAILiveSession";
import { OpenAIRealtimeSession } from "./sessions/OpenAIRealtimeSession";
import type { ChatSession } from "./sessions/types";

class ChatStream implements ChatSession {
  private readonly micAudioContext: AudioContext;
  private readonly speakerAudioContext: AudioContext;

  private micSource: MediaStreamAudioSourceNode | undefined;
  private microphone: MediaStream | undefined;
  private micWorklet: AudioWorkletNode | undefined;
  private micWorker: Worker | undefined;
  private chatWorker: Worker | undefined;
  private speakerWorklet: AudioWorkletNode | undefined;

  private stopped?: boolean;

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly startMessage: string,

    private readonly navigateToStep: (idx: number) => void,
    private readonly navigateToIngredients: () => void,
    private readonly setSpeaking: (speaking: boolean) => void,
    private readonly setWaiting: (waiting: boolean) => void,
    private readonly microphoneDeviceId?: string,
  ) {
    this.micAudioContext = new AudioContext({ sampleRate: 16_000 });
    this.speakerAudioContext = new AudioContext({ sampleRate: 24_000 });
  }

  async start() {
    const micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: this.microphoneDeviceId
          ? { exact: this.microphoneDeviceId }
          : undefined,
      },
    });
    this.microphone = micStream;
    if (this.stopped) {
      for (const track of micStream.getTracks()) track.stop();
      return;
    }
    const micAudioContext = this.micAudioContext;
    this.micSource = micAudioContext.createMediaStreamSource(micStream);
    await micAudioContext.audioWorklet.addModule(MicWorkletURL);
    if (this.stopped) return;
    this.micWorklet = new AudioWorkletNode(micAudioContext, "mic-worklet");
    this.micSource.connect(this.micWorklet);

    const speakerAudioContext = this.speakerAudioContext;
    await speakerAudioContext.audioWorklet.addModule(SpeakerWorkletURL);
    if (this.stopped) return;
    const outputBuffer = RingBuffer.getStorageForCapacity(
      speakerAudioContext.sampleRate * 60, // 60 seconds
      Float32Array,
    );

    this.speakerWorklet = new AudioWorkletNode(
      speakerAudioContext,
      "speaker-worklet",
      {
        processorOptions: {
          outputBuffer,
        },
      },
    );
    this.speakerWorklet.connect(speakerAudioContext.destination);

    this.chatWorker = new ChatWorker();
    this.chatWorker.postMessage(
      {
        type: "init",
        apiKey: this.apiKey,
        model: this.model,
        startMessage: this.startMessage,
        micPort: this.micWorklet.port,
        outputBuffer,
      },
      [this.micWorklet.port],
    );
    this.chatWorker.onmessage = (event: MessageEvent<ChatEvent>) => {
      switch (event.data.type) {
        case "audioStart":
          this.setSpeaking(true);
          this.setWaiting(false);
          break;
        case "toolCall": {
          const call = event.data.call;
          if (call.name === "navigate_to_step" && call.args) {
            const step = call.args.step as number;
            this.navigateToStep(step - 1);
          } else if (call.name === "navigate_to_ingredients") {
            this.navigateToIngredients();
          }
          break;
        }
        case "turnComplete":
          this.setSpeaking(false);
          this.setWaiting(true);
          break;
      }
    };
  }

  async stop() {
    if (this.stopped) {
      return;
    }
    this.stopped = true;
    for (const track of this.microphone?.getTracks() ?? []) track.stop();
    if (this.micWorklet) {
      this.micWorklet.disconnect();
    }
    if (this.micWorker) {
      this.micWorker.terminate();
    }
    if (this.chatWorker) {
      this.chatWorker.terminate();
    }
    if (this.speakerWorklet) {
      this.speakerWorklet.disconnect();
    }
    await this.micAudioContext.close();
    await this.speakerAudioContext.close();
  }
}

export function ChatButton({
  className,
  recipeId,
  planId,
  navigateToStep,
  navigateToIngredients,
  prompt,
}: {
  className?: string;
  recipeId: string;
  planId: string;
  navigateToStep?: (idx: number) => void;
  navigateToIngredients?: () => void;
  prompt?: string;
}) {
  const sessionRef = useRef<ChatSession | undefined>(undefined);
  const startingRef = useRef(false);
  const operationRef = useRef(0);
  const [error, setError] = useState<string>();
  const [playing, setPlaying] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [waiting, setWaiting] = useState(false);

  const frontendQueries = useFrontendQueries();
  const queryClient = useQueryClient();
  const settings = useSettingsStore();

  const onClick = useCallback(async () => {
    if (!navigateToStep || !navigateToIngredients) return;

    if (sessionRef.current || startingRef.current) {
      operationRef.current++;
      sessionRef.current?.stop();
      sessionRef.current = undefined;
      startingRef.current = false;
      setPlaying(false);
      setSpeaking(false);
      setWaiting(false);
      return;
    }

    const operation = ++operationRef.current;
    startingRef.current = true;
    setError(undefined);
    setPlaying(true);
    const request = {
      recipe: recipeId
        ? { case: "recipeId" as const, value: recipeId }
        : { case: "planId" as const, value: planId },
      modelProvider: settings.useOpenAI
        ? StartChatRequest_ModelProvider.OPENAI
        : StartChatRequest_ModelProvider.GOOGLE_GENAI,
      llmPrompt: prompt,
      model: settings.model,
    };

    try {
      if (settings.useOpenAI && settings.model === "gpt-live-1") {
        const reset = (sessionError?: Error) => {
          if (operationRef.current !== operation) return;
          operationRef.current++;
          sessionRef.current = undefined;
          startingRef.current = false;
          setPlaying(false);
          setSpeaking(false);
          setWaiting(false);
          if (sessionError) setError(sessionError.message);
        };
        const session = new OpenAILiveSession({
          navigateToStep,
          navigateToIngredients,
          microphoneDeviceId: settings.microphoneDeviceId || undefined,
          speakerDeviceId: settings.speakerDeviceId || undefined,
          createSession: (sdpOffer, signal) =>
            frontendQueries.startChatSession({ ...request, sdpOffer }, signal),
          onError: reset,
          onClosed: () => reset(),
        });
        sessionRef.current = session;
        await session.start();
        if (operationRef.current === operation) setWaiting(true);
      } else {
        const res = await queryClient.fetchQuery({
          ...frontendQueries.startChat(request),
          staleTime: 0,
          retry: false,
        });
        if (operationRef.current !== operation) return;
        if (settings.useOpenAI) {
          const session = new OpenAIRealtimeSession();
          sessionRef.current = session;
          await session.start({
            apiKey: res.chatApiKey,
            model: res.chatModel,
            instructions: res.chatInstructions,
            startMessage: res.startMessage,
            navigateToStep,
            navigateToIngredients,
          });
        } else {
          const session = new ChatStream(
            res.chatApiKey,
            res.chatModel,
            res.startMessage,
            navigateToStep,
            navigateToIngredients,
            setSpeaking,
            setWaiting,
            settings.microphoneDeviceId || undefined,
          );
          sessionRef.current = session;
          await session.start();
        }
      }
    } catch (err) {
      if (operationRef.current !== operation) return;
      sessionRef.current?.stop();
      sessionRef.current = undefined;
      setPlaying(false);
      setSpeaking(false);
      setWaiting(false);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (operationRef.current === operation) startingRef.current = false;
    }
  }, [
    queryClient,
    frontendQueries,
    recipeId,
    planId,
    navigateToStep,
    navigateToIngredients,
    prompt,
    settings,
  ]);

  useEffect(
    () => () => {
      operationRef.current++;
      sessionRef.current?.stop();
      sessionRef.current = undefined;
      startingRef.current = false;
    },
    [],
  );

  return (
    <div
      className={twMerge(
        "flex flex-col items-center gap-2 text-yellow font-semibold",
        className,
      )}
    >
      {error && (
        <p role="alert" className="text-red-600 text-sm">
          {error}
        </p>
      )}
      <div className="relative">
        {/* Play animation after assistant finishes speaking. */}
        {playing && waiting && <span className="mic-ping" />}
        <button
          type="button"
          onClick={onClick}
          className={twMerge(
            playing && speaking ? "bg-gray-400" : "bg-yellow-400",
            "z-10 rounded-full size-18 md:size-50 flex items-center justify-center cursor-pointer",
          )}
        >
          {!playing ? (
            <HiMicrophone className="text-white size-6 md:size-16" />
          ) : waiting ? (
            <div className="text-white text-lg">話して</div>
          ) : (
            <HiStop className="text-white size-6 md:size-16" />
          )}
        </button>
      </div>
      <button
        type="button"
        onClick={onClick}
        className={twMerge(
          "rounded-2xl py-1 px-2 bg-yellow-400 font-light text-white text-xs",
          playing && "invisible",
        )}
      >
        COOPiiと話す
      </button>
    </div>
  );
}
