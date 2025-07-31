import { StartChatRequest_ModelProvider } from "@cookchat/frontend-api";
import type { GoogleGenAI, LiveServerMessage, Session } from "@google/genai";
import { RealtimeAgent, RealtimeSession } from "@openai/agents-realtime";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { HiMicrophone, HiStop } from "react-icons/hi2";
import { twMerge } from "tailwind-merge";

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

  private audioSource!: MediaStreamAudioSourceNode;
  private micWorklet!: AudioWorkletNode;
  private session!: Session;

  private stopped?: boolean;

  constructor(
    private readonly audioPlayer: AudioPlayer,
    private readonly genAI: GoogleGenAI,
    private readonly model: string,
    private readonly startMessage: string,
    private readonly navigateToStep: (idx: number) => void,
    private readonly speakingRef: React.RefObject<boolean>,
    private readonly setSpeaking: (speaking: boolean) => void,
    private readonly setWaiting: (waiting: boolean) => void,
    private readonly microphoneDeviceId?: string,
  ) {
    this.audioContext = new AudioContext();
  }

  async start() {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: this.microphoneDeviceId
          ? { exact: this.microphoneDeviceId }
          : undefined,
      },
    });
    const audioContext = this.audioContext;
    this.audioSource = audioContext.createMediaStreamSource(stream);
    await audioContext.audioWorklet.addModule(MicWorkletURL);
    this.micWorklet = new AudioWorkletNode(audioContext, "mic-worklet");
    this.audioSource.connect(this.micWorklet);
    this.micWorklet.connect(audioContext.destination);

    this.session = await this.genAI.live.connect({
      model: this.model,
      callbacks: {
        onmessage: (e: LiveServerMessage) => {
          if (e.setupComplete) {
            this.session.sendClientContent({
              turns: [
                {
                  role: "user",
                  parts: [
                    {
                      text: this.startMessage,
                    },
                  ],
                },
              ],
              turnComplete: true,
            });
            this.micWorklet.port.onmessage = (e) => {
              if (this.speakingRef.current) {
                return;
              }
              if (e.data.event === "chunk") {
                this.session.sendRealtimeInput({
                  audio: {
                    mimeType: "audio/pcm",
                    data: btoa(e.data.data.str),
                  },
                });
              }
            };
            return;
          }
          const toolCall = e.toolCall?.functionCalls?.[0];
          if (toolCall?.name === "navigate_to_step" && toolCall.args) {
            const idx = toolCall.args.step as number;
            this.navigateToStep(idx);
          }

          const inlineData = e.serverContent?.modelTurn?.parts?.[0]?.inlineData;
          const mimeType = inlineData?.mimeType;
          if (inlineData?.data && mimeType?.startsWith("audio/pcm")) {
            this.setSpeaking(true);
            this.setWaiting(false);
            this.audioPlayer.add(base64Decode(inlineData.data));
          }
          if (e.serverContent?.turnComplete) {
            this.setSpeaking(false);
            this.setWaiting(true);
          }
        },

        onclose: (_e: CloseEvent) => {},

        onerror: (e: ErrorEvent) => {
          console.error("Error in live connection:", e);
        },
      },
    });
  }

  async stop() {
    if (this.stopped) {
      return;
    }
    this.stopped = true;
    await this.audioPlayer.stop();
    this.audioSource.disconnect();
    this.micWorklet.disconnect();
    await this.audioContext.close();
    if (this.session) {
      this.session.close();
    }
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
  const speakingRef = useRef(false);

  useEffect(() => {
    speakingRef.current = speaking;
  }, [speaking]);

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
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      const audioContext = new AudioContext();
      const micSource = audioContext.createMediaStreamSource(micStream);
      await audioContext.audioWorklet.addModule(MicWorkletURL);
      const micWorklet = new AudioWorkletNode(audioContext, "mic-worklet");
      micSource.connect(micWorklet);

      const micWorkerChannel = new MessageChannel();
      const micWorker = new MicWorker();
      console.log(micStream.getAudioTracks()[0].getSettings());
      micWorker.postMessage(
        {
          type: "init",
          sampleRate: audioContext.sampleRate,
          micPort: micWorklet.port,
          chatPort: micWorkerChannel.port1,
        },
        [micWorkerChannel.port1, micWorklet.port],
      );

      await audioContext.audioWorklet.addModule(SpeakerWorkletURL);

      const speakerWorkerChannel = new MessageChannel();

      const speakerNode = new AudioWorkletNode(audioContext, "speaker-worklet");
      speakerNode.connect(audioContext.destination);

      const chatWorker = new ChatWorker();
      chatWorker.postMessage(
        {
          type: "init",
          apiKey: res.chatApiKey,
          model: res.chatModel,
          startMessage: res.startMessage,
          micPort: micWorkerChannel.port2,
          speakerPort: speakerWorkerChannel.port1,
        },
        [micWorkerChannel.port2, speakerWorkerChannel.port1],
      );

      const speakerWorker = new SpeakerWorker();
      speakerWorker.postMessage(
        {
          type: "init",
          sampleRate: audioContext.sampleRate,
          chatPort: speakerWorkerChannel.port2,
          speakerPort: speakerNode.port,
        },
        [speakerNode.port, speakerWorkerChannel.port2],
      );

      /*

      const genai = new GoogleGenAI({
        apiKey: res.chatApiKey,
        apiVersion: "v1alpha",
      });
      const audioPlayer = new AudioPlayer();
      if (settings.speakerDeviceId !== "") {
        await audioPlayer.setSpeaker(settings.speakerDeviceId);
      }
      const s = new ChatStream(
        audioPlayer,
        genai,
        res.chatModel,
        res.startMessage,
        navigateToStep,
        speakingRef,
        setSpeaking,
        setWaiting,
        settings.microphoneDeviceId !== ""
          ? settings.microphoneDeviceId
          : undefined,
      );
      await s.start();
      setStream(s);
      */
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
        "flex items-center gap-2 text-primary font-semibold",
        className,
      )}
    >
      <button
        type="button"
        onClick={onClick}
        className={twMerge(
          playing && speaking ? "mic-bubble-deselected" : "mic-bubble",
          playing && waiting && "blinking",
          "flex-1/3 size-30 flex items-center justify-center cursor-pointer",
        )}
      >
        {!playing ? (
          <HiMicrophone className="text-white size-6" />
        ) : (
          <HiStop className="text-white size-6" />
        )}
      </button>
    </div>
  );
}
