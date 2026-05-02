'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

// Server actions used by the admin pages. Each one re-checks
// requireAdmin() — even though the layout already gated rendering,
// server actions are individually-callable POST endpoints that bypass
// the layout, so we must NOT trust the layout-level gate alone.

export async function hideRunAction(runId: string, reason: string | null) {
  await requireAdmin();
  await prisma.run.update({
    where: { id: runId },
    data: { hiddenAt: new Date(), hiddenReason: reason || null },
  });
  revalidatePath('/admin/runs');
}

export async function unhideRunAction(runId: string) {
  await requireAdmin();
  await prisma.run.update({
    where: { id: runId },
    data: { hiddenAt: null, hiddenReason: null },
  });
  revalidatePath('/admin/runs');
}

// Hard-delete is destructive but lossless for moderation purposes —
// the row goes away completely. Most cases should use hide instead;
// reserve delete for spam / test data / GDPR-style requests.
export async function deleteRunAction(runId: string) {
  await requireAdmin();
  await prisma.run.delete({ where: { id: runId } });
  revalidatePath('/admin/runs');
}

export async function banUserAction(userId: string) {
  const me = await requireAdmin();
  // Belt-and-suspenders: never let an admin ban themselves and lock
  // out the admin section. Hardcoded allowlist would let them back in,
  // but a permanent self-mistake is annoying. Just no.
  if (userId === me.userId) {
    throw new Error("Can't ban yourself.");
  }
  await prisma.user.update({
    where: { id: userId },
    data: { bannedAt: new Date() },
  });
  revalidatePath('/admin/users');
  revalidatePath('/admin');
}

export async function unbanUserAction(userId: string) {
  await requireAdmin();
  await prisma.user.update({
    where: { id: userId },
    data: { bannedAt: null },
  });
  revalidatePath('/admin/users');
  revalidatePath('/admin');
}
