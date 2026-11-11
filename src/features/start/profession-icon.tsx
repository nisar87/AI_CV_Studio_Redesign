import {
  BookOpen,
  Briefcase,
  Code2,
  GraduationCap,
  HardHat,
  HeartPulse,
  Landmark,
  PenLine,
  ShoppingBag,
  Truck,
  type LucideIcon,
} from 'lucide-react';
import type { PresetId } from '@/modules/resume/professions';

const ICONS: Record<PresetId, LucideIcon> = {
  driver: Truck,
  teacher: BookOpen,
  healthcare: HeartPulse,
  retail: ShoppingBag,
  trades: HardHat,
  office: Briefcase,
  tech: Code2,
  executive: Landmark,
  student: GraduationCap,
  general: PenLine,
};

export function ProfessionIcon({ id, size = 22 }: { id: PresetId; size?: number }) {
  const Icon = ICONS[id];
  return <Icon aria-hidden size={size} />;
}
