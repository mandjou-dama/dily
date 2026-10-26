-- CreateEnum
CREATE TYPE "message_kind" AS ENUM ('text', 'offer', 'deal');

-- CreateEnum
CREATE TYPE "fulfilment" AS ENUM ('pickup', 'delivery');

-- CreateEnum
CREATE TYPE "offer_status" AS ENUM ('pending', 'accepted', 'declined', 'superseded', 'expired');

-- CreateEnum
CREATE TYPE "order_status" AS ENUM ('awaiting_payment', 'paid', 'cancelled', 'expired');

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "kind" "message_kind" NOT NULL DEFAULT 'text',
ADD COLUMN     "offer_id" UUID,
ADD COLUMN     "order_id" UUID;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "delivery_fee" INTEGER,
ADD COLUMN     "pickup" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "offers" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "fulfilment" "fulfilment" NOT NULL,
    "delivery_fee" INTEGER,
    "delivery_area" TEXT,
    "list_price" INTEGER NOT NULL,
    "status" "offer_status" NOT NULL DEFAULT 'pending',
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "responded_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "buyer_id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "offer_id" UUID,
    "amount" INTEGER NOT NULL,
    "list_price" INTEGER NOT NULL,
    "fulfilment" "fulfilment" NOT NULL,
    "delivery_fee" INTEGER,
    "delivery_area" TEXT,
    "status" "order_status" NOT NULL DEFAULT 'awaiting_payment',
    "reserved_until" TIMESTAMPTZ(3) NOT NULL,
    "paid_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "offers_conversation_id_created_at_idx" ON "offers"("conversation_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "orders_offer_id_key" ON "orders"("offer_id");

-- CreateIndex
CREATE INDEX "orders_conversation_id_created_at_idx" ON "orders"("conversation_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "orders_product_id_idx" ON "orders"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "messages_offer_id_key" ON "messages"("offer_id");

-- CreateIndex
CREATE INDEX "messages_order_id_idx" ON "messages"("order_id");

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Not expressible in schema.prisma: same limits as the API's zod schemas
ALTER TABLE "products"
  ADD CONSTRAINT "products_delivery_fee_check" CHECK ("delivery_fee" >= 0),
  ADD CONSTRAINT "products_fulfilment_check" CHECK ("pickup" OR "delivery_fee" IS NOT NULL);

ALTER TABLE "messages"
  ADD CONSTRAINT "messages_offer_check" CHECK (("kind" = 'offer') = ("offer_id" IS NOT NULL)),
  ADD CONSTRAINT "messages_order_check" CHECK (("kind" = 'deal') = ("order_id" IS NOT NULL));

-- Delivery fee and area go with delivery, and only with it
ALTER TABLE "offers"
  ADD CONSTRAINT "offers_amount_check" CHECK ("amount" > 0),
  ADD CONSTRAINT "offers_list_price_check" CHECK ("list_price" >= 0),
  ADD CONSTRAINT "offers_delivery_fee_check" CHECK (("fulfilment" = 'delivery') = ("delivery_fee" IS NOT NULL)),
  ADD CONSTRAINT "offers_delivery_area_check" CHECK (("fulfilment" = 'delivery') = ("delivery_area" IS NOT NULL)),
  ADD CONSTRAINT "offers_delivery_area_length_check" CHECK (char_length("delivery_area") BETWEEN 1 AND 60);

ALTER TABLE "orders"
  ADD CONSTRAINT "orders_amount_check" CHECK ("amount" > 0),
  ADD CONSTRAINT "orders_list_price_check" CHECK ("list_price" >= 0),
  ADD CONSTRAINT "orders_delivery_fee_check" CHECK (("fulfilment" = 'delivery') = ("delivery_fee" IS NOT NULL)),
  ADD CONSTRAINT "orders_delivery_area_check" CHECK (("fulfilment" = 'delivery') = ("delivery_area" IS NOT NULL)),
  ADD CONSTRAINT "orders_delivery_area_length_check" CHECK (char_length("delivery_area") BETWEEN 1 AND 60),
  ADD CONSTRAINT "orders_participants_check" CHECK ("buyer_id" <> "seller_id");

-- At most one pending offer per conversation: a new one replaces it
CREATE UNIQUE INDEX "offers_one_pending_idx" ON "offers"("conversation_id") WHERE "status" = 'pending';

-- At most one order awaiting payment or paid per listing: it can't be sold twice
CREATE UNIQUE INDEX "orders_one_open_idx" ON "orders"("product_id") WHERE "status" IN ('awaiting_payment', 'paid');
