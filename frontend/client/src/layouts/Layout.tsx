import { Badge } from "@heroui/badge";
import { Divider } from "@heroui/divider";
import { Link } from "@heroui/link";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { FaBookmark, FaCalendarAlt } from "react-icons/fa";
import { HiShare, HiShoppingCart } from "react-icons/hi";
import { PiForkKnifeFill } from "react-icons/pi";
import { twMerge } from "tailwind-merge";
import { usePageContext } from "vike-react/usePageContext";

import { BackButton } from "../components/BackButton";
import { ChatButton } from "../components/ChatButton";
import { useCartStore, useChatStore } from "../stores";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();

  const pageContext = usePageContext();
  const path = pageContext.urlPathname;
  const isHome = path === "/";
  const isCart = path === "/cart";

  const cart = useCartStore();
  const chatStore = useChatStore();

  const pageI18nKey = (pageContext.pageId || "/src/index")
    .slice("/src/".length)
    .replaceAll("/", ".");
  const title = t(`${pageI18nKey}.title`);

  const onShareClick = useCallback(() => {
    const texts = [];
    for (const recipe of cart.recipes) {
      texts.push(
        `
${recipe.title}
${import.meta.env.PUBLIC_ENV__URL_BASE}recipes/${recipe.id}

${recipe.ingredients
  .filter((ingredient) => !ingredient.selected)
  .map((ingredient) => `${ingredient.name} (${ingredient.quantity})`)
  .join("\n")}
`.trim(),
      );
    }
    if (cart.extraItems) {
      texts.push(
        `
追加の買い物:

${cart.extraItems.join("\n")}
      `.trim(),
      );
    }
    navigator.share({ text: texts.join("\n\n") });
  }, [cart]);

  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex flex-1 container mx-auto min-h-screen max-w-full md:w-4xl pt-2 pb-24 bg-white">
        <div className="p-2 flex flex-col flex-1">
          {!isHome && (
            <div className="flex justify-between items-center pb-4">
              <BackButton className="flex-1/10 text-primary" />
              <h1 className="mt-0 mb-0 flex-8/10 text-center">{title}</h1>
              <div className="flex-1/10 w-full flex justify-end">
                {isCart && (
                  <HiShare
                    onClick={onShareClick}
                    className="size-6 text-orange-400 cursor-pointer"
                  />
                )}
              </div>
            </div>
          )}
          <div
            className={twMerge(
              !isHome && "flex-1 bg-linear-to-r from-[#fff7ed] to-[#ffedd5]",
            )}
          >
            {children}
          </div>
        </div>
      </div>
      <div className="fixed bottom-0 w-full h-24 md:h-24 bg-white z-50">
        <Divider />
        <div className="px-4 flex items-center justify-between h-full w-full">
          <Link
            href="/"
            className={twMerge(
              "flex flex-col gap-1",
              path === "/" || path.startsWith("/recipes/")
                ? "text-orange-400"
                : "text-gray-400",
            )}
          >
            <PiForkKnifeFill className="size-8 md:size-12" />
            <div>{t("Recipe")}</div>
          </Link>
          <Link
            href="/plans"
            className={twMerge(
              "flex flex-col gap-1",
              path.startsWith("/plans") ? "text-orange-400" : "text-gray-400",
            )}
          >
            <FaCalendarAlt className="size-8 md:size-12" />
            <div>{t("Plan")}</div>
          </Link>
          <ChatButton
            className={
              chatStore.currentRecipeId || chatStore.currentPlanId
                ? "fixed bottom-32 right-8"
                : "hidden"
            }
            recipeId={chatStore.currentRecipeId}
            planId={chatStore.currentPlanId}
            navigateToStep={chatStore.navigateToStep}
            navigateToIngredients={chatStore.navigateToIngredients}
            prompt={chatStore.prompt}
          />
          <Link
            href="/bookmarks"
            className={twMerge(
              "flex flex-col gap-1",
              path === "/bookmarks" ? "text-orange-400" : "text-gray-400",
            )}
          >
            <FaBookmark className="size-8 md:size-12" />
            <div>{t("Bookmarks")}</div>
          </Link>
          <Link
            href="/cart"
            className={twMerge(
              "flex flex-col gap-1",
              path === "/cart" ? "text-orange-400" : "text-gray-400",
            )}
          >
            <Badge
              content={cart.recipes.length}
              isInvisible={cart.recipes.length === 0}
            >
              <HiShoppingCart className="size-8 md:size-12" />
            </Badge>
            <div>{t("Cart")}</div>
          </Link>
        </div>
      </div>
    </div>
  );
}
