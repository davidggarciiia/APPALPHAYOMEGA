import type { NestExpressApplication } from "@nestjs/platform-express"

/** Admite el patrón máximo, incluidas indicaciones UTF-8, sin cuerpos ilimitados. */
export function configurarCuerposHttp(app: NestExpressApplication): void {
  app.useBodyParser("json", { limit: "8mb" })
}
