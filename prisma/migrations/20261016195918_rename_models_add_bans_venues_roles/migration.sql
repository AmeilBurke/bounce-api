/*
  Warnings:

  - You are about to drop the `Alerts` table. If the table is not empty, all the data it contains will be lost.
  - Changed the type of `role` on the `Staff` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'BOUNCER', 'VENUE_MANAGER', 'DUTY_MANAGER');

-- DropForeignKey
ALTER TABLE "Alerts" DROP CONSTRAINT "Alerts_createdById_fkey";

-- AlterTable
ALTER TABLE "Staff" DROP COLUMN "role",
ADD COLUMN     "role" "Role" NOT NULL;

-- DropTable
DROP TABLE "Alerts";

-- DropEnum
DROP TYPE "Roles";

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "imagePath" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    "bannedPersonId" TEXT,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VenueManager" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,

    CONSTRAINT "VenueManager_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DutyManager" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,

    CONSTRAINT "DutyManager_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Venue" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imagePath" TEXT NOT NULL,

    CONSTRAINT "Venue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BannedPerson" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imagePath" TEXT NOT NULL,

    CONSTRAINT "BannedPerson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ban" (
    "id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isPending" BOOLEAN NOT NULL,
    "bannedPersonId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "Ban_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VenueBan" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "banId" TEXT NOT NULL,

    CONSTRAINT "VenueBan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Alert_bannedPersonId_key" ON "Alert"("bannedPersonId");

-- CreateIndex
CREATE INDEX "Alert_createdById_idx" ON "Alert"("createdById");

-- CreateIndex
CREATE INDEX "VenueManager_venueId_idx" ON "VenueManager"("venueId");

-- CreateIndex
CREATE UNIQUE INDEX "VenueManager_staffId_venueId_key" ON "VenueManager"("staffId", "venueId");

-- CreateIndex
CREATE INDEX "DutyManager_venueId_idx" ON "DutyManager"("venueId");

-- CreateIndex
CREATE UNIQUE INDEX "DutyManager_staffId_venueId_key" ON "DutyManager"("staffId", "venueId");

-- CreateIndex
CREATE INDEX "Ban_bannedPersonId_idx" ON "Ban"("bannedPersonId");

-- CreateIndex
CREATE INDEX "Ban_createdById_idx" ON "Ban"("createdById");

-- CreateIndex
CREATE INDEX "VenueBan_banId_idx" ON "VenueBan"("banId");

-- CreateIndex
CREATE UNIQUE INDEX "VenueBan_venueId_banId_key" ON "VenueBan"("venueId", "banId");

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_bannedPersonId_fkey" FOREIGN KEY ("bannedPersonId") REFERENCES "BannedPerson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueManager" ADD CONSTRAINT "VenueManager_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueManager" ADD CONSTRAINT "VenueManager_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DutyManager" ADD CONSTRAINT "DutyManager_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DutyManager" ADD CONSTRAINT "DutyManager_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ban" ADD CONSTRAINT "Ban_bannedPersonId_fkey" FOREIGN KEY ("bannedPersonId") REFERENCES "BannedPerson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ban" ADD CONSTRAINT "Ban_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueBan" ADD CONSTRAINT "VenueBan_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueBan" ADD CONSTRAINT "VenueBan_banId_fkey" FOREIGN KEY ("banId") REFERENCES "Ban"("id") ON DELETE CASCADE ON UPDATE CASCADE;
