import type { RecipeIngredient } from "@cookchat/frontend-api";
import { Button } from "@heroui/button";
import { Image } from "@heroui/image";
import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/table";
import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { usePageContext } from "vike-react/usePageContext";
import { useFrontendQueries } from "../../../hooks/rpc";
import ChatButton from "./ChatButton";

function Ingredients({ ingredients }: { ingredients: RecipeIngredient[] }) {
  return (
    <Table
      className="not-prose"
      hideHeader
      radius="none"
      shadow="none"
      aria-label="Recipe Ingredients"
    >
      <TableHeader>
        <TableColumn>名前</TableColumn>
        <TableColumn>量</TableColumn>
      </TableHeader>
      <TableBody>
        {ingredients.map((ingredient) => (
          <TableRow key={ingredient.name}>
            <TableCell>{ingredient.name}</TableCell>
            <TableCell>{ingredient.quantity}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default function Page() {
  const { t } = useTranslation();

  const pageContext = usePageContext();
  const recipeId = pageContext.routeParams.id;

  const queries = useFrontendQueries();
  const getRecipeQuery = queries.getRecipe({ recipeId });

  const { data: recipeRes, isPending } = useQuery(getRecipeQuery);

  const onIngredientsShare = useCallback(() => {
    if (!recipeRes) {
      return;
    }
    const recipe = recipeRes.recipe;
    if (!recipe) {
      return;
    }

    const ingredients = [
      ...recipe.ingredients,
      ...recipe.additionalIngredients.flatMap((section) => section.ingredients),
    ];

    const text = `
${recipe.title}

${ingredients
  .map((ingredient) => `${ingredient.name} ${ingredient.quantity}`)
  .join("\n")
  .trim()}
    `.trim();

    navigator.share({ text });
  }, [recipeRes]);

  if (isPending) {
    return <div>Loading...</div>;
  }

  if (!recipeRes) {
    throw new Error("Failed to load recipe");
  }

  const recipe = recipeRes.recipe;
  if (!recipe) {
    throw new Error("Recipe not received");
  }

  return (
    <div className="p-4">
      <Image src={recipe.imageUrl} />
      <div className="mb-4">
        <h1 className="text-large">{recipe.title}</h1>
        <p className="px-2 mt-0 mb-0">{recipe.description}</p>
      </div>
      <ChatButton recipeId={recipe.id} />
      <h3 className="flex items-center justify-between">
        {t("Ingredients")}
        <Button onPress={onIngredientsShare}>材料共有</Button>
      </h3>
      <p className="not-prose">{recipe.servingSize}</p>
      <Ingredients ingredients={recipe.ingredients} />
      {recipe.additionalIngredients.map((section, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
        <div key={i}>
          <h3>{section.title}</h3>
          <Ingredients ingredients={section.ingredients} />
        </div>
      ))}
      <h3>作り方</h3>
      <ol className="[&_li]:marker:font-bold">
        {recipe.steps.map((step, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
          <li key={i}>
            <p>{step.description}</p>
            {step.imageUrl && <Image width="100%" src={step.imageUrl} />}
          </li>
        ))}
      </ol>
    </div>
  );
}
