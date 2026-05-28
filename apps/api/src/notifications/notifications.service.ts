import { BadRequestException, Injectable } from "@nestjs/common";
import { Device, NotificationJob as DbNotificationJob, Prisma } from "@prisma/client";
import { SwitchProposal } from "@syncthia/shared";
import { PrismaService } from "../prisma/prisma.service";

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
  type: "switch.proposed" | "switch.launching" | "switch.expired";
  proposalId: string;
  deviceCount: number;
  status: string;
  createdAt: string;
  updatedAt: string;
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
    type: NotificationJob["type"],
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
    status: job.status,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString()
  };
}
