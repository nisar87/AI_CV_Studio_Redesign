import type { Metadata } from 'next';
import { Container } from '@/components/ui/misc';
import { TemplateGallery } from '@/features/gallery/template-gallery';

export const metadata: Metadata = { title: 'Designs' };

export default function TemplatesPage() {
  return (
    <Container className="py-10 md:py-14">
      <h1 className="font-display text-[32px] leading-tight font-semibold tracking-tight sm:text-4xl">
        Designs
      </h1>
      <p className="text-ink-muted mt-3 max-w-2xl text-lg">
        A few carefully made designs that look professional with any amount of experience. Every one
        can be read by hiring software, and you can switch at any time without losing anything.
      </p>
      <div className="mt-8">
        <TemplateGallery />
      </div>
    </Container>
  );
}
