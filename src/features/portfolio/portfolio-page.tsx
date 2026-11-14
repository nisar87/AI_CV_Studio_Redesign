import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { ExternalLink, Mail, MapPin, Phone } from 'lucide-react';
import { cn as classes } from '@/lib/cn';
import type { PortfolioProject, PortfolioSection, Theme } from '@/modules/portfolio/themes';
import type { ResumeDocument } from '@/modules/resume/schema';
import { ensureContrast } from '@/modules/templates/color';
import { FONT_PAIRS } from '@/modules/templates/fonts';
import {
  toRenderModel,
  type Contact as RContact,
  type REntry,
  type RSection,
} from '@/modules/templates/render-model';
import { ContactForm } from './contact-form';

/** What the page needs from the owner's settings (stored page, preview or a sample). */
export type PortfolioPageData = {
  slug: string;
  showEmail: boolean;
  showPhone: boolean;
  sections?: PortfolioSection[];
  projects?: PortfolioProject[];
};

type Props = {
  doc: ResumeDocument;
  portfolio: PortfolioPageData;
  theme: Theme;
  /** Where a project picture is served from. */
  imageSrc?: (id: string) => string;
  /** Show the contact form (the page takes messages). */
  contactOpen?: boolean;
  /** The owner's preview or a sample: the form can't send. */
  preview?: boolean;
  /** A note across the top (preview or sample page). */
  banner?: ReactNode;
  /** Shown inside another page (the gallery): no main landmark and no footer. */
  embedded?: boolean;
};

/**
 * A personal web page made from one CV (R3), in one of six themes from the design families
 * (R9.8): same facts, accent colour and heading style, laid out for reading on a phone. Email and
 * phone appear only if the owner chose to show them.
 */
