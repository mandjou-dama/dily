-- CreateEnum
CREATE TYPE "dispute_reason" AS ENUM ('not_received', 'not_as_described', 'other');

-- CreateEnum
CREATE TYPE "dispute_status" AS ENUM ('open', 'refunded', 'released');

-- CreateEnum
CREATE TYPE "transfer_kind" AS ENUM ('payout', 'refund');

-- CreateEnum
CREATE TYPE "transfer_status" AS ENUM ('awaiting_account', 'pending', 'succeeded', 'failed');

-- AlterEnum
ALTER TYPE "message_kind" ADD VALUE 'handover';
ALTER TYPE "message_kind" ADD VALUE 'dispute';
ALTER TYPE "message_kind" ADD VALUE 'refund';

-- AlterEnum
ALTER TYPE "order_status" ADD VALUE 'completed';
ALTER TYPE "order_status" ADD VALUE 'disputed';
ALTER TYPE "order_status" ADD VALUE 'refunded';

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "completed_at" TIMESTAMPTZ(3),
ADD COLUMN     "handover_code" TEXT,
ADD COLUMN     "handover_reminders" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "refunded_at" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "payout_phone" TEXT,
ADD COLUMN     "payout_provider" "payment_provider";

-- CreateTable
CREATE TABLE "disputes" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "reason" "dispute_reason" NOT NULL,
    "note" TEXT,
    "photo_paths" TEXT[],
    "status" "dispute_status" NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ(3),

    CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfers" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "kind" "transfer_kind" NOT NULL,
    "recipient_id" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "provider" "payment_provider",
    "phone" TEXT,
    "status" "transfer_status" NOT NULL,
    "failure_reason" TEXT,
    "reference" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMPTZ(3),
    "settled_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transfers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "disputes_order_id_key" ON "disputes"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "transfers_order_id_key" ON "transfers"("order_id");

-- CreateIndex
CREATE INDEX "transfers_status_next_attempt_at_idx" ON "transfers"("status", "next_attempt_at");

-- CreateIndex
CREATE INDEX "transfers_recipient_id_status_idx" ON "transfers"("recipient_id", "status");

-- CreateIndex
CREATE INDEX "orders_status_paid_at_idx" ON "orders"("status", "paid_at");

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Checks Prisma can't express. The new enum values can't be used in the
-- transaction that adds them: the message kind is compared as text
ALTER TABLE "messages"
  DROP CONSTRAINT "messages_order_check",
  ADD CONSTRAINT "messages_order_check" CHECK (("kind"::text IN ('deal', 'handover', 'dispute', 'refund')) = ("order_id" IS NOT NULL));

ALTER TABLE "users"
  ADD CONSTRAINT "users_payout_account_check" CHECK (("payout_provider" IS NULL) = ("payout_phone" IS NULL)),
  ADD CONSTRAINT "users_payout_phone_check" CHECK ("payout_phone" ~ '^\+[0-9]{8,15}$');

ALTER TABLE "orders"
  ADD CONSTRAINT "orders_handover_code_check" CHECK ("handover_code" ~ '^[0-9]{4}$'),
  ADD CONSTRAINT "orders_handover_reminders_check" CHECK ("handover_reminders" BETWEEN 0 AND 2);

ALTER TABLE "disputes"
  ADD CONSTRAINT "disputes_note_check" CHECK (char_length("note") BETWEEN 1 AND 500),
  ADD CONSTRAINT "disputes_photos_check" CHECK (cardinality("photo_paths") <= 4),
  ADD CONSTRAINT "disputes_photo_required_check" CHECK ("reason" <> 'not_as_described' OR cardinality("photo_paths") >= 1);

ALTER TABLE "transfers"
  ADD CONSTRAINT "transfers_amount_check" CHECK ("amount" > 0),
  ADD CONSTRAINT "transfers_phone_check" CHECK ("phone" ~ '^\+[0-9]{8,15}$'),
  ADD CONSTRAINT "transfers_destination_check" CHECK (("provider" IS NULL) = ("phone" IS NULL) AND ("status" = 'awaiting_account') = ("provider" IS NULL)),
  ADD CONSTRAINT "transfers_awaiting_account_check" CHECK ("kind" = 'payout' OR "status" <> 'awaiting_account'),
  ADD CONSTRAINT "transfers_failure_reason_check" CHECK (("status" = 'failed') = ("failure_reason" IS NOT NULL));
