/**
 * Letter library (complete-studio-spec §10, "Letter library"): every letter type is data — a
 * guided form of 3–5 questions plus notes for the AI — rendered by one editor and one task
 * (`letter.generic`). Adding a type needs no new code.
 */
export type LetterQuestion = {
  id: string;
  label: string;
  hint?: string;
  /** Long answer (text area) rather than one line. */
  long?: boolean;
  required?: boolean;
};

export type LetterType = {
  id: LetterTypeId;
  title: string;
  /** One line for the picker. */
  description: string;
  /** Subject line shown on the letter ("Re: …"); {answer ids} are filled in. */
  subject: string;
  /** Who it usually goes to, used as the recipient field's hint. */
  to: string;
  questions: LetterQuestion[];
  /** What the AI must do for this type (purpose, structure, length). */
  notes: string;
  /** Draft written without AI: paragraphs with {answer ids} filled in; empty answers drop out. */
  starter: string[];
};

export const LETTER_TYPE_IDS = [
  'cover',
  'resignation',
  'reference',
  'thank-you',
  'follow-up',
  'offer-accept',
  'salary',
  'networking',
] as const;
export type LetterTypeId = (typeof LETTER_TYPE_IDS)[number];

export const LETTER_TYPES: LetterType[] = [
  {
    id: 'cover',
    title: 'Cover letter',
    description: 'A general letter for a kind of role, without a specific advert.',
    subject: 'Application: {role}',
    to: 'Hiring manager, Company',
    questions: [
      { id: 'role', label: 'The role you’re applying for', required: true },
      { id: 'organisation', label: 'Organisation (if you know it)' },
      {
        id: 'why',
        label: 'Why this kind of work or this organisation?',
        long: true,
        hint: 'A sentence or two in your own words.',
      },
      {
        id: 'availability',
        label: 'When you could start',
        hint: 'For example: “after one month’s notice”.',
      },
    ],
    notes:
      'A general cover letter for the role named in the answers. 3 or 4 short paragraphs: the role and why (from the answers), two or three facts from the CV that fit that kind of role, availability and thanks. Under 250 words.',
    starter: [
      'I am writing to apply for the role of {role}{organisation: at }.',
      '{why}',
      'My CV is attached. It shows my experience and the skills I would bring to the role.',
      'I could start {availability}.',
      'Thank you for considering my application.',
    ],
  },
  {
    id: 'resignation',
    title: 'Resignation letter',
    description: 'Leave on good terms, with your notice and last day.',
    subject: 'Resignation',
    to: 'Your manager',
    questions: [
      { id: 'role', label: 'Your current role', required: true },
      { id: 'organisation', label: 'Organisation', required: true },
      {
        id: 'lastDay',
        label: 'Your last working day',
        required: true,
        hint: 'For example: 31 December 2026.',
      },
      { id: 'thanks', label: 'Anything you want to thank them for (optional)', long: true },
      { id: 'handover', label: 'Help you’ll offer with the handover (optional)', long: true },
    ],
    notes:
      'A short, polite resignation letter. State the resignation from the role and the last working day exactly as given, a brief thank-you (only what the answers say), an offer to help with the handover. No reasons unless given. Under 180 words.',
    starter: [
      'Please accept this letter as formal notice of my resignation from my role as {role} at {organisation}. My last working day will be {lastDay}.',
      '{thanks}',
      '{handover}',
      'Thank you for the opportunities I have had here. I wish you and the team every success.',
    ],
  },
  {
    id: 'reference',
    title: 'Reference request',
    description: 'Ask a former manager or teacher to be your referee.',
    subject: 'Reference request',
    to: 'Your former manager or teacher',
    questions: [
      {
        id: 'relationship',
        label: 'How you know them',
        required: true,
        hint: 'For example: “you managed me at Swift Logistics from 2021 to 2024”.',
      },
      { id: 'role', label: 'The role you’re applying for', required: true },
      { id: 'organisation', label: 'Where you’re applying (optional)' },
      { id: 'deadline', label: 'When the employer may contact them (optional)' },
    ],
    notes:
      'A polite request to act as a referee. Remind them how they know the person (from the answers), name the role applied for, offer to send the CV and job details, mention timing if given, thank them. Under 170 words.',
    starter: [
      'I hope you are well. I am applying for the role of {role}{organisation: at }, and I would be grateful if you would act as one of my referees.',
      'As a reminder, {relationship}.',
      'The employer may contact you {deadline}.',
      'I am happy to send you my CV and the job details.',
      'Thank you very much for considering this.',
    ],
  },
  {
    id: 'thank-you',
    title: 'Thank-you after an interview',
    description: 'Send within a day of the interview.',
    subject: 'Thank you — {role} interview',
    to: 'The person who interviewed you',
    questions: [
      { id: 'role', label: 'The role you interviewed for', required: true },
      { id: 'organisation', label: 'Organisation', required: true },
      {
        id: 'when',
        label: 'When the interview was',
        hint: 'For example: “yesterday”, “on Tuesday”.',
      },
      {
        id: 'highlight',
        label: 'Something from the conversation you enjoyed (optional)',
        long: true,
      },
    ],
    notes:
      'A brief thank-you after an interview: thanks for their time, one specific point from the conversation if given, renewed interest in the role, one line linking a CV strength to the role. Under 150 words.',
    starter: [
      'Thank you for taking the time to meet me{when:} to discuss the {role} role at {organisation}.',
      '{highlight}',
      'Our conversation confirmed my interest in the role, and I would welcome the chance to join the team.',
      'Please let me know if you need anything else from me.',
    ],
  },
  {
    id: 'follow-up',
    title: 'Application follow-up',
    description: 'A polite nudge when you haven’t heard back.',
    subject: 'Following up: {role} application',
    to: 'Hiring manager or recruiter',
    questions: [
      { id: 'role', label: 'The role you applied for', required: true },
      { id: 'organisation', label: 'Organisation', required: true },
      { id: 'appliedOn', label: 'When you applied', hint: 'For example: “on 3 November”.' },
    ],
    notes:
      'A short, friendly follow-up on an application: when they applied (if given), continued interest, one CV strength relevant to the role, a question about next steps. Under 120 words. Never pushy.',
    starter: [
      'I applied for the {role} role at {organisation}{appliedOn:} and wanted to follow up on my application.',
      'I remain very interested in the role and would be glad to provide any further information.',
      'Could you let me know about the next steps? Thank you for your time.',
    ],
  },
  {
    id: 'offer-accept',
    title: 'Accepting a job offer',
    description: 'Confirm the offer, the start date and what you agreed.',
    subject: 'Acceptance of offer: {role}',
    to: 'Hiring manager or HR',
    questions: [
      { id: 'role', label: 'The role', required: true },
      { id: 'organisation', label: 'Organisation', required: true },
      { id: 'startDate', label: 'Start date', required: true },
      {
        id: 'terms',
        label: 'Terms to confirm (optional)',
        long: true,
        hint: 'Salary, hours, location — exactly as agreed.',
      },
    ],
    notes:
      'A warm, clear acceptance: accept the role, confirm the start date and any terms exactly as given in the answers (never add terms), say they look forward to joining, ask about anything needed before day one. Under 160 words.',
    starter: [
      'I am delighted to accept your offer for the role of {role} at {organisation}.',
      'I confirm that I will start on {startDate}.',
      '{terms}',
      'Thank you for this opportunity. Please let me know if you need anything from me before my first day.',
    ],
  },
  {
    id: 'salary',
    title: 'Salary negotiation',
    description: 'Ask for a better offer, politely and with reasons.',
    subject: 'Offer for {role}',
    to: 'Hiring manager or HR',
    questions: [
      { id: 'role', label: 'The role', required: true },
      { id: 'organisation', label: 'Organisation', required: true },
      { id: 'offer', label: 'What they offered', required: true },
      { id: 'ask', label: 'What you’d like to ask for', required: true },
      {
        id: 'reasons',
        label: 'Your reasons',
        long: true,
        hint: 'Experience, skills, market rates — in your own words.',
      },
    ],
    notes:
      'A respectful negotiation: thanks for the offer, enthusiasm for the role, the ask exactly as given with the reasons from the answers and real CV facts, openness to discuss. Use only the figures in the answers. Under 200 words.',
    starter: [
      'Thank you for offering me the role of {role} at {organisation}. I am excited about joining the team.',
      'The offer is {offer}. Based on my experience, I would like to ask whether you could consider {ask}.',
      '{reasons}',
      'I am keen to find an arrangement that works for both of us and would be happy to discuss it.',
    ],
  },
  {
    id: 'networking',
    title: 'Networking introduction',
    description: 'Introduce yourself to someone in your field.',
    subject: 'Introduction',
    to: 'The person you’re contacting',
    questions: [
      { id: 'connection', label: 'How you found them or who introduced you', required: true },
      {
        id: 'goal',
        label: 'What you’d like from them',
        required: true,
        hint: 'For example: “a 15-minute call about working in logistics”.',
      },
      { id: 'about', label: 'One line about you (optional)', long: true },
    ],
    notes:
      'A short, respectful introduction: how they are connected (from the answers), who the person is (one or two CV facts), the specific ask from the answers, easy to say no to. Under 140 words.',
    starter: [
      'I am getting in touch because {connection}.',
      '{about}',
      'I would be very grateful for {goal}, at a time that suits you.',
      'Thank you for reading this, and no worries at all if now is not a good time.',
    ],
  },
];

