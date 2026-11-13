import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Globe, IdCard } from 'lucide-react';
import { Container } from '@/components/ui/misc';

export const metadata: Metadata = { title: 'Presence', robots: { index: false } };

const TOOLS = [
  {
    href: '/portfolio',
    icon: Globe,
    title: 'Portfolio page',
    body: 'Your CV as a web page with its own link. Choose what shows, and turn it off at any time.',
  },
  {
    href: '/linkedin',
    icon: IdCard,
    title: 'LinkedIn profile',
    body: 'A headline, About section and experience entries written from your CV, ready to paste.',
  },
];

/** Presence hub (complete-studio-spec §11.1): everything people see of you online. */
export default function PresencePage() {
  return (
    <Container className="py-10 md:py-14">
      <div className="mb-8 flex max-w-2xl flex-col gap-3">
        <h1 className="font-display text-[32px] leading-tight font-semibold tracking-tight sm:text-4xl">
          Presence
        </h1>
        <p className="text-ink-muted text-lg">
          How you show up online, made from the CV you already have.
        </p>
      </div>
      <ul className="grid gap-4 md:grid-cols-2">
        {TOOLS.map((t) => (
          <li key={t.href}>
            <Link
              href={t.href}
              className="border-line bg-surface hover:border-primary flex h-full flex-col gap-3 rounded-xl border p-6"
            >
              <t.icon aria-hidden size={26} className="text-primary" />
              <span className="text-xl font-semibold">{t.title}</span>
              <span className="text-ink-muted">{t.body}</span>
              <span className="text-primary mt-auto inline-flex items-center gap-1 font-semibold">
                Open <ArrowRight aria-hidden size={16} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Container>
  );
}
