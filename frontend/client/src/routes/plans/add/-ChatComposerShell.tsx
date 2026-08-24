export function ChatComposerShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky bottom-0 z-40 w-full min-w-0 border-t border-yellow-100 bg-white px-2 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.04)] md:px-4 md:py-4">
      {children}
    </div>
  );
}
