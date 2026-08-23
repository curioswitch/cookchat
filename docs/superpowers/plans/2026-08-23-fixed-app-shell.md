# Fixed App Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the authenticated app header and footer visible while only the center content scrolls, and keep the AI chat composer visible above the footer.

**Architecture:** Introduce a small presentational `AppViewport` component that owns the three-row viewport layout. `Layout` supplies the route-aware header, content, and footer and resets the new content scroller on navigation. The chat composer becomes sticky inside that content scroller, and chat updates scroll a local end anchor instead of the browser window.

**Tech Stack:** React 19, TanStack Router, Tailwind CSS 4, Bun test, Biome, Vite

**Spec:** `docs/superpowers/specs/2026-08-23-fixed-app-shell-design.md`

## Global Constraints

- Apply the three-row layout to every authenticated route.
- Keep the login route without an app header or footer.
- Do not change APIs, persisted data, authentication, navigation labels, or footer selection behavior.
- Use dynamic viewport height so mobile browser chrome and the software keyboard can resize the app.
- Preserve horizontal overflow protection and the existing desktop maximum width.
- Use TDD for each behavior change: write a failing behavior test, confirm the expected failure, then implement the minimum change.

---

### Task 1: Keep the AI chat composer visible and scroll locally

**Files:**
- Create: `frontend/client/src/routes/plans/add/-scrollChatToEnd.ts`
- Create: `frontend/client/src/routes/plans/add/-scrollChatToEnd.test.ts`
- Modify: `frontend/client/src/routes/plans/add/-ChatComposerShell.tsx:1-7`
- Modify: `frontend/client/src/routes/plans/add/-ChatComposerShell.test.tsx:6-18`
- Modify: `frontend/client/src/routes/plans/add/-ChatPlan.tsx:397-528`

**Interfaces:**
- Produces: `scrollChatToEnd(target: ChatEndTarget | null): void`.
- `ChatEndTarget` exposes `scrollIntoView(options: ScrollIntoViewOptions): void`.
- Produces local end-anchor scrolling; Task 4 supplies the final nearest scroll container.

- [ ] **Step 1: Extend the composer test before changing production code**

Add these assertions to the existing `ChatComposerShell` test:

```tsx
expect(html).toContain("sticky");
expect(html).toContain("bottom-0");
expect(html).toContain("z-40");
```

Run:

```bash
bun test frontend/client/src/routes/plans/add/-ChatComposerShell.test.tsx
```

Expected: FAIL because the composer does not yet contain `sticky`.

- [ ] **Step 2: Make the composer sticky inside the content scroller**

Update the wrapper class without changing its children or width safeguards:

```tsx
<div className="sticky bottom-0 z-40 w-full min-w-0 border-t border-yellow-100 bg-white px-2 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.04)] md:px-4 md:py-4">
```

Run the focused composer test again. Expected: PASS.

- [ ] **Step 3: Write the failing local-scroll test**

```ts
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
```

Run:

```bash
bun test frontend/client/src/routes/plans/add/-scrollChatToEnd.test.ts
```

Expected: FAIL because `./-scrollChatToEnd` does not exist.

- [ ] **Step 4: Implement the local-scroll helper**

```ts
export type ChatEndTarget = {
  scrollIntoView: (options: ScrollIntoViewOptions) => void;
};

export function scrollChatToEnd(target: ChatEndTarget | null) {
  target?.scrollIntoView({ block: "end", behavior: "smooth" });
}
```

- [ ] **Step 5: Replace window scrolling with an end anchor**

In `ChatPlan`, add the helper import and a ref:

```tsx
const chatEndRef = useRef<HTMLDivElement>(null);
```

Replace `window.scrollTo(0, document.body.scrollHeight)` with:

```tsx
useEffect(() => {
  const _ = getChatMessagesRes;
  const __ = doChatPlan.isPending;
  scrollChatToEnd(chatEndRef.current);
}, [getChatMessagesRes, doChatPlan.isPending]);
```

Place the anchor after `ChatComposerShell` and before the closing chat wrapper:

```tsx
<div ref={chatEndRef} aria-hidden />
```

- [ ] **Step 6: Run all chat tests and lint**

```bash
bun test frontend/client/src/routes/plans/add
cd frontend/client && bun run lint
```

Expected: all chat tests pass and Biome exits 0.

- [ ] **Step 7: Commit the fixed composer**

```bash
git add frontend/client/src/routes/plans/add/-ChatComposerShell.tsx frontend/client/src/routes/plans/add/-ChatComposerShell.test.tsx frontend/client/src/routes/plans/add/-scrollChatToEnd.ts frontend/client/src/routes/plans/add/-scrollChatToEnd.test.ts frontend/client/src/routes/plans/add/-ChatPlan.tsx
git commit -m "fix: keep chat composer visible while messages scroll"
```

