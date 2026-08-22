export function ChatComposerShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full min-w-0 bg-white px-2 py-3 md:px-4 md:py-4">
      {children}
    </div>
  );
}
