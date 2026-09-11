import type { INestApplication } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import request from "supertest"

import { AppModule } from "../src/app.module.js"

/**
 * Test de extremo a extremo: arranca la aplicacion de verdad y la golpea por
 * HTTP. No usa dobles. Si la base de datos no esta levantada, este test falla,
 * y eso es correcto: su trabajo es demostrar que las piezas encajan de verdad.
 */
describe("GET /salud", () => {
  let app: INestApplication

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = modulo.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it("responde 200 y confirma que la base de datos contesta", async () => {
    const respuesta = await request(app.getHttpServer()).get("/salud").expect(200)

    expect(respuesta.body).toEqual({ estado: "ok", baseDeDatos: "ok" })
  })
})
