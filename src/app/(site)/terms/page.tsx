import type { Metadata } from 'next';
import Link from 'next/link';
import { Container } from '@/components/ui/misc';
import { getBusinessConfig } from '@/modules/billing/server';

export const metadata: Metadata = { title: 'Terms of use' };
// Reads the support email from settings (cached 60 s on the server); not baked in at build time.
export const dynamic = 'force-dynamic';

const UPDATED = '12 November 2026';

export default async function TermsPage() {
  const { support } = (await getBusinessConfig()).value;
  const contact = support.email ? (
    <a href={`mailto:${support.email}`}>{support.email}</a>
  ) : (
    'the contact details on our Help page'
  );
  return (
    <Container className="max-w-[760px] py-10 md:py-14">
      <article className="text-ink-muted [&_a]:text-primary [&_h2]:text-ink [&_strong]:text-ink flex flex-col gap-4 text-[17px] leading-relaxed [&_a]:underline [&_a]:underline-offset-4 [&_h2]:mt-4 [&_h2]:text-xl [&_h2]:font-semibold [&_li]:mt-2 [&_ul]:list-disc [&_ul]:pl-6">
        <h1 className="font-display text-ink text-[32px] leading-tight font-semibold tracking-tight sm:text-4xl">
          Terms of use
        </h1>
        <p className="text-sm">Last updated {UPDATED}</p>
        <p>
          These terms explain what you can expect from AI CV Studio and what we expect from you. By
          creating an account or using the studio you agree to them. Our{' '}
          <Link href="/privacy">privacy notice</Link> explains how we handle your information.
        </p>

        <h2>Your account</h2>
        <ul>
          <li>You must be 18 or older to create an account.</li>
          <li>
            Keep your sign-in details to yourself. You are responsible for what happens in your
            account.
          </li>
          <li>You can delete your account at any time on the Account page.</li>
        </ul>

        <h2>Your CVs are yours</h2>
        <p>
          Everything you write stays yours. We only store and process it to provide the studio — to
          save it, show it, make your PDF and, when you ask, suggest wording.
        </p>
        <p>
          You are responsible for what your CV says. Only include true information about yourself.
          Our AI help is designed not to add facts, and it asks you when a detail is missing — but
          always read suggestions before you use them, and check your CV before you send it.
        </p>

        <h2>Free and Premium</h2>
        <ul>
          <li>
            A free account includes the features and monthly allowances shown on the{' '}
            <Link href="/premium">Premium page</Link>. Allowances reset each calendar month.
          </li>
          <li>
            <strong>Premium is a one-time pass</strong> for the number of days you choose. It does
            not renew automatically and nothing is charged without you paying for a new pass.
          </li>
          <li>
            We check payments by hand. Premium starts when your payment is approved. If we can’t
            find your payment, we tell you why so you can check the details.
          </li>
          <li>
            If you paid and did not receive Premium, contact us at {contact} with your order number.
            We will either give you the Premium you paid for or refund the payment.
          </li>
          <li>
            When a pass ends, your CVs stay in your account. CVs in a Premium design can be switched
            to a free design with your words kept.
          </li>
          <li>
            We may change prices and allowances for future passes; a pass you already bought keeps
            what it included.
          </li>
        </ul>

        <h2>Discount codes and invites</h2>
        <p>
          Discount codes work only on the passes and dates shown when you apply them, and can’t be
          exchanged for money. When a friend who joined with your invite link has their first
          Premium pass approved, you get the Premium days shown on your Account page; each friend
          counts once, and inviting yourself or using fake accounts doesn’t count. We may change or
          end offers for future purchases at any time.
        </p>
        <h2>Fair use</h2>
        <p>Please don’t:</p>
        <ul>
          <li>use the studio to create false documents or to impersonate someone else;</li>
          <li>try to get around limits, access other people’s accounts, or disrupt the service;</li>
          <li>use automated tools to make large numbers of requests.</li>
        </ul>
        <p>We may limit or close accounts that break these rules.</p>

        <h2>Availability</h2>
        <p>
          We work to keep the studio running and your CVs safe, but we can’t promise it will always
          be available or free of errors. Keep a downloaded copy of any CV you rely on.
        </p>

        <h2>Our responsibility</h2>
        <p>
          The studio helps you present your experience; it can’t guarantee interviews or jobs. As
          far as the law allows, we are not responsible for indirect losses. Nothing in these terms
          limits rights you have by law.
        </p>

        <h2>Changes and contact</h2>
        <p>
          If we change these terms, we will update the date above and, for important changes, tell
          you in the studio. Questions? Contact us at {contact}.
        </p>
      </article>
    </Container>
  );
}
