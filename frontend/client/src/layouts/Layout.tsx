import { Divider } from "@heroui/divider";
import { Link } from "@heroui/link";
import { HiHeart, HiShoppingCart, HiUser, HiViewList } from "react-icons/hi";
import { twMerge } from "tailwind-merge";
import { usePageContext } from "vike-react/usePageContext";

export default function Layout({ children }: { children: React.ReactNode }) {
  const pageContext = usePageContext();
  const path = pageContext.urlPathname;

  return (
    <div className="flex flex-col min-h-screen">
      <div className="container mx-auto max-w-full prose pb-16">{children}</div>
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
          <Link href="/cart">
            <HiShoppingCart
              className={twMerge(
                "size-8",
                path === "/cart" ? "text-orange-400" : "text-gray-400",
              )}
            />
          </Link>
          <HiUser className="size-8 text-gray-400" />
        </div>
      </div>
    </div>
  );
}
