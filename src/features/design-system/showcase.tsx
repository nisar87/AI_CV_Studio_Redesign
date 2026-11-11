'use client';

import { useState } from 'react';
import { Download, Redo2, Trash2, Undo2 } from 'lucide-react';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Card, SelectableCard } from '@/components/ui/card';
import { Badge, Chip } from '@/components/ui/chip';
import { TextArea, TextField } from '@/components/ui/field';
import { IconButton } from '@/components/ui/icon-button';
import { Container, Skeleton, Stepper } from '@/components/ui/misc';
import { Segmented } from '@/components/ui/segmented';
import { Tabs, tabId, tabPanelId } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';

const COLORS = [
  'paper',
  'surface',
  'sunken',
  'line',
  'line-strong',
  'ink',
  'ink-muted',
  'ink-subtle',
  'primary',
  'primary-hover',
  'primary-soft',
  'accent',
  'accent-soft',
  'accent-ink',
  'success',
  'warning',
  'danger',
  'info',
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-line flex flex-col gap-4 border-t pt-8">
      <h2 className="text-[22px] font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function Showcase() {
  const toast = useToast();
  const [tab, setTab] = useState<'content' | 'design'>('content');
  const [density, setDensity] = useState<'compact' | 'balanced' | 'airy'>('balanced');
  const [skills, setSkills] = useState<string[]>(['Customer service']);
  const [selected, setSelected] = useState(1);

  return (
    <main id="main">
      <Container className="flex flex-col gap-10 py-12">
        <header className="flex flex-col gap-2">
          <h1 className="font-display text-4xl font-semibold">Paper &amp; Ink — components</h1>
          <p className="text-ink-muted">
            Internal reference. Tokens mirror docs/ux/design-system.md.
          </p>
        </header>

        <Section title="Colour">
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {COLORS.map((c) => (
              <li key={c} className="flex flex-col gap-1.5 text-sm">
                <span
                  className="border-line h-14 rounded-md border"
                  style={{ background: `var(--color-${c})` }}
                />
                <code>{c}</code>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Typography">
          <p className="font-display text-5xl font-semibold">Display — Fraunces</p>
          <p className="font-display text-[32px] font-semibold">Page title — Fraunces 32</p>
          <p className="text-[22px] font-semibold">Section — Figtree 22</p>
          <p className="text-lg font-semibold">Card title — Figtree 18</p>
          <p>Body — Figtree 16. Plain words for everyone, from drivers to directors.</p>
          <p className="text-ink-muted text-sm">Helper — Figtree 14 muted.</p>
        </Section>

        <Section title="Buttons">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger" icon={<Trash2 aria-hidden size={16} />}>
              Delete
            </Button>
            <Button loading loadingText="Preparing your PDF…">
              Download PDF
            </Button>
            <Button size="sm">Small</Button>
            <Button size="lg" icon={<Download aria-hidden size={18} />}>
              Large
            </Button>
            <IconButton label="Undo" icon={<Undo2 aria-hidden size={20} />} />
            <IconButton label="Redo" variant="outlined" icon={<Redo2 aria-hidden size={20} />} />
          </div>
        </Section>

        <Section title="Form fields">
          <div className="grid max-w-2xl gap-5 sm:grid-cols-2">
            <TextField label="Full name" placeholder="e.g. Imran Qureshi" />
            <TextField
              label="Email"
              optional
              hint="Employers will use this to reply."
              placeholder="name@example.com"
            />
            <TextField label="Phone" error="This number looks too short" defaultValue="0300" />
            <TextField label="Disabled" disabled defaultValue="Can't edit" />
            <TextArea
              containerClassName="sm:col-span-2"
              label="What did you do there?"
              hint="One thing per line. For example: Delivered 120 parcels a day across north London."
            />
          </div>
          <Segmented
            label="Spacing"
            value={density}
            onChange={setDensity}
            options={[
              { value: 'compact', label: 'Compact' },
              { value: 'balanced', label: 'Balanced' },
              { value: 'airy', label: 'Airy' },
            ]}
            className="max-w-sm"
          />
        </Section>

        <Section title="Chips and badges">
          <div className="flex flex-wrap gap-2">
            {['Customer service', 'Route planning', 'Forklift', 'First aid'].map((s) => (
              <Chip
                key={s}
                selected={skills.includes(s)}
                onClick={() =>
                  setSkills((xs) => (xs.includes(s) ? xs.filter((x) => x !== s) : [...xs, s]))
                }
              >
                {s}
              </Chip>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge>Neutral</Badge>
            <Badge tone="primary">Saved</Badge>
            <Badge tone="accent">Suggested</Badge>
            <Badge tone="success">Ready</Badge>
            <Badge tone="warning">Needs your input</Badge>
            <Badge tone="danger">Error</Badge>
          </div>
        </Section>

        <Section title="Cards">
          <div className="grid gap-4 sm:grid-cols-3">
            {['Calm & classic', 'Modern & clear', 'Bold sidebar'].map((t, i) => (
              <SelectableCard key={t} selected={selected === i} onClick={() => setSelected(i)}>
                <span className="font-semibold">{t}</span>
                <span className="text-ink-muted text-sm">A short description of the style.</span>
              </SelectableCard>
            ))}
          </div>
          <Card className="max-w-md p-5">
            <p className="font-semibold">Static card</p>
            <p className="text-ink-muted text-sm">Used for grouped content.</p>
          </Card>
        </Section>

        <Section title="Tabs and stepper">
          <div className="max-w-md">
            <Tabs
              label="Editor"
              idBase="ds-tabs"
              value={tab}
              onChange={setTab}
              tabs={[
                { value: 'content', label: 'Content' },
                { value: 'design', label: 'Design' },
              ]}
            />
            <div
              role="tabpanel"
              id={tabPanelId('ds-tabs', tab)}
              aria-labelledby={tabId('ds-tabs', tab)}
              className="text-ink-muted py-4"
            >
              {tab === 'content' ? 'Content panel' : 'Design panel'}
            </div>
          </div>
          <div className="max-w-md">
            <Stepper current={2} total={6} label="Work history" />
          </div>
        </Section>

        <Section title="Feedback">
          <div className="flex max-w-2xl flex-col gap-3">
            <Banner tone="info" title="Saved on this device">
              Download a backup to keep your CVs safe.
            </Banner>
            <Banner tone="success" title="Your CV is ready" />
            <Banner tone="warning" title="2 details need your input" />
            <Banner
              tone="error"
              title="We couldn't create the PDF"
              action={
                <Button size="sm" variant="secondary">
                  Try again
                </Button>
              }
            >
              You can also use Print to save it as a PDF.
            </Banner>
          </div>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => toast.show({ message: 'Saved', tone: 'success' })}
            >
              Show toast
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                toast.show({
                  message: 'Work entry removed',
                  action: { label: 'Undo', onAction: () => {} },
                })
              }
            >
              Toast with undo
            </Button>
          </div>
          <div className="flex max-w-md flex-col gap-2">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        </Section>
      </Container>
    </main>
  );
}