---

### Task 2: Capture the regression baseline after the chat change

**Files:**
- No production files are modified in this task.

**Interfaces:**
- Consumes the sticky chat composer and local end-anchor behavior from Task 1.
- Produces a clean automated baseline before changing the shared layout.

- [ ] **Step 1: Run the entire automated test suite**

```bash
bun test
```

Expected: 0 failures, including the new chat scrolling tests and the existing navigation, Markdown, quick-reply, width, and color tests.

- [ ] **Step 2: Run Biome over the client**

```bash
cd frontend/client && bun run lint
```

Expected: exit 0 with no diagnostics.

- [ ] **Step 3: Build the production client and SSR bundle**

```bash
cd frontend/client && bun run build
```

Expected: client build, SSR build, and prerender all finish successfully. The existing large-chunk advisory is allowed; new errors are not.

---

### Task 3: Add the viewport-sized three-row frame

**Files:**
- Create: `frontend/client/src/layouts/AppViewport.tsx`
- Create: `frontend/client/src/layouts/AppViewport.test.tsx`
- Modify: `frontend/client/src/layouts/styles.css`

**Interfaces:**
- Produces: `AppViewport(props: AppViewportProps): React.ReactElement`
- `AppViewportProps` contains `children: React.ReactNode`, optional `header`, optional `footer`, and optional `contentRef: React.Ref<HTMLDivElement>`.
- Produces a single element marked `data-app-scroll-content` as the only vertical scroll container.

- [ ] **Step 1: Write the failing frame test**

```tsx
import { renderToStaticMarkup } from "react-dom/server";

import { AppViewport } from "./AppViewport";
import { describe, expect, test } from "bun:test";

describe("AppViewport", () => {
  test("keeps chrome fixed while only content scrolls", () => {
    const html = renderToStaticMarkup(
      <AppViewport header={<span>ヘッダー</span>} footer={<span>フッター</span>}>
        <p>本文</p>
      </AppViewport>,
    );

    expect(html).toContain("h-dvh");
    expect(html).toContain("overflow-hidden");
    expect(html).toContain('data-app-header="true"');
    expect(html).toContain('data-app-scroll-content="true"');
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
```

- [ ] **Step 2: Run the test and verify the missing-module failure**

Run from the repository root:

```bash
bun test frontend/client/src/layouts/AppViewport.test.tsx
```

Expected: FAIL because `./AppViewport` does not exist.

- [ ] **Step 3: Implement the minimal viewport component**

```tsx
import type { ReactNode, Ref } from "react";

type AppViewportProps = {
  children: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  contentRef?: Ref<HTMLDivElement>;
};

export function AppViewport({
  children,
  header,
  footer,
  contentRef,
}: AppViewportProps) {
  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden">
      {header && (
        <div data-app-header className="shrink-0 bg-white">
          {header}
        </div>
      )}
      <div
        ref={contentRef}
        data-app-scroll-content
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        {children}
      </div>
      {footer && (
        <div data-app-footer className="shrink-0 bg-white">
          {footer}
        </div>
      )}
    </div>
  );
}
```

Append the document-level guard to `styles.css` so the browser window cannot become a second scroll container:

```css
html,
body {
  height: 100%;
  overflow: hidden;
}
```

- [ ] **Step 4: Run the frame test and lint**

```bash
bun test frontend/client/src/layouts/AppViewport.test.tsx
cd frontend/client && bun run lint
```

Expected: both commands exit 0.

- [ ] **Step 5: Commit the frame**

```bash
git add frontend/client/src/layouts/AppViewport.tsx frontend/client/src/layouts/AppViewport.test.tsx frontend/client/src/layouts/styles.css
git commit -m "feat: add fixed app viewport frame"
```

---

### Task 4: Move authenticated screens into the shared frame

**Files:**
- Create: `frontend/client/src/layouts/scrollPosition.ts`
- Create: `frontend/client/src/layouts/scrollPosition.test.ts`
- Modify: `frontend/client/src/layouts/Layout.tsx:1-219`
- Modify: `frontend/client/src/routes/index/route.tsx:1-78`
- Modify: `frontend/client/src/routes/plans/add/index.tsx:13-38`

**Interfaces:**
- Consumes: `AppViewport` and its `contentRef` from Task 3.
- Produces: `resetScrollPosition(target: ScrollPositionTarget | null): void`.
- `ScrollPositionTarget` exposes `scrollTo(options: ScrollToOptions): void`.
- `Layout` remains the default export and retains all current navigation behavior.

- [ ] **Step 1: Write the failing scroll-reset test**

```ts
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
```

- [ ] **Step 2: Run the test and verify the missing-module failure**

