import type { ReactNode } from "react";

type AppViewportProps = {
  children: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  centerContent?: boolean;
};

export function AppViewport({
  children,
  header,
  footer,
  centerContent = false,
}: AppViewportProps) {
  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden">
      {header && (
        <div data-app-header className="shrink-0 bg-white">
          {header}
        </div>
      )}
      <div
        data-app-scroll-content
        data-scroll-restoration-id="app-content"
        className={`min-h-0 flex-1 overflow-y-auto overscroll-contain ${
          centerContent ? "flex items-center justify-center" : ""
        }`}
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
