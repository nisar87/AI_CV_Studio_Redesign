'use client';

import { useSearchParams } from 'next/navigation';
import { Gift } from 'lucide-react';

/** Shown on the home page after opening a friend's invite link. */
export function InvitedNote() {
  const invited = useSearchParams().get('invited') === '1';
  if (!invited) return null;
  return (
    <p
      role="status"
      className="bg-primary-soft text-primary inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold"
    >
      <Gift aria-hidden size={16} /> A friend invited you. Create your free account to get extra
      days when you choose Premium.
    </p>
  );
}
