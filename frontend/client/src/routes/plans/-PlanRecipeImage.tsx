import { twMerge } from "tailwind-merge";

type PlanRecipeImageProps = {
  imageUrl: string;
  title: string;
  loadingLabel: string;
  hasLoadError?: boolean;
  onLoadError?: () => void;
  className?: string;
};

export function PlanRecipeImage({
  imageUrl,
  title,
  loadingLabel,
  hasLoadError = false,
  onLoadError,
  className,
}: PlanRecipeImageProps) {
  if (!imageUrl || hasLoadError) {
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

  return (
    <img
      className={className}
      src={imageUrl}
      alt={title}
      onError={onLoadError}
    />
  );
}

type PlanWithRecipes = {
  recipes: readonly { id: string; imageUrl: string }[];
};

export function hasPendingRecipeImages(
  plans?: readonly PlanWithRecipes[],
  failedRecipeImageIds: ReadonlySet<string> = new Set(),
) {
  return (
    plans?.some((plan) =>
      plan.recipes.some(
        (recipe) => !recipe.imageUrl || failedRecipeImageIds.has(recipe.id),
      ),
    ) ?? false
  );
}

export function shouldPollPlanDetails({
  plan,
  isProcessing,
  failedRecipeImageIds = new Set(),
}: {
  plan?: PlanWithRecipes;
  isProcessing: boolean;
  failedRecipeImageIds?: ReadonlySet<string>;
}) {
  return (
    isProcessing ||
    hasPendingRecipeImages(plan ? [plan] : undefined, failedRecipeImageIds)
  );
}
