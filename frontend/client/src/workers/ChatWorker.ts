import {
  GoogleGenAI,
  type LiveServerMessage,
  type Session,
} from "@google/genai";
import { AudioWriter, RingBuffer } from "ringbuf.js";

import type {
  AudioStartEvent,
  ToolCallEvent,
  TurnCompleteEvent,
} from "../events";

type MicEvent = {
  data: Float32Array;
};

class ChatStream {
  private readonly speakerWriter: AudioWriter;

  private session!: Session;

  constructor(
    private genAI: GoogleGenAI,
    private model: string,
    private startMessage: string,
    private micPort: MessagePort,
    outputBuffer: SharedArrayBuffer,
  ) {
    this.speakerWriter = new AudioWriter(
      new RingBuffer(outputBuffer, Float32Array),
    );
  }

  async start() {
    let receivingAudio = false;
    let isInitialTurn = true;
    this.session = await this.genAI.live.connect({
      model: this.model,
      callbacks: {
        onmessage: (e: LiveServerMessage) => {
          if (e.setupComplete) {
            this.session.sendRealtimeInput({
              text: this.startMessage,
            });
            this.micPort.onmessage = (e: MessageEvent<Float32Array>) => {
              if (receivingAudio || isInitialTurn) {
                return;
              }
              this.session.sendRealtimeInput({
                audio: {
                  mimeType: "audio/pcm",
                  data: b64Encode(float32ToPcm16(e.data)),
                },
              });
            };
          }

          const toolCall = e.toolCall?.functionCalls?.[0];
          if (toolCall) {
            this.session.sendToolResponse({
              functionResponses: {
                id: toolCall.id,
                name: toolCall.name,
                response: {
                  status: "Done",
                },
              },
            });
            self.postMessage({
              type: "toolCall",
              call: toolCall,
            } satisfies ToolCallEvent);
          }

          const parts = e.serverContent?.modelTurn?.parts;
          if (parts) {
            for (const part of parts) {
              const inlineData = part.inlineData;
              const mimeType = inlineData?.mimeType;
              if (inlineData?.data && mimeType?.startsWith("audio/pcm")) {
                if (!receivingAudio) {
                  self.postMessage({
                    type: "audioStart",
                  } satisfies AudioStartEvent);
                  receivingAudio = true;
                }
                const pcmData = base64Decode(inlineData.data);
                const float32Data = pcm16ToFloat32(pcmData);
                this.speakerWriter.enqueue(float32Data);
              }
            }
          }

          if (e.serverContent?.turnComplete) {
            self.postMessage({
              type: "turnComplete",
            } satisfies TurnCompleteEvent);
            receivingAudio = false;
            isInitialTurn = false;
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
    this.session?.close();
  }
}

type InitEvent = {
  type: "init";
  apiKey: string;
  model: string;
  startMessage: string;
  micPort: MessagePort;
  outputBuffer: SharedArrayBuffer;
};

type CloseWorkerEvent = {
  type: "close";
};

let stream: ChatStream;

async function init(request: InitEvent) {
  const genAI = new GoogleGenAI({
    apiKey: request.apiKey,
    apiVersion: "v1alpha",
  });
  stream = new ChatStream(
    genAI,
    request.model,
    request.startMessage,
    request.micPort,
    request.outputBuffer,
  );
  await stream.start();
}

async function processMessage(
  event: MessageEvent<InitEvent | CloseWorkerEvent>,
) {
  const data = event.data;
  switch (data.type) {
    case "init": {
      return await init(data);
    }
  }
}

self.onmessage = (event: MessageEvent<InitEvent | CloseWorkerEvent>) => {
  processMessage(event);
};

function pcm16ToFloat32(pcm: Uint8Array): Float32Array {
  const length = pcm.length / 2; // 16-bit audio, so 2 bytes per sample
  const float32AudioData = new Float32Array(length);
  const view = new DataView(pcm.buffer);

  for (let i = 0; i < length; i++) {
    const s = view.getInt16(i * 2, true); // little-endian
    float32AudioData[i] = s < 0 ? s / 0x8000 : s / 0x7fff;
  }
  return float32AudioData;
}

function float32ToPcm16(float32AudioData: Float32Array): Uint8Array {
  const pcm16 = new Int16Array(float32AudioData.length);

  for (let i = 0; i < float32AudioData.length; i++) {
    const s = Math.max(-1, Math.min(1, float32AudioData[i]));
    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }

  return new Uint8Array(pcm16.buffer);
}

function base64Decode(base64: string): Uint8Array {
  if (Uint8Array.fromBase64) {
    return Uint8Array.fromBase64(base64);
  }

  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function b64Encode(data: Uint8Array): string {
  if (data.toBase64) {
    return data.toBase64();
  }
  return btoa(String.fromCharCode(...data));
}
