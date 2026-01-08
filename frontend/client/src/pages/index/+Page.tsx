import { Image } from "@heroui/image";
import { Input } from "@heroui/input";
import { Link } from "@heroui/link";
import { useDebouncedValue } from "@tanstack/react-pacer";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FaRegUserCircle } from "react-icons/fa";

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

  const recommendedRecipes = useMemo(
    () => recipes?.slice(0, 2) || [],
    [recipes],
  );

  const popularRecipes = useMemo(() => recipes?.slice(2) || [], [recipes]);

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mt-2 mb-4">
        <Image radius="none" src={logoSVG} alt={t("CookChat Logo")} />
        <Link href="/settings">
          <FaRegUserCircle className="size-6 text-primary-400" />
        </Link>
      </div>
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

      {isPending && <div className="mt-4">{t("Loading...")}</div>}

      {!isPending && recipes && recipes.length > 0 && (
        <>
          <div className="mt-6">
            <h2 className="text-lg font-bold mb-4">
              {t("Recommended Recipes")}
            </h2>
            <div className="grid grid-cols-2 gap-4">
              {recommendedRecipes.map((recipe) => (
                <Link
                  href={`/recipes/${recipe.id}`}
                  color="foreground"
                  key={recipe.id}
                  className="block"
                >
                  <Image
                    className="w-full h-32 object-cover rounded-2xl"
                    src={recipe.imageUrl}
                    alt={recipe.title}
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
              {t("Popular Recipes")}
            </h2>
            <div className="flex flex-col gap-2">
              {popularRecipes.map((recipe, i) => (
                <Link
                  href={`/recipes/${recipe.id}`}
                  color="foreground"
                  key={recipe.id}
                  className="flex border-1 rounded-2xl border-primary-100 items-center gap-4 not-prose h-32"
                  ref={i === popularRecipes.length - 1 ? handleLastItem : null}
                >
                  <Image
                    className="flex-1/4 rounded-none rounded-l-large object-cover h-32 w-full"
                    classNames={{
                      wrapper: "flex-1/4",
                    }}
                    src={recipe.imageUrl}
                    alt={recipe.title}
                  />
                  <div className="flex-3/4 pr-4">
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
