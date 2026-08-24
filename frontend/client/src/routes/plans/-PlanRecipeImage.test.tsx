import { renderToStaticMarkup } from "react-dom/server";

import {
  hasPendingRecipeImages,
  PlanRecipeImage,
  shouldPollPlanDetails,
} from "./-PlanRecipeImage";
import { describe, expect, test } from "bun:test";

describe("PlanRecipeImage", () => {
  test("shows an animated status while the image URL is empty", () => {
    const html = renderToStaticMarkup(
      <PlanRecipeImage
        imageUrl=""
        title="シンプル温やっこ"
        loadingLabel="AIが画像を生成中…"
        className="h-40"
      />,
    );

    expect(html).toContain('role="status"');
    expect(html).toContain("AIが画像を生成中…");
    expect(html).toContain("animate-spin");
    expect(html).not.toContain("<img");
  });

  test("shows the completed recipe image", () => {
    const html = renderToStaticMarkup(
      <PlanRecipeImage
        imageUrl="https://example.com/recipe.jpg"
        title="シンプル温やっこ"
        loadingLabel="AIが画像を生成中…"
        className="h-40"
      />,
    );

    expect(html).toContain('src="https://example.com/recipe.jpg"');
    expect(html).toContain('alt="シンプル温やっこ"');
    expect(html).not.toContain('role="status"');
  });

  test("shows the loading status after a non-empty image URL fails", () => {
    const html = renderToStaticMarkup(
      <PlanRecipeImage
        imageUrl="https://example.com/not-ready.jpg"
        title="シンプル温やっこ"
        loadingLabel="AIが画像を生成中…"
        hasLoadError
        className="h-40"
      />,
    );

    expect(html).toContain('role="status"');
    expect(html).toContain("AIが画像を生成中…");
    expect(html).not.toContain("<img");
  });

  test("reports an image load failure", () => {
    const onLoadError = () => {};
    const image = PlanRecipeImage({
      imageUrl: "https://example.com/not-ready.jpg",
      title: "シンプル温やっこ",
      loadingLabel: "AIが画像を生成中…",
      onLoadError,
    });

    expect(image.type).toBe("img");
    expect(image.props.onError).toBe(onLoadError);
  });
});

describe("hasPendingRecipeImages", () => {
  test("detects a recipe whose image is still pending", () => {
    expect(
      hasPendingRecipeImages([
        {
          recipes: [
            { id: "ready", imageUrl: "ready.jpg" },
            { id: "pending", imageUrl: "" },
          ],
        },
      ]),
    ).toBe(true);
  });

  test("stops polling after every recipe image is ready", () => {
    expect(
      hasPendingRecipeImages([
        {
          recipes: [
            { id: "one", imageUrl: "one.jpg" },
            { id: "two", imageUrl: "two.jpg" },
          ],
        },
      ]),
    ).toBe(false);
  });

  test("keeps polling while a non-empty image URL is failing", () => {
    expect(
      hasPendingRecipeImages(
        [{ recipes: [{ id: "recipe-1", imageUrl: "not-ready.jpg" }] }],
        new Set(["recipe-1"]),
      ),
    ).toBe(true);
  });
});

describe("shouldPollPlanDetails", () => {
  const readyPlan = {
    recipes: [{ id: "recipe-1", imageUrl: "ready.jpg" }],
  };

  test("polls while the plan is processing", () => {
    expect(shouldPollPlanDetails({ plan: readyPlan, isProcessing: true })).toBe(
      true,
    );
  });

  test("polls while a recipe image is failing", () => {
    expect(
      shouldPollPlanDetails({
        plan: readyPlan,
        isProcessing: false,
        failedRecipeImageIds: new Set(["recipe-1"]),
      }),
    ).toBe(true);
  });

  test("stops polling after processing and image loading finish", () => {
    expect(
      shouldPollPlanDetails({ plan: readyPlan, isProcessing: false }),
    ).toBe(false);
  });
});
