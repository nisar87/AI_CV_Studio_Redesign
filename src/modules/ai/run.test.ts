import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { profileDigest } from '@/modules/jobs/digest';
import * as F from '@/modules/resume/fixtures';
import { describe, expect, it, vi } from 'vitest';
import { aiMode, aiModels } from './config';
import { createAiLimiter } from './limits';
import { AiProviderError, type AiProvider, type GenerateRequest } from './provider';
import { createGeminiProvider } from './providers/gemini';
import { createMockProvider } from './providers/mock';
import { runTask } from './run';
import { TASK_IDS } from './schemas';

const models = { fast: 'fast-model', smart: 'smart-model' };
const noSleep = async () => {};

function scripted(replies: (string | Error)[]): AiProvider & { calls: GenerateRequest[] } {
  const calls: GenerateRequest[] = [];
  return {
    id: 'gemini',
    calls,
    async generate(req) {
      calls.push(req);
      const r = replies.shift();
      if (r instanceof Error) throw r;
      return { text: r ?? '', usage: { inputTokens: 10, outputTokens: 5 } };
    },
  };
}

const bulletsInput = {
  presetId: 'driver',
  role: 'Van Driver',
  organization: 'Swift Logistics',
  bullets: ['i was responsible for delivering parcels around town'],
  instruction: 'clearer',
};

