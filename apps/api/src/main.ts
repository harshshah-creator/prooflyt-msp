import { config } from "dotenv";
import { resolve } from "node:path";
config({ path: resolve(import.meta.dirname, "../../../.env") });
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";
import { json } from "express";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });
  app.use(json({ limit: "2mb" }));
  app.setGlobalPrefix("");

  const port = Number(process.env.PORT || 4010);
  await app.listen(port);
  console.log(`Prooflyt MSP API listening on http://127.0.0.1:${port}`);
}

bootstrap();
