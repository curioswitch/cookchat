import type { RecipeIngredient } from "@cookchat/frontend-api";
import { Button } from "@heroui/button";
import { Divider } from "@heroui/divider";
import { Image } from "@heroui/image";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { HiShoppingCart } from "react-icons/hi";
import { usePageContext } from "vike-react/usePageContext";

import { BackButton } from "../../../components/BackButton";
import { useFrontendQueries } from "../../../hooks/rpc";
import {
  addRecipeToCart,
  removeRecipeFromCart,
  useCartStore,
} from "../../../stores";

import ChatButton from "./ChatButton";

function Ingredients({ ingredients }: { ingredients: RecipeIngredient[] }) {
  return (
    <>
      {ingredients.map((ingredient) => (
        <div
          className="flex justify-between py-2 border-b-1 border-gray-100"
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

  const stepRefs = useRef<Array<HTMLElement | null>>([]);

  const navigateToStep = useCallback((idx: number) => {
    stepRefs.current[idx]?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);

  if (isPending) {
    return <div>Loading...</div>;
  }

  if (!recipeRes) {
    throw new Error("Failed to load recipe");
  }

  const recipe = recipeRes.recipe;
  if (!recipe) {
    throw new Error("Recipe not received");
  }

  return (
    <div className="p-4">
      <div className="flex items-center gap-2">
        <BackButton className="size-6" />
        <h1 className="text-2xl font-semibold">{recipe.title}</h1>
      </div>
      <Divider className="mt-0 mb-4 -ml-4 w-screen bg-gray-100" />
      <Image src={recipe.imageUrl} />
      <ChatButton
        recipeId={recipe.id}
        prompt={recipeRes.llmPrompt}
        navigateToStep={navigateToStep}
      />
      <h3 className="flex items-center justify-between">
        {t("Ingredients")}
        <Button color="primary" className="text-white" onPress={onCartToggle}>
          <HiShoppingCart className="size-5" />
          買い物リスト{inCart ? "から削除" : "に追加"}
        </Button>
      </h3>
      <p className="not-prose">{recipe.servingSize}</p>
      <Ingredients ingredients={recipe.ingredients} />
      {recipe.additionalIngredients.map((section) => (
        <div key={section.title}>
          <h3>{section.title}</h3>
          <Ingredients ingredients={section.ingredients} />
        </div>
      ))}
      <h3>作り方</h3>
      <ol className="marker:font-bold list-none px-0">
        {recipe.steps.map((step, i) => (
          <li
            // biome-ignore lint/suspicious/noArrayIndexKey: steps are unique
            key={i}
            ref={(node) => {
              stepRefs.current[i] = node;
            }}
            className="flex items-baseline gap-3 px-0"
          >
            <div className="flex-1/10 bg-orange-400 text-white w-8 h-8 rounded-full flex justify-center items-center">
              {i + 1}
            </div>
            <div className="flex-9/10">
              <p className="text-xl font-light">{step.description}</p>
              {step.imageUrl && (
                <Image className="mt-0 mb-0" width="100%" src={step.imageUrl} />
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
