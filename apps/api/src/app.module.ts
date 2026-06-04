import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { HealthController } from "./health.controller";
import { MeModule } from "./me/me.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { RateLimitModule } from "./rate-limit/rate-limit.module";
import { SessionsModule } from "./sessions/sessions.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    RateLimitModule,
    NotificationsModule,
    SessionsModule,
    MeModule
  ],
  controllers: [HealthController]
})
export class AppModule {}
