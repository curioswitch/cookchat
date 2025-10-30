import { create } from "@bufbuild/protobuf";
import { useMutation } from "@connectrpc/connect-query";
import {
  addBookmark,
  type RecipeIngredient,
  RecipeSnippetSchema,
  removeBookmark,
} from "@cookchat/frontend-api";
import { Button } from "@heroui/button";
import { Image } from "@heroui/image";
import { Textarea } from "@heroui/input";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FaBookmark, FaRegBookmark } from "react-icons/fa";
import { HiAdjustments, HiShoppingCart, HiUsers } from "react-icons/hi";
import { navigate } from "vike/client/router";
import { usePageContext } from "vike-react/usePageContext";

import { useFrontendQueries } from "../../../hooks/rpc";
import {
  addPlanRecipe,
  addRecipeToCart,
  addRecipeToEditPlan,
  removeRecipeFromCart,
  resetChat,
  setCurrentRecipe,
  setPrompt,
  useCartStore,
  useChatStore,
  useEditPlanStore,
} from "../../../stores";

function Ingredients({ ingredients }: { ingredients: RecipeIngredient[] }) {
  return (
    <div>
      {ingredients.map((ingredient) => (
        <div
          className="flex justify-between py-2 md:py-4 [&:not(:last-child)]:border-b-1 border-gray-100 text-sm prose"
          key={ingredient.name}
        >
          <div className="">{ingredient.name}</div>
          <div>{ingredient.quantity}</div>
        </div>
      ))}
    </div>
  );
}

export default function Page() {
  const { t } = useTranslation();

  const pageContext = usePageContext();
  const recipeId = pageContext.routeParams.id;

  const queries = useFrontendQueries();
  const getRecipeQuery = queries.getRecipe({ recipeId });

  const { data: recipeRes, isPending } = useQuery(getRecipeQuery);

  const queryClient = useQueryClient();

  const doAddBookmark = useMutation(addBookmark, {
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: getRecipeQuery.queryKey,
      });
    },
  });
  const doRemoveBookmark = useMutation(removeBookmark, {
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: getRecipeQuery.queryKey,
      });
    },
  });

  const onBookmarkClick = useCallback(() => {
    if (
      !recipeRes ||
      !recipeRes.recipe ||
      doAddBookmark.isPending ||
      doRemoveBookmark.isPending
    ) {
      return;
    }

    if (recipeRes.isBookmarked) {
      doRemoveBookmark.mutate({ recipeId: recipeRes.recipe.id });
    } else {
      doAddBookmark.mutate({ recipeId: recipeRes.recipe.id });
    }
  }, [recipeRes, doRemoveBookmark, doAddBookmark]);

  const { editing: editingPlan } = useEditPlanStore();

  const cart = useCartStore();
  const inCart = cart.recipes.some((recipe) => recipe.id === recipeId);

  const stepRefs = useRef<Array<HTMLElement | null>>([]);
  const ingredientsRef = useRef<HTMLDivElement | null>(null);

  const navigateToStep = useCallback((idx: number) => {
    stepRefs.current[idx]?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);
  const navigateToIngredients = useCallback(() => {
    ingredientsRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);

  const chatStore = useChatStore();

  useEffect(() => {
    if (recipeRes?.recipe) {
      setCurrentRecipe(
        recipeRes.recipe.id,
        navigateToStep,
        navigateToIngredients,
      );
      return () => {
        resetChat();
      };
    }
  }, [recipeRes, navigateToStep, navigateToIngredients]);

  const [editPrompt, setEditPrompt] = useState(false);

  const onEditPromptClick = useCallback(() => {
    setEditPrompt((prev) => !prev);
  }, []);

  const onPromptChange = useCallback((prompt: string) => {
    setPrompt(prompt);
  }, []);

  const onCreatePlan = useCallback(() => {
    const recipe = recipeRes?.recipe;
    if (!recipe) {
      return;
    }

    addPlanRecipe(recipe);
    navigate("/plans/add");
  }, [recipeRes]);

  const onAddToPlan = useCallback(() => {
    const recipe = recipeRes?.recipe;
    if (!recipe) {
      return;
    }

    addRecipeToEditPlan(
      create(RecipeSnippetSchema, {
        id: recipe.id,
        title: recipe.title,
        imageUrl: recipe.imageUrl,
      }),
    );
    navigate("/plans/edit");
  }, [recipeRes]);

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
    <>
      <Image radius="none" src={recipe.imageUrl} />
      <div className="px-4 py-2">
        <div className="px-2">
          <div className="flex items-center justify-between">
            <h2 className="">{recipe.title}</h2>
            {recipeRes.isBookmarked ? (
              <FaBookmark
                onClick={onBookmarkClick}
                className="fill-primary-400 cursor-pointer"
              />
            ) : (
              <FaRegBookmark
                onClick={onBookmarkClick}
                className="fill-primary-400 cursor-pointer"
              />
            )}
          </div>
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <HiUsers className="size-4 text-primary" />
              <span className="text-gray-500 md:text-2xl mt-0.5">
                {recipe.servingSize}
              </span>
            </div>
            {editingPlan ? (
              <Button
                onPress={onAddToPlan}
                color="primary"
                size="sm"
                className="text-white"
              >
                {t("Add to plan")}
              </Button>
            ) : (
              <Button
                onPress={onCreatePlan}
                color="primary"
                size="sm"
                className="text-white"
              >
                {t("Create Plan")}
              </Button>
            )}
          </div>
        </div>
        {editPrompt && (
          <Textarea
            className="mt-0"
            value={chatStore.prompt}
            onValueChange={onPromptChange}
          />
        )}
        <div className="flex flex-col gap-4 mt-2">
          <div
            ref={(node) => {
              ingredientsRef.current = node;
            }}
            className="p-4 bg-white rounded-xl border-1 border-primary-200"
          >
            <h3 className="flex items-center justify-between mt-0 prose">
              {t("Ingredients")}
              <HiAdjustments className="size-6" onClick={onEditPromptClick} />
            </h3>
            <Ingredients ingredients={recipe.ingredients} />
            {recipe.additionalIngredients.map((section) => (
              <div key={section.title} className="mt-4">
                <h3 className="prose">{section.title}</h3>
                <Ingredients ingredients={section.ingredients} />
              </div>
            ))}
            <Button
              fullWidth
              className="mt-4 text-[#c2410c] py-4 px-6 bg-[#ffedd5] md:py-8 md:text-large"
              onPress={onCartToggle}
            >
              <HiShoppingCart className="size-5 md:size-8" />
              {inCart
                ? t("Remove from shopping list")
                : t("Add to shopping list")}
            </Button>
          </div>
          {recipe.steps.map((step, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: steps are unique
              key={i}
              ref={(node) => {
                stepRefs.current[i] = node;
              }}
              className="p-4 bg-white rounded-xl border-1 border-primary-200"
            >
              <div className="flex gap-2">
                <div className="flex-none bg-[#fed7aa] text-[#c2410c] size-8 md:size-10 text-base md:text-lg rounded-full flex justify-center items-center">
                  {i + 1}
                </div>
                <p className="text-md md:text-2xl font-light prose">
                  {step.description}
                </p>
              </div>
              {step.imageUrl && (
                <Image
                  radius="sm"
                  className="mt-2 mb-0"
                  width="100%"
                  src={step.imageUrl}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
