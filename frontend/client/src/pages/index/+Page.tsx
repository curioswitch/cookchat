import { Image } from "@heroui/image";
import { Link } from "@heroui/link";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useRef } from "react";
import { useFrontendQueries } from "../../hooks/rpc";

export default function Page() {
  const queries = useFrontendQueries();
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isPending } =
    useInfiniteQuery(queries.listRecipes());

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

  if (isPending) {
    return <div>Loading...</div>;
  }

  if (!recipes) {
    throw new Error("Failed to load recipes");
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {recipes.map((recipe, i) => (
        <Link
          href={`/recipes/${recipe.id}`}
          color="foreground"
          key={recipe.id}
          className="flex p-4 border-1 border-gray-300 items-start"
          ref={i === recipes.length - 1 ? handleLastItem : null}
        >
          <div className="flex-2/3">
            <h3 className="font-light">{recipe.title}</h3>
            <p className="text-small font-thin line-clamp-1">
              {recipe.summary}
            </p>
          </div>
          <div className="flex-1/3">
            <Image src={recipe.imageUrl} alt={recipe.title} />
          </div>
        </Link>
      ))}
    </div>
  );
}
