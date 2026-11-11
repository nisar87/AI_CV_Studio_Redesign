'use client';

import { useState } from 'react';
import { PenLine, Sparkles, Wand2, Scissors, Briefcase, ListPlus, PowerOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Menu, type MenuItem } from '@/components/ui/menu';
import { useToast } from '@/components/ui/toast';
import type { PresetId } from '@/modules/resume/professions';
import { setAiPreference, useAi } from './client';
import { useAiDoc } from './context';
import { skillsInput, summaryInput } from './inputs';
import { AskText, SuggestionCard, useSuggestion } from './suggestion';

const triggerClass =
  'text-primary hover:bg-primary-soft inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-[15px] font-semibold';

function useTurnOff(): MenuItem {
  const toast = useToast();
  return {
    label: 'Turn off AI help',
    icon: <PowerOff aria-hidden size={16} />,
    onSelect: () => {
      setAiPreference(false);
      toast.show({
        message: 'AI help is off on this device.',
        action: { label: 'Undo', onAction: () => setAiPreference(true) },
      });
    },
  };
}

function HelpMenu({ items, label = 'Help me write' }: { items: MenuItem[]; label?: string }) {
  return (
    <Menu
      label={label}
      align="left"
      items={items}
      trigger={{
        className: triggerClass,
        content: (
          <>
            <Sparkles aria-hidden size={16} /> {label}
          </>
        ),
      }}
    />
  );
}

/** "Help me write" for the profile / introduction. */
export function SummaryAssist({
  summary,
  onApply,
}: {
  summary: string;
  onApply: (text: string) => void;
}) {
  const ai = useAi();
  const doc = useAiDoc();
  const s = useSuggestion('write.summary');
  const off = useTurnOff();
  if (!ai.show || !doc) return null;
  const has = summary.trim().length > 0;
  const items: MenuItem[] = [
    {
      label: has ? 'Write a new one for me' : 'Write it for me',
      icon: <PenLine aria-hidden size={16} />,
      onSelect: () => void s.run(summaryInput(doc, 'write'), 'From your details'),
    },
    ...(has
      ? [
          {
            label: 'Improve what I wrote',
            icon: <Wand2 aria-hidden size={16} />,
            onSelect: () => void s.run(summaryInput(doc, 'improve'), 'Improved'),
          },
          {
            label: 'Make it shorter',
            icon: <Scissors aria-hidden size={16} />,
            onSelect: () => void s.run(summaryInput(doc, 'shorter'), 'Shorter'),
          },
        ]
      : []),
    off,
  ];
  return (
    <div data-ai="summary">
      <HelpMenu items={items} />
      <SuggestionCard
        s={s}
        demo={ai.demo}
        onUse={(d) => {
          onApply(d.result.text);
          s.dismiss();
        }}
      >
        {(d) => (
          <p>
            <AskText text={d.result.text} />
          </p>
        )}
      </SuggestionCard>
    </div>
  );
}

