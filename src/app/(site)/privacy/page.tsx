import type { Metadata } from 'next';
import { Container } from '@/components/ui/misc';
import { AiPreferenceToggle } from '@/features/ai/preference-toggle';

export const metadata: Metadata = { title: 'Privacy' };

export default function PrivacyPage() {
  return (
    <Container className="max-w-[720px] py-10 md:py-14">
      <h1 className="font-display text-[32px] leading-tight font-semibold tracking-tight sm:text-4xl">
        Privacy, in plain words
      </h1>
      <div className="text-ink-muted [&_h2]:text-ink mt-6 flex flex-col gap-5 text-[17px] leading-relaxed [&_h2]:mt-4 [&_h2]:text-xl [&_h2]:font-semibold">
        <p>
          Your CV is about you, so we keep as little of it as possible. This page describes the
          current version of AI CV Studio.
        </p>
        <h2>What we store</h2>
        <p>
          Your CVs are saved in your own browser on this device. We do not keep a copy on our
          servers. If you clear your browser data, your CVs are removed — download a backup to keep
          them safe.
        </p>
        <h2>When information leaves your device</h2>
        <p>
          When you download a PDF, your CV is sent to our server to create the file and is not kept
          afterwards. When you use AI help, only the part you asked about (for example one job’s
          bullet points) is sent to Google’s Gemini service to create a suggestion. We do not store
          it. We use Gemini’s paid service, under which Google does not use it to improve its
          products; Google keeps it for a limited time only to detect misuse.
        </p>
        <h2>What we measure</h2>
        <p>
          We count visits and which steps people complete, without cookies and without reading what
          you write, so we can make the product easier to use.
        </p>
        <h2>Your choices</h2>
        <p>You can delete any CV at any time, and you can turn AI help off:</p>
        <AiPreferenceToggle />
      </div>
    </Container>
  );
}
