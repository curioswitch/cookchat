import type { CartStore } from "../../stores";

import * as amazonFresh from "./-amazonFresh";
import { getAmazonShoppingItems } from "./-amazonFresh";
import { describe, expect, test } from "bun:test";

describe("getAmazonShoppingItems", () => {
  test("returns unique unpurchased ingredients and extra items", () => {
    const cart: CartStore = {
      recipes: [
        {
          id: "recipe-1",
          title: "カレー",
          servingSize: "2人分",
          ingredients: [
            { name: "玉ねぎ", quantity: "1個", selected: false },
            { name: "塩", quantity: "少々", selected: true },
          ],
        },
        {
          id: "recipe-2",
          title: "スープ",
          servingSize: "2人分",
          ingredients: [{ name: "玉ねぎ", quantity: "1/2個", selected: false }],
        },
      ],
      extraItems: ["牛乳", " 牛乳 "],
    };

    expect(getAmazonShoppingItems(cart)).toEqual(["玉ねぎ", "牛乳"]);
  });
});

describe("getAmazonFreshStorefrontUrl", () => {
  test("opens the official Amazon Fresh storefront", () => {
    const getAmazonFreshStorefrontUrl = (
      amazonFresh as unknown as {
        getAmazonFreshStorefrontUrl?: () => string;
      }
    ).getAmazonFreshStorefrontUrl;

    expect(typeof getAmazonFreshStorefrontUrl).toBe("function");
    expect(getAmazonFreshStorefrontUrl?.()).toBe(
      "https://www.amazon.co.jp/fmc/storefront?almBrandId=QW1hem9uIEZyZXNo",
    );
  });
});

describe("getAmazonFreshSearchStep", () => {
  test("returns each ingredient in order with an Amazon Fresh search URL", () => {
    const getAmazonFreshSearchStep = (
      amazonFresh as unknown as {
        getAmazonFreshSearchStep?: (items: string[], index: number) => unknown;
      }
    ).getAmazonFreshSearchStep;

    expect(typeof getAmazonFreshSearchStep).toBe("function");
    expect(getAmazonFreshSearchStep?.(["玉ねぎ", "鶏もも肉 300g"], 1)).toEqual({
      item: "鶏もも肉 300g",
      current: 2,
      total: 2,
      nextIndex: 2,
      url: "https://www.amazon.co.jp/s?i=amazonfresh&k=%E9%B6%8F%E3%82%82%E3%82%82%E8%82%89+300g",
    });
  });

  test("returns no step after every ingredient has been searched", () => {
    const getAmazonFreshSearchStep = (
      amazonFresh as unknown as {
        getAmazonFreshSearchStep?: (items: string[], index: number) => unknown;
      }
    ).getAmazonFreshSearchStep;

    expect(typeof getAmazonFreshSearchStep).toBe("function");
    expect(getAmazonFreshSearchStep?.(["玉ねぎ"], 1)).toBeUndefined();
  });
});

describe("getSeikatsuClubSearchStep", () => {
  test("returns each ingredient in order with an e-club keyword search URL", () => {
    const getSeikatsuClubSearchStep = (
      amazonFresh as unknown as {
        getSeikatsuClubSearchStep?: (items: string[], index: number) => unknown;
      }
    ).getSeikatsuClubSearchStep;

    expect(typeof getSeikatsuClubSearchStep).toBe("function");
    expect(getSeikatsuClubSearchStep?.(["玉ねぎ", "鶏もも肉 300g"], 1)).toEqual(
      {
        item: "鶏もも肉 300g",
        current: 2,
        total: 2,
        nextIndex: 2,
        url: "https://shop.seikatsuclub.coop/search.html?KWD=%E9%B6%8F%E3%82%82%E3%82%82%E8%82%89+300g",
      },
    );
  });
});

describe("scrollAmazonSearchResultsIntoView", () => {
  test("moves newly revealed results into the visible scroll area", () => {
    const scrollCalls: ScrollIntoViewOptions[] = [];
    const target = {
      scrollIntoView(options: ScrollIntoViewOptions) {
        scrollCalls.push(options);
      },
    };
    const scrollAmazonSearchResultsIntoView = (
      amazonFresh as unknown as {
        scrollAmazonSearchResultsIntoView?: (element: typeof target) => void;
      }
    ).scrollAmazonSearchResultsIntoView;

    expect(typeof scrollAmazonSearchResultsIntoView).toBe("function");
    scrollAmazonSearchResultsIntoView?.(target);
    expect(scrollCalls).toEqual([{ behavior: "smooth", block: "nearest" }]);
  });
});
