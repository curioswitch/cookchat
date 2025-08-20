import { Badge } from "@heroui/badge";
import { Divider } from "@heroui/divider";
import { Link } from "@heroui/link";
import { useTranslation } from "react-i18next";
import { FaBookmark, FaCalendarAlt } from "react-icons/fa";
import { HiShoppingCart } from "react-icons/hi";
import { PiForkKnifeFill } from "react-icons/pi";
import { twMerge } from "tailwind-merge";
import { usePageContext } from "vike-react/usePageContext";

import { ChatButton } from "../components/ChatButton";
import { useCartStore, useChatStore } from "../stores";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();

  const pageContext = usePageContext();
  const path = pageContext.urlPathname;

  const cart = useCartStore();
  const chatStore = useChatStore();

  return (
    <div className="flex flex-col min-h-screen bg-[#ffe799]">
      <div className="container mx-auto min-h-screen max-w-full md:w-4xl prose md:prose-lg pb-16 bg-white">
        {children}
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
              chatStore.currentRecipeId ? "fixed bottom-32 right-8" : "hidden"
            }
            recipeId={chatStore.currentRecipeId}
            navigateToStep={chatStore.navigateToStep}
            prompt={chatStore.prompt}
          />
          <Link
            href="/settings"
            className={twMerge(
              "flex flex-col gap-1",
              path === "/settings" ? "text-orange-400" : "text-gray-400",
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
