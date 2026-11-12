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
      <div className="text-ink-muted [&_h2]:text-ink [&_strong]:text-ink mt-6 flex flex-col gap-5 text-[17px] leading-relaxed [&_h2]:mt-4 [&_h2]:text-xl [&_h2]:font-semibold [&_li]:mt-2 [&_ul]:list-disc [&_ul]:pl-6">
        <p>
          Your CV is about you, so we keep as little of it as possible. This page describes the
          current version of AI CV Studio.
        </p>
        <h2>What we store</h2>
        <p>
          Without an account, your CVs are saved only in this browser. With an account, they are
          also saved in your account on our servers (Google Cloud, through Firebase), together with
          the last 10 versions of each CV, so you can use them on any device and get back an earlier
          version.
        </p>
        <p>
          For your account we keep your email address and name, how you sign in, when you last used
          the studio, your plan, and how many downloads, imports and AI actions you used this month.
          If you buy Premium, we keep the payment details you send us (pass, amount, payment method
          and transaction ID) to check the payment.
        </p>
        <h2>When information leaves your device</h2>
        <ul>
          <li>
            <strong>Downloading a PDF:</strong> your CV is sent to our server to create the file and
            is not kept afterwards.
          </li>
          <li>
            <strong>Importing a CV:</strong> the file is read on our server and not kept. Its text
            may be sent to Google’s Gemini service to sort it into sections; we then check that
            nothing was added that isn’t in your file.
          </li>
          <li>
            <strong>AI help:</strong> only the part you asked about (for example one job’s bullet
            points) is sent to Gemini to create a suggestion.
          </li>
        </ul>
        <p>
          We use Gemini’s paid service, under which Google does not use your text to improve its
          products; Google keeps it for a limited time only to detect misuse. We don’t store what is
          sent to Gemini.
        </p>
        <h2>Deleting</h2>
        <p>
          Deleting a CV removes it and all of its earlier versions from your account. On the Account
          page you can delete your whole account, which removes everything above except payment
          records, which we keep for accounting with your email address removed. Signing out removes
          your account’s CVs from that device.
        </p>
        <h2>What we measure</h2>
        <p>
          We count visits and which steps people complete, without cookies and without reading what
          you write, so we can make the product easier to use.
        </p>
        <h2>Your choices</h2>
        <p>You can turn AI help off on this device:</p>
        <AiPreferenceToggle />
      </div>
    </Container>
  );
}
