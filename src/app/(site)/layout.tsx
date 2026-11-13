import { SiteChrome } from '@/features/shell/site-chrome';

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return <SiteChrome>{children}</SiteChrome>;
}
