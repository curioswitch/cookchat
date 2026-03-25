import { useMutation } from "@connectrpc/connect-query";
import { generatePlan, RecipeGenre } from "@cookchat/frontend-api";
import {
  Button,
  Checkbox,
  CheckboxGroup,
  Input,
  Label,
  NumberField,
  Spinner,
  Switch,
  TextField,
} from "@heroui/react";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { FaMagic } from "react-icons/fa";
import { twMerge } from "tailwind-merge";
import { navigate } from "vike/client/router";

import {
  type PlanRecipe,
  setPlanDays,
  setPlanGenres,
  setPlanIngredients,
  usePlanStore,
} from "../../../stores";

function MainDishPlaceholder() {
  const { t } = useTranslation();
  return (
    <a
      href="/"
      className="flex items-center gap-2 p-4 bg-white rounded-2xl border border-yellow-400"
    >
      <FaMagic className="text-yellow-400" />
      <div className="text-gray-600">
        {t("Generating with AI. Click to select instead.")}
      </div>
    </a>
  );
}

function MainDish({ recipe }: { recipe: PlanRecipe }) {
  const { t } = useTranslation();
  return (
    <div className="mb-4">
      <div className="flex gap-4 bg-white p-4 items-center rounded-2xl border border-yellow-400">
        <div className="w-1/5 shrink-0 overflow-hidden rounded-xl">
          <img
            className="block h-auto w-full object-cover"
            alt={recipe.title}
            src={recipe.imageUrl}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div>{recipe.title}</div>
          <div className="text-gray-600">{t("Main Dish")}</div>
        </div>
      </div>
    </div>
  );
}

