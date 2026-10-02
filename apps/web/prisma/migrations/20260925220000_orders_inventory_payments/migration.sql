-- CreateEnum
CREATE TYPE "OrderChannel" AS ENUM ('MANUAL', 'STRIPE');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('DRAFT', 'AWAITING_PAYMENT', 'CONFIRMED', 'FULFILLED', 'CANCELLED', 'REFUND_PENDING', 'REFUNDED', 'REVIEW');

-- CreateEnum
CREATE TYPE "InventoryState" AS ENUM ('NONE', 'HELD', 'SOLD', 'RELEASED', 'RESTOCKED');

-- AlterTable
ALTER TABLE "Variety" ADD COLUMN     "archived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "inventoryVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reserved" INTEGER NOT NULL DEFAULT 0;

-- Existing v1 on-hand counts stay intact; new held stock starts at zero.
ALTER TABLE "Variety" ADD CONSTRAINT "Variety_reserved_range_check"
  CHECK ("reserved" >= 0 AND (("stock" IS NULL AND "reserved" = 0) OR ("stock" IS NOT NULL AND "reserved" <= "stock")));
ALTER TABLE "Variety" ADD CONSTRAINT "Variety_inventory_version_check" CHECK ("inventoryVersion" >= 0);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "channel" "OrderChannel" NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'DRAFT',
    "inventoryState" "InventoryState" NOT NULL DEFAULT 'NONE',
    "requestKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "ownerHash" TEXT,
    "email" TEXT NOT NULL,
    "customerName" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "delivery" TEXT NOT NULL,
    "shippingAddress" JSONB,
    "currency" TEXT NOT NULL DEFAULT 'gbp',
    "subtotalPence" INTEGER NOT NULL,
    "shippingPence" INTEGER NOT NULL DEFAULT 0,
    "totalPence" INTEGER NOT NULL,
    "refundedPence" INTEGER NOT NULL DEFAULT 0,
    "checkoutOrigin" TEXT,
    "stripeSessionId" TEXT,
    "stripeIntentId" TEXT,
    "checkoutUrl" TEXT,
    "expiresAt" TIMESTAMP(3),
    "issue" TEXT,
    "paidAt" TIMESTAMP(3),
    "fulfilledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "varietyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unitPricePence" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "varietyId" TEXT NOT NULL,
    "orderId" TEXT,
    "operationKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "stockDelta" INTEGER NOT NULL,
    "reservedDelta" INTEGER NOT NULL DEFAULT 0,
    "stockAfter" INTEGER,
    "reservedAfter" INTEGER NOT NULL,
    "actor" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "stripeId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "amountPence" INTEGER NOT NULL,
    "restock" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "previousStatus" "OrderStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_quantity_check" CHECK ("quantity" BETWEEN 1 AND 1000 AND "unitPricePence" BETWEEN 0 AND 1000000);
ALTER TABLE "Order" ADD CONSTRAINT "Order_amount_check" CHECK ("subtotalPence" >= 0 AND "shippingPence" >= 0 AND "totalPence" = "subtotalPence" + "shippingPence" AND "totalPence" <= 99999999 AND "refundedPence" BETWEEN 0 AND "totalPence");
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_balances_check" CHECK ("stockAfter" IS NULL OR "stockAfter" BETWEEN 0 AND 1000000);
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_reserved_check" CHECK ("reservedAfter" BETWEEN 0 AND 1000000);
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_amount_check" CHECK ("amountPence" > 0);

INSERT INTO "StockMovement" ("id", "varietyId", "operationKey", "kind", "stockDelta", "reservedDelta", "stockAfter", "reservedAfter", "actor", "reason")
SELECT 'v1-opening-' || "id", "id", 'opening:' || "id", 'opening', COALESCE("stock", 0), 0, "stock", 0, 'migration', 'Opening balance carried forward from v1'
FROM "Variety";

-- CreateIndex
CREATE UNIQUE INDEX "Order_number_key" ON "Order"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Order_requestKey_key" ON "Order"("requestKey");

-- CreateIndex
CREATE UNIQUE INDEX "Order_stripeSessionId_key" ON "Order"("stripeSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_stripeIntentId_key" ON "Order"("stripeIntentId");

-- CreateIndex
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");

CREATE INDEX "Variety_archived_name_idx" ON "Variety"("archived", "name");

-- CreateIndex
CREATE INDEX "Order_channel_status_expiresAt_idx" ON "Order"("channel", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "Order_ownerHash_createdAt_idx" ON "Order"("ownerHash", "createdAt");

-- CreateIndex
CREATE INDEX "OrderItem_varietyId_idx" ON "OrderItem"("varietyId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderItem_orderId_varietyId_key" ON "OrderItem"("orderId", "varietyId");

-- CreateIndex
CREATE INDEX "StockMovement_varietyId_createdAt_idx" ON "StockMovement"("varietyId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_orderId_idx" ON "StockMovement"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "StockMovement_varietyId_operationKey_key" ON "StockMovement"("varietyId", "operationKey");

-- CreateIndex
CREATE INDEX "OrderEvent_orderId_createdAt_idx" ON "OrderEvent"("orderId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_requestKey_key" ON "Refund"("requestKey");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_stripeId_key" ON "Refund"("stripeId");

-- CreateIndex
CREATE INDEX "Refund_orderId_createdAt_idx" ON "Refund"("orderId", "createdAt");

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_varietyId_fkey" FOREIGN KEY ("varietyId") REFERENCES "Variety"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_varietyId_fkey" FOREIGN KEY ("varietyId") REFERENCES "Variety"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderEvent" ADD CONSTRAINT "OrderEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