/** "Help me write" for the bullet points of one job, project or activity. */
export function BulletsAssist({
  presetId,
  role,
  organization,
  bullets,
  onApply,
}: {
  presetId: PresetId;
  role: string;
  organization: string;
  bullets: string[];
  onApply: (bullets: string[]) => void;
}) {
  const ai = useAi();
  const improve = useSuggestion('write.improveBullets');
  const notes = useSuggestion('write.fromNotes');
  const off = useTurnOff();
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesText, setNotesText] = useState('');
  if (!ai.show) return null;
  const lines = bullets.map((b) => b.trim()).filter(Boolean);
  const base = { presetId, role: role.slice(0, 160), organization: organization.slice(0, 160) };
  const improveWith =
    (instruction: 'clearer' | 'shorter' | 'professional', label: string) => () => {
      notes.dismiss();
      void improve.run({ ...base, bullets: lines.slice(0, 12), instruction }, label);
    };
  const items: MenuItem[] = [
    ...(lines.length
      ? [
          {
            label: 'Make clearer',
            icon: <Wand2 aria-hidden size={16} />,
            onSelect: improveWith('clearer', 'Clearer'),
          },
          {
            label: 'Make shorter',
            icon: <Scissors aria-hidden size={16} />,
            onSelect: improveWith('shorter', 'Shorter'),
          },
          {
            label: 'Sound more professional',
            icon: <Briefcase aria-hidden size={16} />,
            onSelect: improveWith('professional', 'More professional'),
          },
        ]
      : []),
    {
      label: lines.length ? 'Turn my text into points' : 'Write from my notes',
      icon: <ListPlus aria-hidden size={16} />,
      onSelect: () => {
        improve.dismiss();
        if (lines.length)
          void notes.run({ ...base, notes: lines.join('\n').slice(0, 2000) }, 'From your text');
        else setNotesOpen(true);
      },
    },
    off,
  ];
  const list = (xs: string[]) => (
    <ul className="list-disc space-y-1 pl-5">
      {xs.map((b, i) => (
        <li key={i}>
          <AskText text={b} />
        </li>
      ))}
    </ul>
  );
  return (
    <div data-ai="bullets">
      <HelpMenu items={items} />
      {notesOpen && notes.state.kind === 'idle' && (
        <div className="border-line bg-surface mt-2 flex flex-col gap-2 rounded-md border p-3">
          <label htmlFor={`notes-${role}`} className="text-sm font-semibold">
            Tell us what you did, in your own words
          </label>
          <textarea
            id={`notes-${role}`}
            rows={3}
            value={notesText}
            onChange={(e) => setNotesText(e.target.value)}
            placeholder="e.g. drove a van, about 100 drops a day, loaded the van every morning, sometimes trained new drivers"
            className="border-line-strong bg-surface focus-visible:border-primary focus-visible:ring-primary/25 w-full rounded-sm border px-3 py-2 text-base focus-visible:ring-3 focus-visible:outline-none"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              icon={<Sparkles aria-hidden size={16} />}
              disabled={notesText.trim().length < 3}
              onClick={() =>
                void notes.run({ ...base, notes: notesText.slice(0, 2000) }, 'From your notes')
              }
            >
              Write points
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setNotesOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      <SuggestionCard
        s={improve}
        demo={ai.demo}
        onUse={(d) => {
          onApply(d.result.bullets);
          improve.dismiss();
        }}
      >
        {(d) => list(d.result.bullets)}
      </SuggestionCard>
      <SuggestionCard
        s={notes}
        demo={ai.demo}
        useLabel={lines.length ? 'Use these points' : 'Add these points'}
        onUse={(d) => {
          onApply(d.result.bullets);
          notes.dismiss();
          setNotesOpen(false);
          setNotesText('');
        }}
      >
        {(d) => list(d.result.bullets)}
      </SuggestionCard>
    </div>
  );
}

/** Skill ideas the person picks from (never added automatically). */
export function SkillsAssist({
  existing,
  onAdd,
}: {
  existing: string[];
  onAdd: (skills: string[]) => void;
}) {
  const ai = useAi();
  const doc = useAiDoc();
  const s = useSuggestion('suggest.skills');
  const [picked, setPicked] = useState<string[]>([]);
  if (!ai.show || !doc) return null;
  const have = new Set(existing.map((x) => x.toLowerCase()));
  return (
    <div data-ai="skills">
      <button
        type="button"
        className={triggerClass}
        onClick={() => {
          setPicked([]);
          void s.run(skillsInput(doc, existing), 'Pick the ones you have');
        }}
      >
        <Sparkles aria-hidden size={16} /> Suggest skills for me
      </button>
      <SuggestionCard
        s={s}
        demo={ai.demo}
        useLabel={
          picked.length
            ? `Add ${picked.length} skill${picked.length === 1 ? '' : 's'}`
            : 'Add selected'
        }
        onUse={() => {
          if (picked.length) onAdd(picked);
          setPicked([]);
          s.dismiss();
        }}
      >
        {(d) => (
          <ul className="flex flex-wrap gap-2" aria-label="Suggested skills">
            {d.result.skills
              .filter((k) => !have.has(k.toLowerCase()))
              .map((k) => {
                const on = picked.includes(k);
                return (
                  <li key={k}>
                    <Chip
                      selected={on}
                      onClick={() => setPicked((p) => (on ? p.filter((x) => x !== k) : [...p, k]))}
                    >
                      {k}
                    </Chip>
                  </li>
                );
              })}
          </ul>
        )}
      </SuggestionCard>
    </div>
  );
}
