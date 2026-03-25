import { create } from "@bufbuild/protobuf";
import { createValidator } from "@bufbuild/protovalidate";
import { useQuery } from "@connectrpc/connect-query";
import {
  GetPlanResponseSchema,
  getPlan,
  type IngredientSection,
  PlanStatus,
  RecipeSchema,
  type StepGroup as StepGroupProto,
} from "@cookchat/frontend-api";
import { TextArea } from "@heroui/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FaCheck, FaLightbulb, FaStar } from "react-icons/fa";
import { HiAdjustments, HiShoppingCart } from "react-icons/hi";
import { twMerge } from "tailwind-merge";
import { usePageContext } from "vike-react/usePageContext";

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
      <div className="p-4 bg-white border-1 border-yellow-400 rounded-2xl">
        <h3>{group.label}</h3>
        <div className="flex flex-col gap-4 mt-4">
          {group.steps.map((step, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: indexed list of items
              key={i}
              ref={(node) => setStepRef(groupIdx, i, node)}
              className="border-l-6 border-orange-400 p-4 bg-[#fff7ed] rounded-r-xl"
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
          <div className="p-4 bg-[#fff7ed] mt-4 rounded-2xl border-1 border-yellow-400 flex gap-2 items-center">
            <FaLightbulb className="flex-1/12 size-6 text-orange-400" />
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
            <div className="text-xs">{ingredient.name}</div>
            <div
              className={twMerge(
                "text-xs!",
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

export default function Page() {
  const { t } = useTranslation();

  const pageContext = usePageContext();
  const planId = pageContext.routeParams.id;

  const chatStore = useChatStore();

  const { data: planRes, isPending } = useQuery(getPlan, {
    planId,
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

  const navigateToStep = useCallback((stepIdx: number) => {
    let i = 0;
    for (const group of stepRefs.current) {
      for (const step of group) {
        if (i === stepIdx) {
          step?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }
        i++;
      }
    }
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

  const onPromptChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      setPrompt(event.target.value);
    },
    [],
  );

  useEffect(() => {
    if (!editPrompt) {
      setPrompt("");
    } else {
      setPrompt(planRes?.llmPrompt ?? "");
    }
  }, [editPrompt, planRes]);

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
      <div className="px-4 py-2 border-y-1 border-yellow-400 bg-white">
        {plan.status === PlanStatus.PROCESSING && (
          <div className="p-4 bg-[#ffedd5] border-1 border-[#ffedd5] rounded-2xl flex gap-2 items-center mb-2">
            <FaLightbulb className="text-orange-400 size-6" />
            <div>
              {t("Your plan is being processed. It should be ready soon!")}
            </div>
          </div>
        )}
        <h2 className="text-gray-600 text-xl mb-2">{t("Today's Plan")}</h2>
        <div className="flex gap-4 justify-between">
          {plan.recipes.map((recipe) => (
            <a
              key={recipe.id}
              href={`/recipes/${recipe.id}`}
              className="flex flex-col gap-2 items-center"
            >
              <img
                src={recipe.imageUrl}
                alt={recipe.title}
                className="h-20 rounded-xl"
              />
              <div className="max-w-20 truncate text-xs text-gray-600">
                {recipe.title}
              </div>
            </a>
          ))}
        </div>
      </div>
      <div className="px-4 py-2 border-b-1 border-yellow-400 bg-white">
        <div
          ref={(node) => {
            ingredientsRef.current = node;
          }}
          className="flex justify-between mb-4"
        >
          <h2 className="text-gray-600 text-xl">{t("Ingredients")}</h2>
          <button
            type="button"
            className="flex gap-2 items-center text-orange-400 cursor-pointer"
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
          <TextArea
            className="mt-0"
            value={chatStore.prompt}
            onChange={onPromptChange}
          />
        )}
      </div>
      {plan.stepGroups.map((group, i) => (
        <StepGroup
          // biome-ignore lint/suspicious/noArrayIndexKey: indexed list of items
          key={i}
          group={group}
          groupIdx={i}
          setStepRef={setStepRef}
        />
      ))}
      {plan.notes.length > 0 && (
        <div className="p-4">
          <div className="p-4 border-1 border-yellow-400 rounded-2xl bg-linear-to-r from-[#ffedd5] to-[#fed7aa]">
            <div className="flex gap-2 items-center">
              <FaStar className="text-orange-400" />
              <div className="text-large">{t("Plan Notes")}</div>
            </div>
            <ol className="flex flex-col gap-2 mt-2">
              {plan.notes.map((note, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: indexed list of items
                <li key={i} className="flex gap-2 items-center">
                  <FaCheck className="flex-1/12 size-3 text-orange-400" />
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
