import {
  GoogleGenAI,
  type LiveServerMessage,
  type Session,
} from "@google/genai";
import { Button } from "@heroui/button";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { useFrontendQueries } from "../../../hooks/rpc";

function convertFloat32ToInt16(float32Array: Float32Array): Int16Array {
  const int16Array = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    int16Array[i] = Math.max(-32768, Math.min(32767, float32Array[i] * 32768)); // Scale and clamp
  }
  return int16Array;
}

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
  private readonly audio = new Audio();

  private nextStartTime = this.audioCtx.currentTime;

  private playing = false;
  private queue: Float32Array[] = [];

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
        break;
      }
      // Create an AudioBuffer (Assuming 1 channel and 24k sample rate)
      const audioBuffer = this.audioCtx.createBuffer(1, chunk.length, 24000);
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
    await this.audioPlayer.stop();
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
