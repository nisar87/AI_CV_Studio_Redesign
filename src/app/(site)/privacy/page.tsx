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
          If you buy Premium, we keep the order details (order number, pass, amount, payment method,
          your mobile number and any transaction ID you give) to check the payment. Payment
          screenshots you send us on WhatsApp stay in that chat and are only used to check your
          order.
        </p>
        <h2>When information leaves your device</h2>
        <ul>
          <li>
            <strong>Downloading a PDF or Word file:</strong> your CV is sent to our server to create
            the file and is not kept afterwards.
          </li>
          <li>
            <strong>AI help, job match, cover letters and LinkedIn text:</strong> the CV text needed
            for the task (and the job advert you pasted) is sent to Gemini to create a draft. It is
            checked against your CV so nothing is added that you didn’t write.
          </li>
          <li>
            <strong>Share links (only if you create one):</strong> anyone with the link can see that
            CV, read-only, until you switch the link off or delete it. Share pages are hidden from
            search engines. We count how many times a link is opened, nothing about who opened it.
          </li>
          <li>
            <strong>Portfolio page (only if you publish one):</strong> the CV you choose becomes a
            public web page anyone can find. Your email and phone number appear only if you tick
            them. Unpublishing or deleting the page takes it down straight away.
          </li>
          <li>
            <strong>Uploading a CV (makeover or import):</strong> the file is read on our server and
            not kept. Its text may be sent to Google’s Gemini service to sort it into sections; we
            then check that nothing was added that isn’t in your file. A scanned PDF or a photo of a
            CV is sent to Gemini as a picture so its text can be read. The “before” view of your
            original is drawn in your own browser. If you use the polish suggestions, the lines
            concerned are sent to Gemini to suggest fixes.
          </li>
          <li>
            <strong>Writing help in the editor:</strong> only the part you asked about (for example
            one job’s bullet points) is sent to Gemini to create a suggestion.
          </li>
          <li>
            <strong>AI Designer (describe a design):</strong> your description and counts of your
            CV’s length and sections are sent to Gemini — not the words of your CV. If you add a
            picture of a CV you like, the picture is sent to Gemini to read its layout and colours,
            then discarded; we don’t store it.
          </li>
        </ul>
        <p>
          We use Gemini’s paid service, under which Google does not use your text to improve its
          products; Google keeps it for a limited time only to detect misuse. We don’t store what is
          sent to Gemini.
        </p>
        <h2>Deleting</h2>
        <p>
          Deleting a CV removes it, all of its earlier versions and its share links from your
          account. On the Account page you can delete your whole account, which removes everything
          above, including your jobs, letters, share links and portfolio page, except payment
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
