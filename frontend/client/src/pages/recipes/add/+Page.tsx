import { create } from "@bufbuild/protobuf";
import { useMutation } from "@connectrpc/connect-query";
import {
  type AddRecipeRequest,
  type AddRecipeRequest_AddRecipeStep,
  AddRecipeRequest_AddRecipeStepSchema,
  AddRecipeRequestSchema,
  addRecipe,
  generateRecipe,
  type IngredientSection,
  IngredientSectionSchema,
  type RecipeIngredient,
  RecipeIngredientSchema,
} from "@cookchat/frontend-api";
import { Button } from "@heroui/button";
import { Form } from "@heroui/form";
import { Input, Textarea } from "@heroui/input";
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useState,
} from "react";
import { useDropzone } from "react-dropzone";
import { useTranslation } from "react-i18next";
import { HiTrash } from "react-icons/hi";
import { navigate } from "vike/client/router";

function IngredientInput({
  idx,
  sectionIdx,
  ingredient,
  setRequest,
}: {
  idx: number;
  sectionIdx?: number;
  ingredient: RecipeIngredient;
  setRequest: Dispatch<SetStateAction<AddRecipeRequest>>;
}) {
  const { t } = useTranslation();
  const onNameChange = useCallback(
    (value: string) =>
      setRequest((prev) => {
        if (sectionIdx) {
          const ingredients = [
            ...prev.additionalIngredients[sectionIdx].ingredients,
          ];
          ingredients[idx] = {
            ...ingredients[idx],
            name: value,
          };
          return {
            ...prev,
            additionalIngredients: prev.additionalIngredients.map((sec, i) =>
              i === sectionIdx ? { ...sec, ingredients } : sec,
            ),
          };
        }
        const ingredients = [...prev.ingredients];
        ingredients[idx] = {
          ...ingredients[idx],
          name: value,
        };
        return { ...prev, ingredients };
      }),
    [idx, setRequest, sectionIdx],
  );
  const onQuantityChange = useCallback(
    (value: string) =>
      setRequest((prev) => {
        if (sectionIdx) {
          const ingredients = [
            ...prev.additionalIngredients[sectionIdx].ingredients,
          ];
          ingredients[idx] = {
            ...ingredients[idx],
            quantity: value,
          };
          return {
            ...prev,
            additionalIngredients: prev.additionalIngredients.map((sec, i) =>
              i === sectionIdx ? { ...sec, ingredients } : sec,
            ),
          };
        }
        const ingredients = [...prev.ingredients];
        ingredients[idx] = {
          ...ingredients[idx],
          quantity: value,
        };
        return { ...prev, ingredients };
      }),
    [idx, setRequest, sectionIdx],
  );
  const onRemoveClick = useCallback(() => {
    setRequest((prev) => {
      if (sectionIdx) {
        const ingredients = [
          ...prev.additionalIngredients[sectionIdx].ingredients,
        ];
        ingredients.splice(idx, 1);
        return {
          ...prev,
          additionalIngredients: prev.additionalIngredients.map((sec, i) =>
            i === sectionIdx ? { ...sec, ingredients } : sec,
          ),
        };
      }
      const ingredients = [...prev.ingredients];
      ingredients.splice(idx, 1);
      return { ...prev, ingredients };
    });
  }, [idx, setRequest, sectionIdx]);

  return (
    <div className="flex items-center gap-2">
      <Input
        label={t("Ingredient")}
        labelPlacement="outside"
        value={ingredient.name}
        onValueChange={onNameChange}
      />
      <Input
        label={t("Quantity")}
        labelPlacement="outside"
        value={ingredient.quantity}
        onValueChange={onQuantityChange}
      />
      <Button onPress={onRemoveClick}>
        <HiTrash className="size-14" />
      </Button>
    </div>
  );
}

