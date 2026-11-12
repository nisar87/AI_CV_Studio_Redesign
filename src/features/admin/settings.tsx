'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { TextArea, TextField } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { CheckboxField } from '@/features/editor/fields';
import { METERED, PLAN_IDS, type BusinessConfig, type Metered } from '@/modules/billing/config';
import { AdminHeading } from './admin-shell';
import { adminGet, adminSend } from './api';

type ConfigResponse = { version: number; value: BusinessConfig };

const METER_LABEL: Record<Metered, string> = {
  'pdf.download': 'PDF downloads',
  'import.cv': 'CV imports',
  'ai.action': 'AI actions',
};
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function AdminSettings() {
  const toast = useToast();
  const [base, setBase] = useState<ConfigResponse | null>(null);
  const [draft, setDraft] = useState<BusinessConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    adminGet<ConfigResponse>('/api/admin/config').then(
      (r) => {
        setBase(r);
        setDraft(structuredClone(r.value));
      },
      (e: Error) => setError(e.message),
    );
  }, []);
  useEffect(load, [load]);

  const dirty = useMemo(
    () => !!base && !!draft && JSON.stringify(base.value) !== JSON.stringify(draft),
    [base, draft],
  );

  const edit = (fn: (c: BusinessConfig) => void) =>
    setDraft((d) => {
      if (!d) return d;
      const next = structuredClone(d);
      fn(next);
      return next;
    });

  const editDesign = (i: number, fn: (d: BusinessConfig['designs'][number]) => void) =>
    edit((c) => {
      const d = c.designs[i];
      if (d) fn(d);
    });
  const editPass = (i: number, fn: (p: BusinessConfig['passes'][number]) => void) =>
    edit((c) => {
      const p = c.passes[i];
      if (p) fn(p);
    });

  const editMethod = (i: number, fn: (m: BusinessConfig['payments']['methods'][number]) => void) =>
    edit((c) => {
      const m = c.payments.methods[i];
      if (m) fn(m);
    });

  const save = async () => {
    if (!base || !draft) return;
    setSaving(true);
    setError(null);
    try {
      const r = await adminSend<{ version: number; changes: string[] }>(
        '/api/admin/config',
        'PUT',
        {
          baseVersion: base.version,
          value: draft,
        },
      );
      toast.show({
        tone: 'success',
        message: `Saved as version ${r.version} (${r.changes.length} change${r.changes.length === 1 ? '' : 's'}).`,
      });
      setBase({ version: r.version, value: structuredClone(draft) });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (!draft || !base)
    return (
      <>
        <AdminHeading title="Settings" />
        {error ? (
          <Banner tone="error" title="Could not load settings">
            {error}
          </Banner>
        ) : (
          <div className="skeleton h-64 rounded-lg" aria-busy="true" />
        )}
      </>
    );

  const freeEnabled = draft.designs.some((d) => d.enabled && d.tier === 'free');
  const salesProblem =
    draft.features.sales &&
    (!draft.passes.some((p) => p.active) || !draft.payments.methods.some((m) => m.active));

  return (
    <>
      <AdminHeading
        title="Settings"
        intro="Plans, designs, prices and switches. Changes take effect within a minute of saving and every save is kept in History."
      />
      <div className="flex flex-col gap-6 pb-28">
        <Section
          title="Plans and monthly limits"
          hint="Use −1 for unlimited and 0 for not included."
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-ink-muted text-left">
                  <th className="py-2 pr-3 font-semibold">Plan</th>
                  {METERED.map((m) => (
                    <th key={m} className="py-2 pr-3 font-semibold">
                      {METER_LABEL[m]}
                    </th>
                  ))}
                  <th className="py-2 pr-3 font-semibold">Jobs tracked</th>
                </tr>
              </thead>
              <tbody>
                {PLAN_IDS.map((p) => (
                  <tr key={p} className="border-line border-t">
                    <th scope="row" className="py-2 pr-3 text-left font-semibold">
                      {draft.plans[p].label}
                    </th>
                    {METERED.map((m) => (
                      <td key={m} className="py-2 pr-3">
                        <input
                          type="number"
                          min={-1}
                          aria-label={`${draft.plans[p].label}: ${METER_LABEL[m]} per month`}
                          className="border-line-strong bg-surface h-10 w-28 rounded-sm border px-2"
                          value={draft.plans[p].limits[m]}
                          onChange={(e) =>
                            edit((c) => {
                              c.plans[p].limits[m] = Math.max(
                                -1,
                                Math.floor(Number(e.target.value) || 0),
                              );
                            })
                          }
                        />
                      </td>
                    ))}
                    <td className="py-2 pr-3">
                      <input
                        type="number"
                        min={-1}
                        aria-label={`${draft.plans[p].label}: jobs tracked at once`}
                        className="border-line-strong bg-surface h-10 w-28 rounded-sm border px-2"
                        value={draft.plans[p].maxJobs}
                        onChange={(e) =>
                          edit((c) => {
                            c.plans[p].maxJobs = Math.max(
                              -1,
                              Math.floor(Number(e.target.value) || 0),
                            );
                          })
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section
          title="Designs"
          hint="Hide a design, or make it Premium. Free accounts and visitors can still preview Premium designs but download only free ones."
        >
          {!freeEnabled && (
            <Banner
              tone="warning"
              title="Keep at least one design free and shown."
              className="mb-3"
            />
          )}
          <ul className="divide-line divide-y">
            {draft.designs.map((d, i) => (
              <li
                key={d.id}
                className="flex flex-wrap items-center gap-x-6 gap-y-1 py-2"
                data-testid={`design-row-${d.id}`}
              >
                <span className="w-28 font-semibold">{cap(d.id)}</span>
                <CheckboxField
                  label="Shown"
                  checked={d.enabled}
                  onChange={(v) => editDesign(i, (d) => void (d.enabled = v))}
                />
                <label className="flex items-center gap-2 text-[15px]">
                  <span className="sr-only">{cap(d.id)} tier</span>
                  <select
                    className="border-line-strong bg-surface h-10 rounded-sm border px-2"
                    value={d.tier}
                    aria-label={`${cap(d.id)} tier`}
                    onChange={(e) =>
                      editDesign(i, (d) => void (d.tier = e.target.value as 'free' | 'premium'))
                    }
                  >
                    <option value="free">Free</option>
                    <option value="premium">Premium</option>
                  </select>
                </label>
                <CheckboxField
                  label="Mark as new"
                  checked={d.isNew}
                  onChange={(v) => editDesign(i, (d) => void (d.isNew = v))}
                />
              </li>
            ))}
          </ul>
        </Section>

        <Section
          title="Premium passes"
          hint="What people can buy once sales are on. Prices are in PKR."
        >
          <ul className="flex flex-col gap-3">
            {draft.passes.map((p, i) => (
              <li key={i} className="flex flex-wrap items-end gap-3">
                <TextField
                  label="Name"
                  value={p.label}
                  onChange={(e) => editPass(i, (p) => void (p.label = e.target.value))}
                  containerClassName="w-40"
                />
                <TextField
                  label="Days"
                  type="number"
                  min={1}
                  value={p.days}
                  onChange={(e) =>
                    editPass(i, (p) => void (p.days = Math.floor(Number(e.target.value) || 1)))
                  }
                  containerClassName="w-24"
                />
                <TextField
                  label="Price (PKR)"
                  type="number"
                  min={0}
                  value={p.pricePkr}
                  onChange={(e) =>
                    editPass(i, (p) => void (p.pricePkr = Math.floor(Number(e.target.value) || 0)))
                  }
                  containerClassName="w-32"
                />
                <CheckboxField
                  label="On sale"
                  checked={p.active}
                  onChange={(v) => editPass(i, (p) => void (p.active = v))}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Remove ${p.label}`}
                  icon={<Trash2 aria-hidden size={16} />}
                  onClick={() => edit((c) => void c.passes.splice(i, 1))}
                />
              </li>
            ))}
          </ul>
          {draft.passes.length < 6 && (
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              icon={<Plus aria-hidden size={16} />}
              onClick={() =>
                edit(
                  (c) =>
                    void c.passes.push({
                      id: `pass-${Date.now().toString(36)}`,
                      label: 'New pass',
                      days: 30,
                      pricePkr: 0,
                      active: false,
                    }),
                )
              }
            >
              Add a pass
            </Button>
          )}
        </Section>

        <Section
          title="How to pay"
          hint="Shown on the Premium page while sales are open. Put each account detail on its own line; buyers get a copy button for every line."
        >
          <ul className="flex flex-col gap-4">
            {draft.payments.methods.map((m, i) => (
              <li key={i} className="border-line flex flex-col gap-2 rounded-md border p-3">
                <div className="flex flex-wrap items-end gap-3">
                  <TextField
                    label="Method"
                    value={m.label}
                    placeholder="Bank transfer"
                    onChange={(e) => editMethod(i, (x) => void (x.label = e.target.value))}
                    containerClassName="w-56"
                  />
                  <CheckboxField
                    label="Shown"
                    checked={m.active}
                    onChange={(v) => editMethod(i, (x) => void (x.active = v))}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Remove ${m.label}`}
                    icon={<Trash2 aria-hidden size={16} />}
                    onClick={() => edit((c) => void c.payments.methods.splice(i, 1))}
                  />
                </div>
                <TextArea
                  label="Account details"
                  rows={3}
                  value={m.details}
                  placeholder={'Account title: …\nIBAN: …'}
                  onChange={(e) => editMethod(i, (x) => void (x.details = e.target.value))}
                />
              </li>
            ))}
          </ul>
          {draft.payments.methods.length < 6 && (
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              icon={<Plus aria-hidden size={16} />}
              onClick={() =>
                edit(
                  (c) =>
                    void c.payments.methods.push({
                      id: `pay-${Date.now().toString(36)}`,
                      label: 'Bank transfer',
                      details: '',
                      active: true,
                    }),
                )
              }
            >
              Add a payment method
            </Button>
          )}
          <TextArea
            label="Instructions for buyers"
            rows={3}
            maxLength={600}
            containerClassName="mt-4"
            value={draft.payments.instructions}
            onChange={(e) => edit((c) => void (c.payments.instructions = e.target.value))}
          />
        </Section>

        <Section title="Switches">
          <CheckboxField
            label="Premium sales are open (shows prices and “Get Premium”)"
            checked={draft.features.sales}
            onChange={(v) => edit((c) => void (c.features.sales = v))}
          />
          {salesProblem && (
            <Banner
              tone="warning"
              className="my-2"
              title="To open sales, keep at least one pass on sale and one payment method shown."
            />
          )}
          <CheckboxField
            label="AI help is available"
            checked={draft.features.ai}
            onChange={(v) => edit((c) => void (c.features.ai = v))}
          />
          <CheckboxField
            label="CV import is available"
            checked={draft.features.import}
            onChange={(v) => edit((c) => void (c.features.import = v))}
          />
          <CheckboxField
            label="New accounts can sign up"
            checked={draft.features.signups}
            onChange={(v) => edit((c) => void (c.features.signups = v))}
          />
          <CheckboxField
            label="Maintenance mode (downloads and AI paused)"
            checked={draft.features.maintenance}
            onChange={(v) => edit((c) => void (c.features.maintenance = v))}
          />
        </Section>

        <Section
          title="Support contact"
          hint="Shown on the Help, Terms and Premium pages so people can reach you about payments, privacy and problems."
        >
          <TextField
            label="Support email"
            type="email"
            value={draft.support.email}
            onChange={(e) => edit((c) => void (c.support.email = e.target.value.trim()))}
          />
        </Section>

        <Section title="Announcement" hint="A short message shown at the top of every page.">
          <CheckboxField
            label="Show the announcement"
            checked={draft.announcement.enabled}
            onChange={(v) => edit((c) => void (c.announcement.enabled = v))}
          />
          <TextField
            label="Message"
            maxLength={240}
            value={draft.announcement.text}
            onChange={(e) => edit((c) => void (c.announcement.text = e.target.value))}
          />
        </Section>
      </div>

      <div className="border-line bg-surface/95 fixed inset-x-0 bottom-0 z-20 border-t backdrop-blur">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-end gap-3 px-4 py-3 md:px-8">
          {error && (
            <p role="alert" className="text-danger mr-auto text-sm">
              {error}
            </p>
          )}
          <span className="text-ink-muted text-sm" aria-live="polite">
            {dirty ? 'Unsaved changes' : `Version ${base.version} · saved`}
          </span>
          <Button
            variant="ghost"
            disabled={!dirty || saving}
            onClick={() => setDraft(structuredClone(base.value))}
          >
            Discard
          </Button>
          <Button
            disabled={!dirty || saving || !freeEnabled || salesProblem}
            loading={saving}
            onClick={save}
          >
            Save changes
          </Button>
        </div>
      </div>
    </>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="border-line bg-surface rounded-lg border p-5"
      aria-labelledby={`s-${title}`}
    >
      <h2 id={`s-${title}`} className="text-lg font-semibold">
        {title}
      </h2>
      {hint && <p className="text-ink-muted mt-0.5 mb-3 text-sm">{hint}</p>}
      <div className={hint ? '' : 'mt-3'}>{children}</div>
    </section>
  );
}
