import { StartChatRequest_ModelProvider } from "@cookchat/frontend-api";
import { RealtimeAgent, RealtimeSession } from "@openai/agents-realtime";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { HiMicrophone, HiStop } from "react-icons/hi2";
import { twMerge } from "tailwind-merge";

import type { ChatEvent } from "../../events";
import { useFrontendQueries } from "../../hooks/rpc";
import { useSettingsStore } from "../../stores";
import ChatWorker from "../../workers/ChatWorker?worker";
import MicWorker from "../../workers/MicWorker?worker";
import MicWorkletURL from "../../workers/MicWorklet?worker&url";
import SpeakerWorker from "../../workers/SpeakerWorker?worker";
import SpeakerWorkletURL from "../../workers/SpeakerWorklet?worker&url";

function convertPCM16ToFloat32(pcm: Uint8Array): Float32Array {
  const length = pcm.length / 2; // 16-bit audio, so 2 bytes per sample
  const float32AudioData = new Float32Array(length);

  for (let i = 0; i < length; i++) {
    // Combine two bytes into one 16-bit signed integer (little-endian)
    let sample = pcm[i * 2] | (pcm[i * 2 + 1] << 8);
    // Convert from 16-bit PCM to Float32 (range -1 to 1)
    if (sample >= 32768) sample -= 65536;
    float32AudioData[i] = sample / 32768;
  }
  return float32AudioData;
}

function base64Decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

class AudioPlayer {
  private readonly audioCtx = new AudioContext();

  private nextStartTime = this.audioCtx.currentTime;

  private playing = false;
  private queue: Float32Array[] = [];

  async setSpeaker(speakerDeviceId: string) {
    await this.audioCtx.setSinkId?.(speakerDeviceId);
  }

  add(chunk: Uint8Array) {
    if (this.audioCtx.state === "closed") {
      return;
    }
    this.queue.push(convertPCM16ToFloat32(chunk));
    if (!this.playing) {
      this.play();
    }
  }

  play() {
    this.playing = true;
    while (this.queue.length > 0) {
      if (this.audioCtx.state === "closed") {
        this.queue = [];
        break;
      }

      const chunk = this.queue.shift();
      if (!chunk) {
        continue;
      }
      // Create an AudioBuffer (Assuming 1 channel and 24k sample rate)
      const audioBuffer = this.audioCtx.createBuffer(1, chunk.length, 24_000);
      audioBuffer.copyToChannel(chunk, 0);
      const source = this.audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioCtx.destination);
      if (this.nextStartTime < this.audioCtx.currentTime) {
        this.nextStartTime = this.audioCtx.currentTime;
      }
      source.start(this.nextStartTime);
      this.nextStartTime += audioBuffer.duration;
    }
    this.playing = false;
  }

  async stop() {
    await this.audioCtx.close();
  }
}

class ChatStream {
  private readonly audioContext: AudioContext;

  private micSource: MediaStreamAudioSourceNode | undefined;
  private micWorklet: AudioWorkletNode | undefined;
  private micWorker: Worker | undefined;
  private chatWorker: Worker | undefined;
  private speakerWorker: Worker | undefined;
  private speakerWorklet: AudioWorkletNode | undefined;

  private stopped?: boolean;

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly startMessage: string,

    private readonly navigateToStep: (idx: number) => void,
    private readonly setSpeaking: (speaking: boolean) => void,
    private readonly setWaiting: (waiting: boolean) => void,
    private readonly microphoneDeviceId?: string,
  ) {
    this.audioContext = new AudioContext();
  }

  async start() {
    // We start 5 threads to process audio, two realtime threads for mic input and speaker output,
    // two workers for processing mic audio and speaker audio, and one worker for I/O with the
    // websocket. The two workers are notably separated to ensure realtime threads don't get busy
    // and mic and speaker processing have as little effect on each other as possible. Ideally,
    // the I/O itself could be separated, but not since it's a single websocket.

    const micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: this.microphoneDeviceId
          ? { exact: this.microphoneDeviceId }
          : undefined,
      },
    });
    const audioContext = this.audioContext;
    this.micSource = audioContext.createMediaStreamSource(micStream);
    await audioContext.audioWorklet.addModule(MicWorkletURL);
    await audioContext.audioWorklet.addModule(SpeakerWorkletURL);
    this.micWorklet = new AudioWorkletNode(audioContext, "mic-worklet");
    this.micSource.connect(this.micWorklet);

    const micWorkerChannel = new MessageChannel();
    this.micWorker = new MicWorker();
    this.micWorker.postMessage(
      {
        type: "init",
        sampleRate: audioContext.sampleRate,
        micPort: this.micWorklet.port,
        chatPort: micWorkerChannel.port1,
      },
      [micWorkerChannel.port1, this.micWorklet.port],
    );

    const speakerWorkerChannel = new MessageChannel();
    this.speakerWorklet = new AudioWorkletNode(audioContext, "speaker-worklet");
    this.speakerWorklet.connect(audioContext.destination);

    this.chatWorker = new ChatWorker();
    this.chatWorker.postMessage(
      {
        type: "init",
        apiKey: this.apiKey,
        model: this.model,
        startMessage: this.startMessage,
        micPort: micWorkerChannel.port2,
        speakerPort: speakerWorkerChannel.port1,
      },
      [micWorkerChannel.port2, speakerWorkerChannel.port1],
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
            const idx = call.args.step as number;
            this.navigateToStep(idx);
          }
          break;
        }
        case "turnComplete":
          this.setSpeaking(false);
          this.setWaiting(true);
          break;
      }
    };

    this.speakerWorker = new SpeakerWorker();
    this.speakerWorker.postMessage(
      {
        type: "init",
        sampleRate: audioContext.sampleRate,
        chatPort: speakerWorkerChannel.port2,
        speakerPort: this.speakerWorklet.port,
      },
      [this.speakerWorklet.port, speakerWorkerChannel.port2],
    );
  }

  async stop() {
    if (this.stopped) {
      return;
    }
    this.stopped = true;
    if (this.micWorklet) {
      this.micWorklet.disconnect();
    }
    if (this.micWorker) {
      this.micWorker.terminate();
    }
    if (this.chatWorker) {
      this.chatWorker.terminate();
    }
    if (this.speakerWorker) {
      this.speakerWorker.terminate();
    }
    if (this.speakerWorklet) {
      this.speakerWorklet.disconnect();
    }
    await this.audioContext.close();
  }
}

