import { NextResponse } from 'next/server';
import { currentUser } from '@/modules/identity/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The signed-in user (or null). Plan and usage are added in R1.2. */
export async function GET() {
  const user = await currentUser();
  return NextResponse.json(
    {
      user: user
        ? {
            uid: user.uid,
            email: user.email,
            name: user.name,
            emailVerified: user.emailVerified,
            picture: user.picture,
            admin: user.admin,
          }
        : null,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
