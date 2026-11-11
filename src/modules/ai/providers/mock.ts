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
