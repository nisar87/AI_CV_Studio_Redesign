import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/figtree';
import '@fontsource-variable/fraunces';
import '@/styles/globals.css';
import { ToastProvider } from '@/components/ui/toast';

export const metadata: Metadata = {
  title: {
    default: 'AI CV Studio — A professional CV in your own words',
    template: '%s · AI CV Studio',
  },
  description:
    'Tell us what you do, answer a few simple questions, and get a professional CV you can edit and download for free.',
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
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
