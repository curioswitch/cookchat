import { useMutation } from "@connectrpc/connect-query";
import { generatePlan, RecipeGenre } from "@cookchat/frontend-api";
import { Button } from "@heroui/button";
import { CheckboxGroup, useCheckbox } from "@heroui/checkbox";
import { Chip } from "@heroui/chip";
import { Input } from "@heroui/input";
import { NumberInput } from "@heroui/number-input";
import { Spinner } from "@heroui/spinner";
import { Switch } from "@heroui/switch";
import { cn, tv } from "@heroui/theme";
import { VisuallyHidden } from "@react-aria/visually-hidden";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { navigate } from "vike/client/router";

function Option(props: { value: string; children: React.ReactNode }) {
  const checkbox = tv({
    slots: {
      base: "border-default hover:bg-default-200",
      content: "text-default-500",
    },
    variants: {
      isSelected: {
        true: {
          base: "border-primary bg-primary hover:bg-primary-500 hover:border-primary-500",
          content: "text-primary-foreground pl-1",
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

export default function Page() {
  const { t } = useTranslation();

  const [numDays, setNumDays] = useState(1);
  const [ingredients, setIngredients] = useState<string>("");
  const [genres, setGenres] = useState<string[]>([]);

  console.log(genres);
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
    });
  }, [doGeneratePlan, ingredients, genres, numDays]);

  return (
    <div>
      <h3>{t("Conditions")}</h3>
      <div>
        <NumberInput
          label={t("Number of days")}
          value={numDays}
          onValueChange={setNumDays}
        />
      </div>
      <div>
        <Input
          label={t("Ingredients to include")}
          value={ingredients}
          onValueChange={setIngredients}
        />
      </div>
      <div>
        <Switch
          classNames={{
            base: cn(
              "inline-flex flex-row-reverse w-full max-w-md bg-content1 hover:bg-content2 items-center",
              "justify-between cursor-pointer rounded-lg gap-2 p-4 border-2 border-transparent",
              "data-[selected=true]:border-primary",
            ),
          }}
        >
          <div className="flex flex-col not-prose">
            <p className="text-medium">{t("Add dessert")}</p>
            <p className="text-tiny text-default-400">
              {t("Seasonal fruit or yogurt")}
            </p>
          </div>
        </Switch>
      </div>
      <h3>{t("Preferences")}</h3>
      <div className="flex flex-col gap-1 w-full">
        <CheckboxGroup
          className="gap-1"
          label={t("Genre")}
          orientation="horizontal"
          value={genres}
          onValueChange={setGenres}
        >
          <Option value={RecipeGenre.JAPANESE.toString()}>
            {t("Japanese Food")}
          </Option>
          <Option value={RecipeGenre.CHINESE.toString()}>{t("Chinese")}</Option>
          <Option value={RecipeGenre.WESTERN.toString()}>{t("Western")}</Option>
          <Option value={RecipeGenre.KOREAN.toString()}>{t("Korean")}</Option>
          <Option value={RecipeGenre.ITALIAN.toString()}>{t("Italian")}</Option>
          <Option value={RecipeGenre.ETHNIC.toString()}>{t("Ethnic")}</Option>
        </CheckboxGroup>
      </div>
      <Button
        className="mt-4"
        fullWidth
        onPress={onGenerateClick}
        disabled={doGeneratePlan.isPending}
      >
        Generate
      </Button>
      {doGeneratePlan.isPending && <Spinner />}
    </div>
  );
}
