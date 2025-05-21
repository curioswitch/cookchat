import type { RecipeIngredient } from "@cookchat/frontend-api";
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
import { usePageContext } from "vike-react/usePageContext";
import { useFrontendQueries } from "../../../hooks/rpc";

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
  const pageContext = usePageContext();
  const recipeId = pageContext.routeParams.id;

  const queries = useFrontendQueries();
  const getRecipeQuery = queries.getRecipe({ recipeId });

  const { data: recipeRes, isPending } = useQuery(getRecipeQuery);

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
      <div className="flex gap-2">
        <div className="flex-1/3 not-prose">
          <Image src={recipe.imageUrl} />
        </div>
        <div className="flex-2/3">
          <h1 className="text-large">{recipe.title}</h1>
          <p className="px-2 mt-0 mb-0">{recipe.description}</p>
        </div>
      </div>
      <h3>材料</h3>
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
