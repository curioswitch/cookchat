import { Checkbox } from "@heroui/checkbox";
import { Link } from "@heroui/link";
import { useCallback } from "react";
import { HiShare } from "react-icons/hi";
import { BackButton } from "../../components/BackButton";
import {
  type CartIngredient,
  toggleCartIngredientSelection,
  useCartStore,
} from "../../stores";

function IngredientSelect({
  ingredient,
  recipeId,
  ingredientIndex,
}: {
  ingredient: CartIngredient;
  recipeId: string;
  ingredientIndex: number;
}) {
  const onValueChange = useCallback(() => {
    toggleCartIngredientSelection(recipeId, ingredientIndex);
  }, [recipeId, ingredientIndex]);

  return (
    <Checkbox
      value={ingredient.name}
      lineThrough
      className="mt-2 w-full max-w-full"
      classNames={{
        base: "w-full",
        label: "w-full",
      }}
      isSelected={ingredient.selected}
      onValueChange={onValueChange}
    >
      <div className="flex justify-between w-full">
        <div>
          {ingredient.name} ({ingredient.quantity})
        </div>
        <div>{ingredient.selected ? "購入済み" : "必要"}</div>
      </div>
    </Checkbox>
  );
}

export default function Page() {
  const cart = useCartStore();

  const onShareClick = useCallback(() => {
    const texts = [];
    for (const recipe of cart.recipes) {
      texts.push(
        `
${recipe.title}
${import.meta.env.PUBLIC_ENV__URL_BASE}recipes/${recipe.id}

${recipe.ingredients
  .filter((ingredient) => !ingredient.selected)
  .map((ingredient) => `${ingredient.name} (${ingredient.quantity})`)
  .join("\n")}
`.trim(),
      );
    }
    navigator.share({ text: texts.join("\n\n") });
  }, [cart]);

  return (
    <div className="p-4">
      <div className="flex justify-between items-center">
        <BackButton className="size-6" />
        <h3 className="mt-0 mb-0">買い物リスト</h3>
        <HiShare onClick={onShareClick} className="size-6 text-orange-400" />
      </div>
      {cart.recipes.length === 0 && <div className="p-4">カートは空です</div>}
      {cart.recipes.map((recipe) => {
        return (
          <div key={recipe.id} className="mt-4">
            <Link
              className="text-gray-600 w-full"
              href={`/recipes/${recipe.id}`}
            >
              <div className="bg-amber-50 p-4 rounded-lg w-full">
                <div>{recipe.title}</div>
                <div className="text-sm text-gray-400">
                  {recipe.servingSize}の素材
                </div>
              </div>
            </Link>
            {recipe.ingredients.map((ingredient, i) => {
              return (
                <IngredientSelect
                  key={ingredient.name}
                  ingredient={ingredient}
                  recipeId={recipe.id}
                  ingredientIndex={i}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
