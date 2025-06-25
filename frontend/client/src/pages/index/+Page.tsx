import { Divider } from "@heroui/divider";
import { Image } from "@heroui/image";
import { Input } from "@heroui/input";
import { Link } from "@heroui/link";
import { useDebouncedValue } from "@tanstack/react-pacer";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useRef, useState } from "react";

import { useFrontendQueries } from "../../hooks/rpc";

export default function Page() {
  const [rawQuery, setRawQuery] = useState("");
  const [query] = useDebouncedValue(rawQuery, {
    wait: 500,
  });

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

  return (
    <div className="p-4">
      <h1 className="text-2xl font-semibold">COOKCHAT</h1>
      <Divider className="mt-0 mb-4 -ml-4 w-screen bg-gray-100" />
      <Input
        fullWidth
        placeholder="作りたい料理は？"
        value={rawQuery}
        onValueChange={setRawQuery}
      />
      {(isPending && <div>Loading...</div>) || (
        <div className="flex flex-col">
          {recipes?.map((recipe, i) => (
            <Link
              href={`/recipes/${recipe.id}`}
              color="foreground"
              key={recipe.id}
              className="flex p-4 border-b-1 border-gray-100 items-center gap-4"
              ref={i === recipes.length - 1 ? handleLastItem : null}
            >
              <div className="flex-3/4">
                <h3 className="font-semibold">{recipe.title}</h3>
                <p className="text-small font-thin line-clamp-1">
                  {recipe.summary}
                </p>
              </div>
              <div className="flex-1/4">
                <Image src={recipe.imageUrl} alt={recipe.title} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
