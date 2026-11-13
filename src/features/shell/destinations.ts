import {
  Briefcase,
  FileText,
  FilePlus2,
  Globe,
  Home,
  Mail,
  PenLine,
  MessagesSquare,
  Upload,
  UserRound,
  type LucideIcon,
} from 'lucide-react';

/** The five studio destinations (complete-studio-spec §11.1). No more. */
export const DESTINATIONS: { href: string; label: string; icon: LucideIcon; also?: string[] }[] = [
  { href: '/studio', label: 'Home', icon: Home },
  { href: '/documents', label: 'Documents', icon: FileText, also: ['/cv', '/profile', '/letters'] },
  { href: '/jobs', label: 'Jobs', icon: Briefcase },
  { href: '/presence', label: 'Presence', icon: Globe, also: ['/portfolio', '/linkedin'] },
  { href: '/coach', label: 'Coach', icon: MessagesSquare },
];

/** The Create sheet: one place to start anything. */
export const CREATE: { href: string; label: string; hint: string; icon: LucideIcon }[] = [
  { href: '/makeover', label: 'Upload a CV', hint: 'See yours in new designs', icon: Upload },
  { href: '/start', label: 'New CV', hint: 'Start from scratch, step by step', icon: FilePlus2 },
  {
    href: '/letters/new?type=cover',
    label: 'Cover letter',
    hint: 'For a kind of role, or a saved job',
    icon: Mail,
  },
  {
    href: '/letters/new',
    label: 'Letter',
    hint: 'Resignation, thank-you, follow-up…',
    icon: PenLine,
  },
  { href: '/jobs?new=1', label: 'Add a job', hint: 'Track it and tailor your CV', icon: Briefcase },
  { href: '/presence', label: 'Portfolio', hint: 'Your CV as a web page', icon: UserRound },
];

export const isActive = (pathname: string, d: { href: string; also?: string[] }) =>
  [d.href, ...(d.also ?? [])].some((h) => pathname === h || pathname.startsWith(`${h}/`));
