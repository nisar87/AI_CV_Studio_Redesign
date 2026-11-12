import type { Metadata } from 'next';
import { Container } from '@/components/ui/misc';
import { ImportScreen } from '@/features/import/import-screen';

export const metadata: Metadata = {
  title: 'Import your CV',
  description: 'Upload your CV as a PDF or Word file and move it into a new design in minutes.',
};

export default function ImportPage() {
  return (
    <Container className="max-w-[1200px] py-10 md:py-14">
      <div className="mb-8 flex max-w-2xl flex-col gap-3">
        <h1 className="font-display text-[32px] leading-tight font-semibold tracking-tight sm:text-4xl">
          Import your CV
        </h1>
        <p className="text-ink-muted text-lg">
          Upload the CV you already have. We’ll put your words into editable sections so you can
          give it a fresh design and keep it up to date.
        </p>
      </div>
      <ImportScreen />
    </Container>
  );
}
