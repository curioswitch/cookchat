import { Checkbox, CheckboxGroup } from "@heroui/checkbox";
import { Link } from "@heroui/link";
import { type PrimitiveAtom, useAtom, useAtomValue } from "jotai";
import { focusAtom } from "jotai-optics";
import { splitAtom } from "jotai/utils";
import { useCallback, useMemo } from "react";
import { HiShare } from "react-icons/hi";
import {
  type CartIngredient,
  cartAtom,
  cartRecipeAtomsAtom,
} from "../../atoms";
import { BackButton } from "../../components/BackButton";

function IngredientSelect({
  ingredientAtom,
}: { ingredientAtom: PrimitiveAtom<CartIngredient> }) {
  const [ingredient, setIngredient] = useAtom(ingredientAtom);
  const onValueChange = useCallback(() => {
    setIngredient((prev) => ({
      ...prev,
      selected: !prev.selected,
    }));
  }, [setIngredient]);

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
  const cart = useAtomValue(cartAtom);
  const recipeAtoms = useAtomValue(cartRecipeAtomsAtom);

  const onShareClick = useCallback(() => {
    const texts = [];
    for (const recipe of cart) {
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
      {recipeAtoms.length === 0 && <div className="p-4">カートは空です</div>}
      {recipeAtoms.map((recipeAtom) => {
        const recipe = useAtomValue(recipeAtom);
        const ingredientAtomsAtom = useMemo(
          () =>
            splitAtom(
              focusAtom(recipeAtom, (optic) => optic.prop("ingredients")),
            ),
          [recipeAtom],
        );
        const ingredientAtoms = useAtomValue(ingredientAtomsAtom);
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
            {ingredientAtoms.map((ingredientAtom) => {
              const ingredient = useAtomValue(ingredientAtom);
              return (
                <IngredientSelect
                  key={ingredient.name}
                  ingredientAtom={ingredientAtom}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
