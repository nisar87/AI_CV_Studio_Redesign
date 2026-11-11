import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Container } from '@/components/ui/misc';
import { SignInScreen } from '@/features/account/signin-screen';

export const metadata: Metadata = { title: 'Sign in' };

export default function SignInPage() {
  return (
    <Container className="py-10 md:py-16">
      <Suspense>
        <SignInScreen />
      </Suspense>
    </Container>
  );
}
