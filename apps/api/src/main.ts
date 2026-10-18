import "./env";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { toNodeHandler } from "better-auth/node";
import { AppModule } from "./app.module";
import { auth } from "./auth/auth";
import { db } from "./db/database";
import { settings } from "./db/schema";
import { eq } from "drizzle-orm";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api");
  app.enableCors({
    origin: (process.env.CORS_ORIGIN ?? "http://localhost:5173").split(",").map((value) => value.trim()),
    credentials: true,
  });
  app.use("/api/auth/sign-up/email", async (request: { method?: string }, response: { status(code: number): { json(body: unknown): void } }, next: () => void) => {
    if (request.method !== "POST") return next();
    try {
      const [siteConfig] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, "site_config")).limit(1);
      const config = siteConfig?.value && typeof siteConfig.value === "object" ? siteConfig.value as Record<string, unknown> : {};
      if (config.allow_registrations === false) return response.status(403).json({ message: "Pendaftaran akun sedang ditutup." });
      next();
    } catch {
      response.status(503).json({ message: "Pendaftaran tidak tersedia saat ini." });
    }
  });
  app.use("/api/auth", toNodeHandler(auth));
  await app.listen(Number(process.env.PORT ?? 3000), "0.0.0.0");
}

void bootstrap();
