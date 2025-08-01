import {
  GoogleGenAI,
  type LiveServerMessage,
  type Session,
} from "@google/genai";

import type {
  AudioStartEvent,
  ToolCallEvent,
  TurnCompleteEvent,
} from "../events";

type MicEvent = {
  data: string;
};

class ChatStream {
  private session!: Session;

  constructor(
    private genAI: GoogleGenAI,
    private model: string,
    private startMessage: string,
    private micPort: MessagePort,
    private speakerPort: MessagePort,
  ) {}

  async start() {
    let receivingAudio = false;
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
            this.micPort.onmessage = (e: MessageEvent<MicEvent>) => {
              if (receivingAudio) {
                return;
              }
              this.session.sendRealtimeInput({
                audio: {
                  mimeType: "audio/pcm",
                  data: e.data.data,
                },
              });
            };
          }

          const toolCall = e.toolCall?.functionCalls?.[0];
          if (toolCall) {
            self.postMessage({
              type: "toolCall",
              call: toolCall,
            } satisfies ToolCallEvent);
          }

          const inlineData = e.serverContent?.modelTurn?.parts?.[0]?.inlineData;
          const mimeType = inlineData?.mimeType;
          if (inlineData?.data && mimeType?.startsWith("audio/pcm")) {
            if (!receivingAudio) {
              self.postMessage({
                type: "audioStart",
              } satisfies AudioStartEvent);
              receivingAudio = true;
            }
            this.speakerPort.postMessage(inlineData.data);
          }

          if (e.serverContent?.turnComplete) {
            self.postMessage({
              type: "turnComplete",
            } satisfies TurnCompleteEvent);
            receivingAudio = false;
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
  speakerPort: MessagePort;
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
    request.speakerPort,
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
  console.log("onmessage");
  processMessage(event);
};
