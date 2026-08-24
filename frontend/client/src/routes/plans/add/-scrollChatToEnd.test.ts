import { scrollChatToEnd } from "./-scrollChatToEnd";
import { describe, expect, test } from "bun:test";

describe("scrollChatToEnd", () => {
  test("scrolls the chat end anchor within its nearest container", () => {
    const calls: ScrollIntoViewOptions[] = [];
    scrollChatToEnd({
      scrollIntoView(options) {
        calls.push(options);
      },
    });

    expect(calls).toEqual([{ block: "end", behavior: "smooth" }]);
  });

  test("does nothing before the anchor is mounted", () => {
    expect(() => scrollChatToEnd(null)).not.toThrow();
  });
});
