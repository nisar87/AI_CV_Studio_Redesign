'use client';

import { useId, useState, type KeyboardEvent } from 'react';
import { Chip } from '@/components/ui/chip';
import { cn } from '@/lib/cn';

const control =
  'h-11 w-full rounded-sm border border-line-strong bg-surface px-3 text-base text-ink focus-visible:border-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/25 disabled:bg-sunken disabled:text-ink-subtle';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** Month (optional) + year selects producing "", "YYYY" or "YYYY-MM". */
export function DateField({
  label,
  value,
  onChange,
  disabled,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();
  const [y, m] = value ? value.split('-') : ['', ''];
  const thisYear = new Date().getFullYear();
  const years: number[] = [];
  for (let yr = thisYear + 6; yr >= thisYear - 60; yr--) years.push(yr);
  const set = (year: string, month: string) =>
    onChange(year ? (month ? `${year}-${month}` : year) : '');
  return (
    <fieldset className={cn('flex min-w-0 flex-col gap-1.5', className)} disabled={disabled}>
      <legend className="text-ink mb-1.5 text-sm font-semibold">{label}</legend>
      <div className="grid grid-cols-[1.2fr_1fr] gap-2">
        <label htmlFor={`${id}-m`} className="sr-only">
          {label} month
        </label>
        <select
          id={`${id}-m`}
          className={control}
          value={m ?? ''}
          onChange={(e) => set(y || String(thisYear), e.target.value)}
        >
          <option value="">Month</option>
          {MONTHS.map((name, i) => (
            <option key={name} value={String(i + 1).padStart(2, '0')} aria-label={name}>
              {name.slice(0, 3)}
            </option>
          ))}
        </select>
        <label htmlFor={`${id}-y`} className="sr-only">
          {label} year
        </label>
        <select
          id={`${id}-y`}
          className={control}
          value={y ?? ''}
          onChange={(e) => set(e.target.value, e.target.value ? (m ?? '') : '')}
        >
          <option value="">Year</option>
          {years.map((yr) => (
            <option key={yr} value={String(yr)}>
              {yr}
            </option>
          ))}
        </select>
      </div>
    </fieldset>
  );
}

/** Textarea where each line is one bullet point. */
export function LinesField({
  label,
  hint,
  value,
  onChange,
  placeholder,
  id: givenId,
}: {
  label: string;
  hint: string;
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  id?: string;
}) {
  const auto = useId();
  const id = givenId ?? auto;
  const rows = Math.min(10, Math.max(3, value.length + 1));
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-ink text-sm font-semibold">
        {label}
      </label>
      <textarea
        id={id}
        rows={rows}
        aria-describedby={`${id}-hint`}
        value={value.join('\n')}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value.split('\n'))}
        className="border-line-strong bg-surface text-ink placeholder:text-ink-subtle focus-visible:border-primary focus-visible:ring-primary/25 min-h-24 w-full resize-y rounded-sm border px-3 py-2.5 text-base leading-6 focus-visible:ring-3 focus-visible:outline-none"
      />
      <p id={`${id}-hint`} className="text-ink-muted text-sm">
        {hint}
      </p>
    </div>
  );
}

/** Chip input for skills, with optional suggestions. */
export function TagsField({
  label,
  hint,
  value,
  onChange,
  suggestions = [],
  id: givenId,
}: {
  label: string;
  hint: string;
  value: string[];
  onChange: (v: string[]) => void;
  suggestions?: string[];
  id?: string;
}) {
  const auto = useId();
  const id = givenId ?? auto;
  const [draft, setDraft] = useState('');
  const has = (s: string) => value.some((v) => v.toLowerCase() === s.toLowerCase());
  const add = (raw: string) => {
    const parts = raw
      .split(/[,;\n]/)
      .map((p) => p.trim())
      .filter((p) => p && !has(p));
    if (parts.length) onChange([...value, ...parts]);
    setDraft('');
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add(draft);
    } else if (e.key === 'Backspace' && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  };
  const remaining = suggestions.filter((s) => !has(s));
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-ink text-sm font-semibold">
        {label}
      </label>
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Added skills">
          {value.map((v, i) => (
            <li key={`${v}-${i}`}>
              <Chip
                mode="remove"
                selected
                aria-label={`Remove ${v}`}
                onClick={() => onChange(value.filter((_, k) => k !== i))}
              >
                {v}
              </Chip>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <input
          id={id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => draft.trim() && add(draft)}
          aria-describedby={`${id}-hint`}
          placeholder="e.g. Customer service"
          className={control}
        />
        <button
          type="button"
          onClick={() => add(draft)}
          className="border-line-strong bg-surface hover:bg-sunken h-11 shrink-0 rounded-md border px-4 text-[15px] font-semibold"
        >
          Add
        </button>
      </div>
      <p id={`${id}-hint`} className="text-ink-muted text-sm">
        {hint}
      </p>
      {remaining.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-ink-muted text-sm font-semibold">Suggestions</p>
          <ul className="flex flex-wrap gap-2">
            {remaining.map((s) => (
              <li key={s}>
                <Chip onClick={() => onChange([...value, s])}>{s}</Chip>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex min-h-11 items-center gap-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-5 shrink-0 accent-[var(--color-primary)]"
      />
      <label htmlFor={id} className="text-ink text-[15px]">
        {label}
      </label>
    </div>
  );
}