export function SimplePlan() {
  const { t } = useTranslation();

  const planStore = usePlanStore();
  const numDays = planStore.numDays;
  const ingredients = planStore.ingredients;
  const genres = planStore.genres;

  const doGeneratePlan = useMutation(generatePlan, {
    onSuccess: () => {
      navigate("/plans");
    },
  });

  const onGenerateClick = useCallback(() => {
    doGeneratePlan.mutate({
      numDays,
      ingredients: ingredients.split(",").map((s) => s.trim()),
      genres: genres.map((g) => Number(g)),
      recipeIds: planStore.recipes.map((r) => r.id),
    });
  }, [doGeneratePlan, ingredients, genres, numDays, planStore]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="mb-2">メイン</h3>
        <div className="flex flex-col gap-2">
          {[...Array(numDays).keys()].map((day) =>
            planStore.recipes[day] ? (
              <MainDish recipe={planStore.recipes[day]} key={day} />
            ) : (
              <MainDishPlaceholder key={day} />
            ),
          )}
        </div>
      </div>
      <div>
        <h3 className="text-lg mb-2">{t("Conditions")}</h3>
        <div className="flex flex-col gap-3">
          <div>
            <NumberField
              className="bg-white border border-yellow-400 rounded-lg p-2"
              value={numDays}
              onChange={setPlanDays}
            >
              <Label className="text-xs text-gray-400">
                {t("Number of days")}
              </Label>
              <NumberField.Group>
                <NumberField.DecrementButton />
                <NumberField.Input />
                <NumberField.IncrementButton />
              </NumberField.Group>
            </NumberField>
          </div>
          <div className="p-4 bg-white border border-yellow-400 rounded-xl">
            <h4>{t("Ingredients to include")}</h4>
            <TextField
              value={ingredients}
              onChange={setPlanIngredients}
              className="mt-2"
            >
              <Input
                placeholder={t("Ingredients in your fridge...")}
                className="bg-white border border-yellow-400"
              />
              <Label className="mt-2 text-gray-400">
                {t("Ingredients for sides")}
              </Label>
            </TextField>
          </div>
          <div>
            <Switch className="border border-yellow-400 rounded-lg px-4 py-4 w-full max-w-md justify-between bg-white">
              {({ isSelected }) => (
                <>
                  {" "}
                  <Switch.Content>
                    <div className="flex flex-col not-prose">
                      <p className="text-medium">{t("Add dessert")}</p>
                      <p className="text-xs text-gray-400 mt-2">
                        {t("Seasonal fruit or yogurt")}
                      </p>
                    </div>
                  </Switch.Content>
                  <Switch.Control className={isSelected ? "bg-orange-400" : ""}>
                    <Switch.Thumb />
                  </Switch.Control>
                </>
              )}
            </Switch>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <h3 className="text-lg">{t("Meal Preferences")}</h3>
        <div className="flex flex-col gap-1 w-full">
          <CheckboxGroup value={genres} onChange={setPlanGenres}>
            <Label className="text-gray-400">{t("Genre")}</Label>
            <div className="flex flex-wrap gap-1">
              <Checkbox value={RecipeGenre.JAPANESE.toString()}>
                {({ isSelected }) => (
                  <Checkbox.Content
                    className={twMerge(
                      "border border-yellow-400 rounded-4xl py-2 px-4 w-fit text-sm",
                      isSelected && "bg-orange-400 text-white",
                    )}
                  >
                    {t("genre.japanese")}
                  </Checkbox.Content>
                )}
              </Checkbox>
              <Checkbox value={RecipeGenre.CHINESE.toString()}>
                {({ isSelected }) => (
                  <Checkbox.Content
                    className={twMerge(
                      "border border-yellow-400 rounded-4xl py-2 px-4 w-fit text-sm",
                      isSelected && "bg-orange-400 text-white",
                    )}
                  >
                    {t("genre.chinese")}
                  </Checkbox.Content>
                )}
              </Checkbox>
              <Checkbox value={RecipeGenre.WESTERN.toString()}>
                {({ isSelected }) => (
                  <Checkbox.Content
                    className={twMerge(
                      "border border-yellow-400 rounded-4xl py-2 px-4 w-fit text-sm",
                      isSelected && "bg-orange-400 text-white",
                    )}
                  >
                    {t("genre.western")}
                  </Checkbox.Content>
                )}
              </Checkbox>
              <Checkbox value={RecipeGenre.KOREAN.toString()}>
                {({ isSelected }) => (
                  <Checkbox.Content
                    className={twMerge(
                      "border border-yellow-400 rounded-4xl py-2 px-4 w-fit text-sm",
                      isSelected && "bg-orange-400 text-white",
                    )}
                  >
                    {t("genre.korean")}
                  </Checkbox.Content>
                )}
              </Checkbox>
              <Checkbox value={RecipeGenre.ITALIAN.toString()}>
                {({ isSelected }) => (
                  <Checkbox.Content
                    className={twMerge(
                      "border border-yellow-400 rounded-4xl py-2 px-4 w-fit text-sm",
                      isSelected && "bg-orange-400 text-white",
                    )}
                  >
                    {t("genre.italian")}
                  </Checkbox.Content>
                )}
              </Checkbox>
              <Checkbox value={RecipeGenre.ETHNIC.toString()}>
                {({ isSelected }) => (
                  <Checkbox.Content
                    className={twMerge(
                      "border border-yellow-400 rounded-4xl py-2 px-4 w-fit text-sm",
                      isSelected && "bg-orange-400 text-white",
                    )}
                  >
                    {t("genre.ethnic")}
                  </Checkbox.Content>
                )}
              </Checkbox>
            </div>
          </CheckboxGroup>
        </div>
        <div>
          <Button
            className="mt-4 h-12 rounded-lg bg-yellow-400 text-white hover:bg-yellow-500"
            fullWidth
            onPress={onGenerateClick}
            isDisabled={doGeneratePlan.isPending}
          >
            <FaMagic />
            {t("Generate Plan")}
          </Button>
          <div className="text-center text-gray-600 text-sm mt-2">
            {t("AI will generate an appropriate plan")}
          </div>
        </div>
        {doGeneratePlan.isPending && <Spinner />}
      </div>
    </div>
  );
}
