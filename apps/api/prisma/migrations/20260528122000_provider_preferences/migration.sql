-- CreateTable
CREATE TABLE "ProviderPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "preferredProvider" "Provider",
    "installedProviders" "Provider"[],
    "signals" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProviderPreference_userId_key" ON "ProviderPreference"("userId");

-- AddForeignKey
ALTER TABLE "ProviderPreference" ADD CONSTRAINT "ProviderPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
