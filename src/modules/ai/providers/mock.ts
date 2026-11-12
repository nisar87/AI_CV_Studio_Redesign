import { parseCv } from '@/modules/import/parse';
import { docToStructure } from '@/modules/import/structure';
import { PRESETS } from '@/modules/resume/presets';
import { TEMPLATE_CATALOG } from '../catalog';
import { guessDesign, guessPreset, guessTitle } from '../heuristics';
import type { AiFile, AiProvider, GenerateRequest } from '../provider';
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

function answer(task: TaskId, input: unknown, attempt: number, files: AiFile[] = []): unknown {
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
        email: {
          subject: `Application: ${i.jobTitle} — ${i.name}`,
          body: `Dear Hiring Manager,\n\nPlease find attached my CV and cover letter for the ${i.jobTitle} role${i.company ? ` at ${i.company}` : ''}.${best[0] ? ` In my current work I ${best[0].charAt(0).toLowerCase()}${best[0].slice(1)}.` : ''}\n\nThank you for your time.\n\n${i.name}`,
        },
      };
    }
    case 'interview.prep': {
      const i = input as ParsedInput<'interview.prep'>;
      const cv = digestLines(i.profile);
      const bullets = cv.filter((l) => /\.B\d+$/.test(l.id));
      const b = (n: number) => bullets[n % Math.max(1, bullets.length)];
      return {
        questions: [
          {
            question: `Tell me about your experience that fits this ${i.jobTitle} role.`,
            kind: 'experience' as const,
            why: 'They want to know you have done similar work.',
            points: b(0)
              ? [`In my current job I ${b(0)!.text.charAt(0).toLowerCase()}${b(0)!.text.slice(1)}.`]
              : [],
            evidence: b(0) ? [b(0)!.id] : [],
          },
          {
            question: 'Tell me about a time you had to plan your work carefully.',
            kind: 'situation' as const,
            why: 'They are checking how you organise your day.',
            points: b(1)
              ? [`Situation: busy days. What I did: ${b(1)!.text}. Result: work done on time.`]
              : [],
            evidence: b(1) ? [b(1)!.id] : [],
          },
          {
            question: `Why do you want to work${i.company ? ` at ${i.company}` : ' here'}?`,
            kind: 'motivation' as const,
            why: 'They want people who chose this job on purpose.',
            points: ['Say what attracted you to the advert, in your own words.'],
            evidence: [],
          },
        ],
        tips: ['Read the advert again the night before.', 'Prepare one question to ask them.'],
      };
    }
    case 'linkedin.write': {
      const i = input as ParsedInput<'linkedin.write'>;
      const cv = digestLines(i.profile);
      const headline = cv.find((l) => l.id === 'HEADLINE')?.text ?? 'Professional';
      const skills = (cv.find((l) => l.id === 'SKILLS')?.text ?? '').split('; ').filter(Boolean);
      const jobs = cv.filter((l) => /^[JV]\d+$/.test(l.id));
      return {
        headline: [headline, ...skills.slice(0, 2)].join(' | '),
        about: [
          cv.find((l) => l.id === 'SUMMARY')?.text ?? `I work as a ${headline}.`,
          i.target ? `I am open to ${i.target} roles.` : 'I enjoy doing careful, reliable work.',
        ].join('\n\n'),
        experience: jobs.map((j) => ({
          job: j.id,
          text: cv
            .filter((l) => l.id.startsWith(`${j.id}.B`))
            .map((l) => `I ${l.text.charAt(0).toLowerCase()}${l.text.slice(1).replace(/\.$/, '')}.`)
            .join(' '),
        })),
        skills: skills.slice(0, 10),
      };
    }
    case 'import.structure': {
      // The demo "model" is the rules-based parser, returned in the AI's shape.
      const i = input as ParsedInput<'import.structure'>;
      return docToStructure(parseCv(i.lines).doc);
    }
    case 'import.transcribe':
      return transcribe(files);
    case 'makeover.diagnose': {
      const i = input as ParsedInput<'makeover.diagnose'>;
      return {
        items: i.items.flatMap((it) => {
          // Test hook: lets e2e prove an invented number never reaches the screen.
          if (/ZZ-INVENT/.test(it.text))
            return [
              { id: it.id, after: `${tidy(it.text)} and raised sales by 45%`, reason: 'Test' },
            ];
          const after = i.chip === 'wording' ? fixWording(it.text) : tidy(it.text);
          return after && after !== it.text
            ? [
                {
                  id: it.id,
                  after,
                  reason: i.chip === 'wording' ? 'Wording' : 'Starts with the action',
                },
              ]
            : [];
        }),
      };
    }
  }
}

const MISSPELT: [RegExp, string][] = [
  [/\bresponsable\b/gi, 'responsible'],
  [/\bmanagment\b/gi, 'management'],
  [/\brecieved\b/gi, 'received'],
  [/\bcostumers\b/gi, 'customers'],
  [/\bteh\b/gi, 'the'],
];
function fixWording(t: string): string {
  let out = t
    .trim()
    .replace(/^i\s+/i, '')
    .replace(/\s{2,}/g, ' ');
  for (const [re, rep] of MISSPELT) out = out.replace(re, rep);
  return cap(out);
}

/**
 * Demo "vision": test files carry their text between CVTEXT-BEGIN / CVTEXT-END markers (e2e
 * fixtures); anything else gets a fixed sample CV.
 */
function transcribe(files: AiFile[]) {
  const raw = files[0] ? Buffer.from(files[0].data, 'base64').toString('utf8') : '';
  const m = /CVTEXT-BEGIN\r?\n([\s\S]*?)\r?\n(?:%\s?)?CVTEXT-END/.exec(raw);
  const lines = m
    ? m[1]!.split(/\r?\n/)
    : [
        'Sara Malik',
        'Staff Nurse',
        'sara.malik@example.com · 0300 1234567 · Lahore',
        'Experience',
        'Staff Nurse, Services Hospital, Lahore',
        'Jan 2019 – Present',
        'Cared for patients on a busy surgical ward',
        'Education',
        'BSc Nursing, University of Health Sciences, 2018',
      ];
  return {
    // PDF fixtures carry the text as "% " comment lines.
    lines: lines.map((l) => l.replace(/^%\s?/, '').trim()).filter(Boolean),
    photo: /CVPHOTO/.test(raw),
  };
}

export function createMockProvider(): AiProvider {
  return {
    id: 'mock',
    async generate(req: GenerateRequest) {
      const attempt = Number(/Attempt (\d+)/.exec(req.user)?.[1] ?? 0);
      const text = JSON.stringify(answer(req.task.id, req.task.input, attempt, req.files));
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
