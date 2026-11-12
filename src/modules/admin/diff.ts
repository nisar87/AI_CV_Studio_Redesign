/** Short human summary of what changed between two configs (for the audit log). */
export function diffSummary(before: unknown, after: unknown, path = ''): string[] {
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  const isObj = (x: unknown): x is Record<string, unknown> =>
    !!x && typeof x === 'object' && !Array.isArray(x);
  if (isObj(before) && isObj(after)) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    return [...keys].flatMap((k) => diffSummary(before[k], after[k], path ? `${path}.${k}` : k));
  }
  // Lists of items with an id (designs, passes, methods) or a code (discount codes).
  const key = (x: unknown) =>
    isObj(x)
      ? typeof x.id === 'string'
        ? x.id
        : typeof x.code === 'string'
          ? x.code
          : null
      : null;
  if (
    Array.isArray(before) &&
    Array.isArray(after) &&
    [...before, ...after].every((x) => key(x) !== null)
  ) {
    const byId = (a: unknown[]) => new Map(a.map((x) => [key(x)!, x]));
    const b = byId(before);
    const a = byId(after);
    const ids = new Set([...b.keys(), ...a.keys()]);
    return [...ids].flatMap((id) => diffSummary(b.get(id), a.get(id), `${path}[${id}]`));
  }
  const show = (v: unknown) => (v === undefined ? '—' : JSON.stringify(v));
  return [`${path}: ${show(before)} → ${show(after)}`];
}
