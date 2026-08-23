import { resetScrollPosition } from "./scrollPosition";
import { describe, expect, test } from "bun:test";

describe("resetScrollPosition", () => {
  test("returns the content scroller to the top", () => {
    const calls: ScrollToOptions[] = [];
    resetScrollPosition({
      scrollTo(options) {
        calls.push(options);
      },
    });

    expect(calls).toEqual([{ top: 0, left: 0, behavior: "auto" }]);
  });

  test("does nothing before the scroller is mounted", () => {
    expect(() => resetScrollPosition(null)).not.toThrow();
  });
});
