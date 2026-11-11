import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/figtree';
import '@fontsource-variable/fraunces';
import '@/styles/globals.css';
import { ToastProvider } from '@/components/ui/toast';
import { AccountProvider } from '@/features/account/account-context';

export const metadata: Metadata = {
  title: {
    default: 'AI CV Studio — A professional CV in your own words',
    template: '%s · AI CV Studio',
  },
  description:
    'Tell us what you do, answer a few simple questions, and get a professional CV you can edit and download as a PDF.',
  applicationName: 'AI CV Studio',
};

export const viewport: Viewport = {
  themeColor: '#faf8f4',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>
          <AccountProvider>{children}</AccountProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
