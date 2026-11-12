import { parseCv } from '@/modules/import/parse';
import { docToStructure } from '@/modules/import/structure';
import { PRESETS } from '@/modules/resume/presets';
import { TEMPLATE_CATALOG } from '../catalog';
import { guessDesign, guessPreset, guessTitle } from '../heuristics';
import type { AiProvider, GenerateRequest } from '../provider';
import type { DesignChoice, ParsedInput, TaskId } from '../schemas';

/**
 * Deterministic stand-in for a model: tests, e2e and development without a key.
 * Answers are simple rule-based rewrites built only from the input, labelled "Demo AI" in the UI.
 */

const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);
const FILLER: [RegExp, string][] = [
  [/^(i was |i am |i )?(responsible for|in charge of)\s+/i, ''],
  [/^(i )?(did|was doing|helped with|helped to)\s+/i, 'Helped with '],
  [/^i\s+/i, ''],
  [/\s+(and stuff|etc\.?|and so on)$/i, ''],
  [/\bvery\s+/gi, ''],
  [/\breally\s+/gi, ''],
  [/\s+/g, ' '],
];

function tidy(s: string, shorter = false): string {
  let out = s.trim().replace(/\.$/, '');
  for (const [re, rep] of FILLER) out = out.replace(re, rep);
  if (shorter) out = out.split(/,\s+|\s+which\s+|\s+so that\s+/)[0]!;
  return cap(out.trim());
}

function variant<T>(items: T[], attempt: number): T[] {
  if (items.length < 2 || attempt % 2 === 0) return items;
  return [...items.slice(1), items[0]!];
}

