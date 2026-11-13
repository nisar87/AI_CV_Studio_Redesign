import { BlockList, isIP } from 'node:net';

/**
 * Job from URL (R9.5, complete-studio-spec §12.6): the pure parts — which addresses may be
 * fetched, HTML to text, and the schema.org JobPosting most job boards embed. The network part is
 * in fetch.ts.
 */

/** Ranges a server-side fetch must never reach (private, loopback, link-local, reserved…). */
const BLOCKED = new BlockList();
for (const [net, bits] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const)
  BLOCKED.addSubnet(net, bits, 'ipv4');
for (const [net, bits] of [
  ['::', 128],
  ['::1', 128],
  ['100::', 64],
  ['2001:db8::', 32],
  ['2001::', 32],
  ['2002::', 16],
  ['fc00::', 7],
  ['fe80::', 10],
  ['fec0::', 10],
  ['ff00::', 8],
] as const)
  BLOCKED.addSubnet(net, bits, 'ipv6');

/** An IPv4 address hidden inside IPv6 (::ffff:a.b.c.d, ::a.b.c.d, 64:ff9b::a.b.c.d). */
function embeddedV4(ip: string): string | null {
  const low = ip.toLowerCase();
  const m = /^(?:::ffff:|::|64:ff9b::)((?:\d{1,3}\.){3}\d{1,3})$/.exec(low);
  if (m) return m[1]!;
  const h = /^(?:::ffff:|64:ff9b::)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(low);
  if (h) {
    const a = parseInt(h[1]!, 16);
    const b = parseInt(h[2]!, 16);
    return `${a >> 8}.${a & 255}.${b >> 8}.${b & 255}`;
  }
  return null;
}

/** True only for addresses on the public internet. */
export function isPublicAddress(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return !BLOCKED.check(ip, 'ipv4');
  if (kind === 6) {
    const v4 = embeddedV4(ip);
    if (v4) return isPublicAddress(v4);
    if (/^64:ff9b:/i.test(ip)) return false;
    return !BLOCKED.check(ip, 'ipv6');
  }
  return false;
}

export class PageError extends Error {
  constructor(
    public code: 'BAD_URL' | 'BLOCKED' | 'TIMEOUT' | 'TOO_LARGE' | 'NOT_HTML' | 'HTTP' | 'NETWORK',
    message: string,
  ) {
    super(message);
  }
}

/**
 * The URL a person typed, if it may be fetched: http(s) only, no credentials, the usual ports,
 * no local names, and an IP literal only if public. (The URL parser already turns "2130706433"
 * and "0x7f.1" into dotted addresses.) DNS answers are checked again when connecting.
 */
