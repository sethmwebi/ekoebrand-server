/*
  Warnings:

  - Added the required column `resendId` to the `Email` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Email" ADD COLUMN     "resendId" TEXT NOT NULL;
