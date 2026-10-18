import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { ScraperService } from "./scraper/scraper.service";
import { SubtitleSyncService } from "./subtitles/subtitle-sync.service";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [AppController],
  providers: [ScraperService, SubtitleSyncService],
})
export class AppModule {}
