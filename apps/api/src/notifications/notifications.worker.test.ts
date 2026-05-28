import { describe, expect, it, vi } from "vitest";
import type { NotificationSender } from "./notification-sender";
import type {
  NotificationsService,
  QueuedNotificationDelivery
} from "./notifications.service";
import { NotificationsWorker } from "./notifications.worker";

describe("NotificationsWorker", () => {
  it("marks queued deliveries as sent after the sender succeeds", async () => {
    const deliveries = [createDelivery("job-1")];
    const notifications = {
      listQueuedNotifications: vi.fn(async () => deliveries),
      markNotificationSent: vi.fn(),
      markNotificationFailed: vi.fn()
    } as unknown as NotificationsService;
    const sender = {
      send: vi.fn(async () => undefined)
    } as unknown as NotificationSender;
    const worker = new NotificationsWorker(notifications, sender);

    const result = await worker.processQueuedJobs();

    expect(result).toEqual({ processed: 1, sent: 1, failed: 0 });
    expect(sender.send).toHaveBeenCalledWith(deliveries[0]);
    expect(notifications.markNotificationSent).toHaveBeenCalledWith("job-1");
    expect(notifications.markNotificationFailed).not.toHaveBeenCalled();
  });

  it("marks queued deliveries as failed after the sender throws", async () => {
    const deliveries = [createDelivery("job-2")];
    const notifications = {
      listQueuedNotifications: vi.fn(async () => deliveries),
      markNotificationSent: vi.fn(),
      markNotificationFailed: vi.fn()
    } as unknown as NotificationsService;
    const sender = {
      send: vi.fn(async () => {
        throw new Error("Expo delivery failed.");
      })
    } as unknown as NotificationSender;
    const worker = new NotificationsWorker(notifications, sender);

    const result = await worker.processQueuedJobs(10);

    expect(notifications.listQueuedNotifications).toHaveBeenCalledWith(10);
    expect(result).toEqual({ processed: 1, sent: 0, failed: 1 });
    expect(notifications.markNotificationSent).not.toHaveBeenCalled();
    expect(notifications.markNotificationFailed).toHaveBeenCalledWith(
      "job-2",
      "Expo delivery failed."
    );
  });
});

function createDelivery(jobId: string): QueuedNotificationDelivery {
  const now = "2026-05-28T00:00:00.000Z";

  return {
    job: {
      id: jobId,
      recipientId: "u2",
      type: "switch.proposed",
      proposalId: "proposal-1",
      deviceCount: 1,
      payload: { id: "proposal-1" },
      status: "queued",
      attempts: 0,
      createdAt: now,
      updatedAt: now
    },
    devices: [
      {
        id: "device-1",
        userId: "u2",
        pushToken: "ExponentPushToken[one]",
        platform: "ios",
        createdAt: now,
        updatedAt: now
      }
    ]
  };
}
