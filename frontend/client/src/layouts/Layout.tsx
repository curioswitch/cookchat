import { Badge, Separator } from "@heroui/react";
import { useCallback } from "react";
import {
  FiBookmark,
  FiBookOpen,
  FiCalendar,
  FiShoppingCart,
} from "react-icons/fi";
import { HiShare } from "react-icons/hi";
import { twMerge } from "tailwind-merge";
import { usePageContext } from "vike-react/usePageContext";

import { BackButton } from "../components/BackButton";
import { ChatButton } from "../components/ChatButton";
import { m } from "../paraglide/messages";
import { useCartStore, useChatStore } from "../stores";

const pageTitleByI18nKey = {
  "pages.bookmarks": m.page_bookmarks_title,
  "pages.cart": m.page_cart_title,
  "pages.plans": m.page_plans_title,
  "pages.plans.@id": m.page_plan_detail_title,
  "pages.plans.@id.edit": m.page_plan_edit_title,
  "pages.plans.add": m.page_plan_create_title,
  "pages.recipes.@id": m.page_recipe_detail_title,
  "pages.recipes.add": m.page_recipe_add_title,
  "pages.settings": m.page_settings_title,
} as const;

export default function Layout({ children }: { children: React.ReactNode }) {
  const pageContext = usePageContext();
  const path = pageContext.urlPathname;
  const isHome = path === "/";
  const isCart = path === "/cart";
  const isBookmarks = path === "/bookmarks";

  const cart = useCartStore();
  const chatStore = useChatStore();
  const pageI18nKey = (pageContext.pageId || "/src/index")
    .slice("/src/".length)
    .replaceAll("/", ".");
  const title =
    pageTitleByI18nKey[pageI18nKey as keyof typeof pageTitleByI18nKey]?.();

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
${m.cart_extra_items_title()}:

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
              <BackButton className="flex-1/10 text-yellow-400" />
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
              !isHome &&
                !isBookmarks &&
                !path.startsWith("/recipes/") &&
                "flex-1 bg-linear-to-r from-[#fff7ed] to-[#ffedd5]",
              isBookmarks && "flex-1 bg-white",
              path.startsWith("/recipes/") && "flex-1 bg-white",
            )}
          >
            {children}
          </div>
        </div>
      </div>
      <div className="fixed bottom-0 w-full h-24 md:h-24 bg-white z-50">
        <Separator className="bg-yellow-300" />
        <div className="px-6 md:px-8 flex items-center justify-between h-full w-full">
          <a
            href="/"
            className={twMerge(
              "flex flex-col gap-1 items-center",
              path === "/" || path.startsWith("/recipes/")
                ? "text-yellow-400"
                : "text-gray-400",
            )}
          >
            <FiBookOpen className="size-7 md:size-10" />
            <div className="text-xs md:text-sm">{m.nav_recipe()}</div>
          </a>
          <a
            href="/plans"
            className={twMerge(
              "flex flex-col gap-1 items-center",
              path.startsWith("/plans") ? "text-yellow-400" : "text-gray-400",
            )}
          >
            <FiCalendar className="size-7 md:size-10" />
            <div className="text-xs md:text-sm">{m.nav_plan()}</div>
          </a>
          {(chatStore.currentRecipeId || chatStore.currentPlanId) && (
            <ChatButton
              className={"fixed bottom-32 right-8"}
              recipeId={chatStore.currentRecipeId}
              planId={chatStore.currentPlanId}
              navigateToStep={chatStore.navigateToStep}
              navigateToIngredients={chatStore.navigateToIngredients}
              prompt={chatStore.prompt}
            />
          )}
          <a
            href="/bookmarks"
            className={twMerge(
              "flex flex-col gap-1 items-center",
              path === "/bookmarks" ? "text-yellow-400" : "text-gray-400",
            )}
          >
            <FiBookmark className="size-7 md:size-10" />
            <div className="text-xs md:text-sm">{m.nav_bookmarks()}</div>
          </a>
          <a
            href="/cart"
            className={twMerge(
              "flex flex-col gap-1 items-center",
              path === "/cart" ? "text-yellow-400" : "text-gray-400",
            )}
          >
            <Badge.Anchor>
              <FiShoppingCart className="size-7 md:size-10" />
              {cart.recipes.length > 0 && (
                <Badge size="sm" className="border-2 border-white">
                  {cart.recipes.length}
                </Badge>
              )}
            </Badge.Anchor>
            <div className="text-xs md:text-sm">{m.nav_cart()}</div>
          </a>
        </div>
      </div>
    </div>
  );
}
