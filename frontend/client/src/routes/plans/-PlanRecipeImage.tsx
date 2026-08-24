import { twMerge } from "tailwind-merge";

type PlanRecipeImageProps = {
  imageUrl: string;
  title: string;
  loadingLabel: string;
  hasLoadError?: boolean;
  onLoadError?: () => void;
  className?: string;
  compact?: boolean;
};

export function PlanRecipeImage({
  imageUrl,
  title,
  loadingLabel,
  hasLoadError = false,
  onLoadError,
  className,
  compact = false,
}: PlanRecipeImageProps) {
  if (!imageUrl || hasLoadError) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label={compact ? loadingLabel : undefined}
        className={twMerge(
          className,
          "flex flex-col items-center justify-center bg-yellow-50 text-center",
          compact ? "p-1" : "gap-2 px-3",
        )}
      >
        <span
          aria-hidden
          className={twMerge(
            "animate-spin rounded-full border-yellow-200 border-t-yellow-500",
            compact ? "size-5 border-2" : "size-8 border-4",
          )}
        />
        {!compact && (
          <span className="text-xs font-medium text-yellow-700">
            {loadingLabel}
          </span>
        )}
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