interface ChatSession {
  stop(): void;
}

class OpenAISession implements ChatSession {
  constructor(private readonly session: RealtimeSession) {}

  stop(): void {
    this.session.close();
  }
}

export function ChatButton({
  className,
  recipeId,
  navigateToStep,
  prompt,
}: {
  className?: string;
  recipeId: string;
  navigateToStep?: (idx: number) => void;
  prompt?: string;
}) {
  const [stream, setStream] = useState<ChatSession | undefined>(undefined);
  const [playing, setPlaying] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [waiting, setWaiting] = useState(false);

  const frontendQueries = useFrontendQueries();
  const queryClient = useQueryClient();
  const settings = useSettingsStore();

  const onClick = useCallback(async () => {
    if (!navigateToStep) {
      return;
    }

    if (stream) {
      stream.stop();
      setStream(undefined);
      setPlaying(false);
      setSpeaking(false);
      setWaiting(false);
      return false;
    }

    setPlaying(true);

    const modelProvider = settings.useOpenAI
      ? StartChatRequest_ModelProvider.OPENAI
      : StartChatRequest_ModelProvider.GOOGLE_GENAI;

    const res = await queryClient.fetchQuery({
      ...frontendQueries.startChat({
        recipe: {
          case: "recipeId",
          value: recipeId,
        },
        modelProvider,
        llmPrompt: prompt,
      }),
      staleTime: 0,
    });

    if (modelProvider === StartChatRequest_ModelProvider.OPENAI) {
      const agent = new RealtimeAgent({
        name: "CookChat",
        instructions: res.chatInstructions,
        voice: "sage",
        tools: [
          {
            name: "navigate_to_step",
            description: "Navigate the UI to a specific step in the recipe.",
            type: "function",
            parameters: {
              type: "object",
              properties: {
                step: {
                  type: "integer",
                  description:
                    "The index of the step to navigate to, starting from 0.",
                },
              },
              additionalProperties: false,
              required: ["step"],
            },
            strict: false,
            needsApproval: async () => false,
            invoke: async (_, input) => {
              const req = JSON.parse(input);
              navigateToStep(req.step);
              return "Done";
            },
          },
        ],
      });
      const session = new RealtimeSession(agent, {
        model: res.chatModel,
      });
      await session.connect({ apiKey: res.chatApiKey });
      session.sendMessage(res.startMessage);
      setStream(new OpenAISession(session));
    } else {
      const s = new ChatStream(
        res.chatApiKey,
        res.chatModel,
        res.startMessage,
        navigateToStep,
        setSpeaking,
        setWaiting,
        settings.microphoneDeviceId !== ""
          ? settings.microphoneDeviceId
          : undefined,
      );
      await s.start();
      setStream(s);
    }
    return false;
  }, [
    queryClient,
    frontendQueries,
    stream,
    recipeId,
    navigateToStep,
    prompt,
    settings,
  ]);

  useEffect(() => {
    return () => {
      if (stream) {
        stream.stop();
      }
    };
  }, [stream]);

  return (
    <div
      className={twMerge(
        "relative flex items-center gap-2 text-primary font-semibold",
        className,
      )}
    >
      {/* Play animation after assistant finishes speaking. */}
      {playing && waiting && <span className="mic-ping" />}
      <button
        type="button"
        onClick={onClick}
        className={twMerge(
          playing && speaking ? "mic-bubble-deselected" : "mic-bubble",
          "z-10 flex-1/3 size-30 md:size-50 flex items-center justify-center cursor-pointer",
        )}
      >
        {!playing ? (
          <HiMicrophone className="text-white size-6 md:size-16" />
        ) : waiting ? (
          <div className="text-white text-4xl">話して</div>
        ) : (
          <HiStop className="text-white size-6 md:size-16" />
        )}
      </button>
    </div>
  );
}
