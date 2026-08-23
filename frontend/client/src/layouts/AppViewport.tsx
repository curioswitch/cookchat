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
