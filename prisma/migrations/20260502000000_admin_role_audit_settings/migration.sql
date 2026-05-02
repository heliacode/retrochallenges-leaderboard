-- Admin role: DB column + bootstrap allowlist together replace the
-- previous hardcoded-only check. Defaulting false so existing rows are
-- non-admin until explicitly granted.
ALTER TABLE "User" ADD COLUMN "isAdmin" BOOLEAN NOT NULL DEFAULT false;

-- Audit log for admin actions. Free-form action / targetType strings so
-- adding new action kinds doesn't require a migration. metadata is JSONB
-- for the same reason — different actions store different shapes.
CREATE TABLE "AuditLog" (
    "id"            TEXT NOT NULL,
    "actorUserId"   TEXT NOT NULL,
    "action"        TEXT NOT NULL,
    "targetType"    TEXT,
    "targetId"      TEXT,
    "metadata"      JSONB,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditLog_createdAt_idx"   ON "AuditLog"("createdAt");
CREATE INDEX "AuditLog_actorUserId_idx" ON "AuditLog"("actorUserId");

ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey"
    FOREIGN KEY ("actorUserId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Singleton site settings (banner text + future flags). Hardcoded id=1
-- so the table only ever holds one row.
CREATE TABLE "SiteSetting" (
    "id"               INTEGER NOT NULL DEFAULT 1,
    "bannerText"       TEXT,
    "bannerLevel"      TEXT,
    "bannerUpdatedAt"  TIMESTAMP(3),
    "bannerUpdatedBy"  TEXT,
    "updatedAt"        TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteSetting_pkey" PRIMARY KEY ("id")
);

-- Seed the singleton row so getSiteSetting() always finds something to
-- return rather than null-guarding everywhere.
INSERT INTO "SiteSetting" ("id", "updatedAt") VALUES (1, CURRENT_TIMESTAMP);
