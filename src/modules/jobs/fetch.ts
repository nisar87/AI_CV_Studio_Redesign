import 'server-only';
import { lookup as dnsLookup, type LookupAddress } from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import type { LookupFunction } from 'node:net';
import zlib from 'node:zlib';
import { checkUrl, isPublicAddress, PageError } from './page';

/**
 * Server-side fetch of a job page (complete-studio-spec §12.6): http(s) only; every DNS answer
 * must be a public address and the connection goes to the address that was checked (no DNS
 * rebinding); redirects are re-checked (at most 3); 5 seconds and 2 MB in total; HTML or text only.
 */
export const MAX_BYTES = 2 * 1024 * 1024;
export const TIMEOUT_MS = 5000;
const MAX_REDIRECTS = 3;
const UA = 'Mozilla/5.0 (compatible; AICVStudioBot/1.0; +https://aicvstudio.app/help)';

/** Loopback is allowed only for the e2e suite's own test pages (never with the real store). */
export const allowLoopback = () =>
  process.env.E2E_TEST_HOOKS === '1' && process.env.DATA_STORE === 'memory';

const safeLookup =
  (loopbackOk: boolean): LookupFunction =>
  (hostname, options, callback) => {
    dnsLookup(hostname, { all: true, family: options.family ?? 0 }, (err, addresses) => {
      if (err) return callback(err, '', 0);
      const list = addresses as LookupAddress[];
      const ok = (a: LookupAddress) =>
        isPublicAddress(a.address) || (loopbackOk && /^(127\.0\.0\.1|::1)$/.test(a.address));
      // Refuse the host if ANY answer is private: a mixed answer is a rebinding trick.
      if (!list.length || !list.every(ok))
        return callback(new PageError('BLOCKED', 'That link can’t be read.'), '', 0);
      const first = list[0]!;
      if (options.all) return callback(null, list);
      callback(null, first.address, first.family);
    });
  };

export type FetchedPage = { url: string; html: string; contentType: string };

function once(
  u: URL,
  deadline: number,
  loopbackOk: boolean,
): Promise<{
  status: number;
  location?: string;
  body?: string;
  contentType: string;
}> {
  return new Promise((resolve, reject) => {
    const lib = u.protocol === 'https:' ? https : http;
    const left = deadline - Date.now();
    if (left <= 0) return reject(new PageError('TIMEOUT', 'The page took too long to answer.'));
    const req = lib.request(
      u,
      {
        method: 'GET',
        lookup: safeLookup(loopbackOk),
        headers: {
          'user-agent': UA,
          accept: 'text/html,application/xhtml+xml,text/plain;q=0.8',
          'accept-encoding': 'gzip, deflate, br',
          'accept-language': 'en-GB,en;q=0.8',
        },
        timeout: left,
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const contentType = String(res.headers['content-type'] ?? '').toLowerCase();
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          return resolve({ status, location: res.headers.location, contentType });
        }
        if (status >= 400) {
          res.resume();
          return resolve({ status, contentType });
        }
        if (contentType && !/text\/html|application\/xhtml|text\/plain/.test(contentType)) {
          res.destroy();
          return reject(new PageError('NOT_HTML', 'That link isn’t a web page with a job advert.'));
        }
        const declared = Number(res.headers['content-length'] ?? 0);
        if (declared > MAX_BYTES) {
          res.destroy();
          return reject(new PageError('TOO_LARGE', 'That page is too large to read.'));
        }
        const enc = String(res.headers['content-encoding'] ?? '').toLowerCase();
        const stream =
          enc === 'gzip' || enc === 'x-gzip'
            ? res.pipe(zlib.createGunzip())
            : enc === 'deflate'
              ? res.pipe(zlib.createInflate())
              : enc === 'br'
                ? res.pipe(zlib.createBrotliDecompress())
                : res;
        const chunks: Buffer[] = [];
        let size = 0;
        stream.on('data', (c: Buffer) => {
          size += c.length;
          if (size > MAX_BYTES) {
            req.destroy();
            stream.destroy();
            reject(new PageError('TOO_LARGE', 'That page is too large to read.'));
            return;
          }
          chunks.push(c);
        });
        stream.on('error', () => reject(new PageError('NETWORK', 'The page couldn’t be read.')));
        stream.on('end', () => {
          const charset = /charset=([\w-]+)/.exec(contentType)?.[1] ?? 'utf-8';
          let body: string;
          try {
            body = new TextDecoder(charset).decode(Buffer.concat(chunks));
          } catch {
            body = new TextDecoder('utf-8').decode(Buffer.concat(chunks));
          }
          resolve({ status, body, contentType });
        });
      },
    );
    req.on('timeout', () => {
      req.destroy();
      reject(new PageError('TIMEOUT', 'The page took too long to answer.'));
    });
    req.on('error', (e) =>
      reject(
        e instanceof PageError ? e : new PageError('NETWORK', 'The page couldn’t be reached.'),
      ),
    );
    req.end();
  });
}

/** Fetches a job page safely, following up to 3 redirects (each one checked again). */
export async function fetchJobPage(raw: string): Promise<FetchedPage> {
  const loopbackOk = allowLoopback();
  let u = checkUrl(raw, { allowLoopback: loopbackOk });
  const deadline = Date.now() + TIMEOUT_MS;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const r = await once(u, deadline, loopbackOk);
    if (r.location) {
      if (hop === MAX_REDIRECTS) throw new PageError('HTTP', 'That link redirects too many times.');
      u = checkUrl(new URL(r.location, u).toString(), { allowLoopback: loopbackOk });
      continue;
    }
    if (r.status >= 400 || r.body === undefined)
      throw new PageError(
        'HTTP',
        r.status === 401 || r.status === 403 || r.status === 429
          ? 'That site doesn’t let us read the job. Copy the advert text and paste it instead.'
          : 'That page couldn’t be found. Check the link, or paste the advert text instead.',
      );
    return { url: u.toString(), html: r.body, contentType: r.contentType };
  }
  throw new PageError('HTTP', 'That link redirects too many times.');
}
