import { twMerge } from "tailwind-merge";

type PlanRecipeImageProps = {
  imageUrl: string;
  title: string;
  loadingLabel: string;
  className?: string;
};

export function PlanRecipeImage({
  imageUrl,
  title,
  loadingLabel,
  className,
}: PlanRecipeImageProps) {
  if (!imageUrl) {
    return (
      <div
        role="status"
        aria-live="polite"
        className={twMerge(
          className,
          "flex flex-col items-center justify-center gap-2 bg-yellow-50 px-3 text-center",
        )}
      >
        <span
          aria-hidden
          className="size-8 animate-spin rounded-full border-4 border-yellow-200 border-t-yellow-500"
        />
        <span className="text-xs font-medium text-yellow-700">
          {loadingLabel}
        </span>
      </div>
    );
  }

  return <img className={className} src={imageUrl} alt={title} />;
}

type PlanWithRecipes = {
  recipes: readonly { imageUrl: string }[];
};

export function hasPendingRecipeImages(plans?: readonly PlanWithRecipes[]) {
  return (
    plans?.some((plan) => plan.recipes.some((recipe) => !recipe.imageUrl)) ??
    false
  );
}
