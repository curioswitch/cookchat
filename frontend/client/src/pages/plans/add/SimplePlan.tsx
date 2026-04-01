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
import { FaMagic } from "react-icons/fa";
import { twMerge } from "tailwind-merge";
import { navigate } from "vike/client/router";

import { m } from "../../../paraglide/messages";
import {
  type PlanRecipe,
  setPlanDays,
  setPlanGenres,
  setPlanIngredients,
  usePlanStore,
} from "../../../stores";

function MainDishPlaceholder() {
  return (
    <a
      href="/"
      className="flex items-center gap-2 p-4 bg-white rounded-2xl border border-yellow-400"
    >
      <FaMagic className="text-yellow-400" />
      <div className="text-gray-600">
        {m.plan_generating_select_instead_hint()}
      </div>
    </a>
  );
}

function MainDish({ recipe }: { recipe: PlanRecipe }) {
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
          <div className="text-gray-600">{m.plan_main_dish_label()}</div>
        </div>
      </div>
    </div>
  );
}

export function SimplePlan() {
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
        <h3 className="mb-2">{m.plan_main_dish_label()}</h3>
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
        <h3 className="text-lg mb-2">{m.plan_conditions_title()}</h3>
        <div className="flex flex-col gap-3">
          <div>
            <NumberField
              className="bg-white border border-yellow-400 rounded-lg p-2"
              value={numDays}
              onChange={setPlanDays}
            >
              <Label className="text-xs text-gray-400">
                {m.plan_number_of_days_label()}
              </Label>
              <NumberField.Group>
                <NumberField.DecrementButton />
                <NumberField.Input />
                <NumberField.IncrementButton />
              </NumberField.Group>
            </NumberField>
          </div>
          <div className="p-4 bg-white border border-yellow-400 rounded-xl">
            <h4>{m.plan_ingredients_to_include_title()}</h4>
            <TextField
              value={ingredients}
              onChange={setPlanIngredients}
              className="mt-2"
            >
              <Input
                placeholder={m.plan_ingredients_in_fridge_placeholder()}
                className="bg-white border border-yellow-400"
              />
              <Label className="mt-2 text-gray-400">
                {m.plan_side_ingredients_hint()}
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
                      <p className="text-medium">
                        {m.plan_add_dessert_label()}
                      </p>
                      <p className="text-xs text-gray-400 mt-2">
                        {m.plan_dessert_hint()}
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
        <h3 className="text-lg">{m.plan_meal_preferences_title()}</h3>
        <div className="flex flex-col gap-1 w-full">
          <CheckboxGroup value={genres} onChange={setPlanGenres}>
            <Label className="text-gray-400">{m.plan_genre_label()}</Label>
            <div className="flex flex-wrap gap-1">
              <Checkbox value={RecipeGenre.JAPANESE.toString()}>
                {({ isSelected }) => (
                  <Checkbox.Content
                    className={twMerge(
                      "border border-yellow-400 rounded-4xl py-2 px-4 w-fit text-sm",
                      isSelected && "bg-orange-400 text-white",
                    )}
                  >
                    {m.genre_japanese()}
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
                    {m.genre_chinese()}
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
                    {m.genre_western()}
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
                    {m.genre_korean()}
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
                    {m.genre_italian()}
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
                    {m.genre_ethnic()}
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
            {m.plan_generate_button()}
          </Button>
          <div className="text-center text-gray-600 text-sm mt-2">
            {m.plan_generate_help()}
          </div>
        </div>
        {doGeneratePlan.isPending && <Spinner />}
      </div>
    </div>
  );
}
