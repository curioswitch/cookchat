// Keep the UI independent of SDK session types. Replace the Live adapter with an
// SDK implementation here when Live is supported by @openai/agents-realtime.
export interface ChatSession {
  stop(): void;
}

export type NavigationCallbacks = {
  navigateToStep: (index: number) => void;
  navigateToIngredients: () => void;
};

export function invokeNavigationTool(
  callbacks: NavigationCallbacks,
  name: string,
  input: string,
): string {
  const args = JSON.parse(input);
  switch (name) {
    case "navigate_to_step":
      if (!Number.isSafeInteger(args?.step) || args.step < 1) {
        throw new Error("Step must be a positive, 1-based integer.");
      }
      callbacks.navigateToStep(args.step - 1);
      return `Navigated to step ${args.step}. Read only that step.`;
    case "navigate_to_ingredients":
      callbacks.navigateToIngredients();
      return "Navigated to ingredients.";
    default:
      throw new Error(`Unknown navigation tool: ${name}`);
  }
}
