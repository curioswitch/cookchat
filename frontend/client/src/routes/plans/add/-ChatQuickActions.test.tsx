import { renderToStaticMarkup } from "react-dom/server";

import { ChatQuickActions } from "./-ChatQuickActions";
import { describe, expect, test } from "bun:test";

describe("ChatQuickActions", () => {
  test("shows the new plan action beside the suggested replies", () => {
    const html = renderToStaticMarkup(
      <ChatQuickActions
        quickReplies={["1"]}
        newChatLabel="新しい献立"
        isDisabled={false}
        onQuickReply={() => {}}
        onNewChat={() => {}}
      />,
    );

    expect(html).toContain("flex-wrap");
    expect(html).toContain(">1</button>");
    expect(html).toContain(">新しい献立</button>");
    expect(html.indexOf(">1</button>")).toBeLessThan(
      html.indexOf(">新しい献立</button>"),
    );
  });
});
