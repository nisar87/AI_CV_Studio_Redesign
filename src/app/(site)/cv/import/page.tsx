import { redirect } from 'next/navigation';

/** The import screen became the Instant Makeover (spec §6). */
export default function ImportPage() {
  redirect('/makeover');
}