```bash
bun test frontend/client/src/layouts/scrollPosition.test.ts
```

Expected: FAIL because `./scrollPosition` does not exist.

- [ ] **Step 3: Implement the reset helper**

```ts
export type ScrollPositionTarget = {
  scrollTo: (options: ScrollToOptions) => void;
};

export function resetScrollPosition(target: ScrollPositionTarget | null) {
  target?.scrollTo({ top: 0, left: 0, behavior: "auto" });
}
```

- [ ] **Step 4: Integrate `AppViewport` into `Layout`**

Add `useEffect` and `useRef`, import `AppViewport`, `resetScrollPosition`, the existing logo asset, and `FaRegUserCircle`. Create the content ref and reset it whenever `path` changes:

```tsx
const contentRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  resetScrollPosition(contentRef.current);
}, [path]);
```

Replace the nested `min-h-screen`, `pb-24`, and fixed-footer wrappers with this structure. Move the five existing navigation links and the floating `ChatButton` into the footer container without changing their labels, paths, selection classes, icons, badge logic, or order:

```tsx
const header = isLogin ? undefined : (
  <div className="container mx-auto max-w-full bg-white p-2 pt-4 md:w-4xl">
    {isHome ? (
      <div className="flex items-center justify-between">
        <img src={logoSVG} alt={m.app_logo_alt()} />
        <Link to="/settings" aria-label={m.page_settings_title()}>
          <FaRegUserCircle className="size-6 text-yellow-400" />
        </Link>
      </div>
    ) : (
      <div className="flex items-center justify-between pb-2">
        <BackButton className="flex-1/10 text-yellow-400" />
        <h1 className="m-0 flex-8/10 text-center">{title}</h1>
        <div className="flex w-full flex-1/10 justify-end">
          {isCart && (
            <HiShare
              onClick={onShareClick}
              className="size-6 cursor-pointer text-yellow-400"
            />
          )}
        </div>
      </div>
    )}
  </div>
);

return (
  <AppViewport
    header={header}
    contentRef={contentRef}
    footer={
      isLogin ? undefined : (
        <>
          <Separator className="bg-yellow-300" />
          <div className="flex h-24 w-full items-center justify-between gap-1 px-2 md:gap-4 md:px-8">
            <Link
              to="/"
              className={twMerge(
                "flex min-w-0 flex-1 flex-col items-center gap-1",
                path === "/" || path.startsWith("/recipes/")
                  ? "text-yellow-400"
                  : "text-gray-400",
              )}
            >
              <FiBookOpen className="size-6 md:size-10" />
              <div className="whitespace-nowrap text-[10px] md:text-sm">
                {m.nav_recipe()}
              </div>
            </Link>
            <Link
              to="/plans"
              className={twMerge(
                "flex min-w-0 flex-1 flex-col items-center gap-1",
                isPlanView ? "text-yellow-400" : "text-gray-400",
              )}
            >
              <FiCalendar className="size-6 md:size-10" />
              <div className="whitespace-nowrap text-[10px] md:text-sm">
                {m.nav_plan_view()}
              </div>
            </Link>
            <Link
              to="/plans/add"
              className={twMerge(
                "flex min-w-0 flex-1 flex-col items-center gap-1",
                isPlanCreate ? "text-yellow-400" : "text-gray-400",
              )}
            >
              <FiPlusSquare className="size-6 md:size-10" />
              <div className="whitespace-nowrap text-[10px] md:text-sm">
                {m.nav_plan_create()}
              </div>
            </Link>
            {(chatStore.currentRecipeId || chatStore.currentPlanId) && (
              <ChatButton
                className="fixed bottom-32 right-8"
                recipeId={chatStore.currentRecipeId}
                planId={chatStore.currentPlanId}
                navigateToStep={chatStore.navigateToStep}
                navigateToIngredients={chatStore.navigateToIngredients}
                prompt={chatStore.prompt}
              />
            )}
            <Link
              to="/bookmarks"
              className={twMerge(
                "flex min-w-0 flex-1 flex-col items-center gap-1",
                path === "/bookmarks" ? "text-yellow-400" : "text-gray-400",
              )}
            >
              <FiBookmark className="size-6 md:size-10" />
              <div className="whitespace-nowrap text-[10px] md:text-sm">
                {m.nav_bookmarks()}
              </div>
            </Link>
            <Link
              to="/cart"
              className={twMerge(
                "flex min-w-0 flex-1 flex-col items-center gap-1",
                path === "/cart" ? "text-yellow-400" : "text-gray-400",
              )}
            >
              <Badge.Anchor>
                <FiShoppingCart className="size-6 md:size-10" />
                {cart.recipes.length > 0 && (
                  <Badge size="sm" className="border-2 border-white">
                    {cart.recipes.length}
                  </Badge>
                )}
              </Badge.Anchor>
              <div className="whitespace-nowrap text-[10px] md:text-sm">
                {m.nav_cart()}
              </div>
            </Link>
          </div>
        </>
      )
    }
  >
    <div className="container mx-auto min-h-full max-w-full bg-white md:w-4xl">
      <div className="flex min-h-full flex-col p-2">
        <div
          className={twMerge(
            "min-h-0 flex-1",
            !isHome &&
              !isBookmarks &&
              !path.startsWith("/recipes/") &&
              "bg-linear-to-r from-[#fefce8] to-[#fef9c3]",
            isBookmarks && "bg-white",
            path.startsWith("/recipes/") && "bg-white",
            isLogin && "flex min-h-full items-center justify-center bg-white",
          )}
        >
          {children}
        </div>
      </div>
    </div>
  </AppViewport>
);
```

