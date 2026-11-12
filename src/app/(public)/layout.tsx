/** Public pages people share (CV links, portfolios): no studio navigation. */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <div className="bg-paper min-h-dvh">{children}</div>;
}
