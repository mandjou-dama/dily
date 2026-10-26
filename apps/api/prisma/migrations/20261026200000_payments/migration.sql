-- CreateEnum
CREATE TYPE "payment_provider" AS ENUM ('orange_money', 'moov_money');

-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('pending', 'succeeded', 'failed', 'cancelled', 'expired');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "contact_phone" TEXT,
ADD COLUMN     "landmark" TEXT;

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "provider" "payment_provider" NOT NULL,
    "payer_phone" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "payment_status" NOT NULL DEFAULT 'pending',
    "failure_reason" TEXT,
    "reference" TEXT,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "settled_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payments_order_id_created_at_idx" ON "payments"("order_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Not expressible in schema.prisma: same limits as the API's zod schemas
ALTER TABLE "orders"
  ADD CONSTRAINT "orders_landmark_check" CHECK (char_length("landmark") BETWEEN 1 AND 120),
  ADD CONSTRAINT "orders_contact_phone_check" CHECK ("contact_phone" ~ '^\+[0-9]{8,15}$'),
  ADD CONSTRAINT "orders_delivery_details_check" CHECK ("fulfilment" = 'delivery' OR ("landmark" IS NULL AND "contact_phone" IS NULL));

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_amount_check" CHECK ("amount" > 0),
  ADD CONSTRAINT "payments_payer_phone_check" CHECK ("payer_phone" ~ '^\+[0-9]{8,15}$'),
  ADD CONSTRAINT "payments_failure_reason_check" CHECK (("status" = 'failed') = ("failure_reason" IS NOT NULL));

-- One attempt at a time, and an order is paid once
CREATE UNIQUE INDEX "payments_one_pending_idx" ON "payments"("order_id") WHERE "status" = 'pending';
CREATE UNIQUE INDEX "payments_one_succeeded_idx" ON "payments"("order_id") WHERE "status" = 'succeeded';
