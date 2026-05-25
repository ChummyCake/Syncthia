import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { PrismaModule } from "../prisma/prisma.module";
import { PrismaSessionsRepository } from "./prisma-sessions.repository";
import { SessionEventsGateway } from "./session-events.gateway";
import { SessionsController } from "./sessions.controller";
import { SessionsService } from "./sessions.service";
import { SESSIONS_REPOSITORY } from "./sessions.repository";

@Module({
  imports: [NotificationsModule, PrismaModule],
  controllers: [SessionsController],
  providers: [
    SessionEventsGateway,
    SessionsService,
    PrismaSessionsRepository,
    {
      provide: SESSIONS_REPOSITORY,
      useExisting: PrismaSessionsRepository
    }
  ],
  exports: [SessionsService]
})
export class SessionsModule {}
