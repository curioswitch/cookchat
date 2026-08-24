import type { RecipeSnippet } from "@cookchat/frontend-api";
import { Input } from "@heroui/react";
import { useDebouncedValue } from "@tanstack/react-pacer";
import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useFrontendQueries } from "../../hooks/rpc";
import { m } from "../../paraglide/messages";

import {
  excludeRecommendedRecipes,
  selectRandomRecipes,
  shouldFetchMoreRecommendationCandidates,
} from "./-recommendations";

export const Route = createFileRoute("/")({
  component: Page,
});

const RECOMMENDATION_HISTORY_KEY = "cookchat-recommended-recipe-ids";
const RECOMMENDATION_CANDIDATE_COUNT = 20;

function getPreviousRecommendationIds() {
  try {
    const value = window.sessionStorage.getItem(RECOMMENDATION_HISTORY_KEY);
    const recipeIds: unknown = value ? JSON.parse(value) : [];
    return Array.isArray(recipeIds) &&
      recipeIds.every((recipeId) => typeof recipeId === "string")
      ? recipeIds
      : [];
  } catch {
    return [];
  }
}

function saveRecommendationIds(recipes: readonly RecipeSnippet[]) {
  try {
    window.sessionStorage.setItem(
      RECOMMENDATION_HISTORY_KEY,
      JSON.stringify(recipes.map((recipe) => recipe.id)),
    );
  } catch {
    // Recommendations can still be shown if browser storage is unavailable.
  }
}

function Page() {
  const [rawQuery, setRawQuery] = useState("");
  const [query] = useDebouncedValue(rawQuery, {
    wait: 500,
  });
  const onQueryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setRawQuery(e.target.value);
    },
    [],
  );

  const queries = useFrontendQueries();
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isPending } =
    useInfiniteQuery(queries.listRecipes(query));

  const observer = useRef<IntersectionObserver | null>(null);
  const handleLastItem = useCallback(
    (element: HTMLElement | null) => {
      if (!hasNextPage || isPending || !element) {
        return;
      }

      if (observer.current) {
        observer.current.disconnect();
      }
      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      });
      observer.current.observe(element);
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage, isPending],
  );

  const recipes = useMemo(
    () => data?.pages.flatMap((page) => page.recipes),
    [data],
  );

  const recipeCount = recipes?.length ?? 0;
  const recommendationCandidatesReady =
    !!recipes &&
    (recipeCount >= RECOMMENDATION_CANDIDATE_COUNT || hasNextPage === false);
  useEffect(() => {
    if (
      shouldFetchMoreRecommendationCandidates({
        recipeCount,
        targetCount: RECOMMENDATION_CANDIDATE_COUNT,
        hasNextPage: !!hasNextPage,
        isFetchingNextPage,
      })
    ) {
      fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, recipeCount]);

  const [recommendedRecipes, setRecommendedRecipes] = useState<RecipeSnippet[]>(
    [],
  );
  const recommendationCandidateIdsRef = useRef("");
  useEffect(() => {
    if (!recommendationCandidatesReady || !recipes) {
      setRecommendedRecipes([]);
      return;
    }

    const recommendationCandidates = recipes.slice(
      0,
      RECOMMENDATION_CANDIDATE_COUNT,
    );
    const candidateIds = recommendationCandidates
      .map((recipe) => recipe.id)
      .join(",");
    if (candidateIds === recommendationCandidateIdsRef.current) {
      return;
    }
    recommendationCandidateIdsRef.current = candidateIds;

    const selectedRecipes = selectRandomRecipes(
      recommendationCandidates,
      4,
      Math.random,
      getPreviousRecommendationIds(),
    );
    saveRecommendationIds(selectedRecipes);
    setRecommendedRecipes(selectedRecipes);
  }, [recommendationCandidatesReady, recipes]);

  const popularRecipes = useMemo(
    () => excludeRecommendedRecipes(recipes ?? [], recommendedRecipes),
    [recipes, recommendedRecipes],
  );

  return (
    <div className="p-4">
      <Input
        fullWidth
        placeholder={m.home_search_placeholder()}
        className="border rounded-xl border-yellow-400 h-12 shadow-none"
        value={rawQuery}
        onChange={onQueryChange}
      />

      {(isPending || (!!recipes && !recommendationCandidatesReady)) && (
        <div className="mt-4">{m.common_loading()}</div>
      )}

      {!isPending &&
        recommendationCandidatesReady &&
        recipes &&
        recipes.length > 0 && (
          <>
            <div className="mt-6">
              <h2 className="text-lg font-bold mb-4">
                {m.home_recommended_recipes()}
              </h2>
              <div className="grid grid-cols-2 gap-4">
                {recommendedRecipes.map((recipe) => (
                  <Link
                    to="/recipes/$id"
                    params={{ id: recipe.id }}
                    key={recipe.id}
                    className="block"
                  >
                    <img
                      src={recipe.imageUrl}
                      alt={recipe.title}
                      className="w-full aspect-square object-cover rounded-2xl"
                    />
                    <h3 className="mt-2 mb-0 text-sm font-semibold line-clamp-2">
                      {recipe.title}
                    </h3>
                  </Link>
                ))}
              </div>
            </div>
            <div className="mt-6">
              <h2 className="text-lg font-bold mb-4 pr-[3px]">
                {m.home_popular_recipes()}
              </h2>
              <div className="flex flex-col gap-2">
                {popularRecipes.map((recipe, i) => (
                  <Link
                    to="/recipes/$id"
                    params={{ id: recipe.id }}
                    key={recipe.id}
                    className="flex border rounded-2xl border-primary-100 items-center gap-4 h-32 overflow-hidden"
                    ref={
                      i === popularRecipes.length - 1 ? handleLastItem : null
                    }
                  >
                    <div className="w-1/4 h-full flex-none">
                      <img
                        src={recipe.imageUrl}
                        alt={recipe.title}
                        className="rounded-tl-2xl rounded-bl-2xl object-cover h-full w-full"
                      />
                    </div>
                    <div className="min-w-0 flex-1 pr-4">
                      <h3 className="mt-0 mb-1 text-[0.95rem]">
                        {recipe.title}
                      </h3>
                      <p className="mb-2 text-small font-thin text-gray-400 line-clamp-1">
                        {recipe.summary}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}
    </div>
  );
}
