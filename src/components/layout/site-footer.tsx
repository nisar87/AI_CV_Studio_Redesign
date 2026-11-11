import Link from 'next/link';
import { Container } from '@/components/ui/misc';
import { Logo } from './logo';

export function SiteFooter() {
  return (
    <footer className="border-line bg-surface mt-24 border-t">
      <Container className="flex flex-col gap-8 py-10 md:flex-row md:items-start md:justify-between">
        <div className="flex max-w-sm flex-col gap-3">
          <Logo />
          <p className="text-ink-muted text-sm">
            A professional CV in your own words. Honest by design, and saved on your device.
          </p>
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm">
          <Link className="text-ink-muted hover:text-ink" href="/start">
            Create a CV
          </Link>
          <Link className="text-ink-muted hover:text-ink" href="/templates">
            Designs
          </Link>
          <Link className="text-ink-muted hover:text-ink" href="/help">
            Help
          </Link>
          <Link className="text-ink-muted hover:text-ink" href="/privacy">
            Privacy
          </Link>
        </nav>
      </Container>
      <Container className="border-line text-ink-subtle border-t py-5 text-xs">
        © {new Date().getFullYear()} AI CV Studio
      </Container>
    </footer>
  );
}
