import 'server-only';
import type { SessionUser } from '@/modules/identity/session';
import { aiMode } from '@/modules/ai/config';
import { getUserStore } from '@/modules/store';
import type { PaymentRequest } from '@/modules/store/types';
import { getBusinessConfig, planFor } from './server';

/** Everything /premium shows: offer (from config) and, when signed in, this person's status. */
export async function premiumOffer(user: SessionUser | null) {
  const { value: cfg } = await getBusinessConfig();
  const shown = cfg.designs.filter((d) => d.enabled);
  const [{ plan, passExpiresAt }, requests] = await Promise.all([
    planFor(user),
    user
      ? getUserStore().listPaymentRequests({ uid: user.uid, limit: 5 })
      : Promise.resolve([] as PaymentRequest[]),
  ]);
  return {
    sales: cfg.features.sales,
    plans: {
      free: { label: cfg.plans.free.label, limits: cfg.plans.free.limits },
      premium: { label: cfg.plans.premium.label, limits: cfg.plans.premium.limits },
    },
    designs: {
      total: shown.length,
      free: shown.filter((d) => d.tier === 'free').length,
    },
    // Only promise AI when it is both switched on and actually configured on the server.
    aiAvailable: cfg.features.ai && aiMode() !== 'off',
    passes: cfg.features.sales ? cfg.passes.filter((p) => p.active) : [],
    methods: cfg.features.sales ? cfg.payments.methods.filter((m) => m.active) : [],
    instructions: cfg.payments.instructions,
    supportEmail: cfg.support.email,
    me: user
      ? {
          plan,
          passExpiresAt,
          // Never echo the uid or email back in the list.
          requests: requests.map((r) => {
            const copy: Partial<PaymentRequest> = { ...r };
            delete copy.uid;
            delete copy.email;
            return copy as Omit<PaymentRequest, 'uid' | 'email'>;
          }),
        }
      : null,
  };
}
export type PremiumOffer = Awaited<ReturnType<typeof premiumOffer>>;
