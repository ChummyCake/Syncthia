import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { NotificationsWorker } from "./notifications.worker";

@Injectable()
export class NotificationsDispatcher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationsDispatcher.name);
  private activeDrain?: Promise<void>;
  private drainAgain = false;
  private retryTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private readonly worker: NotificationsWorker,
    private readonly notifications: NotificationsService
  ) {}

  onModuleInit() {
    void this.requestDrain();
  }

  onModuleDestroy() {
    this.clearRetryTimer();
  }

  requestDrain(limit = 25): Promise<void> {
    this.clearRetryTimer();

    if (this.activeDrain) {
      this.drainAgain = true;
      return this.activeDrain;
    }

    this.activeDrain = this.runDrain(limit);
    return this.activeDrain;
  }

  private async runDrain(limit: number): Promise<void> {
    try {
      await this.worker.processQueuedJobs(limit);
    } catch (error) {
      this.logger.warn(
        error instanceof Error
          ? error.message
          : "Notification queue drain failed."
      );
    } finally {
      this.activeDrain = undefined;
      if (this.drainAgain) {
        this.drainAgain = false;
        void this.requestDrain(limit);
        return;
      }

      await this.scheduleNextDrain(limit);
    }
  }

  private async scheduleNextDrain(limit: number): Promise<void> {
    try {
      const nextDueAt = await this.notifications.getNextQueuedNotificationDueAt();
      if (!nextDueAt) {
        return;
      }

      const delayMs = Math.max(0, new Date(nextDueAt).getTime() - Date.now());
      const retryTimer = setTimeout(() => {
        void this.requestDrain(limit);
      }, delayMs);
      this.retryTimer = retryTimer;
      (retryTimer as unknown as { unref?: () => void }).unref?.();
    } catch (error) {
      this.logger.warn(
        error instanceof Error
          ? error.message
          : "Notification retry scheduling failed."
      );
    }
  }

  private clearRetryTimer() {
    if (!this.retryTimer) {
      return;
    }

    clearTimeout(this.retryTimer);
    this.retryTimer = undefined;
  }
}
