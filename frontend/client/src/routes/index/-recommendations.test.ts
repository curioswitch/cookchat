import {
  excludeRecommendedRecipes,
  selectRandomRecipes,
  shouldFetchMoreRecommendationCandidates,
} from "./-recommendations";
import { describe, expect, test } from "bun:test";

const recipes = [
  { id: "a" },
  { id: "b" },
  { id: "c" },
  { id: "d" },
  { id: "e" },
];

describe("selectRandomRecipes", () => {
  test("uses the supplied random order to choose the requested number", () => {
    const selected = selectRandomRecipes(recipes, 2, () => 0);

    expect(selected.map((recipe) => recipe.id)).toEqual(["b", "c"]);
  });

  test("does not modify the source recipe order", () => {
    selectRandomRecipes(recipes, 4, () => 0);

    expect(recipes.map((recipe) => recipe.id)).toEqual([
      "a",
      "b",
      "c",
      "d",
      "e",
    ]);
  });

  test("changes one recipe when the random result repeats the previous set", () => {
    const selected = selectRandomRecipes(recipes, 4, () => 0, [
      "b",
      "c",
      "d",
      "e",
    ]);

    expect(selected.map((recipe) => recipe.id)).toEqual(["b", "c", "d", "a"]);
  });
});

describe("excludeRecommendedRecipes", () => {
  test("keeps recommended recipes out of the popular list", () => {
    const popular = excludeRecommendedRecipes(recipes, [
      recipes[1],
      recipes[2],
    ]);

    expect(popular.map((recipe) => recipe.id)).toEqual(["a", "d", "e"]);
  });
});

describe("shouldFetchMoreRecommendationCandidates", () => {
  test("fetches another page while fewer than the target recipes are loaded", () => {
    expect(
      shouldFetchMoreRecommendationCandidates({
        recipeCount: 4,
        targetCount: 20,
        hasNextPage: true,
        isFetchingNextPage: false,
      }),
    ).toBe(true);
  });
});
