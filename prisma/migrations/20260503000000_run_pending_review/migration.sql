-- Anti-cheat review queue. Runs that come in suspiciously fast (below
-- a per-challenge flagBelowFrames threshold in the manifest) are
-- inserted with pendingReview=true and hidden from public leaderboards
-- until an admin clears them in /admin/pending.

ALTER TABLE "Run"
  ADD COLUMN "pendingReview" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Run_pendingReview_idx" ON "Run"("pendingReview");
