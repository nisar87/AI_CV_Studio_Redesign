import { z } from 'zod';
import { DESIGN_IDS } from '@/modules/resume/schema';

/**
 * Business configuration (docs/product/studio-master-plan.md §3, §4.4). One typed schema shared by
 * the server gate, the Admin Console and tests. Stored in `config/business` with versions; code
 * defaults apply only when nothing has been saved yet.
 */

export const PLAN_IDS = ['visitor', 'free', 'premium'] as const;
export type PlanId = (typeof PLAN_IDS)[number];

/** Metered capabilities: each plan has a monthly limit (-1 = unlimited, 0 = not included). */
export const METERED = ['pdf.download', 'import.cv', 'ai.action', 'design.ai'] as const;
export type Metered = (typeof METERED)[number];

const limit = z.number().int().min(-1).max(100_000);
/**
 * `design.ai` (R7 AI Designer: composes per month) is newer than saved configs, so each plan has
 * its own default: one free compose to try, 40 a month with Premium (complete-studio-spec §14).
 */
const limitsWith = (designAi: number) =>
  z.object({
    'pdf.download': limit,
    'import.cv': limit,
    'ai.action': limit,
    'design.ai': limit.default(designAi),
  });

export const businessConfig = z.object({
  plans: z.object({
    // maxJobs: how many jobs the tracker keeps at once (-1 = no limit). Optional for older saves.
    visitor: z.object({
      label: z.string().max(40),
      limits: limitsWith(0),
      maxJobs: z.number().int().min(-1).max(10_000).default(0),
    }),
    free: z.object({
      label: z.string().max(40),
      limits: limitsWith(1),
      maxJobs: z.number().int().min(-1).max(10_000).default(3),
    }),
    premium: z.object({
      label: z.string().max(40),
      limits: limitsWith(40),
      maxJobs: z.number().int().min(-1).max(10_000).default(-1),
    }),
  }),
  /** Design catalogue: availability and tier per design. */
  designs: z
    .array(
      z.object({
        id: z.enum(DESIGN_IDS),
        enabled: z.boolean(),
        tier: z.enum(['free', 'premium']),
        isNew: z.boolean().default(false),
      }),
    )
    .min(1),
  /** Premium passes (manual payment, R1.4). */
  passes: z
    .array(
      z.object({
        id: z.string().regex(/^[a-z0-9-]{2,30}$/),
        label: z.string().min(1).max(60),
        days: z.number().int().min(1).max(3660),
        pricePkr: z.number().int().min(0).max(10_000_000),
        active: z.boolean(),
      }),
    )
    .max(6),
  features: z.object({
    /** Master switch for AI help (in addition to server AI configuration). */
    ai: z.boolean(),
    import: z.boolean(),
    /** Premium can be bought (payment page live). Hides all Premium offers when off. */
    sales: z.boolean().default(false),
    signups: z.boolean(),
    maintenance: z.boolean(),
    /** R6 Design Studio (adjust and fine-tune every design detail). Off until switched on. */
    designStudio: z.boolean().default(false),
    /** R7 AI Designer ("Describe your design"). Off until switched on. */
    designer: z.boolean().default(false),
  }),
  announcement: z.object({ enabled: z.boolean(), text: z.string().max(240) }),
  /** How to pay for a pass (manual payments, R1.4). Shown on /premium when sales are on. */
  payments: z
    .object({
      methods: z
        .array(
          z.object({
            id: z.string().regex(/^[a-z0-9-]{2,30}$/),
            label: z.string().min(1).max(40),
            /** Account title / number / IBAN etc., shown with copy buttons line by line. */
            details: z.string().max(400),
            active: z.boolean(),
          }),
        )
        .max(6),
      instructions: z.string().max(600),
      /**
       * WhatsApp number buyers send their payment screenshot to, with their order number.
       * Shown on the Premium page as a ready-made message link.
       */
      whatsapp: z
        .union([
          z.literal(''),
          z.string().regex(/^\+?[\d\s-]{10,20}$/, 'Use a phone number, e.g. +92 300 1234567'),
        ])
        .default(''),
    })
    .default({ methods: [], instructions: '', whatsapp: '' }),
  /**
   * Discount codes (R4). A code gives a percentage off and/or extra days on a pass. Codes are
   * matched case-insensitively. Empty `passIds` means every pass.
   */
  coupons: z
    .array(
      z.object({
        code: z.string().regex(/^[A-Z0-9-]{3,20}$/, 'Use 3–20 capital letters, numbers or -'),
        percentOff: z.number().int().min(0).max(90),
        extraDays: z.number().int().min(0).max(365),
        passIds: z.array(z.string().max(30)).max(6).default([]),
        /** 0 = no limit. Counts pending and approved purchases. */
        maxUses: z.number().int().min(0).max(100_000),
        /** Last day it can be used (yyyy-mm-dd), or '' for no end. */
        expiresOn: z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).default(''),
        active: z.boolean(),
      }),
    )
    .max(30)
    .refine(
      (cs) => new Set(cs.map((c) => c.code)).size === cs.length,
      'Each code must be different.',
    )
    .default([]),
  /**
   * Invite friends (R4): when someone who joined through a person's link buys their first pass,
   * the inviter gets `rewardDays` of Premium and the new buyer gets `welcomeDays` extra.
   */
  referrals: z
    .object({
      enabled: z.boolean(),
      rewardDays: z.number().int().min(0).max(365),
      welcomeDays: z.number().int().min(0).max(365),
    })
    .default({ enabled: false, rewardDays: 14, welcomeDays: 7 }),
  /** Public contact for help, payments and privacy requests; shown on Help, Terms and Premium. */
  support: z.object({ email: z.union([z.literal(''), z.email().max(120)]) }).default({ email: '' }),
});
export type BusinessConfig = z.infer<typeof businessConfig>;

