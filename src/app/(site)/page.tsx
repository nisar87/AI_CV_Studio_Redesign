import Link from 'next/link';
import { Suspense } from 'react';
import { InvitedNote } from '@/features/referrals/invited-note';
import {
  ArrowRight,
  Download,
  FileCheck2,
  MessageSquareText,
  Palette,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { ButtonLink } from '@/components/ui/button';
import { Container } from '@/components/ui/misc';
import { PaperStack } from '@/features/home/paper-stack';
import { LandingDrop } from '@/features/makeover/landing-drop';
import { ContinueCardClient } from '@/features/library/client';
import { PROFESSIONS } from '@/modules/resume/professions';

const STEPS = [
  {
    icon: MessageSquareText,
    title: 'Upload the CV you have',
    body: 'A PDF, a Word file or a photo of a paper CV. No CV yet? Tell us what you do and answer a few simple questions instead.',
  },
  {
    icon: Palette,
    title: 'Pick a design',
    body: 'We choose designs that suit your kind of work and show your CV in each one. Change colours, fonts or the whole look in one tap.',
  },
  {
    icon: Download,
    title: 'Download and send',
    body: 'Get a PDF that looks exactly like the preview and prints perfectly.',
  },
];

const PROMISES = [
  {
    icon: ShieldCheck,
    title: 'Honest by design',
    body: 'Our writing help improves your words. It never invents jobs, dates, qualifications or numbers.',
  },
  {
    icon: FileCheck2,
    title: 'Readable by hiring systems',
    body: 'Every design keeps real, selectable text in a sensible order, so applicant tracking systems can read it.',
  },
  {
    icon: Sparkles,
    title: 'Yours, on your device',
    body: 'Your CV is saved in your browser, and you can download a backup at any time.',
  },
];

export default function HomePage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <Container className="grid items-center gap-12 pt-10 pb-16 md:pt-16 lg:grid-cols-[1.05fr_1fr] lg:gap-8 lg:pt-20 lg:pb-24">
          <div className="flex flex-col items-start gap-6">
            <Suspense>
              <InvitedNote />
            </Suspense>
            <ContinueCardClient />
            <h1 className="font-display text-ink text-[40px] leading-[1.08] font-semibold tracking-tight sm:text-5xl lg:text-[58px]">
              Upload your CV, <span className="text-primary italic">see it transformed.</span>
            </h1>
            <p className="text-ink-muted max-w-[34rem] text-lg leading-relaxed">
              Drop the CV you have and see it in a professional design in under a minute — in your
              own words, with nothing added.
            </p>
            <div className="w-full max-w-[34rem]">
              <LandingDrop />
            </div>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <ButtonLink
                href="/start"
                variant="secondary"
                iconAfter={<ArrowRight aria-hidden size={18} />}
              >
                No CV yet? Create one
              </ButtonLink>
              <ButtonLink href="/templates" variant="ghost">
                See the designs
              </ButtonLink>
            </div>
            <p className="text-ink-subtle text-sm">
              No sign-in needed to see the result. Works on your phone.
            </p>
          </div>
          <PaperStack />
        </Container>
      </section>

      <section aria-labelledby="how" className="border-line bg-surface border-y">
        <Container className="py-16 lg:py-20">
          <h2 id="how" className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Three steps. No experience with CVs needed.
          </h2>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li
                key={s.title}
                className="border-line bg-paper flex flex-col gap-3 rounded-lg border p-6"
              >
                <div className="flex items-center gap-3">
                  <span className="bg-primary text-on-primary inline-flex size-10 items-center justify-center rounded-full">
                    <s.icon aria-hidden size={20} />
                  </span>
                  <span className="text-ink-subtle text-sm font-semibold">Step {i + 1}</span>
                </div>
                <h3 className="text-lg font-semibold">{s.title}</h3>
                <p className="text-ink-muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      <section aria-labelledby="every-job">
        <Container className="py-16 lg:py-20">
          <div className="flex flex-col gap-3 md:max-w-2xl">
            <h2
              id="every-job"
              className="font-display text-3xl font-semibold tracking-tight sm:text-4xl"
            >
              Made for every kind of work
            </h2>
            <p className="text-ink-muted text-lg">
              Choose yours and we&apos;ll ask the right questions — licences for drivers,
              registration for nurses, projects for students.
            </p>
          </div>
          <ul className="mt-8 flex flex-wrap gap-3">
            {PROFESSIONS.filter((p) => p.id !== 'general').map((p) => (
              <li key={p.id}>
                <Link
                  href={`/start?work=${p.id}`}
                  className="border-line-strong bg-surface text-ink hover:border-primary hover:bg-primary-soft hover:text-primary inline-flex min-h-11 items-center rounded-full border px-4 text-[15px] font-semibold transition-colors"
                >
                  {p.name}
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section aria-labelledby="promise" className="bg-ink text-white">
        <Container className="py-16 lg:py-20">
          <h2
            id="promise"
            className="font-display text-3xl font-semibold tracking-tight sm:text-4xl"
          >
            What we promise
          </h2>
          <ul className="mt-10 grid gap-8 md:grid-cols-3">
            {PROMISES.map((p) => (
              <li key={p.title} className="flex flex-col gap-3">
                <p.icon aria-hidden size={26} className="text-accent" />
                <h3 className="text-lg font-semibold">{p.title}</h3>
                <p className="text-white/75">{p.body}</p>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section aria-labelledby="cta">
        <Container className="flex flex-col items-start gap-6 py-16 md:flex-row md:items-center md:justify-between lg:py-20">
          <div className="flex flex-col gap-2">
            <h2 id="cta" className="font-display text-3xl font-semibold tracking-tight">
              Ready when you are.
            </h2>
            <p className="text-ink-muted text-lg">
              Start now — you can stop and come back whenever you like.
            </p>
          </div>
          <ButtonLink href="/start" size="lg" iconAfter={<ArrowRight aria-hidden size={18} />}>
            Create my CV
          </ButtonLink>
        </Container>
      </section>
    </>
  );
}
