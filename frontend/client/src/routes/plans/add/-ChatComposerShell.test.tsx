import { renderToStaticMarkup } from "react-dom/server";

import { ChatComposerShell } from "./-ChatComposerShell";
import { describe, expect, test } from "bun:test";

describe("ChatComposerShell", () => {
  test("keeps the composer inside its available width", () => {
    const html = renderToStaticMarkup(
      <ChatComposerShell>
        <span>入力欄</span>
      </ChatComposerShell>,
    );

    expect(html).toContain("w-full");
    expect(html).toContain("sticky");
    expect(html).toContain("bottom-0");
    expect(html).toContain("z-40");
    expect(html).not.toContain("-mx-");
    expect(html).not.toContain("calc(100%+");
  });
});