function IngredientSectionInput({
  idx,
  section,
  setRequest,
}: {
  idx: number;
  section: IngredientSection;
  setRequest: Dispatch<SetStateAction<AddRecipeRequest>>;
}) {
  const { t } = useTranslation();
  const setTitle = useCallback(
    (name: string) =>
      setRequest((prev) => {
        const sections = [...(prev.additionalIngredients ?? [])];
        sections[idx] = {
          ...sections[idx],
          title: name,
        };
        return { ...prev, additionalIngredients: sections };
      }),
    [idx, setRequest],
  );
  const addIngredient = useCallback(() => {
    setRequest((prev) => {
      const sections = [...(prev.additionalIngredients ?? [])];
      const ingredients = [...(sections[idx]?.ingredients ?? [])];
      ingredients.push(create(RecipeIngredientSchema, {}));
      sections[idx] = {
        ...sections[idx],
        ingredients,
      };
      return { ...prev, additionalIngredients: sections };
    });
  }, [idx, setRequest]);

  const removeSection = useCallback(() => {
    setRequest((prev) => {
      const sections = [...(prev.additionalIngredients ?? [])];
      sections.splice(idx, 1);
      return { ...prev, additionalIngredients: sections };
    });
  }, [idx, setRequest]);

  return (
    <div className="border-1 w-full">
      <Input
        label={t("Section Name")}
        labelPlacement="outside"
        value={section.title}
        onValueChange={setTitle}
      />
      {section.ingredients.map((ingredient, i) => (
        <IngredientInput
          // biome-ignore lint/suspicious/noArrayIndexKey: input form
          key={i}
          idx={i}
          sectionIdx={idx}
          ingredient={ingredient}
          setRequest={setRequest}
        />
      ))}
      <div>
        <Button className="mt-4" onPress={addIngredient}>
          {t("Add Ingredient")}
        </Button>
      </div>
      <div>
        <Button className="mt-4" onPress={removeSection}>
          {t("Remove Section")}
        </Button>
      </div>
    </div>
  );
}

function MainIngredientsInput({
  ingredients,
  setRequest,
}: {
  ingredients: RecipeIngredient[];
  setRequest: Dispatch<SetStateAction<AddRecipeRequest>>;
}) {
  const { t } = useTranslation();
  const addIngredient = useCallback(() => {
    setRequest((prev) => {
      const ingredients = [...(prev.ingredients ?? [])];
      ingredients.push(create(RecipeIngredientSchema, {}));
      return { ...prev, ingredients };
    });
  }, [setRequest]);
  return (
    <div className="border-1 w-full">
      <h3>{t("Main Ingredients")}</h3>
      {ingredients.map((ingredient, i) => (
        <IngredientInput
          // biome-ignore lint/suspicious/noArrayIndexKey: input form
          key={i}
          idx={i}
          ingredient={ingredient}
          setRequest={setRequest}
        />
      ))}
      <Button className="mt-4" onPress={addIngredient}>
        {t("Add Ingredient")}
      </Button>
    </div>
  );
}

