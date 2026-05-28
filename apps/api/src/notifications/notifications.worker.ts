import { Inject, Injectable } from "@nestjs/common";
import { NOTIFICATION_SENDER } from "./notification-sender";
import type { NotificationSender } from "./notification-sender";
import { NotificationsService } from "./notifications.service";

export interface NotificationWorkerResult {
  processed: number;
  sent: number;
  failed: number;
}

@Injectable()
export class NotificationsWorker {
  constructor(
    private readonly notifications: NotificationsService,
    @Inject(NOTIFICATION_SENDER)
    private readonly sender: NotificationSender
  ) {}

  async processQueuedJobs(limit = 25): Promise<NotificationWorkerResult> {
    const deliveries = await this.notifications.listQueuedNotifications(limit);
    const result: NotificationWorkerResult = {
      processed: deliveries.length,
      sent: 0,
      failed: 0
    };

    for (const delivery of deliveries) {
      try {
        await this.sender.send(delivery);
        await this.notifications.markNotificationSent(delivery.job.id);
        result.sent += 1;
      } catch (error) {
        await this.notifications.markNotificationFailed(
          delivery.job.id,
          error instanceof Error ? error.message : "Unknown notification error."
        );
        result.failed += 1;
      }
    }

    return result;
  }
}
