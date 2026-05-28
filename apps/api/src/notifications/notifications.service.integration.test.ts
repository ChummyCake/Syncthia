import { SwitchProposal } from "@syncthia/shared";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "./notifications.service";

const describeDb =
  process.env.RUN_DB_TESTS === "1" ? describe : describe.skip;

describeDb("NotificationsService", () => {
  let prisma: PrismaService;
  let service: NotificationsService;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is required when RUN_DB_TESTS=1.");
    }

    prisma = new PrismaService();
    service = new NotificationsService(prisma);
    await prisma.$connect();
    await cleanDatabase(prisma);
  });

  afterEach(async () => {
    await cleanDatabase(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("upserts registered devices by user and push token", async () => {
    const first = await service.registerDevice({
      userId: "notify-u1",
      pushToken: "ExponentPushToken[one]",
      platform: "ios"
    });
    const second = await service.registerDevice({
      userId: "notify-u1",
      pushToken: "ExponentPushToken[one]",
      platform: "android"
    });

    expect(second.id).toBe(first.id);
    expect(second.platform).toBe("android");
    await expect(prisma.device.count()).resolves.toBe(1);
    await expect(
      prisma.user.findUnique({ where: { id: "notify-u1" } })
    ).resolves.toMatchObject({
      id: "notify-u1",
      displayName: "notify-u1"
    });
  });

  it("persists queued switch notifications with device counts", async () => {
    await service.registerDevice({
      userId: "notify-u2",
      pushToken: "ExponentPushToken[one]",
      platform: "ios"
    });
    await service.registerDevice({
      userId: "notify-u2",
      pushToken: "ExponentPushToken[two]",
      platform: "android"
    });

    const proposal = createProposal("proposal-notify-1", "notify-u2");
    const job = await service.queueSwitchNotification(
      "notify-u2",
      "switch.proposed",
      proposal
    );

    expect(job).toMatchObject({
      recipientId: "notify-u2",
      type: "switch.proposed",
      proposalId: proposal.id,
      deviceCount: 2,
      status: "queued",
      attempts: 0
    });

    const persisted = await prisma.notificationJob.findUnique({
      where: { id: job.id }
    });

    expect(persisted?.payload).toMatchObject({
      id: proposal.id,
      sessionId: proposal.sessionId,
      toProvider: "discord"
    });

    const queued = await service.listQueuedNotifications();
    expect(queued).toHaveLength(1);
    expect(queued[0].job.id).toBe(job.id);
    expect(queued[0].devices.map((device) => device.pushToken)).toEqual([
      "ExponentPushToken[one]",
      "ExponentPushToken[two]"
    ]);
  });

  it("marks notification jobs as sent or failed", async () => {
    const proposal = createProposal("proposal-notify-2", "notify-u3");
    const sentJob = await service.queueSwitchNotification(
      "notify-u3",
      "switch.launching",
      proposal
    );
    const failedJob = await service.queueSwitchNotification(
      "notify-u3",
      "switch.expired",
      proposal
    );

    const sent = await service.markNotificationSent(sentJob.id);
    const failed = await service.markNotificationFailed(
      failedJob.id,
      "Expo delivery failed."
    );

    expect(sent).toMatchObject({
      id: sentJob.id,
      status: "sent",
      lastError: undefined
    });
    expect(sent.sentAt).toBeDefined();
    expect(failed).toMatchObject({
      id: failedJob.id,
      status: "failed",
      attempts: 1,
      lastError: "Expo delivery failed."
    });
    await expect(service.listQueuedNotifications()).resolves.toEqual([]);
  });
});

function createProposal(id: string, recipientId: string): SwitchProposal {
  const now = "2026-05-28T00:00:00.000Z";

  return {
    id,
    sessionId: "notify-session",
    fromProvider: "messenger",
    toProvider: "discord",
    reason: "streaming",
    requesterId: "notify-u1",
    recipientId,
    status: "proposed",
    acceptedBy: ["notify-u1"],
    joinConfirmations: [],
    expiresAt: "2026-05-28T00:02:00.000Z",
    createdAt: now,
    updatedAt: now
  };
}

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
