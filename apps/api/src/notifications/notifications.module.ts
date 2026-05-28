import { Global, Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import {
  NOTIFICATION_SENDER,
  UnconfiguredNotificationSender
} from "./notification-sender";
import { NotificationsService } from "./notifications.service";
import { NotificationsWorker } from "./notifications.worker";

@Global()
@Module({
  imports: [PrismaModule],
  providers: [
    NotificationsService,
    NotificationsWorker,
    {
      provide: NOTIFICATION_SENDER,
      useClass: UnconfiguredNotificationSender
    }
  ],
  exports: [NotificationsService, NotificationsWorker]
})
export class NotificationsModule {}
