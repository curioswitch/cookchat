import { Button, Checkbox, Input, TextField } from "@heroui/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { HiCheck, HiTrash } from "react-icons/hi";

import { m } from "../../paraglide/messages";
import {
  addExtraItemToCart,
  type CartIngredient,
  removeExtraItemFromCart,
  removeRecipeFromCart,
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
      className="mt-2 py-1"
      isSelected={ingredient.selected}
      onChange={onValueChange}
    >
      <Checkbox.Control className="line-through">
        <Checkbox.Indicator />
      </Checkbox.Control>
      <Checkbox.Content className="w-full">
        <div className="w-full flex justify-between">
          <div>
            {ingredient.name} ({ingredient.quantity})
          </div>
          <div>
            {ingredient.selected
              ? m.cart_status_purchased()
              : m.cart_status_needed()}
          </div>
        </div>
      </Checkbox.Content>
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

function SwipeableRecipeCard({
  recipe,
}: {
  recipe: {
    id: string;
    title: string;
    servingSize: string;
    ingredients: CartIngredient[];
  };
}) {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const touchStartX = useRef(0);
  const currentOffset = useRef(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    setIsSwiping(true);
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isSwiping) return;
      const diff = e.touches[0].clientX - touchStartX.current;
      // Only allow left swipe (negative offset)
      if (diff < 0) {
        setSwipeOffset(Math.max(diff, -100));
      }
    },
    [isSwiping],
  );

  const handleTouchEnd = useCallback(() => {
    setIsSwiping(false);
    // If swiped more than 50px, show delete button
    if (swipeOffset < -50) {
      setSwipeOffset(-80);
      currentOffset.current = -80;
    } else {
      setSwipeOffset(0);
      currentOffset.current = 0;
    }
  }, [swipeOffset]);

  const handleDelete = useCallback(() => {
    removeRecipeFromCart(recipe.id);
  }, [recipe.id]);

  return (
    <>
      <div className="relative overflow-hidden">
        {/* Delete button background */}
        <div className="absolute right-0 top-0 bottom-0 w-20 bg-red-500 flex items-center justify-center rounded-lg">
          <HiTrash className="h-6 w-6 text-white" />
        </div>
        {/* Swipeable content */}
        <div
          className="relative bg-white transition-transform"
          style={{
            transform: `translateX(${swipeOffset}px)`,
            transition: isSwiping ? "none" : "transform 0.3s ease-out",
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <a
            className="text-gray-600 w-full block"
            href={`/recipes/${recipe.id}`}
          >
            <div className="bg-amber-50 p-4 rounded-lg w-full">
              <div>{recipe.title}</div>
              <div className="text-sm text-gray-400">
                {recipe.servingSize}の素材
              </div>
            </div>
          </a>
        </div>
        {/* Delete confirmation button */}
        {swipeOffset === -80 && (
          <button
            type="button"
            onClick={handleDelete}
            className="absolute right-0 top-0 bottom-0 w-20 bg-red-500 flex items-center justify-center rounded-lg"
          >
            <HiTrash className="h-6 w-6 text-white" />
          </button>
        )}
      </div>
      {recipe.ingredients.map((ingredient, i) => (
        <IngredientSelect
          key={ingredient.name}
          ingredient={ingredient}
          recipeId={recipe.id}
          ingredientIndex={i}
        />
      ))}
    </>
  );
}

export default function Page() {
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

  return (
    <div className="p-4">
      {cart.recipes.length === 0 && (
        <div className="p-4">{m.cart_empty_state()}</div>
      )}
      {cart.recipes.map((recipe) => (
        <div key={recipe.id} className="mt-4">
          <SwipeableRecipeCard recipe={recipe} />
        </div>
      ))}
      {cart.extraItems && (
        <div className="mt-4">
          <h4 className="text-gray-600">{m.cart_extra_items_title()}</h4>
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
          <TextField value={extraItem} onChange={setExtraItem} fullWidth>
            <Input
              ref={itemInput}
              placeholder={m.cart_item_name_placeholder()}
              className="mt-2 bg-white rounded-lg p-2"
            />
          </TextField>
          <HiCheck onClick={onAddItemSubmit} className="h-8 w-8" />
        </div>
      ) : (
        <Button
          onPress={onAddItemClick}
          fullWidth
          className="text-white mt-2 bg-orange-400"
          variant="primary"
        >
          {m.cart_add_item_button()}
        </Button>
      )}
    </div>
  );
}
