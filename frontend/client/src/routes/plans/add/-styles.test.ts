import { getSelectableOptionClassName } from "./-styles";
import { describe, expect, test } from "bun:test";

describe("getSelectableOptionClassName", () => {
  test("uses the yellow brand color for a selected option", () => {
    const className = getSelectableOptionClassName(true);

    expect(className).toContain("bg-yellow-400");
    expect(className).not.toContain("orange");
  });
});
