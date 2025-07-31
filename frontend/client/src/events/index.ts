import type { FunctionCall } from "@google/genai";

export type ToolCallEvent = {
  type: "toolCall";
  call: FunctionCall;
};

export type TurnCompleteEvent = {
  type: "turnComplete";
};

export type AudioStartEvent = {
  type: "audioStart";
};

export type ChatEvent = AudioStartEvent | ToolCallEvent | TurnCompleteEvent;
