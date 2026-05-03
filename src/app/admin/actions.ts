'use server';

import { revalidatePath } from 'next/cache';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireAdmin, isBootstrapAdminEmail } from '@/lib/auth';

// Server actions used by the admin pages. Each one re-checks
// requireAdmin() — even though the layout already gated rendering,
// server actions are individually-callable POST endpoints that bypass
// the layout, so we must NOT trust the layout-level gate alone.
//
// Every mutation also writes an AuditLog row via writeAudit() so we
// have a tamper-evident moderation paper-trail.

async function writeAudit(
  actorUserId: string,
  action: string,
  targetType: string | null,
  targetId: string | null,
  metadata?: Prisma.InputJsonValue | null,
) {
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId,
        action,
        targetType,
        targetId,
        // Prisma's typed-null sentinel for "the column is JSON SQL NULL".
        // Passing literal null wouldn't typecheck against InputJsonValue.
        metadata: metadata ?? Prisma.JsonNull,
      },
    });
  } catch (err) {
    // Audit write failure shouldn't break the moderation action itself —
    // the action already mutated. Log loudly so we notice.
    console.error('[audit] write failed for', action, '— continuing:', err);
  }
}

// ---------------------------------------------------------------------------
// Run moderation
// ---------------------------------------------------------------------------
export async function hideRunAction(runId: string, reason: string | null) {
  const me = await requireAdmin();
  await prisma.run.update({
    where: { id: runId },
    data: { hiddenAt: new Date(), hiddenReason: reason || null },
  });
  await writeAudit(me.userId, 'hide_run', 'run', runId, { reason: reason || null });
  revalidatePath('/admin/runs');
}

export async function unhideRunAction(runId: string) {
  const me = await requireAdmin();
  await prisma.run.update({
    where: { id: runId },
    data: { hiddenAt: null, hiddenReason: null },
  });
  await writeAudit(me.userId, 'unhide_run', 'run', runId, null);
  revalidatePath('/admin/runs');
}

// Hard-delete is destructive but lossless for moderation purposes —
// the row goes away completely. Most cases should use hide instead;
// reserve delete for spam / test data / GDPR-style requests.
export async function deleteRunAction(runId: string) {
  const me = await requireAdmin();
  // Snapshot useful metadata before delete so the audit row tells the
  // story even after the Run row is gone.
  const snap = await prisma.run.findUnique({
    where: { id: runId },
    select: { game: true, challengeName: true, userId: true },
  });
  await prisma.run.delete({ where: { id: runId } });
  await writeAudit(me.userId, 'delete_run', 'run', runId, snap as unknown as Prisma.InputJsonValue);
  revalidatePath('/admin/runs');
}

// ---------------------------------------------------------------------------
// Anti-cheat review queue. Runs come in pre-flagged when their
// completionTimeFrames falls below the manifest's flagBelowFrames
// threshold; an admin clears them via approve, or removes them via
// reject. Both write to the audit log.
// ---------------------------------------------------------------------------
export async function approveRunAction(runId: string) {
  const me = await requireAdmin();
  const snap = await prisma.run.findUnique({
    where: { id: runId },
    select: { game: true, challengeName: true, userId: true, completionTimeFrames: true },
  });
  await prisma.run.update({
    where: { id: runId },
    data: { pendingReview: false },
  });
  await writeAudit(me.userId, 'approve_run', 'run', runId, snap as unknown as Prisma.InputJsonValue);
  revalidatePath('/admin/pending');
  revalidatePath('/admin');
  if (snap) {
    revalidatePath(`/leaderboards/c/${encodeURIComponent(snap.game)}/${encodeURIComponent(snap.challengeName)}`);
  }
}

