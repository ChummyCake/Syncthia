import { Injectable } from "@nestjs/common";
import type { DeviceRecord, NotificationJob } from "./notifications.service";

export const NOTIFICATION_SENDER = Symbol("NOTIFICATION_SENDER");

export interface NotificationDelivery {
  job: NotificationJob;
  devices: DeviceRecord[];
}

export interface NotificationSender {
  send(delivery: NotificationDelivery): Promise<void>;
}

@Injectable()
export class UnconfiguredNotificationSender implements NotificationSender {
  async send(): Promise<void> {
    throw new Error("Notification sender is not configured.");
  }
}
