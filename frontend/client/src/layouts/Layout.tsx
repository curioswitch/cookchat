import { Badge } from "@heroui/badge";
import { Divider } from "@heroui/divider";
import { Link } from "@heroui/link";
import { HiHeart, HiShoppingCart, HiUser, HiViewList } from "react-icons/hi";
import { twMerge } from "tailwind-merge";
import { usePageContext } from "vike-react/usePageContext";

import { ChatButton } from "../components/ChatButton";
import { useCartStore, useChatStore } from "../stores";

export default function Layout({ children }: { children: React.ReactNode }) {
  const pageContext = usePageContext();
  const path = pageContext.urlPathname;

  const cart = useCartStore();
  const chatStore = useChatStore();

  return (
    <div className="flex flex-col min-h-screen bg-[#ffe799]">
      <div className="container mx-auto min-h-screen max-w-full md:w-4xl prose md:prose-lg pb-16 bg-white">
        {children}
      </div>
      <div className="fixed bottom-0 w-full h-16 bg-white z-50">
        <Divider />
        <div className="px-4 flex items-center justify-between h-full w-full">
          <Link href="/">
            <HiViewList
              className={twMerge(
                "size-8",
                path === "/" ? "text-orange-400" : "text-gray-400",
              )}
            />
          </Link>
          <HiHeart className="size-8 text-gray-400" />
          <ChatButton
            className={
              chatStore.currentRecipeId ? "mb-20 md:mb-40" : "invisible"
            }
            recipeId={chatStore.currentRecipeId}
            navigateToStep={chatStore.navigateToStep}
            prompt={chatStore.prompt}
          />
          <Link href="/cart">
            <Badge
              content={cart.recipes.length}
              isInvisible={cart.recipes.length === 0}
            >
              <HiShoppingCart
                className={twMerge(
                  "size-8",
                  path === "/cart" ? "text-orange-400" : "text-gray-400",
                )}
              />
            </Badge>
          </Link>
          <Link href="/settings">
            <HiUser className="size-8 text-gray-400" />
          </Link>
        </div>
      </div>
    </div>
  );
}
