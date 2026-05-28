import { Global, Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { NotificationsService } from "./notifications.service";

@Global()
@Module({
  imports: [PrismaModule],
  providers: [NotificationsService],
  exports: [NotificationsService]
})
export class NotificationsModule {}