export const LETTER_TYPE: Record<LetterTypeId, LetterType> = Object.fromEntries(
  LETTER_TYPES.map((t) => [t.id, t]),
) as Record<LetterTypeId, LetterType>;

export const isLetterType = (v: unknown): v is LetterTypeId =>
  typeof v === 'string' && (LETTER_TYPE_IDS as readonly string[]).includes(v);

/**
 * Fills `{id}` and `{id: prefix }` placeholders. `{organisation: at }` gives " at Acme" when the
 * answer is set and nothing otherwise. A line whose required placeholder is empty is dropped.
 */
export function fill(template: string, answers: Record<string, string>): string | null {
  let missing = false;
  const out = template.replace(/\{(\w+)(?::\s?([^}]*))?\}/g, (_, id: string, prefix?: string) => {
    const v = (answers[id] ?? '').trim();
    if (prefix !== undefined) return v ? ` ${prefix.trim()} ${v}`.replace(/\s+/g, ' ') : '';
    if (!v) missing = true;
    return v;
  });
  return missing ? null : out.replace(/\s+([.,])/g, '$1').trim();
}

/** The no-AI first draft for a type: paragraphs with answers filled in. */
export function starterLetter(type: LetterType, answers: Record<string, string>) {
  return {
    paragraphs: type.starter.map((t) => fill(t, answers)).filter((p): p is string => !!p),
    subject: fill(type.subject, answers) ?? type.title,
  };
}

/** Required questions without an answer. */
export const missingAnswers = (type: LetterType, answers: Record<string, string>) =>
  type.questions.filter((q) => q.required && !(answers[q.id] ?? '').trim());
