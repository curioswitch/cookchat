import { renderToStaticMarkup } from "react-dom/server";

import { hasPendingRecipeImages, PlanRecipeImage } from "./-PlanRecipeImage";
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
});

describe("hasPendingRecipeImages", () => {
  test("detects a recipe whose image is still pending", () => {
    expect(
      hasPendingRecipeImages([
        { recipes: [{ imageUrl: "ready.jpg" }, { imageUrl: "" }] },
      ]),
    ).toBe(true);
  });

  test("stops polling after every recipe image is ready", () => {
    expect(
      hasPendingRecipeImages([
        { recipes: [{ imageUrl: "one.jpg" }, { imageUrl: "two.jpg" }] },
      ]),
    ).toBe(false);
  });
});
