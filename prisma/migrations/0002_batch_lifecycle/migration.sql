-- S-13/S-14: batch kind, failure message, last activity.
ALTER TABLE "Batch" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'upload';
ALTER TABLE "Batch" ADD COLUMN "error" TEXT;
ALTER TABLE "Batch" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE "Batch" SET "kind" = 'sample' WHERE "name" LIKE 'Sample batch #%';
