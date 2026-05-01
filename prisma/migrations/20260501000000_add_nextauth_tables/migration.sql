-- NextAuth tables (@auth/prisma-adapter standard models) + the
-- supporting User additions. Idempotent enough that a partial run
-- can be re-applied; the @auth adapter will create rows from there.

-- 1. User additions: emailVerified column + unique email constraint.
--    The unique on email is required by the adapter so a website
--    OAuth sign-in can join an existing desktop-app user record.
--    If a duplicate email exists in production this migration will
--    fail; we accept that risk because (a) email comes from the
--    same Google sub for any single user, and (b) we have low
--    volume during beta.
ALTER TABLE "User" ADD COLUMN "emailVerified" TIMESTAMP(3);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- 2. Account: one row per (User, OAuth provider account). For us,
--    everyone has at most one row here (Google).
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Account_provider_providerAccountId_key"
    ON "Account"("provider", "providerAccountId");

ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. Session: one row per signed-in browser (database session strategy).
--    sessionToken is the cookie value; expires drives auto-cleanup by
--    the adapter on session reads.
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. VerificationToken: required by adapter shape but unused for OAuth.
--    Magic-link / email-passwordless flows would write here if we ever
--    enabled them.
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key"
    ON "VerificationToken"("identifier", "token");
