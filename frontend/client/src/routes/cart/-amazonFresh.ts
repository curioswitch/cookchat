import type { CartStore } from "../../stores";

export function getAmazonShoppingItems(cart: CartStore): string[] {
  const items = [
    ...cart.recipes.flatMap((recipe) =>
      recipe.ingredients
        .filter((ingredient) => !ingredient.selected)
        .map((ingredient) => ingredient.name),
    ),
    ...(cart.extraItems ?? []),
  ];

  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}

export function getAmazonFreshStorefrontUrl(): string {
  return "https://www.amazon.co.jp/fmc/storefront?almBrandId=QW1hem9uIEZyZXNo";
}

export type ShoppingSearchStep = {
  item: string;
  current: number;
  total: number;
  nextIndex: number;
  url: string;
};

export function getAmazonFreshSearchStep(
  items: string[],
  index: number,
): ShoppingSearchStep | undefined {
  const item = items[index];
  if (!item) return undefined;

  const url = new URL("https://www.amazon.co.jp/s");
  url.searchParams.set("i", "amazonfresh");
  url.searchParams.set("k", item);

  return {
    item,
    current: index + 1,
    total: items.length,
    nextIndex: index + 1,
    url: url.toString(),
  };
}

export function getSeikatsuClubSearchStep(
  items: string[],
  index: number,
): ShoppingSearchStep | undefined {
  const item = items[index];
  if (!item) return undefined;

  const url = new URL("https://shop.seikatsuclub.coop/search.html");
  url.searchParams.set("KWD", item);

  return {
    item,
    current: index + 1,
    total: items.length,
    nextIndex: index + 1,
    url: url.toString(),
  };
}

type ScrollIntoViewTarget = {
  scrollIntoView(options: ScrollIntoViewOptions): void;
};

export function scrollAmazonSearchResultsIntoView(
  element: ScrollIntoViewTarget,
) {
  element.scrollIntoView({ behavior: "smooth", block: "nearest" });
}