export function PortfolioPage({
  doc,
  portfolio,
  theme,
  imageSrc,
  contactOpen = false,
  preview = false,
  banner,
  embedded = false,
}: Props) {
  const Main = embedded ? 'div' : 'main';
  const m = toRenderModel(doc);
  const pair = FONT_PAIRS[doc.design.fontPair];
  const cvSerif = /serif/i.test(pair.headingFallback) && !/sans/i.test(pair.headingFallback);
  const serif = theme === 'classic' || theme === 'editorial' || cvSerif;
  const style = {
    // Text in the accent colour must stay readable, whatever colour the person picked.
    '--accent': ensureContrast(doc.design.accent, theme === 'classic' ? PAPER : '#ffffff', 4.5),
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
  const side = theme === 'sidebar' ? rest.filter((s) => SIDE_KINDS.has(s.kind)) : [];
  const main = theme === 'sidebar' ? rest.filter((s) => !SIDE_KINDS.has(s.kind)) : rest;
  const custom = portfolio.sections ?? [];
  const projects = portfolio.projects ?? [];

  // Numbered headings (Editorial) count the sections in the order they appear.
  let n = 0;
  const next = () => ++n;
  const blocks: ReactNode[] = [];
  if (summary?.text)
    blocks.push(
      <Block key="about" id="about" title="About" theme={theme} n={next()}>
        <p className="text-[17px] leading-relaxed whitespace-pre-line">{summary.text}</p>
      </Block>,
    );
  for (const c of custom)
    blocks.push(
      <Block key={c.id} id={`c-${c.id}`} title={c.title} theme={theme} n={next()}>
        <CustomBody c={c} />
      </Block>,
    );
  // Called "Projects" unless the CV already has a section with that name.
  const galleryTitle = rest.some((s) => s.title.trim().toLowerCase() === 'projects')
    ? 'Project gallery'
    : 'Projects';
  if (projects.length)
    blocks.push(
      <Block key="projects" id="projects" title={galleryTitle} theme={theme} n={next()}>
        <Projects projects={projects} theme={theme} imageSrc={imageSrc} />
      </Block>,
    );
  for (const s of main)
    blocks.push(
      <Block key={s.id} id={`s-${s.id}`} title={s.title} theme={theme} n={next()}>
        <SectionBody s={s} theme={theme} />
      </Block>,
    );
  if (contactOpen)
    blocks.push(
      <Block key="contact" id="contact" title="Get in touch" theme={theme} n={next()}>
        <ContactForm slug={portfolio.slug} preview={preview} name={m.name} />
      </Block>,
    );

  const page = {
    clean: 'bg-surface',
    classic: 'bg-[#faf7f0]',
    sidebar: 'bg-paper',
    editorial: 'bg-surface',
    timeline: 'bg-surface',
    bold: 'bg-[color-mix(in_srgb,var(--accent)_5%,white)]',
  }[theme];

  return (
    <div style={style} className={classes('text-ink min-h-dvh', page)} data-theme={theme}>
      {banner && (
        <div className="bg-ink px-4 py-2 text-center text-sm text-white" role="note">
          {banner}
        </div>
      )}
      {theme === 'sidebar' ? (
        // Phones: details, then the story, then skills. Wider: details and skills on the left.
        <div className="mx-auto grid max-w-[1120px] gap-8 px-5 py-8 md:grid-cols-[300px_minmax(0,1fr)] md:grid-rows-[auto_1fr] md:py-12">
          <div className="md:col-start-1 md:row-start-1">
            <Identity m={m} contacts={contacts} theme={theme} />
          </div>
          <Main
            id={embedded ? undefined : 'main'}
            className="flex min-w-0 flex-col gap-10 md:col-start-2 md:row-span-2 md:row-start-1"
          >
            {blocks}
          </Main>
          {side.length > 0 && (
            <aside
              aria-label="Skills and languages"
              className="flex flex-col gap-8 md:col-start-1 md:row-start-2"
            >
              {side.map((s) => (
                <Block key={s.id} id={`s-${s.id}`} title={s.title} theme={theme} n={0}>
                  <SectionBody s={s} theme={theme} />
                </Block>
              ))}
            </aside>
          )}
        </div>
      ) : (
        <>
          <Identity m={m} contacts={contacts} theme={theme} />
          <Main
            id={embedded ? undefined : 'main'}
            className={classes(
              'mx-auto flex flex-col px-5 py-12',
              theme === 'editorial' ? 'max-w-[1040px] gap-16' : 'max-w-[860px] gap-12',
            )}
          >
            {blocks}
          </Main>
        </>
      )}
      {!embedded && (
        <footer className="text-ink-muted border-line border-t px-5 py-8 text-center text-sm">
          Made with{' '}
          <Link href="/" className="text-primary font-semibold">
            AI CV Studio
          </Link>
        </footer>
      )}
    </div>
  );
}

const PAPER = '#faf7f0';
/** Sections that sit in the Sidebar theme's side column. */
const SIDE_KINDS = new Set(['skills', 'languages', 'interests', 'strengths']);

type Model = ReturnType<typeof toRenderModel>;

// ---------------------------------------------------------------------------------------------
// Header

function Identity({ m, contacts, theme }: { m: Model; contacts: RContact[]; theme: Theme }) {
  const photo = (size: string, ring: string) =>
    m.photo ? (
      // eslint-disable-next-line @next/next/no-img-element -- data URL from the owner's CV
      <img
        src={m.photo}
        alt=""
        width={160}
        height={160}
        className={classes('shrink-0 rounded-full object-cover', size, ring)}
      />
    ) : (
      <div
        aria-hidden
        className={classes(
          'flex shrink-0 items-center justify-center rounded-full [font-family:var(--heading)] text-2xl font-semibold',
          size,
          theme === 'bold'
            ? 'bg-white/15 text-white'
            : 'bg-[color-mix(in_srgb,var(--accent)_12%,white)] text-[var(--accent)]',
        )}
      >
        {m.initials}
      </div>
    );
  const name = (cls: string) => (
    <h1 className={classes('[font-family:var(--heading)] font-semibold', cls)}>{m.name}</h1>
  );

  if (theme === 'sidebar')
    return (
      <div className="border-line bg-surface shadow-1 flex flex-col gap-4 rounded-xl border p-6">
        {photo('size-32', 'ring-4 ring-[color-mix(in_srgb,var(--accent)_18%,transparent)]')}
        <div className="flex flex-col gap-1">
          {name('text-[32px] leading-[1.1] tracking-tight')}
          {m.headline && <p className="font-semibold text-[var(--accent)]">{m.headline}</p>}
        </div>
        <Contacts contacts={contacts} className="flex flex-col gap-2 text-[15px]" />
      </div>
    );

  if (theme === 'classic')
    return (
      <header className="border-b-4 border-double border-[color-mix(in_srgb,var(--accent)_45%,white)]">
        <div className="mx-auto flex max-w-[860px] flex-col items-center gap-4 px-5 py-12 text-center sm:py-16">
          {photo('size-24', 'ring-2 ring-[var(--accent)] ring-offset-4 ring-offset-[#faf7f0]')}
          {name('text-[40px] leading-[1.05] sm:text-[52px]')}
          {m.headline && <p className="text-lg text-[var(--accent)] italic">{m.headline}</p>}
          <Contacts
            contacts={contacts}
            className="text-ink-muted flex flex-wrap justify-center gap-x-5 gap-y-2 text-[15px]"
          />
        </div>
      </header>
    );

  if (theme === 'editorial')
    return (
      <header className="border-ink border-b-2">
        <div className="mx-auto flex max-w-[1040px] flex-col gap-6 px-5 pt-16 pb-10 sm:pt-24">
          {m.headline && (
            <p className="text-sm font-bold tracking-[0.18em] text-[var(--accent)] uppercase">
              {m.headline}
            </p>
          )}
          {name('text-[48px] leading-[0.95] tracking-tight sm:text-[88px]')}
          <div className="flex flex-wrap items-center gap-6">
            {photo('size-16', '')}
            <Contacts
              contacts={contacts}
              className="text-ink-muted flex flex-wrap gap-x-6 gap-y-2 text-[15px]"
            />
          </div>
        </div>
      </header>
    );

  if (theme === 'bold')
    return (
      <header className="bg-[var(--accent)] text-white">
        <div className="mx-auto flex max-w-[860px] flex-col gap-5 px-5 py-14 sm:flex-row sm:items-center sm:gap-8 sm:py-20">
          {photo('size-28', 'ring-4 ring-white/80')}
          <div className="flex flex-col gap-2">
            {name('text-[40px] leading-[1.05] tracking-tight sm:text-[56px]')}
            {m.headline && <p className="text-lg font-semibold text-white/90">{m.headline}</p>}
            <Contacts
              contacts={contacts}
              className="mt-1 flex flex-wrap gap-x-5 gap-y-2 text-[15px] text-white/90 [&_a:hover]:text-white"
            />
          </div>
        </div>
      </header>
    );

  // clean and timeline
  return (
    <header
      className={classes(
        'border-line bg-surface border-b',
        theme === 'timeline' && 'border-t-4 border-t-[var(--accent)]',
      )}
    >
      <div
        className={classes(
          'mx-auto flex max-w-[860px] flex-col gap-5 px-5 sm:flex-row sm:items-center sm:gap-8',
          theme === 'timeline' ? 'py-10' : 'py-12 sm:py-16',
        )}
      >
        {photo(
          theme === 'timeline' ? 'size-20' : 'size-28',
          'ring-4 ring-[color-mix(in_srgb,var(--accent)_18%,transparent)]',
        )}
        <div className="flex flex-col gap-2">
          {name(
            theme === 'timeline'
              ? 'text-[34px] leading-[1.05] tracking-tight sm:text-[42px]'
              : 'text-[40px] leading-[1.05] tracking-tight sm:text-[52px]',
          )}
          {m.headline && <p className="text-lg font-semibold text-[var(--accent)]">{m.headline}</p>}
          <Contacts
            contacts={contacts}
            className="text-ink-muted mt-1 flex flex-wrap gap-x-5 gap-y-2 text-[15px]"
          />
        </div>
      </div>
    </header>
  );
}

function Contacts({ contacts, className }: { contacts: RContact[]; className: string }) {
  if (!contacts.length) return null;
  return (
    <ul className={className}>
      {contacts.map((c, i) => (
        <li key={i} className="flex min-w-0 items-center gap-1.5">
          {c.kind === 'email' ? (
            <Mail aria-hidden size={16} className="shrink-0" />
          ) : c.kind === 'phone' ? (
            <Phone aria-hidden size={16} className="shrink-0" />
          ) : c.kind === 'location' ? (
            <MapPin aria-hidden size={16} className="shrink-0" />
          ) : (
            <ExternalLink aria-hidden size={16} className="shrink-0" />
          )}
          {c.href ? (
            <a
              href={c.href}
              rel={c.kind === 'link' ? 'noopener noreferrer me' : undefined}
              target={c.kind === 'link' ? '_blank' : undefined}
              className="break-all underline-offset-4 hover:underline"
            >
              {c.label || c.text}
            </a>
          ) : (
            <span>{c.text}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------------------------
// Sections

function Block({
  id,
  title,
  theme,
  n,
  children,
}: {
  id: string;
  title: string;
  theme: Theme;
  n: number;
  children: ReactNode;
}) {
  const h = `${id}-h`;
  if (theme === 'editorial' && n > 0)
    return (
      <section
        aria-labelledby={h}
        className="grid gap-4 md:grid-cols-[200px_minmax(0,1fr)] md:gap-10"
      >
        <h2 id={h} className="flex flex-col gap-1 [font-family:var(--heading)]">
          <span aria-hidden className="text-[44px] leading-none font-semibold text-[var(--accent)]">
            {String(n).padStart(2, '0')}
          </span>
          <span className="text-2xl leading-tight font-semibold">{title}</span>
        </h2>
        <div className="min-w-0">{children}</div>
      </section>
    );
  const heading = {
    clean:
      'mb-5 text-sm font-bold tracking-[0.14em] text-[var(--accent)] uppercase [font-family:var(--font-sans)]',
    classic:
      'mb-6 flex items-center gap-4 text-center [font-family:var(--heading)] text-xl font-semibold before:h-px before:flex-1 before:bg-[color-mix(in_srgb,var(--accent)_40%,white)] after:h-px after:flex-1 after:bg-[color-mix(in_srgb,var(--accent)_40%,white)]',
    sidebar:
      'mb-4 border-l-4 border-[var(--accent)] pl-3 text-sm font-bold tracking-[0.12em] uppercase',
    editorial: 'mb-4 text-sm font-bold tracking-[0.14em] text-[var(--accent)] uppercase',
    timeline:
      'mb-6 flex items-center gap-2 text-sm font-bold tracking-[0.14em] text-[var(--accent)] uppercase before:size-2.5 before:rounded-full before:bg-[var(--accent)]',
    bold: 'mb-5 [font-family:var(--heading)] text-2xl font-bold after:mt-2 after:block after:h-1 after:w-12 after:rounded-full after:bg-[var(--accent)]',
  }[theme];
  // Sidebar: every section sits in its own card.
  const box = theme === 'sidebar' ? 'border-line bg-surface rounded-xl border p-6' : '';
  return (
    <section aria-labelledby={h} className={box}>
      <h2 id={h} className={heading}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function CustomBody({ c }: { c: PortfolioSection }) {
  return (
    <div className="flex flex-col gap-3">
      {c.text
        .split(/\n{2,}/)
        .filter(Boolean)
        .map((p, i) => (
          <p key={i} className="text-[17px] leading-relaxed whitespace-pre-line">
            {p}
          </p>
        ))}
      {c.link && (
        <a
          href={c.link}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 self-start font-semibold text-[var(--accent)] underline-offset-4 hover:underline"
        >
          {c.linkLabel || c.link.replace(/^https?:\/\//, '')}
          <ExternalLink aria-hidden size={15} />
        </a>
      )}
    </div>
  );
}

function Projects({
  projects,
  theme,
  imageSrc,
}: {
  projects: PortfolioProject[];
  theme: Theme;
  imageSrc?: (id: string) => string;
}) {
  return (
    <ul className="grid gap-6 sm:grid-cols-2" data-testid="portfolio-projects">
      {projects.map((p) => {
        const imgs = imageSrc ? p.images : [];
        return (
          <li
            key={p.id}
            className={classes(
              'flex flex-col overflow-hidden rounded-xl',
              theme === 'bold' || theme === 'sidebar'
                ? 'bg-surface shadow-1 border-line border'
                : 'border-line border',
            )}
          >
            {imgs.length > 0 && (
              <div className={classes('grid gap-0.5', imgs.length > 1 && 'grid-cols-2')}>
                {imgs.map((im, i) => (
                  // eslint-disable-next-line @next/next/no-img-element -- the owner's own pictures
                  <img
                    key={im.id}
                    src={imageSrc!(im.id)}
                    alt={im.alt}
                    loading="lazy"
                    className={classes(
                      'bg-sunken w-full object-cover',
                      imgs.length === 1 || (imgs.length === 3 && i === 0)
                        ? 'col-span-2 aspect-[16/10]'
                        : 'aspect-square',
                    )}
                  />
                ))}
              </div>
            )}
            <div className="flex flex-1 flex-col gap-2 p-5">
              <h3 className="[font-family:var(--heading)] text-lg leading-snug font-semibold">
                {p.title}
              </h3>
              {p.text && <p className="leading-relaxed whitespace-pre-line">{p.text}</p>}
              {p.link && (
                <a
                  href={p.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-auto inline-flex items-center gap-1.5 self-start pt-1 font-semibold text-[var(--accent)] underline-offset-4 hover:underline"
                >
                  See the project
                  <span className="sr-only">: {p.title}</span>
                  <ExternalLink aria-hidden size={15} />
                </a>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function SectionBody({ s, theme }: { s: RSection; theme: Theme }) {
  if (s.kind === 'skills')
    return (
      <div className="flex flex-col gap-4">
        {s.entries.map((e) => (
          <div key={e.ref}>
            {e.label && <h3 className="mb-2 font-semibold">{e.label}</h3>}
            <ul className="flex flex-wrap gap-2">
              {e.tags.map((t) => (
                <li
                  key={t}
                  className={classes(
                    'px-3 py-1 text-[15px]',
                    theme === 'classic'
                      ? 'rounded border border-[color-mix(in_srgb,var(--accent)_35%,white)] bg-white'
                      : theme === 'bold'
                        ? 'rounded-full bg-[var(--accent)] font-semibold text-white'
                        : 'rounded-full bg-[color-mix(in_srgb,var(--accent)_10%,white)]',
                  )}
                >
                  {t}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    );
  if (s.kind === 'languages')
    return (
      <ul className="flex flex-wrap gap-x-8 gap-y-2">
        {s.entries.map((e) => (
          <li key={e.ref}>
            <span className="font-semibold">{e.title}</span>
            {e.label && <span className="text-ink-muted"> — {e.label}</span>}
          </li>
        ))}
      </ul>
    );
  const career = s.kind === 'experience' || s.kind === 'volunteering' || s.kind === 'education';
  if (theme === 'timeline' && career)
    return (
      <ol className="flex flex-col">
        {s.entries.map((e) => (
          <li
            key={e.ref}
            className="grid gap-x-6 border-l-2 border-[color-mix(in_srgb,var(--accent)_25%,white)] pb-8 pl-6 last:pb-0 sm:grid-cols-[150px_minmax(0,1fr)] sm:border-l-0 sm:pl-0"
          >
            <p className="text-ink-muted pt-0.5 text-sm font-semibold tabular-nums sm:text-right">
              {e.dates}
            </p>
            <div className="relative sm:border-l-2 sm:border-[color-mix(in_srgb,var(--accent)_25%,white)] sm:pl-6">
              <span
                aria-hidden
                className="absolute top-1.5 -left-[31px] size-3 rounded-full border-2 border-[var(--accent)] bg-white sm:-left-[7px]"
              />
              <EntryBody e={e} withDates={false} />
            </div>
          </li>
        ))}
      </ol>
    );
  const line = (s.kind === 'experience' || s.kind === 'volunteering') && theme === 'clean';
  return (
    <ol
      className={classes(
        'flex flex-col',
        line
          ? 'gap-8 border-l-2 border-[color-mix(in_srgb,var(--accent)_25%,white)] pl-6'
          : 'gap-6',
      )}
    >
      {s.entries.map((e) => (
        <li
          key={e.ref}
          className={classes('relative', theme === 'bold' && 'bg-surface shadow-1 rounded-xl p-5')}
        >
          {line && (
            <span
              aria-hidden
              className="absolute top-2 -left-[31px] size-3 rounded-full border-2 border-[var(--accent)] bg-white"
            />
          )}
          <EntryBody e={e} withDates />
        </li>
      ))}
    </ol>
  );
}

function EntryBody({ e, withDates }: { e: REntry; withDates: boolean }) {
  const sub = [e.subtitle, e.metaHref ? '' : e.meta].filter(Boolean).join(' · ');
  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h3 className="[font-family:var(--heading)] text-lg leading-snug font-semibold">
          {e.title || e.subtitle}
        </h3>
        {withDates && e.dates && <p className="text-ink-muted text-sm tabular-nums">{e.dates}</p>}
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
    </>
  );
}
