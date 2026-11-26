-- CreateEnum
CREATE TYPE "ServiceRequestType" AS ENUM ('WAITER', 'WATER', 'BILL');

-- CreateEnum
CREATE TYPE "ServiceRequestStatus" AS ENUM ('PENDING', 'ACKNOWLEDGED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "DiningPaymentMethod" AS ENUM ('CASH', 'UPI');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "diningSessionId" TEXT;

-- CreateTable
CREATE TABLE "RestaurantTable" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "RestaurantTable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TableQrToken" (
    "id" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "TableQrToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiningSession" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "DiningSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceRequest" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "type" "ServiceRequestType" NOT NULL,
    "status" "ServiceRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiningBill" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "subtotal" INTEGER NOT NULL,
    "tax" INTEGER NOT NULL,
    "discount" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiningBill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentRecord" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "method" "DiningPaymentMethod" NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantTable_restaurantId_number_key" ON "RestaurantTable"("restaurantId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "TableQrToken_tokenHash_key" ON "TableQrToken"("tokenHash");

-- CreateIndex
CREATE INDEX "TableQrToken_tableId_revokedAt_idx" ON "TableQrToken"("tableId", "revokedAt");

-- CreateIndex
CREATE INDEX "DiningSession_restaurantId_tableId_closedAt_idx" ON "DiningSession"("restaurantId", "tableId", "closedAt");

-- CreateIndex
CREATE INDEX "ServiceRequest_sessionId_status_idx" ON "ServiceRequest"("sessionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "DiningBill_sessionId_key" ON "DiningBill"("sessionId");

-- CreateIndex
CREATE INDEX "PaymentRecord_billId_idx" ON "PaymentRecord"("billId");

-- CreateIndex
CREATE INDEX "Order_diningSessionId_idx" ON "Order"("diningSessionId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_diningSessionId_fkey" FOREIGN KEY ("diningSessionId") REFERENCES "DiningSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantTable" ADD CONSTRAINT "RestaurantTable_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableQrToken" ADD CONSTRAINT "TableQrToken_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "RestaurantTable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiningSession" ADD CONSTRAINT "DiningSession_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiningSession" ADD CONSTRAINT "DiningSession_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "RestaurantTable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "DiningSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiningBill" ADD CONSTRAINT "DiningBill_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "DiningSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_billId_fkey" FOREIGN KEY ("billId") REFERENCES "DiningBill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- A table may have only one session until staff close it.
CREATE UNIQUE INDEX "DiningSession_one_open_per_table"
  ON "DiningSession" ("tableId") WHERE "closedAt" IS NULL;

-- Concurrent scans must not create repeated unresolved requests of the same kind.
CREATE UNIQUE INDEX "ServiceRequest_one_unresolved_per_type"
  ON "ServiceRequest" ("sessionId", "type") WHERE "status" <> 'RESOLVED';