function Step({
  idx,
  step,
  setRequest,
}: {
  idx: number;
  step: AddRecipeRequest_AddRecipeStep;
  setRequest: Dispatch<SetStateAction<AddRecipeRequest>>;
}) {
  const { t } = useTranslation();

  const setDescription = useCallback(
    (description: string) =>
      setRequest((prev) => {
        const steps = [...(prev.steps ?? [])];
        steps[idx] = {
          ...steps[idx],
          description,
        };
        return { ...prev, steps };
      }),
    [idx, setRequest],
  );

  const removeStep = useCallback(() => {
    setRequest((prev) => {
      const steps = [...(prev.steps ?? [])];
      steps.splice(idx, 1);
      return { ...prev, steps };
    });
  }, [idx, setRequest]);

  const { getRootProps, getInputProps } = useDropzone({
    maxFiles: 1,
    accept: {
      "image/*": [],
    },
    onDrop: async (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0];

        const url = await readFile(file);

        setRequest((prev) => {
          const steps = [...(prev.steps ?? [])];
          steps[idx] = {
            ...steps[idx],
            imageDataUrl: url,
          };
          return { ...prev, steps };
        });
      }
    },
  });

  return (
    <div className="border-1 w-full">
      <Textarea
        label={t("Step Description")}
        labelPlacement="outside"
        value={step.description}
        onValueChange={setDescription}
      />
      <label htmlFor="step-image">{t("Step Image")}</label>
      <div className="flex gap-4 items-center">
        <div className="mt-2 p-4 rounded-xl bg-gray-100" {...getRootProps()}>
          <input {...getInputProps()} />
          <p>Drag 'n' drop or click to select image</p>
        </div>
        <img
          className={step.imageDataUrl ? "h-100" : "hidden"}
          alt="Step"
          src={step.imageDataUrl}
        />
      </div>
      <Button onPress={removeStep}>{t("Remove Step")}</Button>
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
  const [prompt, setPrompt] = useState("");

  const doGenerateRecipe = useMutation(generateRecipe, {
    onSuccess: (res) => {
      if (res.addRecipeRequest) {
        setRequest(res.addRecipeRequest);
      }
    },
  });

  const onGenerateClick = useCallback(() => {
    doGenerateRecipe.mutate({
      prompt,
    });
  }, [doGenerateRecipe, prompt]);

  const [request, setRequest] = useState<AddRecipeRequest>(
    create(AddRecipeRequestSchema, {}),
  );
  const setTitle = useCallback((title: string) => {
    setRequest((prev) => ({ ...prev, title }));
  }, []);
  const setDescription = useCallback((description: string) => {
    setRequest((prev) => ({ ...prev, description }));
  }, []);
  const setServingSize = useCallback((servingSize: string) => {
    setRequest((prev) => ({ ...prev, servingSize }));
  }, []);

  const { getRootProps, getInputProps } = useDropzone({
    maxFiles: 1,
    accept: {
      "image/*": [],
    },
    onDrop: async (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0];

        const url = await readFile(file);

        setRequest((prev) => {
          return {
            ...prev,
            mainImageDataUrl: url,
          };
        });
      }
    },
  });

  const addStep = useCallback(() => {
    setRequest((prev) => {
      const steps = [...(prev.steps ?? [])];
      steps.push(create(AddRecipeRequest_AddRecipeStepSchema, {}));
      return {
        ...prev,
        steps,
      };
    });
  }, []);

  const addIngredientSection = useCallback(() => {
    setRequest((prev) => {
      const sections = [...(prev.additionalIngredients ?? [])];
      sections.push(create(IngredientSectionSchema, {}));
      return { ...prev, additionalIngredients: sections };
    });
  }, []);

  const doAddRecipe = useMutation(addRecipe, {
    onSuccess: (res) => {
      navigate(`/recipes/${res.recipeId}`);
    },
  });

  const onSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      doAddRecipe.mutate(request);
    },
    [doAddRecipe, request],
  );

  return (
    <div className="p-4">
      <Textarea
        label="Generate Recipe Prompt"
        value={prompt}
        onValueChange={setPrompt}
      />
      <Button
        className="mt-2"
        onPress={onGenerateClick}
        disabled={doGenerateRecipe.isPending}
      >
        Generate Recipe
      </Button>
      {doGenerateRecipe.isPending && <div>Generating recipe...</div>}
      <hr />
      <Form onSubmit={onSubmit}>
        <Input
          label="Title"
          labelPlacement="outside-top"
          value={request.title}
          onValueChange={setTitle}
        />
        <Textarea
          label="Description"
          labelPlacement="outside"
          value={request.description}
          onValueChange={setDescription}
        />
        <Input
          label="Serving Size"
          labelPlacement="outside-top"
          value={request.servingSize}
          onValueChange={setServingSize}
        />
        <div className="flex gap-4 items-center">
          <div className="mt-2 p-4 rounded-xl bg-gray-100" {...getRootProps()}>
            <input {...getInputProps()} />
            <p>Drag 'n' drop or click to select image</p>
          </div>
          <img
            className={request.mainImageDataUrl ? "h-100" : "hidden"}
            alt="Recipe"
            src={request.mainImageDataUrl}
          />
        </div>
        <MainIngredientsInput
          ingredients={request.ingredients}
          setRequest={setRequest}
        />
        {request.additionalIngredients.map((section, i) => (
          <IngredientSectionInput
            // biome-ignore lint/suspicious/noArrayIndexKey: input form
            key={i}
            idx={i}
            section={section}
            setRequest={setRequest}
          />
        ))}
        <Button className="mt-4" onPress={addIngredientSection}>
          Add Section
        </Button>
        <h3 className="mt-4">Steps</h3>
        {request.steps?.map((step, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: input form
          <Step key={i} idx={i} step={step} setRequest={setRequest} />
        ))}
        <Button className="mt-4" onPress={addStep}>
          Add Step
        </Button>
        <Button type="submit" className="mt-4" disabled={doAddRecipe.isPending}>
          Submit Recipe
        </Button>
      </Form>
    </div>
  );
}
