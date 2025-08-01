import { Divider } from "@heroui/divider";
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
        value={rawQuery}
        onValueChange={setRawQuery}
      />
      <Divider className="mt-4 mb-4 md:mt-4 md:mb-4  bg-gray-100" />
      {(isPending && <div>{t("Loading...")}</div>) || (
        <div className="flex flex-col">
          {recipes?.map((recipe, i) => (
            <Link
              href={`/recipes/${recipe.id}`}
              color="foreground"
              key={recipe.id}
              className="flex border-b-1 border-gray-100 items-center gap-4"
              ref={i === recipes.length - 1 ? handleLastItem : null}
            >
              <div className="flex-3/4">
                <h3 className="mt-0 font-semibold">{recipe.title}</h3>
                <p className="mb-2 text-small font-thin text-gray-400 line-clamp-1">
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
