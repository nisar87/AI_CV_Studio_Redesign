'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Download, ImagePlus, Plus, Trash2, X } from 'lucide-react';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { TextArea, TextField } from '@/components/ui/field';
import { cn } from '@/lib/cn';
import {
  MAX_IMAGE_BYTES,
  MAX_IMAGES_PER_PROJECT,
  MAX_PROJECTS,
  MAX_SECTIONS,
  THEME_INFO,
  THEMES,
  type PortfolioProject,
  type PortfolioSection,
  type PortfolioTheme,
  type Theme,
} from '@/modules/portfolio/themes';

const newId = () => Math.random().toString(36).slice(2, 12);
function move<T>(list: T[], i: number, by: number): T[] {
  const j = i + by;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}

// ---------------------------------------------------------------------------------------------
// Theme picker

/** A small drawing of each theme's layout (shapes only, so it reads at a glance). */
function Sketch({ theme }: { theme: Theme }) {
  const bar = (w: string, extra = '') => (
    <span className={cn('block h-1 rounded-full bg-current', w, extra)} />
  );
  const accent = 'text-primary';
  return (
    <span
      aria-hidden
      className={cn(
        'border-line text-ink-subtle relative flex h-20 w-full overflow-hidden rounded-md border',
        theme === 'classic' ? 'bg-[#faf7f0]' : theme === 'bold' ? 'bg-primary-soft' : 'bg-surface',
      )}
    >
      {theme === 'sidebar' ? (
        <>
          <span className="bg-sunken flex w-1/3 flex-col items-center gap-1 p-1.5">
            <span className={cn('size-4 rounded-full bg-current', accent)} />
            {bar('w-8')}
            {bar('w-6')}
          </span>
          <span className="flex flex-1 flex-col gap-1 p-2">
            {bar('w-10', accent)}
            {bar('w-16')}
            {bar('w-14')}
            {bar('w-10', accent)}
            {bar('w-16')}
          </span>
        </>
      ) : theme === 'bold' ? (
        <span className="flex w-full flex-col">
          <span className="bg-primary flex h-7 items-center gap-1.5 px-2">
            <span className="size-4 rounded-full bg-white/80" />
            <span className="block h-1.5 w-12 rounded-full bg-white/90" />
          </span>
          <span className="flex gap-1.5 p-2">
            <span className="bg-surface h-8 flex-1 rounded shadow-sm" />
            <span className="bg-surface h-8 flex-1 rounded shadow-sm" />
          </span>
        </span>
      ) : theme === 'editorial' ? (
        <span className="flex w-full flex-col gap-1 p-2">
          <span className="block h-3 w-20 rounded-sm bg-current" />
          <span className="flex gap-2 pt-1">
            <span className={cn('text-[10px] leading-none font-bold', accent)}>01</span>
            <span className="flex flex-1 flex-col gap-1">
              {bar('w-16')}
              {bar('w-12')}
            </span>
          </span>
          <span className="flex gap-2">
            <span className={cn('text-[10px] leading-none font-bold', accent)}>02</span>
            <span className="flex flex-1 flex-col gap-1">{bar('w-14')}</span>
          </span>
        </span>
      ) : theme === 'timeline' ? (
        <span className="flex w-full flex-col gap-1 p-2">
          <span className="bg-primary absolute inset-x-0 top-0 h-1" />
          {bar('w-16', 'mt-1')}
          {[0, 1, 2].map((i) => (
            <span key={i} className="flex items-center gap-1.5">
              {bar('w-5')}
              <span className={cn('size-1.5 rounded-full bg-current', accent)} />
              {bar('w-14')}
            </span>
          ))}
        </span>
      ) : theme === 'classic' ? (
        <span className="flex w-full flex-col items-center gap-1 p-2">
          <span className={cn('size-4 rounded-full border-2 border-current', accent)} />
          {bar('w-14')}
          <span className="border-ink-subtle/50 w-full border-b-2 border-double" />
          <span className="flex w-full items-center gap-1">
            {bar('flex-1', 'h-px')}
            {bar('w-6', accent)}
            {bar('flex-1', 'h-px')}
          </span>
          {bar('w-16')}
        </span>
      ) : (
        <span className="flex w-full flex-col gap-1 p-2">
          <span className="flex items-center gap-1.5">
            <span className={cn('size-4 rounded-full bg-current', accent)} />
            {bar('w-12')}
          </span>
          {bar('w-8', accent)}
          {bar('w-16')}
          {bar('w-14')}
          {bar('w-16')}
        </span>
      )}
    </span>
  );
}

