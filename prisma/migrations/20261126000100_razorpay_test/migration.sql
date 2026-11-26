ALTER TYPE "PaymentMethod" ADD VALUE 'RAZORPAY_TEST';

ALTER TABLE "Order"
ADD COLUMN "paymentVerified" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "razorpayOrderId" TEXT,
ADD COLUMN "razorpayPaymentId" TEXT;

CREATE UNIQUE INDEX "Order_razorpayOrderId_key" ON "Order"("razorpayOrderId");
CREATE UNIQUE INDEX "Order_razorpayPaymentId_key" ON "Order"("razorpayPaymentId");
