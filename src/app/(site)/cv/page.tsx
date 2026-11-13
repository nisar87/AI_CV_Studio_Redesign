import { permanentRedirect } from 'next/navigation';

/** /cv became Documents in R8 (complete-studio-spec §11.1). */
export default function MyCvsPage() {
  permanentRedirect('/documents');
}
