-- S-18/S-19: when documents arrive, reminder drafts, and the batch day a draft was sent.
ALTER TABLE "Document" ADD COLUMN "receivedOn" TEXT;
ALTER TABLE "EmailDraft" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'followup';
ALTER TABLE "EmailDraft" ADD COLUMN "sentOn" TEXT;
DROP INDEX "EmailDraft_batchId_subCode_key";
CREATE UNIQUE INDEX "EmailDraft_batchId_subCode_kind_key" ON "EmailDraft"("batchId", "subCode", "kind");
