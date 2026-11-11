import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AdminShell } from '@/features/admin/admin-shell';

export const metadata: Metadata = { title: 'Admin Console', robots: { index: false } };

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
