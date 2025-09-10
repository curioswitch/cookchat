import { useMutation } from "@connectrpc/connect-query";
import { generatePlan, RecipeGenre } from "@cookchat/frontend-api";
import { Button } from "@heroui/button";
import { CheckboxGroup, useCheckbox } from "@heroui/checkbox";
import { Chip } from "@heroui/chip";
import { Image } from "@heroui/image";
import { Input } from "@heroui/input";
import { Link } from "@heroui/link";
import { NumberInput } from "@heroui/number-input";
import { Spinner } from "@heroui/spinner";
import { Switch } from "@heroui/switch";
import { cn, tv } from "@heroui/theme";
import { VisuallyHidden } from "@react-aria/visually-hidden";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { FaMagic } from "react-icons/fa";
import { navigate } from "vike/client/router";

import {
  type PlanRecipe,
  setPlanDays,
  setPlanGenres,
  setPlanIngredients,
  usePlanStore,
} from "../../../stores";

function Option(props: { value: string; children: React.ReactNode }) {
  const checkbox = tv({
    slots: {
      base: "border-1 border-primary-400 bg-white p-4",
      content: "text-black text-sm",
    },
    variants: {
      isSelected: {
        true: {
          base: "border-primary bg-primary hover:bg-primary-500 hover:border-primary-500",
          content: "text-white pl-1",
        },
      },
      isFocusVisible: {
        true: {
          base: "outline-solid outline-transparent ring-2 ring-focus ring-offset-2 ring-offset-background",
        },
      },
    },
  });

  const {
    children,
    isSelected,
    isFocusVisible,
    getBaseProps,
    getLabelProps,
    getInputProps,
  } = useCheckbox({
    ...props,
  });

  const styles = checkbox({ isSelected, isFocusVisible });

  return (
    <label {...getBaseProps()}>
      <VisuallyHidden>
        <input {...getInputProps()} />
      </VisuallyHidden>
      <Chip
        classNames={{
          base: styles.base(),
          content: styles.content(),
        }}
        color="primary"
        variant="faded"
        {...getLabelProps()}
      >
        {children ? children : isSelected ? "Enabled" : "Disabled"}
      </Chip>
    </label>
  );
}

function MainDishPlaceholder() {
  const { t } = useTranslation();
  return (
    <Link
      href="/"
      className="flex items-center gap-2 p-4 bg-white rounded-2xl border-1 border-primary-400"
    >
      <FaMagic className="text-primary-400" />
      <div className="text-gray-600">
        {t("Generating with AI. Click to select instead.")}
      </div>
    </Link>
  );
}

function MainDish({ recipe }: { recipe: PlanRecipe }) {
  const { t } = useTranslation();
  return (
    <div className="mb-4">
      <div className="flex gap-4 bg-white p-4 items-center rounded-2xl border-1 border-primary-400">
        <Image
          classNames={{
            wrapper: "flex-1/5",
          }}
          src={recipe.imageUrl}
        />
        <div className="flex-4/5">
          <div>{recipe.title}</div>
          <div className="text-gray-600">{t("Main Dish")}</div>
        </div>
      </div>
    </div>
  );
}

export default function Page() {
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
    <div className="p-4 h-[100%]">
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
              <NumberInput
                label={t("Number of days")}
                value={numDays}
                onValueChange={setPlanDays}
                classNames={{
                  inputWrapper:
                    "bg-white border-1 border-primary-400 h-16 pb-2",
                }}
              />
            </div>
            <div className="p-4 bg-white border-1 border-primary-400 rounded-xl">
              <h4>{t("Ingredients to include")}</h4>
              <Input
                placeholder={t("Ingredients in your fridge...")}
                description={t("Ingredients for sides")}
                value={ingredients}
                onValueChange={setPlanIngredients}
                classNames={{
                  mainWrapper: "mt-2",
                  inputWrapper: "bg-white border-1 border-primary-400",
                  helperWrapper: "mt-2 text-gray-600",
                }}
              />
            </div>
            <div>
              <Switch
                classNames={{
                  base: cn(
                    "inline-flex flex-row-reverse w-full max-w-md bg-content1 hover:bg-content2 items-center",
                    "justify-between cursor-pointer rounded-lg gap-2 px-2 py-4 border-1",
                    "border-primary-400",
                  ),
                }}
              >
                <div className="flex flex-col not-prose">
                  <p className="text-medium">{t("Add dessert")}</p>
                  <p className="text-tiny text-default-400 mt-2">
                    {t("Seasonal fruit or yogurt")}
                  </p>
                </div>
              </Switch>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <h3 className="text-lg">{t("Meal Preferences")}</h3>
          <div className="flex flex-col gap-1 w-full">
            <CheckboxGroup
              className="gap-1"
              classNames={{
                label: "text-gray-600",
              }}
              label={t("Genre")}
              orientation="horizontal"
              value={genres}
              onValueChange={setPlanGenres}
            >
              <Option value={RecipeGenre.JAPANESE.toString()}>
                {t("genre.japanese")}
              </Option>
              <Option value={RecipeGenre.CHINESE.toString()}>
                {t("genre.chinese")}
              </Option>
              <Option value={RecipeGenre.WESTERN.toString()}>
                {t("genre.western")}
              </Option>
              <Option value={RecipeGenre.KOREAN.toString()}>
                {t("genre.korean")}
              </Option>
              <Option value={RecipeGenre.ITALIAN.toString()}>
                {t("genre.italian")}
              </Option>
              <Option value={RecipeGenre.ETHNIC.toString()}>
                {t("genre.ethnic")}
              </Option>
            </CheckboxGroup>
          </div>
          <div>
            <Button
              className="mt-4 text-white h-16"
              color="primary"
              fullWidth
              onPress={onGenerateClick}
              disabled={doGeneratePlan.isPending}
              startContent={<FaMagic />}
            >
              {t("Generate Plan")}
            </Button>
            <div className="text-center text-gray-600 text-sm mt-2">
              {t("AI will generate an appropriate plan")}
            </div>
          </div>
          {doGeneratePlan.isPending && <Spinner />}
        </div>
      </div>
    </div>
  );
}
