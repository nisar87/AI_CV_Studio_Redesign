'use client';

import { Megaphone } from 'lucide-react';
import { useEntitlements } from '@/features/account/entitlements';

/** Site-wide message set in the Admin Console (Settings → Announcement). */
export function AnnouncementBar() {
  const { ent } = useEntitlements();
  const text = ent?.features.maintenance
    ? 'The studio is being updated — downloads and AI help are paused for a little while.'
    : ent?.announcement;
  if (!text) return null;
  return (
    <div
      role="status"
      className="bg-primary-soft text-ink border-line border-b px-4 py-2 text-center text-sm"
    >
      <Megaphone aria-hidden size={16} className="text-primary mr-2 inline-block align-[-3px]" />
      {text}
    </div>
  );
}
