import type { Metadata } from 'next';
import Link from 'next/link';
import { Container } from '@/components/ui/misc';

export const metadata: Metadata = { title: 'Help' };

const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: 'Is it really free?',
    a: 'Yes. Creating your CV and downloading it as a PDF is free. There is no trial that turns into a subscription.',
  },
  {
    q: 'Where is my CV saved?',
    a: 'In this browser, on this device. Nothing is stored on our servers. Download a backup from “My CVs” if you want to keep a copy or move to another device.',
  },
  {
    q: 'Do I need an account?',
    a: 'No. Accounts will be optional later, for people who want their CVs on several devices.',
  },
  {
    q: 'What is an “applicant tracking system”?',
    a: 'Many employers use software to read CVs before a person does. It needs real text in a clear order. All of our designs are built so this software can read them correctly.',
  },
  {
    q: 'How does the writing help work?',
    a: 'It suggests clearer, more professional wording for what you have already written. It never adds jobs, dates, qualifications or numbers you did not give us. When a sentence would be stronger with a detail only you know, it asks you instead of guessing.',
  },
  {
    q: 'Can I use it on my phone?',
    a: 'Yes. Every step works on a phone. For detailed editing, a bigger screen is more comfortable, but it is not required.',
  },
  {
    q: 'My CV runs onto a second page. Is that bad?',
    a: 'No. One page suits short work histories; two pages are normal for experienced people. If it only just spills over, choose “Compact” spacing to fit it on one page.',
  },
];

export default function HelpPage() {
  return (
    <Container className="max-w-[760px] py-10 md:py-14">
      <h1 className="font-display text-[32px] leading-tight font-semibold tracking-tight sm:text-4xl">
        Help
      </h1>
      <p className="text-ink-muted mt-3 text-lg">Short answers to the questions people ask most.</p>
      <div className="divide-line border-line bg-surface mt-8 flex flex-col divide-y rounded-lg border">
        {FAQ.map((item) => (
          <details
            key={item.q}
            className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-sm text-[17px] font-semibold">
              {item.q}
              <span
                aria-hidden
                className="text-ink-subtle text-xl transition-transform group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <p className="text-ink-muted mt-3">{item.a}</p>
          </details>
        ))}
      </div>
      <p className="text-ink-muted mt-8">
        Read how we handle your information in our{' '}
        <Link href="/privacy" className="text-primary font-semibold underline underline-offset-4">
          privacy notice
        </Link>
        .
      </p>
    </Container>
  );
}
