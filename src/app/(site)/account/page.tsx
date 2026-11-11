import type { Metadata } from 'next';
import { Container } from '@/components/ui/misc';
import { AccountScreen } from '@/features/account/account-screen';

export const metadata: Metadata = { title: 'Your account' };

export default function AccountPage() {
  return (
    <Container className="max-w-[760px] py-10 md:py-14">
      <h1 className="font-display mb-6 text-[32px] leading-tight font-semibold tracking-tight sm:text-4xl">
        Account
      </h1>
      <AccountScreen />
    </Container>
  );
}
