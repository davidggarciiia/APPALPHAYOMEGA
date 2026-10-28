import { Controller, Get, Module } from "@nestjs/common"
import { NestFactory } from "@nestjs/core"
import type { NestExpressApplication } from "@nestjs/platform-express"
import request from "supertest"
import { configurarCuerposHttp } from "./http.js"

@Controller()
class ControladorDePrueba {
  @Get()
  leer(): { estado: string } {
    return { estado: "ok" }
  }
}
@Module({ controllers: [ControladorDePrueba] })
class ModuloDePrueba {}

describe("cabeceras HTTP sin base de datos ni proveedores", () => {
  let app: NestExpressApplication
  const previo = process.env.API_PROXIES_CONFIABLES
  beforeEach(async () => {
    process.env.API_PROXIES_CONFIABLES = "127.0.0.1/32,::1/128"
    app = await NestFactory.create<NestExpressApplication>(ModuloDePrueba, { logger: false })
    configurarCuerposHttp(app)
    await app.init()
  })
  afterEach(async () => {
    await app.close()
    if (previo === undefined) delete process.env.API_PROXIES_CONFIABLES
    else process.env.API_PROXIES_CONFIABLES = previo
  })

  it("protege respuestas correctas y errores, incluso JSON malformado", async () => {
    const respuestas = [
      await request(app.getHttpServer()).get("/"),
      await request(app.getHttpServer()).get("/inexistente"),
      await request(app.getHttpServer())
        .post("/")
        .set("Content-Type", "application/json")
        .send("{"),
    ]
    expect(respuestas.map((r) => r.status)).toEqual([200, 404, 400])
    for (const respuesta of respuestas) {
      expect(respuesta.headers["x-content-type-options"]).toBe("nosniff")
      expect(respuesta.headers["x-frame-options"]).toBe("DENY")
      expect(respuesta.headers["referrer-policy"]).toBe("no-referrer")
      expect(respuesta.headers["content-security-policy"]).toContain("default-src 'none'")
      expect(respuesta.headers["cache-control"]).toBe("no-store")
      expect(respuesta.headers["x-powered-by"]).toBeUndefined()
      expect(respuesta.headers["strict-transport-security"]).toBeUndefined()
    }
  })

  it("emite HSTS tras HTTPS indicado por un proxy confiable", async () => {
    const respuesta = await request(app.getHttpServer()).get("/").set("X-Forwarded-Proto", "https")
    expect(respuesta.headers["strict-transport-security"]).toBe("max-age=31536000")
  })
})
