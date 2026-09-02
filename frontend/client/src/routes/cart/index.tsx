import { Button, Checkbox, Input, TextField } from "@heroui/react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FaAmazon } from "react-icons/fa";
import { FiExternalLink, FiShoppingBag } from "react-icons/fi";
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

import {
  getAmazonFreshSearchStep,
  getAmazonFreshStorefrontUrl,
  getAmazonShoppingItems,
  getSeikatsuClubSearchStep,
  scrollAmazonSearchResultsIntoView,
} from "./-amazonFresh";

function IngredientSelect({
  ingredient,
  recipeId,
  ingredientIndex,
}: {
  ingredient: CartIngredient;
  recipeId: string;
  ingredientIndex: number;
}) {
  const onValueChange = useCallback(
    (selected: boolean) => {
      if (selected !== ingredient.selected) {
        toggleCartIngredientSelection(recipeId, ingredientIndex);
      }
    },
    [ingredient.selected, recipeId, ingredientIndex],
  );

  return (
    <Checkbox
      value={ingredient.name}
      className="mt-2 w-full py-1"
      isSelected={ingredient.selected}
      onChange={onValueChange}
    >
      <Checkbox.Content className="w-full">
        <Checkbox.Control>
          <Checkbox.Indicator />
        </Checkbox.Control>
        <div className="flex w-full min-w-0 justify-between gap-2">
          <div className={ingredient.selected ? "line-through" : undefined}>
            {ingredient.name} ({ingredient.quantity})
          </div>
          <div className="shrink-0 text-gray-400">
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
        <div className="absolute right-0 top-0 bottom-0 w-20 bg-red-500 flex items-center justify-center rounded-lg">
          <HiTrash className="h-6 w-6 text-white" />
        </div>
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
          <Link
            to="/recipes/$id"
            params={{ id: recipe.id }}
            className="text-gray-600 w-full block"
          >
            <div className="bg-yellow-50 p-4 rounded-lg w-full">
              <div>{recipe.title}</div>
              <div className="text-sm text-gray-400">
                {recipe.servingSize}の素材
              </div>
            </div>
          </Link>
        </div>
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

export const Route = createFileRoute("/cart/")({
  component: Page,
});

function Page() {
  const cart = useCartStore();

  const [addingItem, setAddingItem] = useState(false);
  const [showAmazonSearch, setShowAmazonSearch] = useState(false);
  const [amazonSearchIndex, setAmazonSearchIndex] = useState(0);
  const [showSeikatsuClubSearch, setShowSeikatsuClubSearch] = useState(false);
  const [seikatsuClubSearchIndex, setSeikatsuClubSearchIndex] = useState(0);
  const [extraItem, setExtraItem] = useState("");
  const itemInput = useRef<HTMLInputElement | null>(null);
  const amazonSearchResults = useRef<HTMLElement | null>(null);
  const seikatsuClubSearchResults = useRef<HTMLElement | null>(null);
  const amazonShoppingItems = useMemo(
    () => getAmazonShoppingItems(cart),
    [cart],
  );
  const amazonSearchStep = useMemo(
    () => getAmazonFreshSearchStep(amazonShoppingItems, amazonSearchIndex),
    [amazonShoppingItems, amazonSearchIndex],
  );
  const seikatsuClubSearchStep = useMemo(
    () =>
      getSeikatsuClubSearchStep(amazonShoppingItems, seikatsuClubSearchIndex),
    [amazonShoppingItems, seikatsuClubSearchIndex],
  );

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

  const onAmazonSearchToggle = useCallback(() => {
    if (!showAmazonSearch) {
      setAmazonSearchIndex(0);
    }
    setShowAmazonSearch(!showAmazonSearch);
  }, [showAmazonSearch]);

  const onSeikatsuClubSearchToggle = useCallback(() => {
    if (!showSeikatsuClubSearch) {
      setSeikatsuClubSearchIndex(0);
    }
    setShowSeikatsuClubSearch(!showSeikatsuClubSearch);
  }, [showSeikatsuClubSearch]);

  useEffect(() => {
    if (itemInput.current) {
      if (addingItem) {
        itemInput.current.focus();
      } else {
        itemInput.current.blur();
      }
    }
  }, [addingItem]);

  useEffect(() => {
    if (showAmazonSearch && amazonSearchResults.current) {
      scrollAmazonSearchResultsIntoView(amazonSearchResults.current);
    }
  }, [showAmazonSearch]);

  useEffect(() => {
    if (showSeikatsuClubSearch && seikatsuClubSearchResults.current) {
      scrollAmazonSearchResultsIntoView(seikatsuClubSearchResults.current);
    }
  }, [showSeikatsuClubSearch]);

  const nextAmazonItem = useCallback(() => {
    if (!amazonSearchStep) return;
    const nextIndex = amazonSearchStep.nextIndex;
    window.setTimeout(() => {
      setAmazonSearchIndex(nextIndex);
    });
  }, [amazonSearchStep]);

  const nextSeikatsuClubItem = useCallback(() => {
    if (!seikatsuClubSearchStep) return;
    const nextIndex = seikatsuClubSearchStep.nextIndex;
    window.setTimeout(() => {
      setSeikatsuClubSearchIndex(nextIndex);
    });
  }, [seikatsuClubSearchStep]);

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
          className="text-white mt-2 bg-yellow-400"
          variant="primary"
        >
          {m.cart_add_item_button()}
        </Button>
      )}
      {amazonShoppingItems.length > 0 && (
        <div className="mt-4">
          <Button
            onPress={onAmazonSearchToggle}
            fullWidth
            className="bg-yellow-400 text-white"
            variant="primary"
            aria-expanded={showAmazonSearch}
            aria-controls="amazon-shopping-results"
          >
            <FaAmazon aria-hidden />
            {m.cart_amazon_fresh_button()}
          </Button>
          {showAmazonSearch && (
            <section
              ref={amazonSearchResults}
              id="amazon-shopping-results"
              className="mt-3 scroll-mb-4 rounded-xl bg-yellow-50 p-4"
            >
              <h3 className="text-gray-700">{m.cart_amazon_fresh_title()}</h3>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-gray-700">
                {amazonShoppingItems.map((item, index) => (
                  <li
                    key={item}
                    className={`break-words ${
                      index < amazonSearchIndex
                        ? "text-gray-400 line-through"
                        : index === amazonSearchIndex
                          ? "font-semibold text-yellow-700"
                          : ""
                    }`}
                  >
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-gray-500">
                {m.cart_amazon_fresh_hint()}
              </p>
              {amazonSearchStep ? (
                <>
                  <p className="mt-4 text-center text-sm text-gray-600">
                    {m.cart_amazon_fresh_progress({
                      current: amazonSearchStep.current + 1,
                      total: amazonSearchStep.total,
                    })}
                  </p>
                  <a
                    href={amazonSearchStep.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={nextAmazonItem}
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-yellow-400 px-4 py-3 text-center font-semibold text-white"
                  >
                    {m.cart_amazon_fresh_search_item({
                      item: amazonSearchStep.item,
                    })}
                    <FiExternalLink aria-hidden />
                  </a>
                </>
              ) : (
                <div className="mt-4 text-center">
                  <p className="font-semibold text-gray-700">
                    {m.cart_amazon_fresh_complete()}
                  </p>
                  <a
                    href={getAmazonFreshStorefrontUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-yellow-400 px-4 py-3 font-semibold text-white"
                  >
                    {m.cart_amazon_fresh_open_store()}
                    <FiExternalLink aria-hidden />
                  </a>
                </div>
              )}
            </section>
          )}
        </div>
      )}
      {amazonShoppingItems.length > 0 && (
        <div className="mt-3">
          <Button
            onPress={onSeikatsuClubSearchToggle}
            fullWidth
            className="bg-yellow-400 text-white"
            variant="primary"
            aria-expanded={showSeikatsuClubSearch}
            aria-controls="seikatsu-club-shopping-results"
          >
            <FiShoppingBag aria-hidden />
            {m.cart_seikatsu_club_button()}
          </Button>
          {showSeikatsuClubSearch && (
            <section
              ref={seikatsuClubSearchResults}
              id="seikatsu-club-shopping-results"
              className="mt-3 scroll-mb-4 rounded-xl bg-yellow-50 p-4"
            >
              <h3 className="text-gray-700">{m.cart_seikatsu_club_title()}</h3>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-gray-700">
                {amazonShoppingItems.map((item, index) => (
                  <li
                    key={item}
                    className={`break-words ${
                      index < seikatsuClubSearchIndex
                        ? "text-gray-400 line-through"
                        : index === seikatsuClubSearchIndex
                          ? "font-semibold text-yellow-700"
                          : ""
                    }`}
                  >
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-gray-500">
                {m.cart_seikatsu_club_hint()}
              </p>
              {seikatsuClubSearchStep ? (
                <>
                  <p className="mt-4 text-center text-sm text-gray-600">
                    {m.cart_seikatsu_club_progress({
                      current: seikatsuClubSearchStep.current + 1,
                      total: seikatsuClubSearchStep.total,
                    })}
                  </p>
                  <a
                    href={seikatsuClubSearchStep.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={nextSeikatsuClubItem}
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-yellow-400 px-4 py-3 text-center font-semibold text-white"
                  >
                    {m.cart_seikatsu_club_search_item({
                      item: seikatsuClubSearchStep.item,
                    })}
                    <FiExternalLink aria-hidden />
                  </a>
                </>
              ) : (
                <div className="mt-4 text-center">
                  <p className="font-semibold text-gray-700">
                    {m.cart_seikatsu_club_complete()}
                  </p>
                  <a
                    href="https://shop.seikatsuclub.coop/eclub_top.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-yellow-400 px-4 py-3 font-semibold text-white"
                  >
                    {m.cart_seikatsu_club_open_store()}
                    <FiExternalLink aria-hidden />
                  </a>
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
