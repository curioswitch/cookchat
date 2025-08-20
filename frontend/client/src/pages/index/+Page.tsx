import { Image } from "@heroui/image";
import { Input } from "@heroui/input";
import { Link } from "@heroui/link";
import { useDebouncedValue } from "@tanstack/react-pacer";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import logoSVG from "../../assets/logo.svg";
import { useFrontendQueries } from "../../hooks/rpc";

export default function Page() {
  const { t } = useTranslation();

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
      <Image
        radius="none"
        src={logoSVG}
        alt={t("CookChat Logo")}
        className="mt-2 mb-4"
      />
      <Input
        fullWidth
        placeholder={t("What do you want to cook?")}
        size="lg"
        className="border-1 rounded-xl border-primary-400"
        classNames={{
          innerWrapper: "bg-white",
          inputWrapper: "bg-white",
        }}
        value={rawQuery}
        onValueChange={setRawQuery}
      />
      {(isPending && <div>{t("Loading...")}</div>) || (
        <div className="flex flex-col gap-2 mt-4">
          {recipes?.map((recipe, i) => (
            <Link
              href={`/recipes/${recipe.id}`}
              color="foreground"
              key={recipe.id}
              className="flex border-1 rounded-2xl border-primary-100 items-center gap-4 not-prose h-32"
              ref={i === recipes.length - 1 ? handleLastItem : null}
            >
              <Image
                className="flex-1/4 rounded-none rounded-l-large object-cover h-32 w-full"
                classNames={{
                  wrapper: "flex-1/4",
                }}
                src={recipe.imageUrl}
                alt={recipe.title}
              />
              <div className="flex-3/4">
                <h3 className="mt-0">{recipe.title}</h3>
                <p className="mb-2 text-small font-thin text-gray-400 line-clamp-1">
                  {recipe.summary}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