The footer JSX above preserves the existing link order, selection rules, badge, and floating `ChatButton`; do not introduce a new state abstraction.

- [ ] **Step 5: Remove duplicate home and plan-page height chrome**

From `routes/index/route.tsx`, remove `FaRegUserCircle`, `logoSVG`, and the `<div>` containing the logo/settings link at the top of `Page`. Keep the page root and search input:

```tsx
return (
  <div className="p-4">
    <Input
      fullWidth
      placeholder={m.home_search_placeholder()}
      className="h-12 rounded-xl border border-yellow-400 shadow-none"
      value={rawQuery}
      onChange={onQueryChange}
    />
```

In `routes/plans/add/index.tsx`, replace the nested viewport minimum:

```tsx
<div className="min-h-full w-full min-w-0 max-w-full overflow-x-hidden bg-white p-4">
```

- [ ] **Step 6: Run focused and full client checks**

```bash
bun test frontend/client/src/layouts/AppViewport.test.tsx frontend/client/src/layouts/scrollPosition.test.ts frontend/client/src/layouts/Layout.test.ts
cd frontend/client && bun run lint
```

Expected: all tests pass and Biome exits 0.

- [ ] **Step 7: Commit the shared layout integration**

```bash
git add frontend/client/src/layouts/Layout.tsx frontend/client/src/layouts/scrollPosition.ts frontend/client/src/layouts/scrollPosition.test.ts frontend/client/src/routes/index/route.tsx frontend/client/src/routes/plans/add/index.tsx
git commit -m "feat: fix app header and footer around scrolling content"
```

---

### Task 5: Verify every screen and production output

**Files:**
- Modify only if verification exposes a regression in a file already listed above.

**Interfaces:**
- Consumes the completed `AppViewport`, route integration, and sticky chat composer.
- Produces fresh test, lint, build, and visual-verification evidence.

- [ ] **Step 1: Run the entire automated test suite**

```bash
bun test
```

Expected: 0 failures, including the navigation, Markdown, quick-reply, width, color, viewport, and scrolling tests.

- [ ] **Step 2: Run Biome over the client**

```bash
cd frontend/client && bun run lint
```

Expected: exit 0 with no diagnostics.

- [ ] **Step 3: Build the production client and SSR bundle**

```bash
cd frontend/client && bun run build
```

Expected: client build, SSR build, and prerender all finish successfully. The existing large-chunk advisory is allowed; new errors are not.

- [ ] **Step 4: Check for obsolete whole-page scrolling classes**

```bash
rg -n "min-h-screen|fixed bottom-0|window\\.scrollTo" frontend/client/src/layouts frontend/client/src/routes/plans/add
```

Expected: no obsolete app-shell `min-h-screen`, fixed-footer wrapper, or chat `window.scrollTo` remains. A match is acceptable only when it belongs to an unrelated intentionally fixed floating action and is explained in the handoff.

- [ ] **Step 5: Perform responsive visual checks when an authenticated session is available**

Check widths near 390 px and 1024 px on `/`, `/plans`, `/plans/add`, `/bookmarks`, `/cart`, and `/settings`:

- Header remains visible while the center content moves.
- Footer remains visible and all five labels fit.
- Center content reaches neither behind the header nor behind the footer.
- Recipe and bookmark infinite lists continue loading when their final item enters the center viewport.
- Route navigation resets center content to the top.
- AI chat history scrolls while the composer remains visible.
- Sending or receiving a chat message moves the chat to its end.
- Opening the mobile keyboard keeps the composer usable.

If authentication is unavailable, report visual verification as not performed rather than claiming it passed.

- [ ] **Step 6: Review the final diff and commit any verification-only correction**

```bash
git diff --check
git status --short
```

Expected: no whitespace errors and only intentional files remain. If a correction was required, stage only that correction and commit it with a message naming the verified regression.
