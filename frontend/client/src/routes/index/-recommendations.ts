export function selectRandomRecipes<T extends { id: string }>(
  recipes: readonly T[],
  count: number,
  random: () => number = Math.random,
  previousRecipeIds: readonly string[] = [],
) {
  const shuffledRecipes = [...recipes];

  for (let i = shuffledRecipes.length - 1; i > 0; i -= 1) {
    const randomIndex = Math.floor(random() * (i + 1));
    [shuffledRecipes[i], shuffledRecipes[randomIndex]] = [
      shuffledRecipes[randomIndex],
      shuffledRecipes[i],
    ];
  }

  const selectedRecipes = shuffledRecipes.slice(0, Math.max(0, count));
  const previousIds = new Set(previousRecipeIds);
  const repeatsPreviousSet =
    selectedRecipes.length === previousIds.size &&
    selectedRecipes.every((recipe) => previousIds.has(recipe.id));

  if (repeatsPreviousSet && shuffledRecipes.length > selectedRecipes.length) {
    selectedRecipes[selectedRecipes.length - 1] =
      shuffledRecipes[selectedRecipes.length];
  }

  return selectedRecipes;
}

export function excludeRecommendedRecipes<T extends { id: string }>(
  recipes: readonly T[],
  recommendedRecipes: readonly T[],
) {
  const recommendedIds = new Set(recommendedRecipes.map((recipe) => recipe.id));
  return recipes.filter((recipe) => !recommendedIds.has(recipe.id));
}

export function shouldFetchMoreRecommendationCandidates({
  recipeCount,
  targetCount,
  hasNextPage,
  isFetchingNextPage,
}: {
  recipeCount: number;
  targetCount: number;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
}) {
  return recipeCount < targetCount && hasNextPage && !isFetchingNextPage;
}
