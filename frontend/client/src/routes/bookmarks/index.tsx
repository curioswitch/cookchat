import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useMemo, useRef } from "react";
import { FaBookmark } from "react-icons/fa";

import { useFrontendQueries } from "../../hooks/rpc";
import { m } from "../../paraglide/messages";

export const Route = createFileRoute("/bookmarks/")({
  component: Page,
});

function Page() {
  const queries = useFrontendQueries();
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isPending } =
    useInfiniteQuery(queries.listBookmarks());

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
      {(isPending && <div>{m.common_loading()}</div>) || (
        <div className="flex flex-col gap-2">
          {recipes?.map((recipe, i) => (
            <Link
              to="/recipes/$id"
              params={{ id: recipe.id }}
              key={recipe.id}
              className="flex bg-white border rounded-2xl items-center border-yellow-100 gap-4 h-28 overflow-hidden"
              ref={i === recipes.length - 1 ? handleLastItem : null}
            >
              <img
                src={recipe.imageUrl}
                alt={recipe.title}
                className="flex-1/5 rounded-none rounded-l-large object-cover h-full w-24"
              />
              <div className="flex-3/5 pr-4 py-2">
                <h3>{recipe.title}</h3>
                <p className="text-small font-thin text-gray-400 line-clamp-1">
                  {recipe.summary}
                </p>
              </div>
              <div className="flex-1/10 flex items-center justify-start -ml-1">
                <FaBookmark className="size-5 fill-yellow-400 cursor-pointer" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
