import { create } from "@bufbuild/protobuf";
import { ChatRequestSchema } from "@cookchat/frontend-api";
import {
  GoogleGenAI,
  type LiveServerMessage,
  type Session,
} from "@google/genai";
import { Button } from "@heroui/button";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useChatService, useFrontendQueries } from "../../../hooks/rpc";

function convertFloat32ToInt16(float32Array: Float32Array): Int16Array {
  const int16Array = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    int16Array[i] = Math.max(-32768, Math.min(32767, float32Array[i] * 32768)); // Scale and clamp
  }
  return int16Array;
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

async function* chatRequestStream(
  recipeId: string,
  processor: ScriptProcessorNode,
  end: Promise<true>,
) {
  let dataPromise: PromiseWithResolvers<Int16Array> = Promise.withResolvers();
  processor.onaudioprocess = (e: AudioProcessingEvent) => {
    const dataFloat32 = e.inputBuffer.getChannelData(0);
    const dataPCM16 = convertFloat32ToInt16(dataFloat32);
    dataPromise.resolve(dataPCM16);
    dataPromise = Promise.withResolvers();
  };
  yield create(ChatRequestSchema, {
    recipe: {
      case: "recipeId",
      value: recipeId,
    },
  });
  while (true) {
    const result = await Promise.any([dataPromise.promise, end]);
    if (result === true) {
      return;
    }
    yield create(ChatRequestSchema, {
      content: {
        payload: {
          case: "audio",
          value: new Uint8Array(result.buffer),
        },
      },
    });
  }
}

interface StreamContext {
  audioContext: AudioContext;
  audioProcessor: ScriptProcessorNode;
  source: MediaStreamAudioSourceNode;
  end: PromiseWithResolvers<true>;
  closed?: boolean;
}

function mergeUint8Array(arrays: Uint8Array[]) {
  const totalSize = arrays.reduce((acc, e) => acc + e.length, 0);
  const merged = new Uint8Array(totalSize);

  arrays.forEach((array, i, arrays) => {
    const offset = arrays.slice(0, i).reduce((acc, e) => acc + e.length, 0);
    merged.set(array, offset);
  });

  return merged;
}

class AudioPlayer {
  private readonly audio = new Audio();

  private playing = false;
  private closed = false;
  private queue: Uint8Array[] = [];

  add(chunk: Uint8Array) {
    if (this.closed) {
      return;
    }
    this.queue.push(chunk);
    this.play();
  }

  play() {
    if (!this.closed && !this.playing && this.queue.length > 0) {
      this.playing = true;
      const audioWav = AudioPlayer.encodeAudio(this.queue, 24_000, 16, 1);
      this.queue = [];
      this.audio.src = URL.createObjectURL(audioWav);
      this.audio.onended = () => {
        this.playing = false;
        this.play();
      };
      this.audio.play();
    }
  }

  start() {
    this.closed = false;
  }

  stop() {
    if (this.playing) {
      this.audio.pause();
      this.audio.src = "";
      this.playing = false;
    }
    this.queue = [];
    this.closed = true;
  }

  private static encodeAudio(
    queue: Uint8Array[],
    sampleRate: number,
    bitDepth: number,
    numChannels: number,
  ) {
    const audioData = mergeUint8Array(queue);

    const dataSize = audioData.length;
    const fileSize = dataSize + 36;
    const blockAlign = (numChannels * bitDepth) / 8;
    const byteRate = sampleRate * blockAlign;

    const buffer = new ArrayBuffer(44);
    const view = new DataView(buffer);

    function writeString(offset: number, string: string) {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    }

    writeString(0, "RIFF");
    view.setUint32(4, fileSize, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(36, "data");
    view.setUint32(40, dataSize, true);

    const mergedData = mergeUint8Array([new Uint8Array(buffer), audioData]);

    return new Blob([mergedData.buffer], { type: "audio/wav" });
  }
}

class ChatStream {
  private readonly audioPlayer: AudioPlayer;
  private readonly audioContext: AudioContext;

  private audioSource!: MediaStreamAudioSourceNode;
  private audioProcessor!: ScriptProcessorNode;
  private session!: Session;

  private stopped?: boolean;

  constructor(
    private readonly genAI: GoogleGenAI,
    private readonly model: string,
  ) {
    this.audioPlayer = new AudioPlayer();
    this.audioContext = new AudioContext({ sampleRate: 16_000 });
  }

  async start() {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });
    const audioContext = new AudioContext({ sampleRate: 16000 });
    this.audioSource = audioContext.createMediaStreamSource(stream);
    this.audioProcessor = audioContext.createScriptProcessor(1024, 1, 1);
    this.audioSource.connect(this.audioProcessor);
    this.audioProcessor.connect(audioContext.destination);

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
                      text: "こんにちは！",
                    },
                  ],
                },
              ],
              turnComplete: true,
            });
            this.audioProcessor.onaudioprocess = (e: AudioProcessingEvent) => {
              const dataFloat32 = e.inputBuffer.getChannelData(0);
              const dataPCM16 = convertFloat32ToInt16(dataFloat32);
              const data = new Uint8Array(
                dataPCM16.buffer,
                dataPCM16.byteOffset,
                dataPCM16.byteLength,
              );
              this.session.sendRealtimeInput({
                audio: {
                  mimeType: "audio/pcm",
                  data: btoa(
                    data.reduce(
                      (acc, val) => acc + String.fromCharCode(val),
                      "",
                    ),
                  ),
                },
              });
            };
            return;
          }
          const inlineData = e.serverContent?.modelTurn?.parts?.[0]?.inlineData;
          const mimeType = inlineData?.mimeType;
          if (inlineData?.data && mimeType?.startsWith("audio/pcm")) {
            this.audioPlayer.add(base64Decode(inlineData.data));
          }
        },

        onclose: (e: CloseEvent) => {},

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
    this.audioPlayer.stop();
    this.audioSource.disconnect();
    this.audioProcessor.disconnect();
    await this.audioContext.close();
    if (this.session) {
      this.session.close();
    }
  }
}

export default function ChatButton({ recipeId }: { recipeId: string }) {
  const [stream, setStream] = useState<ChatStream | undefined>(undefined);

  const frontendQueries = useFrontendQueries();
  const queryClient = useQueryClient();

  const onClick = useCallback(async () => {
    if (stream) {
      stream.stop();
      setStream(undefined);
      return false;
    }
    const res = await queryClient.fetchQuery({
      ...frontendQueries.startChat({
        recipe: {
          case: "recipeId",
          value: recipeId,
        },
      }),
      staleTime: 0,
    });
    const genai = new GoogleGenAI({
      apiKey: res.chatApiKey,
      apiVersion: "v1alpha",
    });
    const s = new ChatStream(genai, res.chatModel);
    await s.start();
    setStream(s);
    return false;
  }, [queryClient, frontendQueries, stream, recipeId]);

  useEffect(() => {
    return () => {
      if (stream) {
        stream.stop();
      }
    };
  }, [stream]);

  return (
    <Button fullWidth onPress={onClick}>
      お喋り{stream ? "終了" : "スタート"}
    </Button>
  );
}