describe('runTask', () => {
  it('rejects invalid input before calling the model', async () => {
    const p = scripted([]);
    const r = await runTask('write.improveBullets', { bullets: [] }, 0, { provider: p, models });
    expect(r).toMatchObject({ ok: false, code: 'INVALID_INPUT' });
    expect(p.calls).toHaveLength(0);
  });

  it('validates output, applies the truth guard and lists questions', async () => {
    const p = scripted([
      JSON.stringify({ bullets: ['Delivered 150 parcels a day around town for Royal Mail'] }),
    ]);
    const r = await runTask('write.improveBullets', bulletsInput, 0, {
      provider: p,
      models,
      sleep: noSleep,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.result.bullets[0]).toBe(
      'Delivered {{?add the real number}} parcels a day around town for {{?confirm: Royal Mail}}',
    );
    expect(r.needsInput).toEqual(['add the real number', 'confirm: Royal Mail']);
    expect(r.findings.map((f) => f.kind)).toEqual(['number', 'name']);
    expect(p.calls[0]!.model).toBe('fast-model');
    expect(p.calls[0]!.user).toContain('<person_text');
    expect(p.calls[0]!.schema).toMatchObject({ type: 'object' });
  });

  it('uses the smart model for the profile', async () => {
    const p = scripted([JSON.stringify({ text: 'Van driver.' })]);
    await runTask('write.summary', { presetId: 'driver', headline: 'Van driver' }, 0, {
      provider: p,
      models,
    });
    expect(p.calls[0]!.model).toBe('smart-model');
  });

  it('repairs invalid output once, then gives up with AI_INVALID_OUTPUT', async () => {
    const good = scripted([
      'not json',
      JSON.stringify({ bullets: ['Delivered parcels around town'] }),
    ]);
    const r1 = await runTask('write.improveBullets', bulletsInput, 0, { provider: good, models });
    expect(r1.ok).toBe(true);
    expect(good.calls[1]!.user).toContain('previous answer was not valid');

    const bad = scripted(['{"bullets": []}', '{"wrong": true}']);
    const r2 = await runTask('write.improveBullets', bulletsInput, 0, { provider: bad, models });
    expect(r2).toMatchObject({ ok: false, code: 'AI_INVALID_OUTPUT' });
    expect(bad.calls).toHaveLength(2);
  });

  it('retries once on rate limits and server errors, not on other failures', async () => {
    const p = scripted([
      new AiProviderError('rate_limited', '429'),
      JSON.stringify({ bullets: ['Delivered parcels around town'] }),
    ]);
    const sleep = vi.fn(noSleep);
    expect(
      (await runTask('write.improveBullets', bulletsInput, 0, { provider: p, models, sleep })).ok,
    ).toBe(true);
    expect(sleep).toHaveBeenCalledTimes(1);

    const down = scripted([
      new AiProviderError('unavailable', '503'),
      new AiProviderError('unavailable', '503'),
    ]);
    expect(
      await runTask('write.improveBullets', bulletsInput, 0, { provider: down, models, sleep }),
    ).toMatchObject({
      ok: false,
      code: 'AI_UNAVAILABLE',
      reason: 'unavailable',
    });

    const timeout = scripted([new AiProviderError('timeout', 'slow')]);
    expect(
      await runTask('write.improveBullets', bulletsInput, 0, { provider: timeout, models, sleep }),
    ).toMatchObject({
      ok: false,
      code: 'AI_UNAVAILABLE',
      reason: 'timeout',
    });
    expect(timeout.calls).toHaveLength(1);
  });

  it('asks for a different version on "Try again"', async () => {
    const p = scripted([JSON.stringify({ bullets: ['Delivered parcels around town'] })]);
    await runTask('write.improveBullets', bulletsInput, 2, { provider: p, models });
    expect(p.calls[0]!.user).toContain('Attempt 2');
    expect(p.calls[0]!.temperature).toBeGreaterThan(0.4);
  });

  it('makes design colours readable and drops duplicate choices', async () => {
    const d = { templateId: 'halo', accent: '#9ec5ff', fontPair: 'humanist', density: 'balanced' };
    const p = scripted([
      JSON.stringify({
        choices: [
          { name: 'Halo', explanation: 'Warm.', design: d },
          { name: 'Halo again', explanation: 'Same.', design: d },
        ],
      }),
    ]);
    const r = await runTask(
      'design.interpret',
      { description: 'light blue', presetId: 'teacher' },
      0,
      {
        provider: p,
        models,
      },
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.result.choices).toHaveLength(1);
    expect(r.result.choices[0]!.design.accent).not.toBe('#9ec5ff');
  });
});

const ADVERT =
  'We are looking for a reliable multi-drop van driver. A full UK driving licence is essential. You will deliver parcels to customers and keep accurate records.';

describe('mock provider', () => {
  const mock = createMockProvider();
  const samples: Record<string, unknown> = {
    'intake.interpret': {
      description: 'I am a school teacher, I want a blue, modern, clean and elegant CV',
    },
    'design.interpret': { description: 'modern, blue, clean and elegant', presetId: 'teacher' },
    'design.compose': {
      description: 'three columns, navy, square bullets',
      presetId: 'tech',
      stats: {
        pages: 2,
        sections: [{ kind: 'experience', items: 3, chars: 1800 }],
        hasPhoto: false,
      },
    },
    'design.refine': { instruction: 'make the sidebar narrower', current: { sideWidth: 32 } },
    'write.summary': {
      presetId: 'driver',
      headline: 'Delivery Driver',
      experience: [
        {
          role: 'Van Driver',
          organization: 'Swift Logistics',
          start: '2016',
          current: true,
          bullets: [],
        },
      ],
      skills: ['Safe driving', 'Route planning'],
    },
    'write.improveBullets': bulletsInput,
    'write.fromNotes': {
      presetId: 'driver',
      notes: 'drove the van. loaded parcels; checked tyres',
    },
    'suggest.skills': { presetId: 'driver', existing: ['Safe driving'] },
    'job.match': { advert: ADVERT, profile: profileDigest(F.driver).text },
    'job.tailor': {
      advert: ADVERT,
      jobTitle: 'Delivery Driver',
      company: 'Swift',
      profile: profileDigest(F.driver).text,
    },
    'letter.write': {
      advert: ADVERT,
      jobTitle: 'Delivery Driver',
      company: 'Swift',
      name: 'Imran Qureshi',
      profile: profileDigest(F.driver).text,
      tone: 'warm',
    },
    'letter.generic': {
      typeTitle: 'Resignation letter',
      notes: 'A short resignation letter.',
      answers: [
        { question: 'Your current role', answer: 'Van Driver' },
        { question: 'Your last working day', answer: '31 December 2026' },
      ],
      to: 'Sara Khan, Swift Logistics',
      name: 'Imran Qureshi',
      profile: profileDigest(F.driver).text,
      tone: 'formal',
    },
    'quality.atsKeywords': { advert: ADVERT, profile: profileDigest(F.driver).text },
    'linkedin.write': { profile: profileDigest(F.driver).text, target: 'transport planning' },
    'interview.prep': {
      advert: ADVERT,
      jobTitle: 'Delivery Driver',
      company: 'Swift',
      profile: profileDigest(F.driver).text,
    },
    'import.transcribe': { kind: 'image' },
    'makeover.diagnose': {
      chip: 'wording',
      presetId: 'driver',
      items: [
        { id: 'experience.0.bullets.0', text: 'i delivered parcels to costumers' },
        { id: 'experience.0.bullets.1', text: 'Planned routes ZZ-INVENT' },
      ],
    },
    'import.structure': {
      lines: [
        'Imran Qureshi',
        'imran@example.com',
        'Experience',
        'Van Driver Jan 2016 – Present',
        'Swift Logistics',
      ],
    },
  };

  it.each(TASK_IDS)('%s returns valid, guarded output', async (id) => {
    const r = await runTask(id, samples[id], 0, { provider: mock, models });
    expect(r.ok ? 'ok' : JSON.stringify(r)).toBe('ok');
    if (r.ok) expect(r.findings).toEqual([]);
  });

  it('transcribes attached files and drops polish suggestions with invented facts', async () => {
    const data = Buffer.from('xx\nCVTEXT-BEGIN\nAli Khan\nWelder\nCVTEXT-END\nCVPHOTO').toString(
      'base64',
    );
    const t = await runTask('import.transcribe', { kind: 'image' }, 0, {
      provider: mock,
      models,
      files: [{ mimeType: 'image/png', data }],
    });
    expect(t).toMatchObject({ ok: true, result: { lines: ['Ali Khan', 'Welder'], photo: true } });
    // The scanned-PDF fixture carries its text as PDF comment lines.
    const pdf = readFileSync(join(__dirname, '../import/__fixtures__/scanned.pdf')).toString(
      'base64',
    );
    const s = await runTask('import.transcribe', { kind: 'pdf' }, 0, {
      provider: mock,
      models,
      files: [{ mimeType: 'application/pdf', data: pdf }],
    });
    expect(s.ok && s.result.lines.slice(0, 2)).toEqual([
      'Ahmed Raza Khan',
      'Lahore, Pakistan | +92 300 1234567 | ahmed.raza@example.com | linkedin.com/in/ahmedraza',
    ]);
    const d = await runTask('makeover.diagnose', samples['makeover.diagnose'], 0, {
      provider: mock,
      models,
    });
    expect(d.ok && d.result.items).toEqual([
      { id: 'experience.0.bullets.0', after: 'Delivered parcels to customers', reason: 'Wording' },
    ]);
  });

  it('interprets the two example requests from the brief', async () => {
    const teacher = await runTask('intake.interpret', samples['intake.interpret'], 0, {
      provider: mock,
      models,
    });
    expect(teacher).toMatchObject({
      ok: true,
      result: { presetId: 'teacher', design: { accent: '#1f4e8c', fontPair: 'executive' } },
    });
    const driver = await runTask(
      'intake.interpret',
      { description: 'A simple CV for a delivery driver' },
      0,
      {
        provider: mock,
        models,
      },
    );
    expect(driver).toMatchObject({
      ok: true,
      result: {
        presetId: 'driver',
        targetTitle: 'Delivery Driver',
        design: { templateId: 'clarity' },
      },
    });
  });
});

describe('gemini adapter', () => {
  const req = {
    model: 'gemini-flash-latest',
    system: 'sys',
    user: 'usr',
    schema: { type: 'object' },
    maxTokens: 100,
    temperature: 0.2,
    task: { id: 'suggest.skills' as const, input: {} },
  };
  const reply = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

  it('sends the key as a header and JSON-schema output config', async () => {
    const fetchImpl = vi.fn(async () =>
      reply(200, {
        candidates: [
          {
            content: { parts: [{ text: 'thinking', thought: true }, { text: '{"skills":["A"]}' }] },
          },
        ],
        usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 3 },
      }),
    );
    const g = createGeminiProvider({
      apiKey: 'secret-key',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const out = await g.generate(req);
    expect(out).toEqual({ text: '{"skills":["A"]}', usage: { inputTokens: 12, outputTokens: 3 } });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent',
    );
    expect(url).not.toContain('secret-key');
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('secret-key');
    const body = JSON.parse(String(init.body));
    expect(body.generationConfig).toMatchObject({
      responseMimeType: 'application/json',
      responseJsonSchema: { type: 'object' },
      maxOutputTokens: 100,
    });
    expect(body.systemInstruction.parts[0].text).toBe('sys');
  });

  it('sends a lean schema (structure only, no length limits)', async () => {
    const { leanSchema } = await import('./providers/gemini');
    expect(
      leanSchema({
        type: 'object',
        additionalProperties: false,
        properties: { a: { type: 'array', maxItems: 3, items: { type: 'string', maxLength: 9 } } },
      }),
    ).toEqual({ type: 'object', properties: { a: { type: 'array', items: { type: 'string' } } } });
  });

  it('falls back to plain JSON mode (shape in the prompt) when the schema is rejected', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        reply(400, {
          error: { message: 'The specified schema produces a constraint that has too many states' },
        }),
      )
      .mockResolvedValueOnce(
        reply(200, { candidates: [{ content: { parts: [{ text: '{}' }] } }] }),
      );
    const g = createGeminiProvider({
      apiKey: 'k',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await g.generate(req);
    const second = JSON.parse(String((fetchImpl.mock.calls[1] as [string, RequestInit])[1].body));
    expect(second.generationConfig.responseJsonSchema).toBeUndefined();
    expect(second.contents[0].parts[0].text).toContain('JSON Schema');
  });

  it.each([
    [429, 'rate_limited'],
    [503, 'unavailable'],
    [403, 'auth'],
    [404, 'bad_request'],
  ])('maps HTTP %i to %s', async (status, kind) => {
    const g = createGeminiProvider({
      apiKey: 'k',
      fetchImpl: (async () => reply(status, { error: { message: 'x' } })) as typeof fetch,
    });
    await expect(g.generate(req)).rejects.toMatchObject({ kind });
  });

  it('reports blocked prompts and timeouts', async () => {
    const blocked = createGeminiProvider({
      apiKey: 'k',
      fetchImpl: (async () =>
        reply(200, { promptFeedback: { blockReason: 'SAFETY' } })) as typeof fetch,
    });
    await expect(blocked.generate(req)).rejects.toMatchObject({ kind: 'blocked' });
    const slow = createGeminiProvider({
      apiKey: 'k',
      fetchImpl: (async () => {
        throw new DOMException('timed out', 'TimeoutError');
      }) as typeof fetch,
    });
    await expect(slow.generate(req)).rejects.toMatchObject({ kind: 'timeout' });
  });
});

describe('config', () => {
  it('chooses the provider safely', () => {
    expect(aiMode({ NODE_ENV: 'production' } as NodeJS.ProcessEnv)).toBe('off');
    expect(aiMode({ NODE_ENV: 'development' } as NodeJS.ProcessEnv)).toBe('mock');
    expect(aiMode({ NODE_ENV: 'production', GEMINI_API_KEY: 'k' } as NodeJS.ProcessEnv)).toBe(
      'gemini',
    );
    expect(aiMode({ NODE_ENV: 'production', AI_PROVIDER: 'gemini' } as NodeJS.ProcessEnv)).toBe(
      'off',
    );
    expect(
      aiMode({
        NODE_ENV: 'production',
        GEMINI_API_KEY: 'k',
        AI_DAILY_BUDGET: '0',
      } as NodeJS.ProcessEnv),
    ).toBe('off');
    expect(aiModels({} as NodeJS.ProcessEnv)).toEqual({
      fast: 'gemini-flash-latest',
      smart: 'gemini-flash-latest',
    });
  });
});

describe('limits', () => {
  it('enforces burst, daily and global budget limits', () => {
    let t = Date.parse('2026-11-11T10:00:00Z');
    const take = createAiLimiter({ per10Min: 2, perDay: 3, dailyBudget: 4 }, () => t);
    expect(take('a')).toMatchObject({ ok: true, remainingToday: 2 });
    expect(take('a')).toMatchObject({ ok: true });
    expect(take('a')).toMatchObject({ ok: false, reason: 'burst' });
    t += 11 * 60_000;
    expect(take('a')).toMatchObject({ ok: true, remainingToday: 0 });
    t += 11 * 60_000;
    expect(take('a')).toMatchObject({ ok: false, reason: 'daily' });
    expect(take('b')).toMatchObject({ ok: true });
    expect(take('c')).toMatchObject({ ok: false, reason: 'budget' });
    t = Date.parse('2026-11-12T00:00:01Z');
    expect(take('c')).toMatchObject({ ok: true });
  });
});

describe('job tasks: section kinds', () => {
  it('a CV certificate may be called a certification in a letter', async () => {
    const { digestKinds } = await import('./tasks');
    const { buildSource, guardText } = await import('./guard');
    const profile = 'CERT2: Immediate Life Support (ILS) — Resuscitation Council UK (2025)';
    const src = buildSource([profile, digestKinds(profile)]);
    expect(guardText('I hold Immediate Life Support certification.', src).findings).toEqual([]);
    expect(
      guardText('I hold a PhD.', buildSource([profile, digestKinds(profile)])).findings,
    ).toHaveLength(1);
  });
});

describe('linkedin.write', () => {
  it('keeps only real job IDs and skills copied from the CV; guards invented facts', async () => {
    const { runTask } = await import('./run');
    const profile = profileDigest(F.driver).text;
    const provider = {
      name: 'fake',
      generate: async () => ({
        text: JSON.stringify({
          headline: 'Multi-drop Delivery Driver | Route planning | HGV Class 1',
          about: 'I have nine years of multi-drop work.\n\nI won Driver of the Year 2021.',
          experience: [
            { job: 'J1', text: 'I deliver around 120 parcels a day.' },
            { job: 'J9', text: 'Invented job.' },
          ],
          skills: ['Route planning', 'Forklift', 'Vehicle checks'],
        }),
        usage: { inputTokens: 1, outputTokens: 1 },
      }),
    };
    const r = await runTask('linkedin.write', { profile }, 0, {
      provider: provider as never,
      models: { fast: 'f', smart: 's' },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.result.experience.map((e) => e.job)).toEqual(['J1']);
    expect(r.result.skills).toEqual(['Route planning', 'Vehicle checks']);
    expect(r.result.headline).toContain('{{?');
    expect(r.result.about).toContain('{{?');
    expect(r.result.experience[0]!.text).toBe('I deliver around 120 parcels a day.');
  });
});

describe('Gemini thinking setting (design tasks)', () => {
  const ok = { candidates: [{ content: { parts: [{ text: '{"changes":[],"note":"x"}' }] } }] };
  it('asks for minimal thinking, and asks again without it if the model refuses', async () => {
    const bodies: Record<string, unknown>[] = [];
    let n = 0;
    const fetchImpl = (async (_u: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)));
      n++;
      if (n === 1)
        return new Response(
          JSON.stringify({ error: { message: 'thinking budget is not supported' } }),
          { status: 400 },
        );
      return new Response(JSON.stringify(ok), { status: 200 });
    }) as typeof fetch;
    const p = createGeminiProvider({ apiKey: 'k', fetchImpl });
    const r = await runTask('design.refine', { instruction: 'square bullets', current: {} }, 0, {
      provider: p,
      models,
    });
    expect(r.ok).toBe(true);
    const cfg = (b: Record<string, unknown>) =>
      (b.generationConfig as Record<string, unknown>).thinkingConfig;
    expect(cfg(bodies[0]!)).toEqual({ thinkingBudget: 0 });
    expect(cfg(bodies[1]!)).toBeUndefined();
    expect(
      (bodies[1]!.generationConfig as Record<string, unknown>).responseJsonSchema,
    ).toBeDefined();
  });
});

describe('letter.generic guard', () => {
  it('keeps facts from the answers and marks invented ones', async () => {
    const provider = scripted([
      JSON.stringify({
        greeting: 'Dear Sara,',
        paragraphs: [
          'Please accept my resignation as Van Driver. My last day will be 31 December 2026.',
          'I increased deliveries by 45% last year.',
        ],
        closing: 'Yours sincerely,',
      }),
    ]);
    const r = await runTask(
      'letter.generic',
      {
        typeTitle: 'Resignation letter',
        notes: 'Short.',
        answers: [
          { question: 'Role', answer: 'Van Driver' },
          { question: 'Last day', answer: '31 December 2026' },
        ],
        to: 'Sara Khan',
        name: 'Imran Qureshi',
        profile: profileDigest(F.driver).text,
        tone: 'formal',
      },
      0,
      { provider, models },
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.result.paragraphs[0]).toContain('31 December 2026');
    expect(r.result.paragraphs[0]).not.toContain('{{?');
    expect(r.result.paragraphs[1]).toContain('{{?');
    expect(r.result.paragraphs[1]).not.toContain('45%');
  });
});
