import { RealtimeAgent, RealtimeSession } from "@openai/agents-realtime";

import {
  type ChatSession,
  invokeNavigationTool,
  type NavigationCallbacks,
} from "./types";

type RealtimeSessionOptions = NavigationCallbacks & {
  apiKey: string;
  model: string;
  instructions: string;
  startMessage: string;
};

export class OpenAIRealtimeSession implements ChatSession {
  private session?: RealtimeSession;
  private stopped = false;

  async start(options: RealtimeSessionOptions): Promise<void> {
    const agent = new RealtimeAgent({
      name: "CookChat",
      instructions: options.instructions,
      tools: [
        {
          name: "navigate_to_step",
          description:
            "Call this immediately before reading any step aloud. Use 1-based indexes: the first step is 1, the second step is 2, and if the user asks for step 5 you must pass 5.",
          type: "function",
          parameters: {
            type: "object",
            properties: {
              step: {
                type: "integer",
                description:
                  "The index of the step to navigate to, starting from 1.",
              },
            },
            additionalProperties: false,
            required: ["step"],
          },
          strict: false,
          isEnabled: async () => true,
          needsApproval: async () => false,
          invoke: async (_, input) => {
            return invokeNavigationTool(options, "navigate_to_step", input);
          },
        },
        {
          name: "navigate_to_ingredients",
          description:
            "Call this immediately before reading the ingredients aloud.",
          type: "function",
          parameters: {
            type: "object",
            properties: {},
            additionalProperties: false,
            required: [],
          },
          strict: false,
          isEnabled: async () => true,
          needsApproval: async () => false,
          invoke: async () => {
            return invokeNavigationTool(
              options,
              "navigate_to_ingredients",
              "{}",
            );
          },
        },
      ],
    });
    this.session = new RealtimeSession(agent, {
      model: options.model,
    });
    await this.session.connect({ apiKey: options.apiKey });
    if (!this.stopped) this.session.sendMessage(options.startMessage);

    if (this.stopped) this.session.close();
  }

  stop(): void {
    this.stopped = true;
    this.session?.close();
  }
}
