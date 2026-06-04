import { BadRequestException, Injectable } from "@nestjs/common";
import { Device, NotificationJob as DbNotificationJob, Prisma } from "@prisma/client";
import { SwitchProposal } from "@syncthia/shared";
import { PrismaService } from "../prisma/prisma.service";

export type NotificationJobType =
  | "switch.proposed"
  | "switch.launching"
  | "switch.expired";

export type NotificationJobStatus = "queued" | "sent" | "failed";

export const MAX_NOTIFICATION_ATTEMPTS = 3;

const NOTIFICATION_RETRY_DELAYS_MS = [60_000, 5 * 60_000] as const;

export interface RegisterDeviceInput {
  userId: string;
  pushToken: string;
  platform: "ios" | "android";
}

export interface DeviceRecord {
  id: string;
  userId: string;
  pushToken: string;
  platform: "ios" | "android";
  createdAt: string;
  updatedAt: string;
}

export interface NotificationJob {
  id: string;
  recipientId: string;
  type: NotificationJobType;
  proposalId: string;
  deviceCount: number;
  payload: Prisma.JsonValue;
  status: NotificationJobStatus;
  attempts: number;
  lastError?: string;
  nextAttemptAt?: string;
  sentAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface QueuedNotificationDelivery {
  job: NotificationJob;
  devices: DeviceRecord[];
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async registerDevice(dto: RegisterDeviceInput): Promise<DeviceRecord> {
    const userId = dto.userId.trim();
    const pushToken = dto.pushToken.trim();
    if (!userId || !pushToken) {
      throw new BadRequestException("User id and push token are required.");
    }

    await this.ensureUser(userId);

    const device = await this.prisma.device.upsert({
      where: {
        userId_pushToken: {
          userId,
          pushToken
        }
      },
      update: {
        platform: dto.platform
      },
      create: {
        userId,
        pushToken,
        platform: dto.platform
      }
    });

    return toDeviceRecord(device);
  }

  async queueSwitchNotification(
    recipientId: string,
    type: NotificationJobType,
    proposal: SwitchProposal
  ): Promise<NotificationJob> {
    const normalizedRecipientId = recipientId.trim();
    if (!normalizedRecipientId) {
      throw new BadRequestException("Recipient id is required.");
    }

    await this.ensureUser(normalizedRecipientId);
    const deviceCount = await this.prisma.device.count({
      where: { userId: normalizedRecipientId }
    });
    const job = await this.prisma.notificationJob.create({
      data: {
        recipientId: normalizedRecipientId,
        type,
        proposalId: proposal.id,
        deviceCount,
        payload: proposal as unknown as Prisma.InputJsonValue
      }
    });

    return toNotificationJob(job);
  }

  async listQueuedNotifications(limit = 25): Promise<QueuedNotificationDelivery[]> {
    const now = new Date();
    const jobs = await this.prisma.notificationJob.findMany({
      where: {
        status: "queued",
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }]
      },
      orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }],
      take: Math.max(1, Math.min(limit, 100))
    });
    const recipientIds = [...new Set(jobs.map((job) => job.recipientId))];
    const devices = await this.prisma.device.findMany({
      where: {
        userId: {
          in: recipientIds
        }
      },
      orderBy: { createdAt: "asc" }
    });
    const devicesByUser = new Map<string, DeviceRecord[]>();

    for (const device of devices) {
      const records = devicesByUser.get(device.userId) ?? [];
      records.push(toDeviceRecord(device));
      devicesByUser.set(device.userId, records);
    }

    return jobs.map((job) => ({
      job: toNotificationJob(job),
      devices: devicesByUser.get(job.recipientId) ?? []
    }));
  }

  async getNextQueuedNotificationDueAt(): Promise<string | undefined> {
    const immediateJob = await this.prisma.notificationJob.findFirst({
      where: {
        status: "queued",
        nextAttemptAt: null
      },
      select: { id: true }
    });
    if (immediateJob) {
      return new Date().toISOString();
    }

    const delayedJob = await this.prisma.notificationJob.findFirst({
      where: {
        status: "queued",
        nextAttemptAt: { not: null }
      },
      orderBy: { nextAttemptAt: "asc" },
      select: { nextAttemptAt: true }
    });

    return delayedJob?.nextAttemptAt?.toISOString();
  }

  async markNotificationSent(jobId: string): Promise<NotificationJob> {
    const job = await this.prisma.notificationJob.update({
      where: { id: jobId },
      data: {
        status: "sent",
        sentAt: new Date(),
        lastError: null,
        nextAttemptAt: null
      }
    });

    return toNotificationJob(job);
  }

  async markNotificationFailed(
    jobId: string,
    errorMessage: string
  ): Promise<NotificationJob> {
    const existing = await this.prisma.notificationJob.findUniqueOrThrow({
      where: { id: jobId }
    });
    const attempts = existing.attempts + 1;
    const shouldRetry = attempts < MAX_NOTIFICATION_ATTEMPTS;
    const retryDelayMs =
      NOTIFICATION_RETRY_DELAYS_MS[
        Math.min(attempts - 1, NOTIFICATION_RETRY_DELAYS_MS.length - 1)
      ];
    const job = await this.prisma.notificationJob.update({
      where: { id: jobId },
      data: {
        status: shouldRetry ? "queued" : "failed",
        attempts,
        lastError: errorMessage.slice(0, 1_000),
        nextAttemptAt: shouldRetry ? new Date(Date.now() + retryDelayMs) : null
      }
    });

    return toNotificationJob(job);
  }

  private async ensureUser(userId: string) {
    await this.prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: {
        id: userId,
        displayName: userId
      }
    });
  }
}

function toDeviceRecord(device: Device): DeviceRecord {
  return {
    id: device.id,
    userId: device.userId,
    pushToken: device.pushToken,
    platform: device.platform as DeviceRecord["platform"],
    createdAt: device.createdAt.toISOString(),
    updatedAt: device.updatedAt.toISOString()
  };
}

function toNotificationJob(job: DbNotificationJob): NotificationJob {
  return {
    id: job.id,
    recipientId: job.recipientId,
    type: job.type as NotificationJob["type"],
    proposalId: job.proposalId,
    deviceCount: job.deviceCount,
    payload: job.payload,
    status: job.status as NotificationJobStatus,
    attempts: job.attempts,
    lastError: job.lastError ?? undefined,
    nextAttemptAt: job.nextAttemptAt?.toISOString(),
    sentAt: job.sentAt?.toISOString(),
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString()
  };
}
