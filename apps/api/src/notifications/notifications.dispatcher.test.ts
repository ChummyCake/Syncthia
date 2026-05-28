import { Logger } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { NotificationsDispatcher } from "./notifications.dispatcher";
import type { NotificationsWorker } from "./notifications.worker";

describe("NotificationsDispatcher", () => {
  it("drains queued notification jobs on demand", async () => {
    const worker = {
      processQueuedJobs: vi.fn(async () => ({
        processed: 1,
        sent: 1,
        failed: 0
      }))
    } as unknown as NotificationsWorker;
    const dispatcher = new NotificationsDispatcher(worker);

    await dispatcher.requestDrain(10);

    expect(worker.processQueuedJobs).toHaveBeenCalledWith(10);
  });

  it("does not reject callers when draining fails", async () => {
    const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
    const worker = {
      processQueuedJobs: vi.fn(async () => {
        throw new Error("Expo delivery failed.");
      })
    } as unknown as NotificationsWorker;
    const dispatcher = new NotificationsDispatcher(worker);

    await expect(dispatcher.requestDrain()).resolves.toBeUndefined();
    warn.mockRestore();
  });

  it("runs a follow-up drain when a request arrives during active work", async () => {
    let finishDrain: (() => void) | undefined;
    let drainCount = 0;
    const worker = {
      processQueuedJobs: vi.fn(
        () => {
          drainCount += 1;
          if (drainCount > 1) {
            return Promise.resolve({ processed: 0, sent: 0, failed: 0 });
          }

          return new Promise((resolve) => {
            finishDrain = () => resolve({ processed: 0, sent: 0, failed: 0 });
          });
        }
      )
    } as unknown as NotificationsWorker;
    const dispatcher = new NotificationsDispatcher(worker);

    const firstDrain = dispatcher.requestDrain();
    void dispatcher.requestDrain();
    expect(worker.processQueuedJobs).toHaveBeenCalledTimes(1);

    finishDrain?.();
    await firstDrain;
    await vi.waitFor(() => {
      expect(worker.processQueuedJobs).toHaveBeenCalledTimes(2);
    });
  });
});
