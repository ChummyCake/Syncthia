import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { MeService } from "./me.service";

const describeDb =
  process.env.RUN_DB_TESTS === "1" ? describe : describe.skip;

describeDb("MeService", () => {
  let prisma: PrismaService;
  let service: MeService;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is required when RUN_DB_TESTS=1.");
    }

    prisma = new PrismaService();
    service = new MeService(new NotificationsService(prisma), prisma);
    await prisma.$connect();
    await cleanDatabase(prisma);
  });

  afterEach(async () => {
    await cleanDatabase(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("persists provider preferences and updates recommendations", async () => {
    const first = await service.updateProviderPreferences({
      userId: "prefs-u1",
      preferredProvider: "zalo",
      installedProviders: ["messenger", "zalo"],
      signals: ["vietnam", "zalo_first"]
    });

    expect(first.preferences).toMatchObject({
      userId: "prefs-u1",
      preferredProvider: "zalo",
      installedProviders: ["messenger", "zalo"],
      signals: ["vietnam", "zalo_first"]
    });
    expect(first.recommendations[0].provider).toBe("zalo");

    const persisted = await prisma.providerPreference.findUnique({
      where: { userId: "prefs-u1" }
    });
    expect(persisted).toMatchObject({
      userId: "prefs-u1",
      preferredProvider: "ZALO",
      installedProviders: ["MESSENGER", "ZALO"],
      signals: ["vietnam", "zalo_first"]
    });

    const nextService = new MeService(new NotificationsService(prisma), prisma);
    const updated = await nextService.updateProviderPreferences({
      userId: "prefs-u1",
      preferredProvider: "discord",
      installedProviders: ["discord"],
      signals: ["streaming"]
    });

    expect(updated.preferences).toMatchObject({
      userId: "prefs-u1",
      preferredProvider: "discord",
      installedProviders: ["discord"],
      signals: ["streaming"]
    });
    expect(updated.recommendations[0].provider).toBe("discord");
    await expect(prisma.providerPreference.count()).resolves.toBe(1);
  });
});

async function cleanDatabase(prisma: PrismaService) {
  await prisma.notificationJob.deleteMany();
  await prisma.joinConfirmation.deleteMany();
  await prisma.switchProposal.deleteMany();
  await prisma.providerEndpoint.deleteMany();
  await prisma.auditEvent.deleteMany();
  await prisma.sessionParticipant.deleteMany();
  await prisma.callSession.deleteMany();
  await prisma.providerPreference.deleteMany();
  await prisma.providerProfile.deleteMany();
  await prisma.device.deleteMany();
  await prisma.user.deleteMany();
}
