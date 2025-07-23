import { Button } from "@heroui/button";
import { Checkbox } from "@heroui/checkbox";
import { Input } from "@heroui/input";
import { Link } from "@heroui/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiCheck, HiShare, HiTrash } from "react-icons/hi";

import { BackButton } from "../../components/BackButton";
import {
  addExtraItemToCart,
  type CartIngredient,
  removeExtraItemFromCart,
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
  const { t } = useTranslation();
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
        <div>{ingredient.selected ? t("Purchased") : t("Needed")}</div>
      </div>
    </Checkbox>
  );
}

function ExtraItem({ item, idx }: { item: string; idx: number }) {
  const onRemoveClick = useCallback(() => {
    removeExtraItemFromCart(idx);
  }, [idx]);

  return (
    <div className="flex items-center gap-2">
      <HiTrash className="h-6 w-6" onClick={onRemoveClick} />
      {item}
    </div>
  );
}

export default function Page() {
  const { t } = useTranslation();

  const cart = useCartStore();

  const [addingItem, setAddingItem] = useState(false);
  const [extraItem, setExtraItem] = useState("");
  const itemInput = useRef<HTMLInputElement | null>(null);

  const onAddItemClick = useCallback(() => {
    setAddingItem(true);
  }, []);

  const onAddItemSubmit = useCallback(() => {
    setAddingItem(false);
    const item = extraItem.trim();
    if (item) {
      addExtraItemToCart(item);
    }
    setExtraItem("");
  }, [extraItem]);

  useEffect(() => {
    if (itemInput.current) {
      if (addingItem) {
        itemInput.current.focus();
      } else {
        itemInput.current.blur();
      }
    }
  }, [addingItem]);

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
    if (cart.extraItems) {
      texts.push(
        `
追加の買い物:

${cart.extraItems.join("\n")}
      `.trim(),
      );
    }
    navigator.share({ text: texts.join("\n\n") });
  }, [cart]);

  return (
    <div className="p-4">
      <div className="flex justify-between items-center">
        <BackButton className="size-6" />
        <h3 className="mt-0 mb-0">{t("Shopping List")}</h3>
        <HiShare onClick={onShareClick} className="size-6 text-orange-400" />
      </div>
      {cart.recipes.length === 0 && (
        <div className="p-4">{t("Cart is empty")}</div>
      )}
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
      {cart.extraItems && (
        <div className="mt-4">
          <h4 className="text-gray-600">{t("Extra Items")}</h4>
          {cart.extraItems.map((ingredient, i) => (
            <ExtraItem
              // biome-ignore lint/suspicious/noArrayIndexKey: free form array so index is the key
              key={i}
              item={ingredient}
              idx={i}
            />
          ))}
        </div>
      )}
      {addingItem ? (
        <div className="flex items-center justify-center gap-2">
          <Input
            ref={itemInput}
            placeholder={t("Item name")}
            className="mt-2"
            value={extraItem}
            onValueChange={setExtraItem}
          />
          <HiCheck onClick={onAddItemSubmit} className="h-8 w-8" />
        </div>
      ) : (
        <Button
          onPress={onAddItemClick}
          fullWidth
          className="text-white mt-2"
          color="primary"
        >
          {t("Add item")}
        </Button>
      )}
    </div>
  );
}
