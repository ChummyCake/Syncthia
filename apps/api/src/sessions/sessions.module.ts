import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { SessionEventsGateway } from "./session-events.gateway";
import { SessionsController } from "./sessions.controller";
import { SessionsService } from "./sessions.service";

@Module({
  imports: [NotificationsModule],
  controllers: [SessionsController],
  providers: [SessionEventsGateway, SessionsService],
  exports: [SessionsService]
})
export class SessionsModule {}
