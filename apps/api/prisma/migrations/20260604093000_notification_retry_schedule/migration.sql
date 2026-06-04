-- AlterTable
ALTER TABLE "NotificationJob" ADD COLUMN "nextAttemptAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "NotificationJob_status_nextAttemptAt_createdAt_idx" ON "NotificationJob"("status", "nextAttemptAt", "createdAt");
