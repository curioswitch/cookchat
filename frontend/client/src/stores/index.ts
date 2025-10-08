import type { Recipe, RecipeSnippet } from "@cookchat/frontend-api";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CartIngredient = {
  name: string;
  quantity: string;
  selected: boolean;
};

export type CartRecipe = {
  id: string;
  title: string;
  servingSize: string;
  ingredients: CartIngredient[];
};

export type CartStore = {
  recipes: CartRecipe[];
  extraItems?: string[];
};

export const useCartStore = create<CartStore>()(
  persist(
    () => ({
      recipes: [] as CartRecipe[],
    }),
    {
      name: "cart-storage",
    },
  ),
);

export const addRecipeToCart = (recipe: Recipe) =>
  useCartStore.setState((state) => {
    const ingredients: CartIngredient[] = [
      ...recipe.ingredients.map((ingredient) => ({
        ...ingredient,
        selected: false,
      })),
      ...recipe.additionalIngredients.flatMap((section) =>
        section.ingredients.map((ingredient) => ({
          ...ingredient,
          selected: false,
        })),
      ),
    ];
    const cartRecipe = {
      id: recipe.id,
      title: recipe.title,
      servingSize: recipe.servingSize,
      ingredients,
    };
    return {
      recipes: [...state.recipes, cartRecipe],
    };
  });

export const removeRecipeFromCart = (recipeId: string) =>
  useCartStore.setState((state) => ({
    recipes: state.recipes.filter((recipe) => recipe.id !== recipeId),
  }));

export const addExtraItemToCart = (item: string) =>
  useCartStore.setState((state) => {
    const extraItems = state.extraItems ?? [];
    return {
      ...state,
      extraItems: [...extraItems, item],
    };
  });

export const removeExtraItemFromCart = (idx: number) =>
  useCartStore.setState((state) => {
    const extraItems = (state.extraItems ?? []).filter((_, i) => i !== idx);
    if (extraItems.length === 0) {
      return {
        ...state,
        extraItems: undefined,
      };
    }
    return {
      ...state,
      extraItems: extraItems,
    };
  });

export const toggleCartIngredientSelection = (
  recipeId: string,
  ingredientIndex: number,
) =>
  useCartStore.setState((state) => {
    const recipe = state.recipes.find((r) => r.id === recipeId);
    if (!recipe) {
      return state;
    }

    const ingredients = [...recipe.ingredients];
    ingredients[ingredientIndex].selected =
      !ingredients[ingredientIndex].selected;

    return {
      ...state,
      recipes: state.recipes.map((r) =>
        r.id === recipeId ? { ...r, ingredients } : r,
      ),
    };
  });

export type SettingsStore = {
  speakerDeviceId: string;
  microphoneDeviceId: string;
  useOpenAI: boolean;
};

export const setSpeakerDeviceId = (deviceId: string) =>
  useSettingsStore.setState({ speakerDeviceId: deviceId });

export const setMicrophoneDeviceId = (deviceId: string) =>
  useSettingsStore.setState({ microphoneDeviceId: deviceId });

export const setUseOpenAI = (useOpenAI: boolean) =>
  useSettingsStore.setState({ useOpenAI });

export const useSettingsStore = create<SettingsStore>()(
  persist(
    () => ({
      speakerDeviceId: "",
      microphoneDeviceId: "",
      useOpenAI: false as boolean,
    }),
    {
      name: "settings-storage",
      onRehydrateStorage() {
        return (state) => {
          async function validateDevices(state: SettingsStore) {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioOutputDevices = devices.filter(
              (device) => device.kind === "audiooutput",
            );
            const audioInputDevices = devices.filter(
              (device) => device.kind === "audioinput",
            );

            if (
              !audioOutputDevices.some(
                (device) => device.deviceId === state.speakerDeviceId,
              )
            ) {
              setSpeakerDeviceId("");
            }
            if (
              !audioInputDevices.some(
                (device) => device.deviceId === state.microphoneDeviceId,
              )
            ) {
              setMicrophoneDeviceId("");
            }
          }
          if (state?.speakerDeviceId || state?.microphoneDeviceId) {
            validateDevices(state);
          }
        };
      },
    },
  ),
);

export type Chat = {
  currentRecipeId: string;
  prompt: string;
  navigateToStep: ((idx: number) => void) | undefined;
};

export const useChatStore = create<Chat>()(() => ({
  currentRecipeId: "",
  prompt: "",
  navigateToStep: undefined,
}));

export const setCurrentRecipe = (
  recipeId: string,
  navigateToStep: (idx: number) => void,
) => {
  useChatStore.setState({ currentRecipeId: recipeId, navigateToStep });
};

export const setPrompt = (prompt: string) => {
  useChatStore.setState({ prompt });
};

export const clearCurrentRecipe = () => {
  useChatStore.setState({
    currentRecipeId: "",
    prompt: "",
    navigateToStep: undefined,
  });
};

export type PlanRecipe = {
  id: string;
  title: string;
  imageUrl: string;
};

export type PlanStore = {
  recipes: PlanRecipe[];
  numDays: number;
  ingredients: string;
  genres: string[];
};

export const usePlanStore = create<PlanStore>()(() => ({
  recipes: [],
  numDays: 1,
  ingredients: "",
  genres: [],
}));

export const addPlanRecipe = (recipe: PlanRecipe) => {
  if (usePlanStore.getState().recipes.find((r) => r.id === recipe.id)) {
    return;
  }
  usePlanStore.setState((state) => ({
    recipes: [...state.recipes, recipe],
  }));
};

export const setPlanDays = (days: number) => {
  usePlanStore.setState({ numDays: days });
};

export const setPlanIngredients = (ingredients: string) =>
  usePlanStore.setState({ ingredients });

export const setPlanGenres = (genres: string[]) =>
  usePlanStore.setState({ genres });

export const clearPlanRecipes = () => {
  usePlanStore.setState({ recipes: [] });
};

export type EditPlanStore = {
  editing: boolean;
  planId: string;
  recipes: RecipeSnippet[];
};

export const useEditPlanStore = create<EditPlanStore>(() => ({
  editing: false,
  planId: "",
  recipes: [],
}));

export const enableEditPlan = (planId: string, recipes: RecipeSnippet[]) => {
  useEditPlanStore.setState({ editing: true, planId, recipes });
};

export const disableEditPlan = () => {
  useEditPlanStore.setState({ editing: false, planId: "", recipes: [] });
};

export const addRecipeToEditPlan = (recipe: RecipeSnippet) => {
  if (useEditPlanStore.getState().recipes.find((r) => r.id === recipe.id)) {
    return;
  }
  useEditPlanStore.setState((state) => ({
    recipes: [...state.recipes, recipe],
  }));
};

export const removeRecipeFromEditPlan = (recipeId: string) => {
  useEditPlanStore.setState((state) => ({
    recipes: state.recipes.filter((r) => r.id !== recipeId),
  }));
};