export function checkUrl(raw: string, opts: { allowLoopback?: boolean } = {}): URL {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    throw new PageError(
      'BAD_URL',
      'That doesn’t look like a web link. It should start with https://',
    );
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:')
    throw new PageError('BAD_URL', 'Only web links (https://) can be read.');
  if (u.username || u.password)
    throw new PageError('BAD_URL', 'Links with a password can’t be read.');
  const host = u.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  const loopbackOk = opts.allowLoopback && (host === '127.0.0.1' || host === 'localhost');
  if (u.port && !['80', '443'].includes(u.port) && !loopbackOk)
    throw new PageError('BLOCKED', 'That link can’t be read.');
  if (!loopbackOk) {
    if (
      host === 'localhost' ||
      /\.(localhost|local|internal|intranet|lan|home|corp|home\.arpa)$/.test(host) ||
      (!host.includes('.') && !isIP(host))
    )
      throw new PageError('BLOCKED', 'That link can’t be read.');
    if (isIP(host) && !isPublicAddress(host))
      throw new PageError('BLOCKED', 'That link can’t be read.');
  }
  u.hash = '';
  return u;
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
  bull: '•',
  middot: '·',
  pound: '£',
  euro: '€',
  copy: '©',
  reg: '®',
  trade: '™',
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : '';
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** Readable text from HTML: no scripts, styles or hidden parts; blocks become lines. */
export function htmlToText(html: string): string {
  const t = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    // Hidden parts are not what a person sees (and are where page-borne instructions hide).
    .replace(
      /<(\w+)\b[^>]*(?:\shidden(?=[\s=>])|aria-hidden=["']true["']|display\s*:\s*none|visibility\s*:\s*hidden)[^>]*>[\s\S]*?<\/\1\s*>/gi,
      ' ',
    )
    .replace(
      /<(script|style|noscript|svg|template|iframe|head|nav|footer|form|button|select)\b[\s\S]*?<\/\1\s*>/gi,
      ' ',
    )
    .replace(/<(br|hr)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n- ')
    .replace(
      /<\/?(p|div|section|article|main|header|aside|h[1-6]|ul|ol|li|tr|table|dd|dt|dl|blockquote|pre)\b[^>]*>/gi,
      '\n',
    )
    .replace(/<[^>]+>/g, ' ');
  return decodeEntities(t)
    .replace(/[ \t\u00a0]+/g, ' ')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n');
}

const meta = (html: string, prop: string) => {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']*)["']|<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${prop}["']`,
    'i',
  );
  const m = re.exec(html);
  return decodeEntities((m?.[1] ?? m?.[2] ?? '').trim());
};

export type PageInfo = {
  title: string;
  siteName: string;
  text: string;
  posting: Posting | null;
};
export type Posting = { title: string; company: string; location: string; advert: string };

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

function placeOf(loc: unknown): string {
  const one = (l: unknown): string => {
    const a = (l as { address?: unknown })?.address;
    if (typeof a === 'string') return a.trim();
    const o = (a ?? {}) as Record<string, unknown>;
    return [o.addressLocality, o.addressRegion, o.addressCountry]
      .map((x) => (typeof x === 'string' ? x : str((x as { name?: unknown })?.name)))
      .filter(Boolean)
      .filter((x, i, arr) => arr.indexOf(x) === i)
      .join(', ');
  };
  const list = Array.isArray(loc) ? loc : loc ? [loc] : [];
  return [...new Set(list.map(one).filter(Boolean))].slice(0, 3).join(' · ');
}

/** The schema.org JobPosting embedded as JSON-LD, if the page has one. */
export function findPosting(html: string): Posting | null {
  const blocks = [
    ...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi),
  ];
  for (const b of blocks) {
    let data: unknown;
    try {
      data = JSON.parse(b[1]!.trim());
    } catch {
      continue;
    }
    const queue: unknown[] = [data];
    while (queue.length) {
      const x = queue.shift();
      if (Array.isArray(x)) {
        queue.push(...x);
        continue;
      }
      if (!x || typeof x !== 'object') continue;
      const o = x as Record<string, unknown>;
      if (o['@graph']) queue.push(o['@graph']);
      const type = o['@type'];
      const isPosting = Array.isArray(type) ? type.includes('JobPosting') : type === 'JobPosting';
      if (!isPosting) continue;
      const org = o.hiringOrganization;
      const posting: Posting = {
        title: decodeEntities(str(o.title)).slice(0, 160),
        company: decodeEntities(
          typeof org === 'string' ? org.trim() : str((org as { name?: unknown })?.name),
        ).slice(0, 160),
        location:
          (o.jobLocationType === 'TELECOMMUTE' ? 'Remote' : '') ||
          placeOf(o.jobLocation).slice(0, 120),
        advert: htmlToText(decodeEntities(str(o.description))).slice(0, 20_000),
      };
      if (posting.title && posting.advert.length >= 80) return posting;
    }
  }
  return null;
}

/** Everything the app needs from a page. */
export function readPage(html: string): PageInfo {
  const titleTag = decodeEntities(
    (/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? '').trim(),
  );
  return {
    title: (meta(html, 'og:title') || titleTag).replace(/\s+/g, ' ').slice(0, 300),
    siteName: meta(html, 'og:site_name').slice(0, 160),
    text: htmlToText(html.replace(/^[\s\S]*?<body\b[^>]*>/i, '')),
    posting: findPosting(html),
  };
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

/** Is this value a line of its own on the page (a heading), not words inside a sentence? */
export function isOwnLine(value: string, text: string): boolean {
  const v = norm(value);
  if (!v) return false;
  return text.split('\n').some((l) => {
    const n = norm(l);
    return n === v || n.startsWith(`${v} `);
  });
}

/** Is this short value really on the page (so the AI didn't make it up)? */
export function onPage(value: string, text: string): boolean {
  const v = norm(value);
  return v.length > 0 && ` ${norm(text)} `.includes(` ${v} `);
}

/**
 * The advert copied from the page text between two anchors the AI quoted (its first and last
 * words). The advert is the page's own text by construction; null if the anchors aren't there.
 */
export function sliceBetween(text: string, start: string, end: string): string | null {
  const find = (needle: string, from = 0) => {
    const words = norm(needle).split(' ').filter(Boolean);
    if (words.length < 2) return null;
    const re = new RegExp(
      words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[^\\p{L}\\p{N}]+'),
      'iu',
    );
    const m = re.exec(text.slice(from));
    return m ? { at: from + m.index, end: from + m.index + m[0].length } : null;
  };
  const a = find(start);
  if (!a) return null;
  const b = find(end, a.at);
  const stop = b ? b.end : -1;
  if (stop <= a.at) return null;
  // Keep the end of the sentence the anchor stops in.
  const rest = text.slice(stop).match(/^[^\n.!?]*[.!?]?/)?.[0] ?? '';
  return text.slice(a.at, stop + rest.length).trim();
}
