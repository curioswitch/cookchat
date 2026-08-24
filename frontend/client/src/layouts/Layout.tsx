import { Badge, Separator } from "@heroui/react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useCallback } from "react";
import { FaRegUserCircle } from "react-icons/fa";
import {
  FiBookmark,
  FiBookOpen,
  FiCalendar,
  FiPlusSquare,
  FiShoppingCart,
} from "react-icons/fi";
import { HiShare } from "react-icons/hi";
import { twMerge } from "tailwind-merge";

import logoSVG from "../assets/logo.svg";
import { BackButton } from "../components/BackButton";
import { ChatButton } from "../components/ChatButton";
import { m } from "../paraglide/messages";
import { useCartStore, useChatStore } from "../stores";

import { AppViewport } from "./AppViewport";
import { getPlanNavigationState } from "./navigation";

function getPageTitle(path: string) {
  if (path === "/bookmarks") {
    return m.page_bookmarks_title();
  }
  if (path === "/cart") {
    return m.page_cart_title();
  }
  if (path === "/plans") {
    return m.page_plans_title();
  }
  if (path === "/plans/add") {
    return m.page_plan_create_title();
  }
  if (/^\/plans\/[^/]+\/edit$/.test(path)) {
    return m.page_plan_edit_title();
  }
  if (/^\/plans\/[^/]+$/.test(path)) {
    return m.page_plan_detail_title();
  }
  if (path === "/recipes/add") {
    return m.page_recipe_add_title();
  }
  if (/^\/recipes\/[^/]+$/.test(path)) {
    return m.page_recipe_detail_title();
  }
  if (path === "/settings") {
    return m.page_settings_title();
  }
  return undefined;
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const path = useRouterState({
    select: (state) => state.location.pathname,
  });
  const isHome = path === "/";
  const isLogin = path === "/login";
  const isCart = path === "/cart";
  const isBookmarks = path === "/bookmarks";
  const { isPlanCreate, isPlanView } = getPlanNavigationState(path);

  const cart = useCartStore();
  const chatStore = useChatStore();
  const title = getPageTitle(path);

  const onShareClick = useCallback(() => {
    const texts = [];
    for (const recipe of cart.recipes) {
      texts.push(
        `
${recipe.title}
${import.meta.env.VITE_URL_BASE}recipes/${recipe.id}

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

  const header = isLogin ? undefined : (
    <div className="container mx-auto max-w-full bg-white p-2 pt-4 md:w-4xl">
      {isHome ? (
        <div className="flex items-center justify-between">
          <img src={logoSVG} alt={m.app_logo_alt()} />
          <Link to="/settings" aria-label={m.page_settings_title()}>
            <FaRegUserCircle className="size-6 text-yellow-400" />
          </Link>
        </div>
      ) : (
        <div className="flex items-center justify-between pb-2">
          <BackButton className="flex-1/10 text-yellow-400" />
          <h1 className="m-0 flex-8/10 text-center">{title}</h1>
          <div className="flex w-full flex-1/10 justify-end">
            {isCart && (
              <HiShare
                onClick={onShareClick}
                className="size-6 cursor-pointer text-yellow-400"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );

  const footer = isLogin ? undefined : (
    <>
      <Separator className="bg-yellow-300" />
      <div className="flex h-24 w-full items-center justify-between gap-1 px-2 md:gap-4 md:px-8">
        <Link
          to="/"
          className={twMerge(
            "flex min-w-0 flex-1 flex-col items-center gap-1",
            path === "/" || path.startsWith("/recipes/")
              ? "text-yellow-400"
              : "text-gray-400",
          )}
        >
          <FiBookOpen className="size-6 md:size-10" />
          <div className="whitespace-nowrap text-[10px] md:text-sm">
            {m.nav_recipe()}
          </div>
        </Link>
        <Link
          to="/plans"
          className={twMerge(
            "flex min-w-0 flex-1 flex-col items-center gap-1",
            isPlanView ? "text-yellow-400" : "text-gray-400",
          )}
        >
          <FiCalendar className="size-6 md:size-10" />
          <div className="whitespace-nowrap text-[10px] md:text-sm">
            {m.nav_plan_view()}
          </div>
        </Link>
        <Link
          to="/plans/add"
          className={twMerge(
            "flex min-w-0 flex-1 flex-col items-center gap-1",
            isPlanCreate ? "text-yellow-400" : "text-gray-400",
          )}
        >
          <FiPlusSquare className="size-6 md:size-10" />
          <div className="whitespace-nowrap text-[10px] md:text-sm">
            {m.nav_plan_create()}
          </div>
        </Link>
        {(chatStore.currentRecipeId || chatStore.currentPlanId) && (
          <ChatButton
            className="fixed bottom-32 right-8"
            recipeId={chatStore.currentRecipeId}
            planId={chatStore.currentPlanId}
            navigateToStep={chatStore.navigateToStep}
            navigateToIngredients={chatStore.navigateToIngredients}
            prompt={chatStore.prompt}
          />
        )}
        <Link
          to="/bookmarks"
          className={twMerge(
            "flex min-w-0 flex-1 flex-col items-center gap-1",
            path === "/bookmarks" ? "text-yellow-400" : "text-gray-400",
          )}
        >
          <FiBookmark className="size-6 md:size-10" />
          <div className="whitespace-nowrap text-[10px] md:text-sm">
            {m.nav_bookmarks()}
          </div>
        </Link>
        <Link
          to="/cart"
          className={twMerge(
            "flex min-w-0 flex-1 flex-col items-center gap-1",
            path === "/cart" ? "text-yellow-400" : "text-gray-400",
          )}
        >
          <Badge.Anchor>
            <FiShoppingCart className="size-6 md:size-10" />
            {cart.recipes.length > 0 && (
              <Badge size="sm" className="border-2 border-white">
                {cart.recipes.length}
              </Badge>
            )}
          </Badge.Anchor>
          <div className="whitespace-nowrap text-[10px] md:text-sm">
            {m.nav_cart()}
          </div>
        </Link>
      </div>
    </>
  );

  return (
    <AppViewport header={header} footer={footer} centerContent={isLogin}>
      {isLogin ? (
        children
      ) : (
        <div className="container mx-auto min-h-full max-w-full bg-white md:w-4xl">
          <div className="flex min-h-full flex-col p-2">
            <div
              className={twMerge(
                "min-h-0 flex-1",
                !isHome &&
                  !isBookmarks &&
                  !path.startsWith("/recipes/") &&
                  "bg-linear-to-r from-[#fefce8] to-[#fef9c3]",
                isBookmarks && "bg-white",
                path.startsWith("/recipes/") && "bg-white",
              )}
            >
              {children}
            </div>
          </div>
        </div>
      )}
    </AppViewport>
  );
}
