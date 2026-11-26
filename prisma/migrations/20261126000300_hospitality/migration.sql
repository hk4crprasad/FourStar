-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RoomCondition" AS ENUM ('AVAILABLE', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "HousekeepingStatus" AS ENUM ('CLEAN', 'DIRTY', 'IN_PROGRESS');

-- AlterEnum
ALTER TYPE "OrderType" ADD VALUE 'ROOM_SERVICE';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "reservationId" TEXT,
ADD COLUMN     "roomNumber" TEXT;

-- CreateTable
CREATE TABLE "Hotel" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "heroUrl" TEXT NOT NULL,
    "logoUrl" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "timeZone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',

    CONSTRAINT "Hotel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Amenity" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "hotelFeature" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Amenity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomType" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "beds" TEXT NOT NULL,
    "sizeM2" INTEGER NOT NULL,
    "capacity" INTEGER NOT NULL,
    "nightlyRate" INTEGER NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isListed" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "RoomType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomImage" (
    "id" TEXT NOT NULL,
    "roomTypeId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RoomImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "roomTypeId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "floor" TEXT NOT NULL,
    "condition" "RoomCondition" NOT NULL DEFAULT 'AVAILABLE',
    "housekeeping" "HousekeepingStatus" NOT NULL DEFAULT 'CLEAN',
    "qrToken" TEXT NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Guest" (
    "id" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,

    CONSTRAINT "Guest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "guestName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "roomTypeName" TEXT NOT NULL,
    "checkIn" DATE NOT NULL,
    "checkOut" DATE NOT NULL,
    "guestCount" INTEGER NOT NULL,
    "nightlyRate" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "payment" "PaymentMethod" NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReservationEvent" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "status" "ReservationStatus" NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReservationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReservationNight" (
    "roomId" TEXT NOT NULL,
    "night" DATE NOT NULL,
    "reservationId" TEXT NOT NULL,

    CONSTRAINT "ReservationNight_pkey" PRIMARY KEY ("roomId","night")
);

-- CreateTable
CREATE TABLE "_AmenityToRoomType" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_AmenityToRoomType_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Hotel_restaurantId_key" ON "Hotel"("restaurantId");

-- CreateIndex
CREATE UNIQUE INDEX "Amenity_hotelId_name_key" ON "Amenity"("hotelId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "RoomType_hotelId_name_key" ON "RoomType"("hotelId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "RoomImage_roomTypeId_position_key" ON "RoomImage"("roomTypeId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Room_qrToken_key" ON "Room"("qrToken");

-- CreateIndex
CREATE INDEX "Room_roomTypeId_idx" ON "Room"("roomTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "Room_hotelId_number_key" ON "Room"("hotelId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Guest_mobile_key" ON "Guest"("mobile");

-- CreateIndex
CREATE UNIQUE INDEX "Reservation_requestId_key" ON "Reservation"("requestId");

-- CreateIndex
CREATE INDEX "Reservation_hotelId_status_createdAt_idx" ON "Reservation"("hotelId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Reservation_roomId_status_idx" ON "Reservation"("roomId", "status");

-- CreateIndex
CREATE INDEX "ReservationEvent_reservationId_at_idx" ON "ReservationEvent"("reservationId", "at");

-- CreateIndex
CREATE INDEX "ReservationNight_reservationId_idx" ON "ReservationNight"("reservationId");

-- CreateIndex
CREATE INDEX "_AmenityToRoomType_B_index" ON "_AmenityToRoomType"("B");

-- CreateIndex
CREATE INDEX "Order_reservationId_idx" ON "Order"("reservationId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hotel" ADD CONSTRAINT "Hotel_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Amenity" ADD CONSTRAINT "Amenity_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomType" ADD CONSTRAINT "RoomType_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomImage" ADD CONSTRAINT "RoomImage_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationEvent" ADD CONSTRAINT "ReservationEvent_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationNight" ADD CONSTRAINT "ReservationNight_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationNight" ADD CONSTRAINT "ReservationNight_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AmenityToRoomType" ADD CONSTRAINT "_AmenityToRoomType_A_fkey" FOREIGN KEY ("A") REFERENCES "Amenity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AmenityToRoomType" ADD CONSTRAINT "_AmenityToRoomType_B_fkey" FOREIGN KEY ("B") REFERENCES "RoomType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
