import { useMutation } from "@connectrpc/connect-query";
import { type RecipeSnippet, updatePlan } from "@cookchat/frontend-api";
import { Button, Spinner } from "@heroui/react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { FaTrash } from "react-icons/fa";

import { m } from "../../../../paraglide/messages";
import { removeRecipeFromEditPlan, useEditPlanStore } from "../../../../stores";

export const Route = createFileRoute("/plans/$id/edit/")({
  component: Page,
});

function RecipeSlot({ recipe }: { recipe: RecipeSnippet }) {
  const onDeleteClick = useCallback(() => {
    removeRecipeFromEditPlan(recipe.id);
  }, [recipe.id]);
  return (
    <div key={recipe.id} className="flex flex-col gap-2 items-center relative">
      <img
        src={recipe.imageUrl}
        alt={recipe.title}
        className="h-20 rounded-xl"
      />
      <div className="max-w-20 truncate text-xs text-gray-600">
        {recipe.title}
      </div>
      <FaTrash
        onClick={onDeleteClick}
        className="cursor-pointer absolute -right-2 fill-yellow-400 z-50"
      />
    </div>
  );
}

function Page() {
  const navigate = useNavigate();
  const { id: planId } = Route.useParams();

  const { recipes: storeRecipes } = useEditPlanStore();

  const doUpdatePlan = useMutation(updatePlan, {
    onSuccess: () => {
      void navigate({ to: "/plans" });
    },
  });

  const onSaveClick = useCallback(() => {
    doUpdatePlan.mutate({
      planId,
      recipeIds: storeRecipes.map((r) => r.id),
    });
  }, [doUpdatePlan, planId, storeRecipes]);

  const recipes: Array<RecipeSnippet | undefined> = [...storeRecipes];
  while (recipes.length < 3) {
    recipes.push(undefined);
  }

  return (
    <div className="px-4 py-2 border-y-1 border-yellow-400 bg-white">
      <div className="flex gap-4 items-center justify-between">
        {recipes.map((recipe, i) =>
          recipe ? (
            <RecipeSlot key={recipe.id} recipe={recipe} />
          ) : (
            // biome-ignore lint/suspicious/noArrayIndexKey: fine
            <div key={i} className="text-gray-600">
              <Link to="/">{m.plan_click_to_select()}</Link>
            </div>
          ),
        )}
      </div>
      <Button
        onPress={onSaveClick}
        isDisabled={doUpdatePlan.isPending}
        fullWidth
        className="mt-4 bg-orange-400"
      >
        {m.common_save()}
      </Button>
      {doUpdatePlan.isPending && <Spinner />}
    </div>
  );
}