/**
 * Starting values. Until Premium can be bought (R1.4), every design is free and the free download
 * allowance is generous; tightening is a config change, not a code change.
 */
export const DEFAULT_CONFIG: BusinessConfig = {
  plans: {
    visitor: {
      label: 'Visitor',
      limits: { 'pdf.download': 0, 'import.cv': 0, 'ai.action': 0, 'design.ai': 0 },
      maxJobs: 0,
    },
    free: {
      label: 'Free',
      limits: { 'pdf.download': 30, 'import.cv': 2, 'ai.action': 0, 'design.ai': 1 },
      maxJobs: 3,
    },
    premium: {
      label: 'Premium',
      limits: { 'pdf.download': 100, 'import.cv': 30, 'ai.action': 300, 'design.ai': 40 },
      maxJobs: -1,
    },
  },
  designs: DESIGN_IDS.map((id) => ({ id, enabled: true, tier: 'free' as const, isNew: false })),
  passes: [
    { id: 'month', label: '1 month', days: 30, pricePkr: 499, active: true },
    { id: 'quarter', label: '3 months', days: 90, pricePkr: 1299, active: true },
  ],
  features: {
    ai: true,
    import: true,
    sales: false,
    signups: true,
    maintenance: false,
    designStudio: false,
    designer: false,
  },
  announcement: { enabled: false, text: '' },
  support: { email: '' },
  coupons: [],
  referrals: { enabled: false, rewardDays: 14, welcomeDays: 7 },
  payments: {
    methods: [],
    instructions:
      'Pay the exact amount, then place your order and send a screenshot of the payment with your order number on WhatsApp. We check payments by hand, usually within 24 hours, and Premium starts as soon as it is approved.',
    whatsapp: '',
  },
};

/**
 * Design tiers recommended for launch (applied by the owner in the Admin Console): one free
 * design per family (owner decision, Appendix C).
 */
export const LAUNCH_FREE_DESIGNS = [
  'clarity',
  'heritage',
  'harbor',
  'column',
  'chronicle',
  'spark',
  'lens',
  'grid',
] as const;

/**
 * Catalogue designs a stored config does not know yet (added in a later release) are appended
 * hidden and Premium, marked new: they appear only when the owner switches them on.
 */
export function withAllDesigns(cfg: BusinessConfig): BusinessConfig {
  const known = new Set(cfg.designs.map((d) => d.id));
  const missing = DESIGN_IDS.filter((id) => !known.has(id));
  if (missing.length === 0) return cfg;
  return {
    ...cfg,
    designs: [
      ...cfg.designs,
      ...missing.map((id) => ({ id, enabled: false, tier: 'premium' as const, isNew: true })),
    ],
  };
}

export function parseConfig(raw: unknown): BusinessConfig {
  const r = businessConfig.safeParse(raw);
  return r.success ? withAllDesigns(r.data) : DEFAULT_CONFIG;
}
