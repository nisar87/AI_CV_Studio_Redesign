import Link from 'next/link';
import type { CSSProperties } from 'react';
import { Mail, MapPin, Phone, ExternalLink } from 'lucide-react';
import type { ResumeDocument } from '@/modules/resume/schema';
import type { Portfolio } from '@/modules/store/types';
import { ensureContrast } from '@/modules/templates/color';
import { FONT_PAIRS } from '@/modules/templates/fonts';
import { toRenderModel, type REntry, type RSection } from '@/modules/templates/render-model';

/**
 * A personal web page made from one CV: same facts, accent colour and heading style, laid out
 * for reading on a phone. Email and phone appear only if the owner chose to show them.
 */
export function PortfolioPage({ doc, portfolio }: { doc: ResumeDocument; portfolio: Portfolio }) {
  const m = toRenderModel(doc);
  const pair = FONT_PAIRS[doc.design.fontPair];
  const serif = /serif/i.test(pair.headingFallback) && !/sans/i.test(pair.headingFallback);
  const style = {
    // Text in the accent colour must stay readable, whatever colour the person picked.
    '--accent': ensureContrast(doc.design.accent, '#ffffff', 4.5),
    '--heading': serif ? 'var(--font-display)' : 'var(--font-sans)',
  } as CSSProperties;
  const contacts = m.contacts.filter(
    (c) =>
      (c.kind === 'email' && portfolio.showEmail) ||
      (c.kind === 'phone' && portfolio.showPhone) ||
      c.kind === 'location' ||
      c.kind === 'link',
  );
  const summary = m.sections.find((s) => s.kind === 'summary');
  const rest = m.sections.filter((s) => s.kind !== 'summary' && s.kind !== 'contact');

  return (
    <div style={style} className="min-h-dvh">
      <header className="border-line bg-surface border-b">
        <div className="mx-auto flex max-w-[860px] flex-col gap-5 px-5 py-12 sm:flex-row sm:items-center sm:gap-8 sm:py-16">
          {m.photo ? (
            // eslint-disable-next-line @next/next/no-img-element -- data URL from the owner's CV
            <img
              src={m.photo}
              alt=""
              width={112}
              height={112}
              className="size-28 shrink-0 rounded-full object-cover ring-4 ring-[color-mix(in_srgb,var(--accent)_18%,transparent)]"
            />
          ) : (
            <div
              aria-hidden
              className="flex size-20 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--accent)_12%,white)] [font-family:var(--heading)] text-2xl font-semibold text-[var(--accent)]"
            >
              {m.initials}
            </div>
          )}
          <div className="flex flex-col gap-2">
            <h1 className="[font-family:var(--heading)] text-[40px] leading-[1.05] font-semibold tracking-tight sm:text-[52px]">
              {m.name}
            </h1>
            {m.headline && (
              <p className="text-lg font-semibold text-[var(--accent)]">{m.headline}</p>
            )}
            {contacts.length > 0 && (
              <ul className="text-ink-muted mt-1 flex flex-wrap gap-x-5 gap-y-2 text-[15px]">
                {contacts.map((c, i) => (
                  <li key={i} className="flex items-center gap-1.5">
                    {c.kind === 'email' ? (
                      <Mail aria-hidden size={16} />
                    ) : c.kind === 'phone' ? (
                      <Phone aria-hidden size={16} />
                    ) : c.kind === 'location' ? (
                      <MapPin aria-hidden size={16} />
                    ) : (
                      <ExternalLink aria-hidden size={16} />
                    )}
                    {c.href ? (
                      <a
                        href={c.href}
                        rel={c.kind === 'link' ? 'noopener noreferrer me' : undefined}
                        target={c.kind === 'link' ? '_blank' : undefined}
                        className="underline-offset-4 hover:text-[var(--accent)] hover:underline"
                      >
                        {c.label || c.text}
                      </a>
                    ) : (
                      <span>{c.text}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto flex max-w-[860px] flex-col gap-12 px-5 py-12">
        {summary?.text && (
          <section aria-labelledby="about">
            <h2 id="about" className={H2}>
              About
            </h2>
            <p className="text-[17px] leading-relaxed whitespace-pre-line">{summary.text}</p>
          </section>
        )}
        {rest.map((s) => (
          <PortfolioSection key={s.id} s={s} />
        ))}
      </main>

      <footer className="text-ink-muted border-line border-t px-5 py-8 text-center text-sm">
        Made with{' '}
        <Link href="/" className="text-primary font-semibold">
          AI CV Studio
        </Link>
      </footer>
    </div>
  );
}

const H2 =
  'mb-5 text-sm font-bold tracking-[0.14em] text-[var(--accent)] uppercase [font-family:var(--font-sans)]';

function PortfolioSection({ s }: { s: RSection }) {
  const id = `s-${s.id}`;
  if (s.kind === 'skills')
    return (
      <section aria-labelledby={id}>
        <h2 id={id} className={H2}>
          {s.title}
        </h2>
        <div className="flex flex-col gap-4">
          {s.entries.map((e) => (
            <div key={e.ref}>
              {e.label && <h3 className="mb-2 font-semibold">{e.label}</h3>}
              <ul className="flex flex-wrap gap-2">
                {e.tags.map((t) => (
                  <li
                    key={t}
                    className="rounded-full bg-[color-mix(in_srgb,var(--accent)_10%,white)] px-3 py-1 text-[15px]"
                  >
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    );
  if (s.kind === 'languages')
    return (
      <section aria-labelledby={id}>
        <h2 id={id} className={H2}>
          {s.title}
        </h2>
        <ul className="flex flex-wrap gap-x-8 gap-y-2">
          {s.entries.map((e) => (
            <li key={e.ref}>
              <span className="font-semibold">{e.title}</span>
              {e.label && <span className="text-ink-muted"> — {e.label}</span>}
            </li>
          ))}
        </ul>
      </section>
    );
  const timeline = s.kind === 'experience' || s.kind === 'volunteering';
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className={H2}>
        {s.title}
      </h2>
      <ol
        className={
          timeline
            ? 'flex flex-col gap-8 border-l-2 border-[color-mix(in_srgb,var(--accent)_25%,white)] pl-6'
            : 'flex flex-col gap-6'
        }
      >
        {s.entries.map((e) => (
          <Entry key={e.ref} e={e} timeline={timeline} />
        ))}
      </ol>
    </section>
  );
}

function Entry({ e, timeline }: { e: REntry; timeline: boolean }) {
  const sub = [e.subtitle, e.metaHref ? '' : e.meta].filter(Boolean).join(' · ');
  return (
    <li className="relative">
      {timeline && (
        <span
          aria-hidden
          className="absolute top-2 -left-[31px] size-3 rounded-full border-2 border-[var(--accent)] bg-white"
        />
      )}
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h3 className="[font-family:var(--heading)] text-lg leading-snug font-semibold">
          {e.title || e.subtitle}
        </h3>
        {e.dates && <p className="text-ink-muted text-sm tabular-nums">{e.dates}</p>}
      </div>
      {e.title && sub && <p className="text-ink-muted">{sub}</p>}
      {e.metaHref && (
        <a
          href={e.metaHref}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[15px] font-semibold text-[var(--accent)] underline-offset-4 hover:underline"
        >
          {e.meta}
        </a>
      )}
      {e.bullets.length > 0 && (
        <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 leading-relaxed marker:text-[var(--accent)]">
          {e.bullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      )}
    </li>
  );
}
