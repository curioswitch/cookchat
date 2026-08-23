import { twMerge } from "tailwind-merge";

export function getSelectableOptionClassName(isSelected: boolean) {
  return twMerge(
    "border border-yellow-400 rounded-4xl py-2 px-4 w-fit text-sm",
    isSelected && "bg-yellow-400 text-white",
  );
}
