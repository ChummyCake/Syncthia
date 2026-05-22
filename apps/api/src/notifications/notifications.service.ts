import { Injectable } from "@nestjs/common";
import { SwitchProposal } from "@syncthia/shared";

interface RegisterDeviceInput {
  userId: string;
  pushToken: string;
  platform: "ios" | "android";
}

interface DeviceRecord {
  userId: string;
  pushToken: string;
  platform: "ios" | "android";
  updatedAt: string;
}

interface NotificationJob {
  recipientId: string;
  type: "switch.proposed" | "switch.launching" | "switch.expired";
  proposalId: string;
  deviceCount: number;
  createdAt: string;
}

@Injectable()
export class NotificationsService {
  private readonly devices = new Map<string, DeviceRecord>();
  private readonly jobs: NotificationJob[] = [];

  registerDevice(dto: RegisterDeviceInput) {
    const record: DeviceRecord = {
      userId: dto.userId,
      pushToken: dto.pushToken,
      platform: dto.platform,
      updatedAt: new Date().toISOString()
    };

    this.devices.set(`${dto.userId}:${dto.pushToken}`, record);
    return record;
  }

  queueSwitchNotification(
    recipientId: string,
    type: NotificationJob["type"],
    proposal: SwitchProposal
  ) {
    const deviceCount = this.getDevicesForUser(recipientId).length;
    const job: NotificationJob = {
      recipientId,
      type,
      proposalId: proposal.id,
      deviceCount,
      createdAt: new Date().toISOString()
    };

    this.jobs.push(job);
    return job;
  }

  private getDevicesForUser(userId: string) {
    return [...this.devices.values()].filter((device) => device.userId === userId);
  }
}