// Reject = hide. We don't hard-delete from the queue so the run row
// stays available for forensic review later. Admin can hard-delete from
// /admin/runs if needed.
export async function rejectRunAction(runId: string, reason: string | null) {
  const me = await requireAdmin();
  const snap = await prisma.run.findUnique({
    where: { id: runId },
    select: { game: true, challengeName: true, userId: true, completionTimeFrames: true },
  });
  await prisma.run.update({
    where: { id: runId },
    data: {
      // Clear pendingReview so it leaves the queue, and hide it so it
      // never appears on the public leaderboard.
      pendingReview: false,
      hiddenAt: new Date(),
      hiddenReason: reason || 'rejected from review queue',
    },
  });
  await writeAudit(me.userId, 'reject_run', 'run', runId, {
    reason: reason || null,
    snapshot: snap,
  } as unknown as Prisma.InputJsonValue);
  revalidatePath('/admin/pending');
  revalidatePath('/admin');
}

// ---------------------------------------------------------------------------
// User moderation
// ---------------------------------------------------------------------------
export async function banUserAction(userId: string) {
  const me = await requireAdmin();
  if (userId === me.userId) {
    throw new Error("Can't ban yourself.");
  }
  await prisma.user.update({
    where: { id: userId },
    data: { bannedAt: new Date() },
  });
  await writeAudit(me.userId, 'ban_user', 'user', userId, null);
  revalidatePath('/admin/users');
  revalidatePath('/admin');
}

export async function unbanUserAction(userId: string) {
  const me = await requireAdmin();
  await prisma.user.update({
    where: { id: userId },
    data: { bannedAt: null },
  });
  await writeAudit(me.userId, 'unban_user', 'user', userId, null);
  revalidatePath('/admin/users');
  revalidatePath('/admin');
}

// ---------------------------------------------------------------------------
// Admin role grants
// ---------------------------------------------------------------------------
export async function grantAdminAction(userId: string) {
  const me = await requireAdmin();
  await prisma.user.update({
    where: { id: userId },
    data: { isAdmin: true },
  });
  await writeAudit(me.userId, 'grant_admin', 'user', userId, null);
  revalidatePath('/admin/users');
  revalidatePath(`/admin/users/${userId}`);
}

export async function revokeAdminAction(userId: string) {
  const me = await requireAdmin();
  // Self-revoke guard: an admin demoting themselves is a footgun. The
  // bootstrap allowlist would let them recover, but for any non-bootstrap
  // admin a self-revoke would lock them out permanently.
  if (userId === me.userId && !isBootstrapAdminEmail(me.email)) {
    throw new Error("Can't revoke your own admin role.");
  }
  await prisma.user.update({
    where: { id: userId },
    data: { isAdmin: false },
  });
  await writeAudit(me.userId, 'revoke_admin', 'user', userId, null);
  revalidatePath('/admin/users');
  revalidatePath(`/admin/users/${userId}`);
}

// ---------------------------------------------------------------------------
// Site settings (banner)
// ---------------------------------------------------------------------------
const VALID_BANNER_LEVELS = new Set(['info', 'warn', 'success']);

export async function setBannerAction(text: string, level: string) {
  const me = await requireAdmin();
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('Banner text cannot be empty — use Clear instead.');
  }
  const lvl = VALID_BANNER_LEVELS.has(level) ? level : 'info';
  await prisma.siteSetting.upsert({
    where: { id: 1 },
    update: {
      bannerText:      trimmed,
      bannerLevel:     lvl,
      bannerUpdatedAt: new Date(),
      bannerUpdatedBy: me.userId,
    },
    create: {
      id: 1,
      bannerText:      trimmed,
      bannerLevel:     lvl,
      bannerUpdatedAt: new Date(),
      bannerUpdatedBy: me.userId,
    },
  });
  await writeAudit(me.userId, 'set_banner', 'setting', 'banner', { text: trimmed, level: lvl });
  // Banner shows on every public page so revalidate broadly.
  revalidatePath('/', 'layout');
}

export async function clearBannerAction() {
  const me = await requireAdmin();
  await prisma.siteSetting.upsert({
    where: { id: 1 },
    update: {
      bannerText:      null,
      bannerLevel:     null,
      bannerUpdatedAt: new Date(),
      bannerUpdatedBy: me.userId,
    },
    create: {
      id: 1,
      bannerUpdatedAt: new Date(),
      bannerUpdatedBy: me.userId,
    },
  });
  await writeAudit(me.userId, 'clear_banner', 'setting', 'banner', null);
  revalidatePath('/', 'layout');
}
