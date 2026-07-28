-- CreateEnum
CREATE TYPE "public"."RepairStatus" AS ENUM ('PENDING', 'CONFIRMED', 'IN_PROGRESS', 'WAITING_FOR_MATERIALS', 'READY_FOR_PICKUP', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."ClothingType" AS ENUM ('SHIRT', 'TROUSERS', 'DRESS', 'SKIRT', 'JACKET', 'COAT', 'SUIT', 'JEANS', 'SWEATER', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."RepairType" AS ENUM ('ALTERATION', 'HEM_MENDING', 'ZIPPER_REPLACEMENT', 'BUTTON_REPLACEMENT', 'PATCH_REPAIR', 'SEAM_MENDING', 'SIZE_ADJUSTMENT', 'FABRIC_PATCHING', 'TAILORING', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."FabricType" AS ENUM ('COTTON', 'LINEN', 'SILK', 'WOOL', 'POLYESTER', 'DENIM', 'KNIT', 'LEATHER', 'SUEDE', 'OTHER');

-- DropIndex
DROP INDEX "public"."Address_userId_key";

-- CreateTable
CREATE TABLE "public"."RepairBooking" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "clothingType" "public"."ClothingType" NOT NULL,
    "clothingItem" TEXT NOT NULL,
    "brand" TEXT,
    "fabricType" "public"."FabricType" NOT NULL,
    "color" TEXT,
    "size" TEXT,
    "repairTypes" "public"."RepairType"[],
    "description" TEXT NOT NULL,
    "images" TEXT[],
    "specialInstructions" TEXT,
    "currentMeasurements" JSONB,
    "desiredMeasurements" TEXT,
    "status" "public"."RepairStatus" NOT NULL DEFAULT 'PENDING',
    "estimatedCost" DOUBLE PRECISION,
    "actualCost" DOUBLE PRECISION,
    "depositPaid" DOUBLE PRECISION,
    "urgency" BOOLEAN NOT NULL DEFAULT false,
    "tailorNotes" TEXT,
    "materialsUsed" TEXT[],
    "completionTime" INTEGER,
    "preferredPickupDate" TIMESTAMP(3),
    "estimatedReadyDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "pickupLocationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RepairBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RepairService" (
    "id" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "repairType" "public"."RepairType" NOT NULL,
    "clothingType" "public"."ClothingType",
    "fabricType" "public"."FabricType",
    "description" TEXT,
    "baseCost" DOUBLE PRECISION NOT NULL,
    "complexity" TEXT,
    "estimatedTime" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RepairService_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RepairBooking_userId_idx" ON "public"."RepairBooking"("userId");

-- CreateIndex
CREATE INDEX "RepairBooking_status_idx" ON "public"."RepairBooking"("status");

-- CreateIndex
CREATE INDEX "RepairBooking_estimatedReadyDate_idx" ON "public"."RepairBooking"("estimatedReadyDate");

-- CreateIndex
CREATE UNIQUE INDEX "RepairService_serviceName_repairType_clothingType_key" ON "public"."RepairService"("serviceName", "repairType", "clothingType");

-- AddForeignKey
ALTER TABLE "public"."RepairBooking" ADD CONSTRAINT "RepairBooking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RepairBooking" ADD CONSTRAINT "RepairBooking_pickupLocationId_fkey" FOREIGN KEY ("pickupLocationId") REFERENCES "public"."Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;
