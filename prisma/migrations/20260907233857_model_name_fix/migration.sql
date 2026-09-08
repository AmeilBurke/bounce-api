/*
  Warnings:

  - You are about to drop the `Alert` table. If the table is not empty, all the data it contains will be lost.
  - Changed the type of `role` on the `Staff` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "Roles" AS ENUM ('ADMIN', 'BOUNCER');

-- DropForeignKey
ALTER TABLE "Alert" DROP CONSTRAINT "Alert_createdById_fkey";

-- AlterTable
ALTER TABLE "Staff" DROP COLUMN "role",
ADD COLUMN     "role" "Roles" NOT NULL;

-- DropTable
DROP TABLE "Alert";

-- DropEnum
DROP TYPE "Role";

-- CreateTable
CREATE TABLE "Alerts" (
    "id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "imagePath" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    "personId" TEXT,

    CONSTRAINT "Alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Alerts_personId_key" ON "Alerts"("personId");

-- AddForeignKey
ALTER TABLE "Alerts" ADD CONSTRAINT "Alerts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
