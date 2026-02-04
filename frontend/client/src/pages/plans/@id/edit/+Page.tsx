import { useMutation } from "@connectrpc/connect-query";
import { type RecipeSnippet, updatePlan } from "@cookchat/frontend-api";
import { Button } from "@heroui/button";
import { Image } from "@heroui/image";
import { Link } from "@heroui/link";
import { Spinner } from "@heroui/spinner";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { FaTrash } from "react-icons/fa";
import { navigate } from "vike/client/router";
import { usePageContext } from "vike-react/usePageContext";

import { removeRecipeFromEditPlan, useEditPlanStore } from "../../../../stores";

function RecipeSlot({ recipe }: { recipe: RecipeSnippet }) {
  const onDeleteClick = useCallback(() => {
    removeRecipeFromEditPlan(recipe.id);
  }, [recipe.id]);
  return (
    <div key={recipe.id} className="flex flex-col gap-2 items-center relative">
      <Image src={recipe.imageUrl} alt={recipe.title} className="h-20" />
      <div className="max-w-20 truncate text-tiny text-gray-600">
        {recipe.title}
      </div>
      <FaTrash
        onClick={onDeleteClick}
        className="cursor-pointer absolute -right-2 fill-primary-400 z-50"
      />
    </div>
  );
}

export default function Page() {
  const { t } = useTranslation();

  const pageContext = usePageContext();
  const planId = pageContext.routeParams.id;

  const { recipes: storeRecipes } = useEditPlanStore();

  const doUpdatePlan = useMutation(updatePlan, {
    onSuccess: () => {
      navigate("/plans");
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
    <div className="px-4 py-2 border-y-1 border-primary-400 bg-white">
      <div className="flex gap-4 items-center justify-between">
        {recipes.map((recipe, i) =>
          recipe ? (
            <RecipeSlot key={recipe.id} recipe={recipe} />
          ) : (
            // biome-ignore lint/suspicious/noArrayIndexKey: fine
            <div key={i} className="text-gray-600">
              <Link href="/">{t("Click to select")}</Link>
            </div>
          ),
        )}
      </div>
      <Button
        onPress={onSaveClick}
        disabled={doUpdatePlan.isPending}
        color="primary"
        fullWidth
        className="mt-4"
      >
        {t("Save")}
      </Button>
      {doUpdatePlan.isPending && <Spinner />}
    </div>
  );
}
