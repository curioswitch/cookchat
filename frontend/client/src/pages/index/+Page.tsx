import { Input } from "@heroui/react";
import { useDebouncedValue } from "@tanstack/react-pacer";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useRef, useState } from "react";
import { FaRegUserCircle } from "react-icons/fa";

import logoSVG from "../../assets/logo.svg";
import { useFrontendQueries } from "../../hooks/rpc";
import { m } from "../../paraglide/messages";

export default function Page() {
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

  const recommendedRecipes = useMemo(
    () => recipes?.slice(0, 4) || [],
    [recipes],
  );

  const popularRecipes = useMemo(() => recipes?.slice(4) || [], [recipes]);

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mt-2 mb-4">
        <img src={logoSVG} alt={m.app_logo_alt()} />
        <a href="/settings">
          <FaRegUserCircle className="size-6 text-yellow-400" />
        </a>
      </div>
      <Input
        fullWidth
        placeholder={m.home_search_placeholder()}
        className="border rounded-xl border-yellow-400 h-12 shadow-none"
        value={rawQuery}
        onChange={onQueryChange}
      />

      {isPending && <div className="mt-4">{m.common_loading()}</div>}

      {!isPending && recipes && recipes.length > 0 && (
        <>
          <div className="mt-6">
            <h2 className="text-lg font-bold mb-4">
              {m.home_recommended_recipes()}
            </h2>
            <div className="grid grid-cols-2 gap-4">
              {recommendedRecipes.map((recipe) => (
                <a
                  href={`/recipes/${recipe.id}`}
                  color="foreground"
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
                </a>
              ))}
            </div>
          </div>
          <div className="mt-6">
            <h2 className="text-lg font-bold mb-4 pr-[3px]">
              {m.home_popular_recipes()}
            </h2>
            <div className="flex flex-col gap-2">
              {popularRecipes.map((recipe, i) => (
                <a
                  href={`/recipes/${recipe.id}`}
                  color="foreground"
                  key={recipe.id}
                  className="flex border rounded-2xl border-primary-100 items-center gap-4 h-32 overflow-hidden"
                  ref={i === popularRecipes.length - 1 ? handleLastItem : null}
                >
                  <div className="w-1/4 h-full flex-none">
                    <img
                      src={recipe.imageUrl}
                      alt={recipe.title}
                      className="rounded-tl-2xl rounded-bl-2xl object-cover h-full w-full"
                    />
                  </div>
                  <div className="min-w-0 flex-1 pr-4">
                    <h3 className="mt-0 mb-1 text-[0.95rem]">{recipe.title}</h3>
                    <p className="mb-2 text-small font-thin text-gray-400 line-clamp-1">
                      {recipe.summary}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
