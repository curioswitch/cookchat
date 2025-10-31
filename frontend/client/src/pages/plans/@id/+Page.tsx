import { create } from "@bufbuild/protobuf";
import { timestampFromDate } from "@bufbuild/protobuf/wkt";
import { createValidator } from "@bufbuild/protovalidate";
import { useQuery } from "@connectrpc/connect-query";
import {
  GetPlanResponseSchema,
  getPlan,
  type IngredientSection,
  RecipeSchema,
  type StepGroup as StepGroupProto,
} from "@cookchat/frontend-api";
import { Image } from "@heroui/image";
import { Textarea } from "@heroui/input";
import { Link } from "@heroui/link";
import { useQuery as useTanstackQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FaCheck, FaLightbulb, FaStar } from "react-icons/fa";
import { HiAdjustments, HiShoppingCart } from "react-icons/hi";
import { twMerge } from "tailwind-merge";
import { usePageContext } from "vike-react/usePageContext";

import { useFrontendQueries } from "../../../hooks/rpc";
import {
  addRecipeToCart,
  resetChat,
  setCurrentPlan,
  setPrompt,
  useChatStore,
} from "../../../stores";

const validator = createValidator();

function StepGroup({
  group,
  groupIdx,
  setStepRef,
}: {
  group: StepGroupProto;
  groupIdx: number;
  setStepRef: (
    groupIdx: number,
    stepIdx: number,
    node: HTMLDivElement | null,
  ) => void;
}) {
  return (
    <div className="p-4">
      <div className="p-4 bg-white border-1 border-primary-400 rounded-2xl">
        <h3>{group.label}</h3>
        <div className="flex flex-col gap-4 mt-4">
          {group.steps.map((step, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: indexed list of items
              key={i}
              ref={(node) => setStepRef(groupIdx, i, node)}
              className="border-l-6 border-primary p-4 bg-[#fff7ed] rounded-r-xl"
            >
              <h4 className="text-gray-600">{step.description}</h4>
              {step.imageUrl && (
                <img
                  src={step.imageUrl}
                  alt={step.description}
                  className="h-34 w-full object-cover rounded-xl mt-2"
                />
              )}
            </div>
          ))}
        </div>
        {group.note && (
          <div className="p-4 bg-[#fff7ed] mt-4 rounded-2xl border-1 border-primary-400 flex gap-2 items-center">
            <FaLightbulb className="flex-1/12 size-6 text-primary" />
            <div className="flex-11/12">{group.note}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function Ingredients({
  section,
  idx,
}: {
  section: IngredientSection;
  idx: number;
}) {
  const styleIdx = idx % 3;
  return (
    <div
      className={twMerge(
        "px-4 py-2 rounded-xl border-1",
        styleIdx === 0 && "border-[#fed7aa] bg-[#fff7ed]",
        styleIdx === 1 && "border-[#bbf7d0] bg-[#f0fdf4]",
        styleIdx === 2 && "border-[#fde68a] bg-[#fffbeb]",
      )}
    >
      <h3 className="mt-0 prose">{section.title}</h3>
      <div className="grid grid-cols-2 gap-2 mt-2">
        {section.ingredients.map((ingredient, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: indexed list of items
          <div key={i} className="flex justify-between">
            <div className="text-tiny">{ingredient.name}</div>
            <div
              className={twMerge(
                "!text-tiny",
                styleIdx === 0 && "text-[#ea580c]",
                styleIdx === 1 && "text-[#16a34a]",
                styleIdx === 2 && "text-[#d97706]",
              )}
            >
              {ingredient.quantity}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecipeDetail({ recipeId }: { recipeId: string }) {
  const queries = useFrontendQueries();
  const { t } = useTranslation();
  const { data: recipeRes, isPending } = useTanstackQuery(
    queries.getRecipe({ recipeId }),
  );

  if (isPending) {
    return <div className="p-4">{t("Loading...")}</div>;
  }

  if (!recipeRes?.recipe) {
    return <div className="p-4">{t("Not found")}</div>;
  }

  const recipe = recipeRes.recipe;

  return (
    <div className="p-4">
      <Image
        src={recipe.imageUrl}
        alt={recipe.title}
        className="w-full h-48 object-cover rounded-lg mb-4"
      />
      <h3 className="text-xl font-semibold mb-4">{recipe.title}</h3>

      <div className="mb-6">
        <h4 className="text-lg font-semibold mb-2 text-primary">材料</h4>
        <div className="bg-white rounded-lg p-4 border-1 border-gray-200">
          {recipe.ingredients.map((ingredient) => (
            <div
              key={ingredient.name}
              className="flex justify-between py-2 border-b-1 border-gray-100 last:border-b-0"
            >
              <div>{ingredient.name}</div>
              <div className="text-gray-600">{ingredient.quantity}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <h4 className="text-lg font-semibold mb-2 text-primary">作り方</h4>
        <div className="flex flex-col gap-4">
          {recipe.steps.map((step, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: indexed list of steps
              key={i}
              className="bg-white rounded-lg p-4 border-1 border-primary-200"
            >
              <div className="flex items-start gap-2">
                <div className="bg-primary text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-semibold shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1">
                  <p className="text-gray-700">{step.description}</p>
                  {step.imageUrl && (
                    <img
                      src={step.imageUrl}
                      alt={`step ${i + 1}`}
                      className="mt-2 w-full h-32 object-cover rounded-lg"
                    />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  const { t } = useTranslation();

  const pageContext = usePageContext();
  const planId = pageContext.routeParams.id;

  const chatStore = useChatStore();

  const { data: planRes, isPending } = useQuery(getPlan, {
    date: timestampFromDate(new Date(planId)),
  });

  const ingredientsRef = useRef<HTMLDivElement | null>(null);

  const stepRefs = useRef<Array<Array<HTMLDivElement | null>>>([]);

  const setStepRef = useCallback(
    (groupIdx: number, stepIdx: number, node: HTMLDivElement | null) => {
      if (!stepRefs.current[groupIdx]) {
        stepRefs.current[groupIdx] = [];
      }
      stepRefs.current[groupIdx][stepIdx] = node;
    },
    [],
  );

  const navigateToStep = useCallback((stepIdx: number, groupIdx: number) => {
    stepRefs.current[groupIdx]?.[stepIdx]?.scrollIntoView({
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

  useEffect(() => {
    if (planRes?.plan) {
      setCurrentPlan(planId, navigateToStep, navigateToIngredients);
      for (let i = 0; i < planRes.plan.stepGroups.length; i++) {
        stepRefs.current[i] = [];
      }
      return () => {
        resetChat();
      };
    }
  }, [planId, planRes, navigateToStep, navigateToIngredients]);

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
      setPrompt(planRes?.llmPrompt ?? "");
    }
  }, [editPrompt, planRes]);

  const [activeTab, setActiveTab] = useState<"parallel" | "individual">(
    "parallel",
  );
  const [selectedRecipe, setSelectedRecipe] = useState(0);

  const addToCart = useCallback(() => {
    if (!planRes?.plan) {
      return;
    }

    planRes.plan.recipes.forEach((recipe, i) => {
      const servingSize = planRes.plan?.servingSizes?.[i] ?? "";
      const ingredients = planRes.plan?.ingredients?.[i]?.ingredients ?? [];
      addRecipeToCart(
        create(RecipeSchema, {
          id: recipe.id,
          title: recipe.title,
          servingSize,
          ingredients,
        }),
      );
    });
  }, [planRes]);

  if (isPending) {
    return <div>{t("Loading...")}</div>;
  }

  if (!planRes) {
    return <div>{t("No plan found")}</div>;
  }

  const res = validator.validate(GetPlanResponseSchema, planRes);
  if (res.kind !== "valid") {
    return <div>{t("Invalid plan data")}</div>;
  }

  const plan = res.message.plan;

  return (
    <>
      <div className="px-4 py-2 border-y-1 border-primary-400 bg-white">
        <h2 className="text-gray-600 text-xl mb-2">{t("Today's Plan")}</h2>
        <div className="flex gap-4 justify-between">
          {plan.recipes.map((recipe) => (
            <Link
              key={recipe.id}
              href={`/recipes/${recipe.id}`}
              className="flex flex-col gap-2 items-center"
            >
              <Image
                src={recipe.imageUrl}
                alt={recipe.title}
                className="h-20"
              />
              <div className="max-w-20 truncate text-tiny text-gray-600">
                {recipe.title}
              </div>
            </Link>
          ))}
        </div>
      </div>
      <div className="px-4 py-2 border-b-1 border-primary-400 bg-white">
        <div
          ref={(node) => {
            ingredientsRef.current = node;
          }}
          className="flex justify-between mb-4"
        >
          <h2 className="text-gray-600 text-xl">{t("Ingredients")}</h2>
          <button
            type="button"
            className="flex gap-2 items-center text-primary cursor-pointer"
            onClick={addToCart}
          >
            <HiShoppingCart className="size-5 md:size-8" />{" "}
            {t("Add to shopping list")}
          </button>
        </div>
        <div className="flex flex-col gap-4">
          {plan.ingredients.map((section, i) => (
            <Ingredients
              // biome-ignore lint/suspicious/noArrayIndexKey: indexed list of items
              key={i}
              idx={i}
              section={section}
            />
          ))}
        </div>
      </div>
      <div className="p-4">
        <HiAdjustments className="size-6" onClick={onEditPromptClick} />
        {editPrompt && (
          <Textarea
            className="mt-0"
            value={chatStore.prompt}
            onValueChange={onPromptChange}
          />
        )}
      </div>

      <div className="border-b-1 border-gray-200 bg-white">
        <div className="flex">
          <button
            type="button"
            onClick={() => setActiveTab("parallel")}
            className={`flex-1 py-3 text-center font-semibold ${
              activeTab === "parallel"
                ? "text-primary border-b-2 border-primary"
                : "text-gray-400"
            }`}
          >
            {t("Parallel Recipes")}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("individual")}
            className={`flex-1 py-3 text-center font-semibold ${
              activeTab === "individual"
                ? "text-primary border-b-2 border-primary"
                : "text-gray-400"
            }`}
          >
            {t("Individual Recipes")}
          </button>
        </div>
      </div>

      {activeTab === "parallel" &&
        plan.stepGroups.map((group, i) => (
          <StepGroup
            // biome-ignore lint/suspicious/noArrayIndexKey: indexed list of items
            key={i}
            group={group}
            groupIdx={i}
            setStepRef={setStepRef}
          />
        ))}

      {activeTab === "individual" && (
        <>
          <div className="bg-white border-b-1 border-gray-200 overflow-x-auto">
            <div className="flex px-4 py-2 gap-2">
              {plan.recipes.map((recipe, i) => {
                const labels = ["主菜", "副菜", "汁物"];
                return (
                  <button
                    key={recipe.id}
                    type="button"
                    onClick={() => setSelectedRecipe(i)}
                    className={`px-4 py-2 rounded-lg whitespace-nowrap ${
                      selectedRecipe === i
                        ? "bg-primary text-white"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {labels[i] || recipe.title}
                  </button>
                );
              })}
            </div>
          </div>

          <RecipeDetail recipeId={plan.recipes[selectedRecipe].id} />
        </>
      )}
      {plan.notes.length > 0 && (
        <div className="p-4">
          <div className="p-4 border-1 border-primary-400 rounded-2xl bg-linear-to-r from-[#ffedd5] to-[#fed7aa]">
            <div className="flex gap-2 items-center">
              <FaStar className="text-primary" />
              <div className="text-large">{t("Plan Notes")}</div>
            </div>
            <ol className="flex flex-col gap-2 mt-2">
              {plan.notes.map((note, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: indexed list of items
                <li key={i} className="flex gap-2 items-center">
                  <FaCheck className="flex-1/12 size-3 text-primary" />
                  <div className="flex-11/12 text-gray-600 text-small ">
                    {note}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </>
  );
}
