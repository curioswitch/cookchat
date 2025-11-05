import { timestampFromDate } from "@bufbuild/protobuf/wkt";
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

class ChatStream implements ChatSession {
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

    private readonly navigateToStep: (idx: number, idx2: number) => void,
    private readonly navigateToIngredients: () => void,
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
    // the I/O itself could be separated, but not since it's a single websocket, so we try to
    // simulate that by leaving out as much processing as we can.

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
            const step = call.args.step as number;
            const group = call.args.group as number;
            this.navigateToStep(step, group);
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
  planId,
  navigateToStep,
  navigateToIngredients,
  prompt,
}: {
  className?: string;
  recipeId: string;
  planId: string;
  navigateToStep?: (idx: number, idx2: number) => void;
  navigateToIngredients?: () => void;
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
    if (!navigateToStep || !navigateToIngredients) {
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
        recipe: recipeId
          ? {
              case: "recipeId",
              value: recipeId,
            }
          : {
              case: "planId",
              value: timestampFromDate(new Date(planId)),
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
                  description: planId
                    ? "The index of the step within the group to navigate to, starting from 0."
                    : "The index of the step to navigate to, starting from 0.",
                },
                group: planId
                  ? {
                      type: "integer",
                      description:
                        "The index of the group containing the step to navigate to, starting from 0.",
                    }
                  : undefined,
              },
              additionalProperties: false,
              required: planId ? ["step", "group"] : ["step"],
            },
            strict: false,
            needsApproval: async () => false,
            invoke: async (_, input) => {
              const req = JSON.parse(input);
              navigateToStep(req.step, req.group);
              return "Done";
            },
          },
          {
            name: "navigate_to_ingredients",
            description: "Navigate the UI to the ingredients section.",
            type: "function",
            parameters: {
              type: "object",
              properties: {},
              additionalProperties: false,
              required: [],
            },
            strict: false,
            needsApproval: async () => false,
            invoke: async () => {
              navigateToIngredients();
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
        navigateToIngredients,
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
    planId,
    navigateToStep,
    navigateToIngredients,
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
        "flex flex-col items-center gap-2 text-primary font-semibold",
        className,
      )}
    >
      <div className="relative">
        {/* Play animation after assistant finishes speaking. */}
        {playing && waiting && <span className="mic-ping" />}
        <button
          type="button"
          onClick={onClick}
          className={twMerge(
            playing && speaking
              ? "bg-gray-400"
              : "bg-linear-to-r from-[#f97316] to-[#fb923c]",
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
          "rounded-2xl py-1 px-2 bg-[#ea580c] font-light text-white !text-tiny",
          playing && "invisible",
        )}
      >
        COOPiiと話す
      </button>
    </div>
  );
}
