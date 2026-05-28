import { Global, Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { ExpoNotificationSender } from "./expo-notification-sender";
import { NOTIFICATION_SENDER } from "./notification-sender";
import { NotificationsService } from "./notifications.service";
import { NotificationsWorker } from "./notifications.worker";

@Global()
@Module({
  imports: [PrismaModule],
  providers: [
    ExpoNotificationSender,
    NotificationsService,
    NotificationsWorker,
    {
      provide: NOTIFICATION_SENDER,
      useExisting: ExpoNotificationSender
    }
  ],
  exports: [NotificationsService, NotificationsWorker]
})
export class NotificationsModule {}
