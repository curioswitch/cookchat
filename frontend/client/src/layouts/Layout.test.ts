import { getPlanNavigationState } from "./navigation";
import { describe, expect, test } from "bun:test";

describe("getPlanNavigationState", () => {
  test("selects plan creation only on the creation route", () => {
    for (const path of ["/plans/add", "/plans/add/"]) {
      expect(getPlanNavigationState(path)).toEqual({
        isPlanCreate: true,
        isPlanView: false,
      });
    }
  });

  test("selects plan viewing for list, detail, and edit routes", () => {
    for (const path of ["/plans", "/plans/plan-1", "/plans/plan-1/edit"]) {
      expect(getPlanNavigationState(path)).toEqual({
        isPlanCreate: false,
        isPlanView: true,
      });
    }
  });

  test("does not select either plan item outside plan routes", () => {
    expect(getPlanNavigationState("/cart")).toEqual({
      isPlanCreate: false,
      isPlanView: false,
    });
  });
});
