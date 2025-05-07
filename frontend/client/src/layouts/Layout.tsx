export default function Layout({ children }: { children: React.ReactNode }) {
  return <div className="container mx-auto max-w-full prose">{children}</div>;
}
