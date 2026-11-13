/** Opens per day for the last `n` days, oldest first (days with no opens are 0). */
export function lastDays(
  daily: Record<string, number> | undefined,
  n = 14,
  now = new Date(),
): { day: string; n: number }[] {
  const out: { day: string; n: number }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    const day = d.toISOString().slice(0, 10);
    out.push({ day, n: daily?.[day] ?? 0 });
  }
  return out;
}
