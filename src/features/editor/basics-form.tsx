'use client';

import { Plus, Trash2 } from 'lucide-react';
import { TextField } from '@/components/ui/field';
import { IconButton } from '@/components/ui/icon-button';
import { getPreset } from '@/modules/resume/presets';
import { ops } from '@/modules/resume/ops';
import type { ResumeDocument } from '@/modules/resume/schema';
import { PhotoField } from './photo-field';
import type { DocumentEditor } from './use-document-editor';

export function BasicsForm({
  editor,
  showLinks = true,
}: {
  editor: DocumentEditor;
  showLinks?: boolean;
}) {
  const { doc, update } = editor;
  const b = doc.basics;
  const preset = getPreset(doc.presetId);
  const set = (patch: Partial<ResumeDocument['basics']>, key: string) =>
    update((d) => ops.updateBasics(d, patch), `basics.${key}`);
  const emailInvalid =
    b.email.trim() !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(b.email.trim());

  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-4">
      <TextField
        containerClassName="col-span-2"
        label="Full name"
        autoComplete="name"
        value={b.name}
        placeholder="e.g. Imran Qureshi"
        onChange={(e) => set({ name: e.target.value }, 'name')}
        data-field="basics.name"
      />
      <TextField
        containerClassName="col-span-2"
        label="Job title you want"
        hint="Shown under your name."
        value={b.headline}
        placeholder={`e.g. ${preset.headlineExample}`}
        onChange={(e) => set({ headline: e.target.value }, 'headline')}
      />
      <TextField
        containerClassName="col-span-2 sm:col-span-1"
        label="Phone"
        type="tel"
        autoComplete="tel"
        value={b.phone}
        onChange={(e) => set({ phone: e.target.value }, 'phone')}
      />
      <TextField
        containerClassName="col-span-2 sm:col-span-1"
        label="Email"
        type="email"
        autoComplete="email"
        value={b.email}
        error={emailInvalid ? 'This email address looks incomplete' : undefined}
        onChange={(e) => set({ email: e.target.value }, 'email')}
      />
      <TextField
        containerClassName="col-span-2"
        label="Town or city"
        hint="Your full address is not needed."
        autoComplete="address-level2"
        value={b.location}
        onChange={(e) => set({ location: e.target.value }, 'location')}
      />
      <div className="col-span-2">
        <PhotoField editor={editor} />
      </div>
      {showLinks && (
        <div className="col-span-2 flex flex-col gap-3">
          {b.links.map((l) => (
            <div key={l.id} className="grid grid-cols-[1fr_1.6fr_auto] items-end gap-2">
              <TextField
                label="Link name"
                value={l.label}
                placeholder="e.g. LinkedIn"
                onChange={(e) =>
                  update(
                    (d) => ops.updateLink(d, l.id, { label: e.target.value }),
                    `link.${l.id}.label`,
                  )
                }
              />
              <TextField
                label="Web address"
                value={l.url}
                placeholder="e.g. linkedin.com/in/you"
                onChange={(e) =>
                  update(
                    (d) => ops.updateLink(d, l.id, { url: e.target.value }),
                    `link.${l.id}.url`,
                  )
                }
              />
              <IconButton
                label="Remove link"
                icon={<Trash2 aria-hidden size={18} />}
                onClick={() => update((d) => ops.removeLink(d, l.id))}
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() => update((d) => ops.addLink(d))}
            className="text-primary hover:bg-primary-soft inline-flex min-h-11 items-center gap-2 self-start rounded-md px-2 text-[15px] font-semibold"
          >
            <Plus aria-hidden size={18} /> Add a link (LinkedIn, website…)
          </button>
        </div>
      )}
    </div>
  );
}
