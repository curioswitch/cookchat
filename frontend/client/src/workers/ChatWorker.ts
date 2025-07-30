import {
  GoogleGenAI,
  type LiveServerMessage,
  type Session,
} from "@google/genai";

class ChatStream {
  private session!: Session;

  constructor(
    private genAI: GoogleGenAI,
    private model: string,
    private startMessage: string,
  ) {}

  async start() {
    console.log("Starting chat stream with model:", this.model);
    this.session = await this.genAI.live.connect({
      model: this.model,
      callbacks: {
        onmessage: (e: LiveServerMessage) => {
          console.log(e);
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
  stream = new ChatStream(genAI, request.model, request.startMessage);
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