export function ThemePicker({
  value,
  auto,
  onChange,
  onPreview,
}: {
  value: PortfolioTheme;
  /** The theme "Match my CV" gives for the chosen CV. */
  auto: Theme;
  onChange: (t: PortfolioTheme) => void;
  onPreview: (t: Theme) => void;
}) {
  const options: { id: PortfolioTheme; name: string; hint: string; sketch: Theme }[] = [
    {
      id: 'auto',
      name: 'Match my CV',
      hint: `${THEME_INFO[auto].name}, from your CV’s design`,
      sketch: auto,
    },
    ...THEMES.map((t) => ({ id: t, ...THEME_INFO[t], sketch: t })),
  ];
  return (
    <fieldset className="flex flex-col gap-3" data-testid="theme-picker">
      <legend className="mb-1 text-sm font-semibold">Theme</legend>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {options.map((o) => {
          const on = value === o.id;
          return (
            <div
              key={o.id}
              className={cn(
                'flex flex-col gap-2 rounded-lg border p-2',
                on ? 'border-primary ring-primary ring-2' : 'border-line',
              )}
            >
              <label className="flex cursor-pointer flex-col gap-2">
                <Sketch theme={o.sketch} />
                <span className="flex items-start gap-2">
                  <input
                    type="radio"
                    name="portfolio-theme"
                    value={o.id}
                    checked={on}
                    onChange={() => onChange(o.id)}
                    className="accent-primary mt-1"
                  />
                  <span className="flex flex-col">
                    <span className="text-sm font-semibold">{o.name}</span>
                    <span className="text-ink-muted text-xs">{o.hint}</span>
                  </span>
                </span>
              </label>
              <button
                type="button"
                onClick={() => onPreview(o.sketch)}
                className="text-primary self-start text-xs font-semibold underline underline-offset-4"
              >
                Preview<span className="sr-only"> the {o.name} theme with my CV</span>
              </button>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}

// ---------------------------------------------------------------------------------------------
// Custom sections

function MoveButtons({
  i,
  count,
  name,
  onMove,
  onRemove,
}: {
  i: number;
  count: number;
  name: string;
  onMove: (by: number) => void;
  onRemove: () => void;
}) {
  const btn =
    'text-ink-muted hover:text-ink hover:bg-sunken inline-flex size-9 items-center justify-center rounded-md disabled:opacity-40';
  return (
    <div className="flex shrink-0">
      <button
        type="button"
        className={btn}
        disabled={i === 0}
        onClick={() => onMove(-1)}
        aria-label={`Move ${name} up`}
      >
        <ArrowUp aria-hidden size={16} />
      </button>
      <button
        type="button"
        className={btn}
        disabled={i === count - 1}
        onClick={() => onMove(1)}
        aria-label={`Move ${name} down`}
      >
        <ArrowDown aria-hidden size={16} />
      </button>
      <button
        type="button"
        className={cn(btn, 'hover:text-danger')}
        onClick={onRemove}
        aria-label={`Remove ${name}`}
      >
        <Trash2 aria-hidden size={16} />
      </button>
    </div>
  );
}

export function SectionsEditor({
  value,
  onChange,
}: {
  value: PortfolioSection[];
  onChange: (v: PortfolioSection[]) => void;
}) {
  const set = (i: number, patch: Partial<PortfolioSection>) =>
    onChange(value.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  return (
    <section
      aria-labelledby="sections-h"
      className="flex flex-col gap-3"
      data-testid="sections-editor"
    >
      <div>
        <h2 id="sections-h" className="font-semibold">
          Your own sections
        </h2>
        <p className="text-ink-muted text-sm">
          Only on your page, not on the CV. For example “What I’m looking for” or “How I work”.
        </p>
      </div>
      {value.map((s, i) => (
        <div
          key={s.id}
          className="border-line flex flex-col gap-3 rounded-lg border p-4"
          data-testid="custom-section"
        >
          <div className="flex items-start gap-2">
            <TextField
              containerClassName="flex-1"
              label="Title"
              value={s.title}
              maxLength={60}
              onChange={(e) => set(i, { title: e.target.value })}
            />
            <MoveButtons
              i={i}
              count={value.length}
              name={s.title || `section ${i + 1}`}
              onMove={(by) => onChange(move(value, i, by))}
              onRemove={() => onChange(value.filter((_, j) => j !== i))}
            />
          </div>
          <TextArea
            label="Text"
            value={s.text}
            maxLength={2000}
            rows={4}
            hint="Leave an empty line between paragraphs."
            onChange={(e) => set(i, { text: e.target.value })}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField
              label="Link (optional)"
              value={s.link}
              maxLength={300}
              placeholder="example.com/more"
              onChange={(e) => set(i, { link: e.target.value })}
            />
            <TextField
              label="Link text (optional)"
              value={s.linkLabel}
              maxLength={60}
              onChange={(e) => set(i, { linkLabel: e.target.value })}
            />
          </div>
        </div>
      ))}
      {value.length < MAX_SECTIONS && (
        <Button
          variant="secondary"
          size="sm"
          className="self-start"
          icon={<Plus aria-hidden size={16} />}
          onClick={() =>
            onChange([...value, { id: newId(), title: '', text: '', link: '', linkLabel: '' }])
          }
        >
          Add a section
        </Button>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------------------------
// Projects with pictures

/** Resizes a picture in the browser so it fits the 600 KB limit (WebP, or JPEG where WebP can't be made). */
async function shrink(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  try {
    for (const [max, q] of [
      [1600, 0.82],
      [1200, 0.75],
      [900, 0.7],
    ] as const) {
      const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(bmp.width * scale));
      c.height = Math.max(1, Math.round(bmp.height * scale));
      const ctx = c.getContext('2d');
      if (!ctx) break;
      ctx.drawImage(bmp, 0, 0, c.width, c.height);
      let blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/webp', q));
      if (!blob || blob.type !== 'image/webp')
        blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', q));
      if (blob && blob.size <= MAX_IMAGE_BYTES) return blob;
    }
  } finally {
    bmp.close();
  }
  throw new Error('That picture is too large. Try a smaller one.');
}

async function upload(file: File): Promise<string> {
  let blob: Blob;
  try {
    blob = await shrink(file);
  } catch (e) {
    throw new Error(
      e instanceof Error && e.message.startsWith('That picture')
        ? e.message
        : 'That file couldn’t be read as a picture. Use a JPG, PNG or WebP.',
    );
  }
  const r = await fetch('/api/portfolio/images', {
    method: 'POST',
    headers: { 'content-type': blob.type },
    body: blob,
  });
  const j = (await r.json().catch(() => null)) as {
    image?: { id: string };
    error?: { message: string };
  } | null;
  if (!r.ok || !j?.image) throw new Error(j?.error?.message ?? 'The picture didn’t upload.');
  return j.image.id;
}

export function ProjectsEditor({
  value,
  onChange,
}: {
  value: PortfolioProject[];
  onChange: (v: PortfolioProject[]) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Uploads finish one by one; each must add to the list as it is by then.
  const latest = useRef(value);
  useEffect(() => {
    latest.current = value;
  }, [value]);
  const set = (id: string, patch: (p: PortfolioProject) => Partial<PortfolioProject>) =>
    onChange(latest.current.map((p) => (p.id === id ? { ...p, ...patch(p) } : p)));

  const add = async (p: PortfolioProject, files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    setBusy(p.id);
    try {
      const room = MAX_IMAGES_PER_PROJECT - p.images.length;
      for (const f of [...files].slice(0, room)) {
        const id = await upload(f);
        set(p.id, (cur) => ({ images: [...cur.images, { id, alt: '' }] }));
      }
      if (files.length > room)
        setError(`Up to ${MAX_IMAGES_PER_PROJECT} pictures per project; the rest were left out.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section
      aria-labelledby="projects-h"
      className="flex flex-col gap-3"
      data-testid="projects-editor"
    >
      <div>
        <h2 id="projects-h" className="font-semibold">
          Projects
        </h2>
        <p className="text-ink-muted text-sm">
          Show your work with pictures: a site you built, a room you renovated, a lesson plan, a
          design. Up to {MAX_PROJECTS} projects with {MAX_IMAGES_PER_PROJECT} pictures each.
        </p>
      </div>
      {error && (
        <Banner tone="error" title="Picture not added" onDismiss={() => setError(null)}>
          {error}
        </Banner>
      )}
      {value.map((p, i) => (
        <div
          key={p.id}
          className="border-line flex flex-col gap-3 rounded-lg border p-4"
          data-testid="project"
        >
          <div className="flex items-start gap-2">
            <TextField
              containerClassName="flex-1"
              label="Project name"
              value={p.title}
              maxLength={80}
              onChange={(e) => set(p.id, () => ({ title: e.target.value }))}
            />
            <MoveButtons
              i={i}
              count={value.length}
              name={p.title || `project ${i + 1}`}
              onMove={(by) => onChange(move(value, i, by))}
              onRemove={() => onChange(value.filter((x) => x.id !== p.id))}
            />
          </div>
          <TextArea
            label="What it is and what you did"
            value={p.text}
            maxLength={800}
            rows={3}
            onChange={(e) => set(p.id, () => ({ text: e.target.value }))}
          />
          <TextField
            label="Link (optional)"
            value={p.link}
            maxLength={300}
            placeholder="example.com/project"
            onChange={(e) => set(p.id, () => ({ link: e.target.value }))}
          />
          {p.images.length > 0 && (
            <ul
              className="grid gap-3 sm:grid-cols-2"
              aria-label={`Pictures for ${p.title || 'this project'}`}
            >
              {p.images.map((im, k) => (
                <li key={im.id} className="border-line flex gap-3 rounded-md border p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element -- the owner's own picture */}
                  <img
                    src={`/api/portfolio/images/${im.id}`}
                    alt=""
                    className="bg-sunken size-20 shrink-0 rounded object-cover"
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <TextField
                      label={`Describe picture ${k + 1}`}
                      hint="For people who can’t see it."
                      value={im.alt}
                      maxLength={140}
                      onChange={(e) =>
                        set(p.id, (cur) => ({
                          images: cur.images.map((x) =>
                            x.id === im.id ? { ...x, alt: e.target.value } : x,
                          ),
                        }))
                      }
                    />
                    <button
                      type="button"
                      onClick={() =>
                        set(p.id, (cur) => ({ images: cur.images.filter((x) => x.id !== im.id) }))
                      }
                      className="text-ink-muted hover:text-danger inline-flex items-center gap-1 self-start text-sm underline underline-offset-4"
                    >
                      <X aria-hidden size={14} /> Remove picture {k + 1}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {p.images.length < MAX_IMAGES_PER_PROJECT && (
            <label
              className={cn(
                'border-line-strong text-primary hover:bg-sunken inline-flex min-h-9 cursor-pointer items-center gap-1.5 self-start rounded-md border px-3 text-sm font-semibold focus-within:ring-2',
                busy === p.id && 'pointer-events-none opacity-60',
              )}
            >
              <ImagePlus aria-hidden size={16} />
              {busy === p.id ? 'Adding…' : 'Add pictures'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="sr-only"
                disabled={busy !== null}
                onChange={(e) => {
                  void add(p, e.target.files);
                  e.target.value = '';
                }}
              />
            </label>
          )}
        </div>
      ))}
      {value.length < MAX_PROJECTS && (
        <Button
          variant="secondary"
          size="sm"
          className="self-start"
          icon={<Plus aria-hidden size={16} />}
          onClick={() =>
            onChange([...value, { id: newId(), title: '', text: '', link: '', images: [] }])
          }
        >
          Add a project
        </Button>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------------------------
// QR code

/** A QR code for the page's address, to print on a business card, a poster or the CV itself. */
export function QrCard({ url, slug }: { url: string; slug: string }) {
  const [png, setPng] = useState<string | null>(null);
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void import('qrcode').then(async (q) => {
      const opts = {
        margin: 2,
        errorCorrectionLevel: 'M' as const,
        color: { dark: '#1d2125', light: '#ffffff' },
      };
      const [p, s] = await Promise.all([
        q.toDataURL(url, { ...opts, width: 768 }),
        q.toString(url, { ...opts, type: 'svg' }),
      ]);
      if (live) {
        setPng(p);
        setSvg(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(s)}`);
      }
    });
    return () => {
      live = false;
    };
  }, [url]);
  return (
    <div className="flex flex-wrap items-center gap-5" data-testid="portfolio-qr">
      {png ? (
        // eslint-disable-next-line @next/next/no-img-element -- generated here
        <img
          src={png}
          alt={`QR code that opens ${url.replace(/^https?:\/\//, '')}`}
          width={128}
          height={128}
          className="border-line rounded-md border"
        />
      ) : (
        <div className="skeleton size-32 rounded-md" aria-hidden />
      )}
      <div className="flex flex-col gap-2">
        <p className="font-semibold">QR code for your page</p>
        <p className="text-ink-muted max-w-[320px] text-sm">
          Print it on a business card or a poster. You can also add it to your CV in the Design
          Studio (Extras → QR code).
        </p>
        <div className="flex flex-wrap gap-2">
          <a
            href={png ?? undefined}
            download={`${slug}-qr.png`}
            aria-disabled={!png}
            className="border-line-strong hover:bg-sunken inline-flex min-h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-semibold"
          >
            <Download aria-hidden size={16} /> PNG
          </a>
          <a
            href={svg ?? undefined}
            download={`${slug}-qr.svg`}
            aria-disabled={!svg}
            className="border-line-strong hover:bg-sunken inline-flex min-h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-semibold"
          >
            <Download aria-hidden size={16} /> SVG (for printing)
          </a>
        </div>
      </div>
    </div>
  );
}
