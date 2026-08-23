import { renderToStaticMarkup } from "react-dom/server";

import { ChatMessageContent } from "./-ChatMessageContent";
import { describe, expect, test } from "bun:test";

describe("ChatMessageContent", () => {
  test("renders assistant markdown as formatted content", () => {
    const html = renderToStaticMarkup(
      <ChatMessageContent
        content={"**メイン料理**\n\n- 豚肉\n- 玉ねぎ"}
        isUser={false}
      />,
    );

    expect(html).toContain("<strong>メイン料理</strong>");
    expect(html).toContain("<ul>");
    expect(html).toContain("<li>豚肉</li>");
  });

  test("keeps user markdown syntax as plain text", () => {
    const html = renderToStaticMarkup(
      <ChatMessageContent content="**太字にしない**" isUser />,
    );

    expect(html).toContain("**太字にしない**");
    expect(html).not.toContain("<strong>");
  });
});