function answer(task: TaskId, input: unknown, attempt: number): unknown {
  switch (task) {
    case 'intake.interpret': {
      const i = input as ParsedInput<'intake.interpret'>;
      const presetId = guessPreset(i.description);
      const design = guessDesign(i.description, presetId);
      const t = TEMPLATE_CATALOG[design.templateId];
      return {
        presetId,
        targetTitle: guessTitle(i.description),
        design,
        reason: `${t.name}: ${t.style.toLowerCase()}, chosen to suit your description.`,
      };
    }
    case 'design.interpret': {
      const i = input as ParsedInput<'design.interpret'>;
      const best = guessDesign(i.description, i.presetId, i.current);
      const others = (Object.keys(TEMPLATE_CATALOG) as DesignChoice['templateId'][])
        .filter((id) => id !== best.templateId && TEMPLATE_CATALOG[id].photo)
        .slice(attempt % 3, (attempt % 3) + 2);
      return {
        choices: [
          best,
          ...others.map((templateId) => ({
            ...best,
            templateId,
            fontPair: TEMPLATE_CATALOG[templateId].font,
          })),
        ].map((d) => ({
          name: TEMPLATE_CATALOG[d.templateId].name,
          explanation: `${TEMPLATE_CATALOG[d.templateId].style} design with your chosen colour.`,
          design: d,
        })),
      };
    }
    case 'write.summary': {
      const i = input as ParsedInput<'write.summary'>;
      if (i.mode !== 'write' && i.currentSummary) {
        const sentences = i.currentSummary.split(/(?<=[.!?])\s+/).map((s) => tidy(s));
        const keep = i.mode === 'shorter' ? sentences.slice(0, 2) : sentences;
        return { text: keep.map((s) => (/[.!?]$/.test(s) ? s : `${s}.`)).join(' ') };
      }
      const title = i.headline || PRESETS[i.presetId].headlineExample;
      const job = i.experience.find((j) => j.organization);
      const skills = variant(i.skills, attempt).slice(0, 3);
      const parts = [
        `${title}${job ? ` with experience at ${job.organization}` : ''}.`,
        skills.length ? `Skilled in ${skills.join(', ').replace(/, ([^,]*)$/, ' and $1')}.` : '',
        'Known for {{?What do colleagues or customers praise you for?}}.',
      ];
      return { text: parts.filter(Boolean).join(' ') };
    }
    case 'write.improveBullets': {
      const i = input as ParsedInput<'write.improveBullets'>;
      return {
        bullets: i.bullets.filter((b) => b.trim()).map((b) => tidy(b, i.instruction === 'shorter')),
      };
    }
    case 'write.fromNotes': {
      const i = input as ParsedInput<'write.fromNotes'>;
      const bullets = i.notes
        .split(/\n|;|\.\s+/)
        .map((s) => tidy(s))
        .filter((s) => s.length > 2)
        .slice(0, 6);
      return { bullets: bullets.length ? bullets : [tidy(i.notes)] };
    }
    case 'suggest.skills': {
      const i = input as ParsedInput<'suggest.skills'>;
      const have = new Set(i.existing.map((s) => s.toLowerCase()));
      const pool = [
        ...PRESETS[i.presetId].suggestedSkills,
        'Communication',
        'Teamwork',
        'Problem solving',
        'Reliability',
        'Attention to detail',
      ].filter((s) => !have.has(s.toLowerCase()));
      return { skills: variant(pool, attempt).slice(0, 8) };
    }
    case 'job.match': {
      const i = input as ParsedInput<'job.match'>;
      const cv = digestLines(i.profile);
      const sentences = i.advert
        .split(/(?<=[.!?])\s+|\n+/)
        .map((x) => x.trim())
        .filter((x) => x.split(' ').length >= 4)
        .slice(0, 5);
      const requirements = sentences.map((text) => {
        const ws = sig(text);
        const ev = cv
          .filter((l) => sig(l.text).filter((w) => ws.includes(w)).length >= 2)
          .slice(0, 2);
        return {
          text: text.slice(0, 200),
          importance: /essential|must|required/i.test(text) ? ('must' as const) : ('nice' as const),
          status: ev.length ? ('met' as const) : ('missing' as const),
          evidence: ev.map((l) => l.id).concat(attempt > 0 ? ['Z9.B9'] : []),
          note: ev.length
            ? 'Your CV shows this.'
            : 'If this is true for you, add it to your profile.',
        };
      });
      const keywords = [...new Set(sig(i.advert))].slice(0, 8);
      return {
        requirements,
        keywords,
        summary: 'Demo AI: a quick comparison of your CV with this advert.',
      };
    }
    case 'job.tailor': {
      const i = input as ParsedInput<'job.tailor'>;
      const cv = digestLines(i.profile);
      const jobs = cv.filter((l) => /^[JV]\d+$/.test(l.id));
      const order = jobs.map((j) => ({
        job: j.id,
        bullets: cv
          .filter((l) => l.id.startsWith(`${j.id}.B`))
          .map((l) => l.id)
          .reverse(),
      }));
      const skills = (cv.find((l) => l.id === 'SKILLS')?.text ?? '')
        .split('; ')
        .filter(Boolean)
        .reverse();
      const summary = cv.find((l) => l.id === 'SUMMARY')?.text ?? 'Experienced and reliable.';
      return { headline: i.jobTitle, summary, order, skills };
    }
    case 'letter.write': {
      const i = input as ParsedInput<'letter.write'>;
      const cv = digestLines(i.profile);
      const best = cv
        .filter((l) => /\.B\d+$/.test(l.id))
        .slice(0, 2)
        .map((l) => l.text.replace(/\.$/, ''));
      return {
        greeting: 'Dear Hiring Manager,',
        paragraphs: [
          `I would like to apply for the ${i.jobTitle} role${i.company ? ` at ${i.company}` : ''}.`,
          best.length
            ? `In my work so far I have: ${best.join('; ')}.`
            : 'My CV sets out my experience.',
          'I would welcome the chance to talk about the role. Thank you for your time.',
        ],
        closing: i.tone === 'formal' ? 'Yours sincerely,' : 'Kind regards,',
      };
    }
    case 'import.structure': {
      // The demo "model" is the rules-based parser, returned in the AI's shape.
      const i = input as ParsedInput<'import.structure'>;
      return docToStructure(parseCv(i.lines).doc);
    }
  }
}

export function createMockProvider(): AiProvider {
  return {
    id: 'mock',
    async generate(req: GenerateRequest) {
      const attempt = Number(/Attempt (\d+)/.exec(req.user)?.[1] ?? 0);
      const text = JSON.stringify(answer(req.task.id, req.task.input, attempt));
      return { text, usage: { inputTokens: 0, outputTokens: 0 } };
    },
  };
}

/** Numbered CV lines ("J1.B2: text") back into objects. */
function digestLines(profile: string) {
  return profile
    .split('\n')
    .map((l) => l.match(/^([A-Z]+\d*(?:\.[A-Z]\d+)?): (.*)$/))
    .filter((m): m is RegExpMatchArray => !!m)
    .map((m) => ({ id: m[1]!, text: m[2]! }));
}
const STOP = new Set([
  'with',
  'that',
  'this',
  'will',
  'your',
  'have',
  'from',
  'they',
  'their',
  'about',
  'what',
  'work',
  'able',
  'must',
  'essential',
  'role',
  'team',
  'good',
  'great',
  'need',
  'looking',
  'join',
  'for',
  'and',
  'the',
  'you',
  'are',
  'our',
]);
const sig = (t: string) =>
  (t.toLowerCase().match(/[a-z][a-z-]{3,}/g) ?? []).filter((w) => !STOP.has(w));
