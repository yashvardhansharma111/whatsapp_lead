-- Add business hours / timezone fields to tenant_settings
-- (they are already in the Prisma schema on TenantSettings; the DB table was missing them)
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata';
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "businessHoursStart" TEXT NOT NULL DEFAULT '09:00';
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "businessHoursEnd" TEXT NOT NULL DEFAULT '18:00';
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "businessDays" INTEGER[] NOT NULL DEFAULT ARRAY[1,2,3,4,5];
