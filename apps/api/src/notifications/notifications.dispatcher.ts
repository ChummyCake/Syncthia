import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { NotificationsWorker } from "./notifications.worker";

@Injectable()
export class NotificationsDispatcher implements OnModuleInit {
  private readonly logger = new Logger(NotificationsDispatcher.name);
  private activeDrain?: Promise<void>;
  private drainAgain = false;

  constructor(private readonly worker: NotificationsWorker) {}

  onModuleInit() {
    void this.requestDrain();
  }

  requestDrain(limit = 25): Promise<void> {
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
      }
    }
  }
}
