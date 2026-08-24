import type { ReactNode } from "react";

type AppViewportProps = {
  children: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
};

export function AppViewport({ children, header, footer }: AppViewportProps) {
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
