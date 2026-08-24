import { renderToStaticMarkup } from "react-dom/server";

import { AppViewport } from "./AppViewport";
import { describe, expect, test } from "bun:test";

describe("AppViewport", () => {
  test("keeps chrome fixed while only content scrolls", () => {
    const html = renderToStaticMarkup(
      <AppViewport
        header={<span>ヘッダー</span>}
        footer={<span>フッター</span>}
      >
        <p>本文</p>
      </AppViewport>,
    );

    expect(html).toContain("h-dvh");
    expect(html).toContain("overflow-hidden");
    expect(html).toContain('data-app-header="true"');
    expect(html).toContain('data-app-scroll-content="true"');
    expect(html).toContain('data-scroll-restoration-id="app-content"');
    expect(html).toContain("min-h-0 flex-1 overflow-y-auto");
    expect(html).toContain('data-app-footer="true"');
    expect(html).not.toContain("position:fixed");
  });

  test("allows the login content to fill the viewport without app chrome", () => {
    const html = renderToStaticMarkup(<AppViewport>ログイン</AppViewport>);

    expect(html).not.toContain("data-app-header");
    expect(html).not.toContain("data-app-footer");
    expect(html).toContain('data-app-scroll-content="true"');
  });
});
