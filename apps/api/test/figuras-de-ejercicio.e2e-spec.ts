import { mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import type { INestApplication } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import {
  EjercicioSchema,
  ErrorDeApiSchema,
  ListadoEjerciciosSchema,
  ListadoMediosSchema,
  ROLES,
  type Ejercicio,
  type Rol,
} from "@alpha-omega/shared"
import request from "supertest"

import { AppModule } from "../src/app.module.js"
import { cifrarContrasena } from "../src/identity/contrasenas.js"
import { PrismaService } from "../src/prisma/prisma.service.js"

const SUFIJO = "@e2e-figuras.test"
const CONTRASENA = "contrasena-de-prueba-figuras"
const PREFIJO = "e2e-figuras"
const ID_QUE_NO_EXISTE = "3f2b8c1e-4d5a-4f6b-8a9c-0d1e2f3a4bfe"

/** Bytes falsos: la API no mira dentro del archivo, solo lo sirve. */
const VIDEO = Buffer.from("video-de-prueba-0123456789")
const POSTER = Buffer.from("poster-de-prueba")

/** Supertest solo acumula el cuerpo de tipos que conoce; un MP4 hay que pedirlo. */
function binario(
  respuesta: request.Response,
  alTerminar: (error: Error | null, cuerpo: Buffer) => void,
): void {
  // En Node, superagent pasa aquí el flujo de la respuesta HTTP sin leer.
  const flujo = respuesta as unknown as NodeJS.ReadableStream
  const trozos: Buffer[] = []
  flujo.on("data", (trozo: Buffer) => trozos.push(trozo))
  flujo.on("end", () => alTerminar(null, Buffer.concat(trozos)))
}

describe("Figuras de ejercicio", () => {
  let app: INestApplication
  let prisma: PrismaService
  let carpeta: string
  const anterior = process.env.MEDIOS_DIR
  const tokens = new Map<Rol, string>()

  function como(rol: Rol): { Authorization: string } {
    return { Authorization: `Bearer ${tokens.get(rol) ?? ""}` }
  }

  function importar(medioId: string): void {
    writeFileSync(join(carpeta, "figuras", `${medioId}.mp4`), VIDEO)
    writeFileSync(join(carpeta, "figuras", `${medioId}.jpg`), POSTER)
  }

  async function ejercicio(nombre: string): Promise<Ejercicio> {
    const respuesta = await request(app.getHttpServer())
      .post("/ejercicios")
      .set(como("entrenador"))
      .send({
        nombre: `${PREFIJO} ${nombre}`,
        grupoPrincipal: "cuadriceps",
        gruposSecundarios: [],
        instrucciones: "Baja controlando.",
      })
      .expect(201)
    return EjercicioSchema.parse(respuesta.body)
  }

  /** Sin `async`: devolver el Test sin esperarlo deja encadenar `.expect(...)`. */
  function asignar(id: string, medioId: string | null): request.Test {
    return request(app.getHttpServer())
      .put(`/ejercicios/${id}/figura`)
      .set(como("entrenador"))
      .send({ medioId })
  }

  async function limpiar(): Promise<void> {
    const donde = { nombreNormalizado: { startsWith: PREFIJO } }
    await prisma.contenidoDeEjercicio.deleteMany({ where: { ejercicio: donde } })
    await prisma.ejercicio.deleteMany({ where: donde })
  }

  beforeAll(async () => {
    carpeta = mkdtempSync(join(tmpdir(), "ao-figuras-"))
    mkdirSync(join(carpeta, "figuras"))
    process.env.MEDIOS_DIR = carpeta

    const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = modulo.createNestApplication()
    await app.init()

    prisma = app.get(PrismaService)
    await prisma.usuario.deleteMany({ where: { email: { endsWith: SUFIJO } } })
    await limpiar()

    const passwordHash = await cifrarContrasena(CONTRASENA)
    for (const rol of ROLES) {
      const email = `${rol}${SUFIJO}`
      await prisma.usuario.create({
        data: { email, nombre: rol, passwordHash, rol, estado: "activo" },
      })
      const login = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email, contrasena: CONTRASENA })
        .expect(200)
      tokens.set(rol, login.body.tokenAcceso)
    }
  })

  beforeEach(() => {
    rmSync(join(carpeta, "figuras"), { recursive: true, force: true })
    mkdirSync(join(carpeta, "figuras"))
    importar("vital-0054")
    importar("movekit-pull-ups")
  })

  afterEach(limpiar)

  afterAll(async () => {
    await prisma.usuario.deleteMany({ where: { email: { endsWith: SUFIJO } } })
    await app.close()
    rmSync(carpeta, { recursive: true, force: true })
    if (anterior === undefined) delete process.env.MEDIOS_DIR
    else process.env.MEDIOS_DIR = anterior
  })

  describe("índice de medios", () => {
    it("el entrenador ve solo las figuras importadas en este servidor", async () => {
      const respuesta = await request(app.getHttpServer())
        .get("/ejercicios/medios")
        .set(como("entrenador"))
        .expect(200)

      const listado = ListadoMediosSchema.parse(respuesta.body)
      expect(listado.total).toBe(2)
      expect(listado.medios).toEqual([
        expect.objectContaining({ id: "vital-0054", fuente: "vital", sinConexion: true }),
        expect.objectContaining({ id: "movekit-pull-ups", fuente: "movekit", sinConexion: false }),
      ])
    })

    it("nadie más lo consulta", async () => {
      const servidor = app.getHttpServer()
      await request(servidor).get("/ejercicios/medios").expect(401)
      for (const rol of ["cliente", "nutricionista", "empleado"] as const) {
        await request(servidor).get("/ejercicios/medios").set(como(rol)).expect(403)
      }
    })
  })

  describe("asignar y quitar", () => {
    it("asocia una figura y la ficha, la búsqueda y el cliente la ven", async () => {
      const sentadilla = await ejercicio("sentadilla")

      const respuesta = await asignar(sentadilla.id, "vital-0054").expect(200)

      const figura = {
        medioId: "vital-0054",
        version: "1",
        origen: "licenciado",
        licencia: "Vital Animations EULA 2026.1 · paquete gratuito",
        sinConexion: true,
      }
      expect(EjercicioSchema.parse(respuesta.body).figura).toEqual(figura)
      const ficha = await request(app.getHttpServer())
        .get(`/ejercicios/${sentadilla.id}`)
        .set(como("cliente"))
        .expect(200)
      expect(EjercicioSchema.parse(ficha.body).figura).toEqual(figura)
      const busqueda = await request(app.getHttpServer())
        .get("/ejercicios")
        .query({ buscar: `${PREFIJO} sentadilla` })
        .set(como("cliente"))
        .expect(200)
      expect(ListadoEjerciciosSchema.parse(busqueda.body).ejercicios[0]?.figura).toEqual(figura)
    })

    it("cambiar de figura sustituye la anterior y `null` la quita, también repetido", async () => {
      const dominadas = await ejercicio("dominadas")
      await asignar(dominadas.id, "vital-0054").expect(200)

      const cambio = await asignar(dominadas.id, "movekit-pull-ups").expect(200)
      expect(EjercicioSchema.parse(cambio.body).figura).toMatchObject({
        medioId: "movekit-pull-ups",
        sinConexion: false,
      })
      expect(
        await prisma.contenidoDeEjercicio.count({ where: { ejercicioId: dominadas.id } }),
      ).toBe(1)

      const sinFigura = await asignar(dominadas.id, null).expect(200)
      expect(EjercicioSchema.parse(sinFigura.body).figura).toBeNull()
      await asignar(dominadas.id, null).expect(200)
    })

    it("rechaza medios fuera del índice o no importados, y formatos que no son un id", async () => {
      const prensa = await ejercicio("prensa")

      for (const medioId of ["vital-9999", "vital-0074"]) {
        const respuesta = await asignar(prensa.id, medioId).expect(409)
        expect(ErrorDeApiSchema.parse(respuesta.body).codigo).toBe("operacion_incompatible")
      }
      for (const medioId of ["../../etc/passwd", "https://ejemplo.test/a.mp4", ""]) {
        const respuesta = await asignar(prensa.id, medioId).expect(400)
        expect(ErrorDeApiSchema.parse(respuesta.body).codigo).toBe("solicitud_invalida")
      }
      await asignar(ID_QUE_NO_EXISTE, "vital-0054").expect(404)
    })

    it("solo el entrenador asigna", async () => {
      const zancada = await ejercicio("zancada")
      const servidor = app.getHttpServer()

      await request(servidor)
        .put(`/ejercicios/${zancada.id}/figura`)
        .send({ medioId: "vital-0054" })
        .expect(401)
      for (const rol of ["cliente", "nutricionista", "empleado"] as const) {
        await request(servidor)
          .put(`/ejercicios/${zancada.id}/figura`)
          .set(como(rol))
          .send({ medioId: "vital-0054" })
          .expect(403)
      }
      expect(await prisma.contenidoDeEjercicio.count({ where: { ejercicioId: zancada.id } })).toBe(
        0,
      )
    })
  })

  describe("servir el archivo", () => {
    it("el cliente recibe el vídeo entero, privado y sin caché compartida", async () => {
      const sentadilla = await ejercicio("sentadilla video")
      await asignar(sentadilla.id, "vital-0054").expect(200)

      const respuesta = await request(app.getHttpServer())
        .get(`/ejercicios/${sentadilla.id}/figura`)
        .set(como("cliente"))
        .buffer(true)
        .parse(binario)
        .expect(200)

      expect(respuesta.headers["content-type"]).toMatch(/^video\/mp4/)
      expect(respuesta.headers["cache-control"]).toBe("private, max-age=86400")
      expect(Buffer.compare(respuesta.body as Buffer, VIDEO)).toBe(0)
    })

    it("admite rangos, que es como piden los reproductores", async () => {
      const sentadilla = await ejercicio("sentadilla rango")
      await asignar(sentadilla.id, "vital-0054").expect(200)

      const parcial = await request(app.getHttpServer())
        .get(`/ejercicios/${sentadilla.id}/figura`)
        .set(como("entrenador"))
        .set("Range", "bytes=0-4")
        .buffer(true)
        .parse(binario)
        .expect(206)
      expect(parcial.headers["content-range"]).toBe(`bytes 0-4/${String(VIDEO.length)}`)
      expect((parcial.body as Buffer).toString()).toBe("video")

      await request(app.getHttpServer())
        .get(`/ejercicios/${sentadilla.id}/figura`)
        .set(como("entrenador"))
        .set("Range", `bytes=${String(VIDEO.length + 10)}-`)
        .expect(416)
    })

    it("sirve el póster como imagen", async () => {
      const sentadilla = await ejercicio("sentadilla poster")
      await asignar(sentadilla.id, "vital-0054").expect(200)

      const respuesta = await request(app.getHttpServer())
        .get(`/ejercicios/${sentadilla.id}/figura/poster`)
        .set(como("cliente"))
        .buffer(true)
        .parse(binario)
        .expect(200)
      expect(respuesta.headers["content-type"]).toMatch(/^image\/jpeg/)
      expect(Buffer.compare(respuesta.body as Buffer, POSTER)).toBe(0)
    })

    it("un ejercicio retirado sigue enseñando su figura en el histórico", async () => {
      const remo = await ejercicio("remo retirado")
      await asignar(remo.id, "movekit-pull-ups").expect(200)
      await request(app.getHttpServer())
        .post(`/ejercicios/${remo.id}/retirar`)
        .set(como("entrenador"))
        .expect(200)

      await request(app.getHttpServer())
        .get(`/ejercicios/${remo.id}/figura`)
        .set(como("cliente"))
        .expect(200)
    })

    it("404 sin figura, sin ejercicio o si el archivo ya no está", async () => {
      const servidor = app.getHttpServer()
      const sinFigura = await ejercicio("sin figura")
      await request(servidor)
        .get(`/ejercicios/${sinFigura.id}/figura`)
        .set(como("cliente"))
        .expect(404)
      await request(servidor)
        .get(`/ejercicios/${sinFigura.id}/figura/poster`)
        .set(como("cliente"))
        .expect(404)
      await request(servidor)
        .get(`/ejercicios/${ID_QUE_NO_EXISTE}/figura`)
        .set(como("cliente"))
        .expect(404)

      const borrado = await ejercicio("archivo borrado")
      await asignar(borrado.id, "vital-0054").expect(200)
      unlinkSync(join(carpeta, "figuras", "vital-0054.mp4"))
      await request(servidor)
        .get(`/ejercicios/${borrado.id}/figura`)
        .set(como("cliente"))
        .expect(404)
    })

    it("el nutricionista, el empleado y quien no tiene sesión no lo reciben", async () => {
      const sentadilla = await ejercicio("sentadilla privada")
      await asignar(sentadilla.id, "vital-0054").expect(200)
      const servidor = app.getHttpServer()

      await request(servidor).get(`/ejercicios/${sentadilla.id}/figura`).expect(401)
      await request(servidor).get(`/ejercicios/${sentadilla.id}/figura/poster`).expect(401)
      for (const rol of ["nutricionista", "empleado"] as const) {
        await request(servidor)
          .get(`/ejercicios/${sentadilla.id}/figura`)
          .set(como(rol))
          .expect(403)
        await request(servidor)
          .get(`/ejercicios/${sentadilla.id}/figura/poster`)
          .set(como(rol))
          .expect(403)
      }
    })
  })
})
