import type { RecipeIngredient } from "@cookchat/frontend-api";
import { Button } from "@heroui/button";
import { Image } from "@heroui/image";
import { Textarea } from "@heroui/input";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiAdjustments, HiShoppingCart, HiUsers } from "react-icons/hi";
import { usePageContext } from "vike-react/usePageContext";

import { BackButton } from "../../../components/BackButton";
import { useFrontendQueries } from "../../../hooks/rpc";
import {
  addRecipeToCart,
  clearCurrentRecipe,
  removeRecipeFromCart,
  setCurrentRecipe,
  setPrompt,
  useCartStore,
  useChatStore,
} from "../../../stores";

function Ingredients({ ingredients }: { ingredients: RecipeIngredient[] }) {
  return (
    <>
      {ingredients.map((ingredient) => (
        <div
          className="flex justify-between py-2 md:py-4 px-4 border-b-1 border-gray-100 text-2xl"
          key={ingredient.name}
        >
          <div>{ingredient.name}</div>
          <div>{ingredient.quantity}</div>
        </div>
      ))}
    </>
  );
}

export default function Page() {
  const { t } = useTranslation();

  const pageContext = usePageContext();
  const recipeId = pageContext.routeParams.id;

  const queries = useFrontendQueries();
  const getRecipeQuery = queries.getRecipe({ recipeId });

  const { data: recipeRes, isPending } = useQuery(getRecipeQuery);

  const cart = useCartStore();
  const inCart = cart.recipes.some((recipe) => recipe.id === recipeId);

  const stepRefs = useRef<Array<HTMLElement | null>>([]);

  const navigateToStep = useCallback((idx: number) => {
    stepRefs.current[idx]?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);

  const chatStore = useChatStore();

  useEffect(() => {
    if (recipeRes?.recipe) {
      setCurrentRecipe(recipeRes.recipe.id, (idx: number) =>
        navigateToStep(idx),
      );
      return () => {
        clearCurrentRecipe();
      };
    }
  }, [recipeRes, navigateToStep]);

  const [editPrompt, setEditPrompt] = useState(false);

  const onEditPromptClick = useCallback(() => {
    setEditPrompt((prev) => !prev);
  }, []);

  const onPromptChange = useCallback((prompt: string) => {
    setPrompt(prompt);
  }, []);

  useEffect(() => {
    if (!editPrompt) {
      setPrompt("");
    } else {
      setPrompt(recipeRes?.llmPrompt ?? "");
    }
  }, [editPrompt, recipeRes]);

  const onCartToggle = useCallback(() => {
    if (!recipeRes) {
      return;
    }
    const recipe = recipeRes.recipe;
    if (!recipe) {
      return;
    }

    if (inCart) {
      removeRecipeFromCart(recipe.id);
    } else {
      addRecipeToCart(recipe);
    }
  }, [recipeRes, inCart]);

  if (isPending) {
    return <div>{t("Loading...")}</div>;
  }

  if (!recipeRes) {
    throw new Error(t("Failed to load recipe"));
  }

  const recipe = recipeRes.recipe;
  if (!recipe) {
    throw new Error(t("Recipe not received"));
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2 pb-2 p-2">
        <BackButton className="size-6" />
        <h1 className="text-2xl md:text-2xl font-semibold mb-0 md:mb-0">
          {t("Recipe")}
        </h1>
        <div className="size-6" />
      </div>
      <Image className="not-prose" radius="none" src={recipe.imageUrl} />
      <div className="md:px-8">
        <h3 className="font-semibold md:text-4xl leading-normal">
          {recipe.title}
        </h3>
        <div className="flex items-center gap-2 mb-4 pt-2">
          <HiUsers className="size-10 text-gray-400" />
          <span className="text-gray-500 md:text-2xl mt-0.5">
            {recipe.servingSize}
          </span>
        </div>
        {editPrompt && (
          <Textarea
            className="mt-0"
            value={chatStore.prompt}
            onValueChange={onPromptChange}
          />
        )}
      </div>
      <div className="bg-gray-50 px-8 py-1">
        <h3 className="flex items-center justify-between mt-0">
          {t("Ingredients")}
          <HiAdjustments className="size-8" onClick={onEditPromptClick} />
        </h3>
        <Ingredients ingredients={recipe.ingredients} />
        {recipe.additionalIngredients.map((section) => (
          <div key={section.title}>
            <h3>{section.title}</h3>
            <Ingredients ingredients={section.ingredients} />
          </div>
        ))}
        <div className="flex items-center justify-center mt-8 mb-8">
          <Button
            color="primary"
            className="text-white py-4 px-6 md:py-8 md:text-large"
            onPress={onCartToggle}
          >
            <HiShoppingCart className="size-5 md:size-8" />
            {inCart
              ? t("Remove from shopping list")
              : t("Add to shopping list")}
          </Button>
        </div>
      </div>
      <div className="md:pb-60 p-4">
        <h3 className="mt-0 md:pl-4 pb-2">{t("Recipe Steps")}</h3>
        <ol className="marker:font-bold list-none px-10">
          {recipe.steps.map((step, i) => (
            <li
              // biome-ignore lint/suspicious/noArrayIndexKey: steps are unique
              key={i}
              ref={(node) => {
                stepRefs.current[i] = node;
              }}
              className="flex gap-3 px-0"
            >
              <div className="flex-none w-8 h-8 bg-gray-400 text-white w-8 h-8 md:w-10 md:h-10 text-base md:text-lg rounded-full flex justify-center items-center">
                {i + 1}
              </div>
              <div className="flex-11/12">
                {step.imageUrl && (
                  <Image
                    radius="sm"
                    className="mt-0 mb-0"
                    width="100%"
                    src={step.imageUrl}
                  />
                )}
                <p className="text-lg md:text-2xl font-light">
                  {step.description}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
