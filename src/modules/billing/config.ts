import { z } from 'zod';
import { TEMPLATE_IDS } from '@/modules/resume/schema';

/**
 * Business configuration (docs/product/studio-master-plan.md §3, §4.4). One typed schema shared by
 * the server gate, the Admin Console and tests. Stored in `config/business` with versions; code
 * defaults apply only when nothing has been saved yet.
 */

export const PLAN_IDS = ['visitor', 'free', 'premium'] as const;
export type PlanId = (typeof PLAN_IDS)[number];

/** Metered capabilities: each plan has a monthly limit (-1 = unlimited, 0 = not included). */
export const METERED = ['pdf.download', 'import.cv', 'ai.action'] as const;
export type Metered = (typeof METERED)[number];

const limit = z.number().int().min(-1).max(100_000);
const limits = z.object({ 'pdf.download': limit, 'import.cv': limit, 'ai.action': limit });

export const businessConfig = z.object({
  plans: z.object({
    visitor: z.object({ label: z.string().max(40), limits }),
    free: z.object({ label: z.string().max(40), limits }),
    premium: z.object({ label: z.string().max(40), limits }),
  }),
  /** Design catalogue: availability and tier per design. */
  designs: z
    .array(
      z.object({
        id: z.enum(TEMPLATE_IDS),
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
    })
    .default({ methods: [], instructions: '' }),
});
export type BusinessConfig = z.infer<typeof businessConfig>;

/**
 * Starting values. Until Premium can be bought (R1.4), every design is free and the free download
 * allowance is generous; tightening is a config change, not a code change.
 */
export const DEFAULT_CONFIG: BusinessConfig = {
  plans: {
    visitor: { label: 'Visitor', limits: { 'pdf.download': 0, 'import.cv': 0, 'ai.action': 0 } },
    free: { label: 'Free', limits: { 'pdf.download': 30, 'import.cv': 2, 'ai.action': 0 } },
    premium: {
      label: 'Premium',
      limits: { 'pdf.download': 100, 'import.cv': 30, 'ai.action': 300 },
    },
  },
  designs: TEMPLATE_IDS.map((id) => ({ id, enabled: true, tier: 'free' as const, isNew: false })),
  passes: [
    { id: 'month', label: '1 month', days: 30, pricePkr: 499, active: true },
    { id: 'quarter', label: '3 months', days: 90, pricePkr: 1299, active: true },
  ],
  features: { ai: true, import: true, sales: false, signups: true, maintenance: false },
  announcement: { enabled: false, text: '' },
  payments: {
    methods: [],
    instructions:
      'Pay the exact amount, then enter the transaction ID from your banking app. We check payments by hand, usually within 24 hours, and Premium starts as soon as it is approved.',
  },
};

/** Design tiers recommended for launch (applied by the owner in the Admin Console). */
export const LAUNCH_FREE_DESIGNS = ['clarity', 'chronicle', 'heritage'] as const;

export function parseConfig(raw: unknown): BusinessConfig {
  const r = businessConfig.safeParse(raw);
  return r.success ? r.data : DEFAULT_CONFIG;
}
