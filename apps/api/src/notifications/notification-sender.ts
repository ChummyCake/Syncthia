import type { DeviceRecord, NotificationJob } from "./notifications.service";

export const NOTIFICATION_SENDER = Symbol("NOTIFICATION_SENDER");

export interface NotificationDelivery {
  job: NotificationJob;
  devices: DeviceRecord[];
}

export interface NotificationSender {
  send(delivery: NotificationDelivery): Promise<void>;
}
