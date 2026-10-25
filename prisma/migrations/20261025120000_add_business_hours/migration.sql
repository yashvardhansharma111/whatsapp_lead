-- Add business hours fields to businesses table
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata';
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "businessHoursStart" TEXT NOT NULL DEFAULT '09:00';
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "businessHoursEnd" TEXT NOT NULL DEFAULT '18:00';
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "businessDays" INTEGER[] NOT NULL DEFAULT ARRAY[1,2,3,4,5];
