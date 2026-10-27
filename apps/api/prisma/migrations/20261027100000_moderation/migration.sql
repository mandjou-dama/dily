-- CreateEnum
CREATE TYPE "report_kind" AS ENUM ('listing', 'user');

-- CreateEnum
CREATE TYPE "report_reason" AS ENUM ('prohibited', 'counterfeit', 'scam', 'harassment', 'offensive', 'spam', 'other');

-- CreateEnum
CREATE TYPE "report_status" AS ENUM ('open', 'dismissed', 'actioned');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "suspended_at" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "blocks" (
    "blocker_id" UUID NOT NULL,
    "blocked_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blocks_pkey" PRIMARY KEY ("blocker_id","blocked_id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" UUID NOT NULL,
    "kind" "report_kind" NOT NULL,
    "reporter_id" UUID,
    "reported_user_id" UUID NOT NULL,
    "product_id" UUID,
    "conversation_id" UUID,
    "reason" "report_reason" NOT NULL,
    "note" TEXT,
    "status" "report_status" NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ(3),

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "blocks_blocked_id_idx" ON "blocks"("blocked_id");

-- CreateIndex
CREATE INDEX "reports_status_created_at_idx" ON "reports"("status", "created_at");

-- CreateIndex
CREATE INDEX "reports_reported_user_id_idx" ON "reports"("reported_user_id");

-- CreateIndex
CREATE INDEX "reports_product_id_idx" ON "reports"("product_id");

-- AddForeignKey
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocker_id_fkey" FOREIGN KEY ("blocker_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocked_id_fkey" FOREIGN KEY ("blocked_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reported_user_id_fkey" FOREIGN KEY ("reported_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Checks and indexes Prisma can't express
ALTER TABLE "blocks"
  ADD CONSTRAINT "blocks_not_self_check" CHECK ("blocker_id" <> "blocked_id");

ALTER TABLE "reports"
  ADD CONSTRAINT "reports_note_check" CHECK (char_length("note") BETWEEN 1 AND 500),
  -- A listing report has no conversation; a person's has no listing
  ADD CONSTRAINT "reports_listing_check" CHECK ("kind" = 'user' OR "conversation_id" IS NULL),
  ADD CONSTRAINT "reports_user_check" CHECK ("kind" = 'listing' OR "product_id" IS NULL),
  ADD CONSTRAINT "reports_resolved_check" CHECK (("status" = 'open') = ("resolved_at" IS NULL));

-- One open report per reporter and listing, and per reporter and person:
-- reporting again changes nothing
CREATE UNIQUE INDEX "reports_open_listing_key" ON "reports"("reporter_id", "product_id") WHERE "status" = 'open' AND "kind" = 'listing';
CREATE UNIQUE INDEX "reports_open_user_key" ON "reports"("reporter_id", "reported_user_id") WHERE "status" = 'open' AND "kind" = 'user';
