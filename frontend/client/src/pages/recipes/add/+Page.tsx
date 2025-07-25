import { create, type MessageInitShape } from "@bufbuild/protobuf";
import { useMutation } from "@connectrpc/connect-query";
import {
  type AddRecipeRequest_AddRecipeStepSchema,
  AddRecipeRequestSchema,
  addRecipe,
  type IngredientSectionSchema,
  RecipeIngredientSchema,
} from "@cookchat/frontend-api";
import { Button } from "@heroui/button";
import { Form } from "@heroui/form";
import { Input, Textarea } from "@heroui/input";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { navigate } from "vike/client/router";

function IngredientInput() {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-2">
      <Input
        name="ingredient"
        label={t("Ingredient")}
        labelPlacement="outside"
      />
      <Input name="quantity" label={t("Quantity")} labelPlacement="outside" />
    </div>
  );
}

function IngredientSectionInput({ idx }: { idx: number }) {
  const { t } = useTranslation();
  const [numIngredients, setNumIngredients] = useState(1);
  const onAddIngredient = () => {
    setNumIngredients((prev) => prev + 1);
  };
  return (
    <div>
      {idx === 0 ? (
        <h3>{t("Main Ingredients")}</h3>
      ) : (
        <Input
          name="section"
          label={t("Section Name")}
          labelPlacement="outside"
        />
      )}
      {Array.from({ length: numIngredients }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: input form
        <IngredientInput key={i} />
      ))}
      <Button className="mt-4" onPress={onAddIngredient}>
        {t("Add Ingredient")}
      </Button>
    </div>
  );
}

function Step() {
  const { t } = useTranslation();

  return (
    <div>
      <Textarea
        name="step-description"
        label={t("Step Description")}
        labelPlacement="outside"
      />
      <Input
        type="file"
        accept="image/*"
        name="step-image"
        label={t("Step Image")}
        labelPlacement="outside"
      />
    </div>
  );
}

async function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("File read error"));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function Page() {
  const [numSections, setNumSections] = useState(1);
  const onAddSection = useCallback(() => {
    setNumSections((prev) => prev + 1);
  }, []);
  const [numSteps, setNumSteps] = useState(1);
  const onAddStep = useCallback(() => {
    setNumSteps((prev) => prev + 1);
  }, []);

  const doAddRecipe = useMutation(addRecipe, {
    onSuccess: (res) => {
      navigate(`/recipes/${res.recipeId}`);
    },
  });

  const onSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const data = new FormData(e.currentTarget);

      const request: MessageInitShape<typeof AddRecipeRequestSchema> = {};
      request.ingredients = [];
      request.additionalIngredients = [];
      request.steps = [];

      let currentSection:
        | MessageInitShape<typeof IngredientSectionSchema>
        | undefined;
      let currentStep:
        | MessageInitShape<typeof AddRecipeRequest_AddRecipeStepSchema>
        | undefined;
      let currentIngredient:
        | MessageInitShape<typeof RecipeIngredientSchema>
        | undefined;

      for (const [key, value] of data.entries()) {
        console.log(`${key}: ${value}`);
        switch (key) {
          case "title":
            request.title = String(value);
            break;
          case "description":
            request.description = String(value);
            break;
          case "servingSize":
            request.servingSize = String(value);
            break;
          case "image":
            request.mainImageDataUrl = await readFile(value as File);
            break;
          case "section":
            if (currentIngredient) {
              if (currentSection) {
                currentSection.ingredients?.push(
                  create(RecipeIngredientSchema, currentIngredient),
                );
              } else {
                request.ingredients.push(currentIngredient);
              }
              currentIngredient = undefined;
            }
            if (currentSection) {
              request.additionalIngredients.push(currentSection);
            }
            currentSection = {
              title: String(value),
            };
            currentSection.ingredients = [];
            break;
          case "ingredient":
            if (currentIngredient) {
              if (currentSection) {
                currentSection.ingredients?.push(
                  create(RecipeIngredientSchema, currentIngredient),
                );
              } else {
                request.ingredients.push(currentIngredient);
              }
            }
            currentIngredient = {
              name: String(value),
            };
            break;
          case "quantity":
            if (currentIngredient) {
              currentIngredient.quantity = String(value);
            }
            break;
          case "step-description":
            if (currentStep) {
              request.steps.push(currentStep);
            }
            currentStep = {
              description: String(value),
            };
            break;
          case "step-image":
            if (currentStep) {
              currentStep.imageDataUrl = await readFile(value as File);
            }
            break;
          default:
        }
      }
      if (currentIngredient) {
        if (currentSection) {
          currentSection.ingredients?.push(
            create(RecipeIngredientSchema, currentIngredient),
          );
        } else {
          request.ingredients.push(
            create(RecipeIngredientSchema, currentIngredient),
          );
        }
      }
      if (currentSection) {
        request.additionalIngredients.push(currentSection);
      }
      if (currentStep) {
        request.steps.push(currentStep);
      }
      doAddRecipe.mutate(create(AddRecipeRequestSchema, request));
    },
    [doAddRecipe],
  );

  return (
    <div className="p-4">
      <Form onSubmit={onSubmit}>
        <Input name="title" label="Title" labelPlacement="outside-top" />
        <Textarea
          name="description"
          label="Description"
          labelPlacement="outside"
        />
        <Input
          name="servingSize"
          label="Serving Size"
          labelPlacement="outside-top"
        />
        <Input
          type="file"
          accept="image/*"
          name="image"
          label="Main Image"
          labelPlacement="outside"
        />
        {Array.from({ length: numSections }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: input form
          <IngredientSectionInput key={i} idx={i} />
        ))}
        <Button className="mt-4" onPress={onAddSection}>
          Add Section
        </Button>
        <h3 className="mt-4">Steps</h3>
        {Array.from({ length: numSteps }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: input form
          <Step key={i} />
        ))}
        <Button className="mt-4" onPress={onAddStep}>
          Add Step
        </Button>
        <Button type="submit" className="mt-4" disabled={doAddRecipe.isPending}>
          Submit Recipe
        </Button>
      </Form>
    </div>
  );
}
