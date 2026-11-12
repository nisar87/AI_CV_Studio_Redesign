import { SiteFooter } from '@/components/layout/site-footer';
import { AnnouncementBar } from '@/components/layout/announcement-bar';
import { SiteHeader } from '@/components/layout/site-header';

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <AnnouncementBar />
      <SiteHeader />
      <main id="main" className="min-h-[calc(100dvh-4rem)] flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
