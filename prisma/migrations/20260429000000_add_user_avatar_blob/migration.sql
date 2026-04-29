-- AlterTable
ALTER TABLE "User"
    ADD COLUMN "pictureBlob" BYTEA,
    ADD COLUMN "pictureMimeType" TEXT,
    ADD COLUMN "hasCustomAvatar" BOOLEAN NOT NULL DEFAULT false;
