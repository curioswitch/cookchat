import {
  GoogleGenAI,
  type LiveServerMessage,
  type Session,
} from "@google/genai";

function base64Decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
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

class ChatStream {
  private session!: Session;

  constructor(
    private genAI: GoogleGenAI,
    private model: string,
    private startMessage: string,
    private speakerPort: MessagePort,
  ) {}

  async start() {
    console.log("Starting chat stream with model:", this.model);
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
          }

          const inlineData = e.serverContent?.modelTurn?.parts?.[0]?.inlineData;
          const mimeType = inlineData?.mimeType;
          if (inlineData?.data && mimeType?.startsWith("audio/pcm")) {
            const decoded = convertPCM16ToFloat32(
              base64Decode(inlineData.data),
            );
            this.speakerPort.postMessage(decoded);
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
  speakerPort: MessagePort;
};

type CloseWorkerEvent = {
  type: "close";
};

let stream: ChatStream;

async function init(request: InitEvent) {
  console.log("init");
  const genAI = new GoogleGenAI({
    apiKey: request.apiKey,
    apiVersion: "v1alpha",
  });
  stream = new ChatStream(
    genAI,
    request.model,
    request.startMessage,
    request.speakerPort,
  );
  await stream.start();
}

async function processMessage(
  event: MessageEvent<InitEvent | CloseWorkerEvent>,
) {
  const data = event.data;
  console.log(data);
  switch (data.type) {
    case "init": {
      return await init(data);
    }
  }
}

self.onmessage = (event: MessageEvent<InitEvent | CloseWorkerEvent>) => {
  console.log("onmessage");
  processMessage(event);
};
