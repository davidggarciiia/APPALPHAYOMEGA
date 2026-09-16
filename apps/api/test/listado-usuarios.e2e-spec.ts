import type { INestApplication } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import type { EstadoUsuario, Rol } from "@alpha-omega/shared"
import { ROLES } from "@alpha-omega/shared"
import request from "supertest"

import { AppModule } from "../src/app.module.js"
import { cifrarContrasena } from "../src/identity/contrasenas.js"
import { PrismaService } from "../src/prisma/prisma.service.js"

const SUFIJO = "@e2e-listado.test"
const CONTRASENA = "contrasena-de-prueba-listado"

/** La cartera de prueba: gente con tildes, estados distintos y roles distintos. */
const CARTERA: ReadonlyArray<{
  nombre: string
  apellidos: string | null
  rol: Rol
  estado: EstadoUsuario
}> = [
  { nombre: "Ana", apellidos: "García Ruiz", rol: "cliente", estado: "activo" },
  { nombre: "Luis", apellidos: "Pérez", rol: "cliente", estado: "pendiente" },
  { nombre: "Marta", apellidos: "Soler", rol: "cliente", estado: "desactivado" },
  { nombre: "Nuria", apellidos: null, rol: "nutricionista", estado: "activo" },
  { nombre: "Óscar", apellidos: "Iglesias", rol: "empleado", estado: "activo" },
]

describe("Listado de la cartera", () => {
  let app: INestApplication
  let prisma: PrismaService
  const tokens = new Map<Rol, string>()

  function listar(rol: Rol, consulta = ""): request.Test {
    return request(app.getHttpServer())
      .get(`/usuarios${consulta}`)
      .set("Authorization", `Bearer ${tokens.get(rol) ?? ""}`)
  }

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = modulo.createNestApplication()
    await app.init()
    prisma = app.get(PrismaService)

    await prisma.usuario.deleteMany({ where: { email: { endsWith: SUFIJO } } })
    const passwordHash = await cifrarContrasena(CONTRASENA)

    // Una cuenta activa por rol, para comprobar quien puede listar.
    for (const rol of ROLES) {
      const email = `admin-${rol}${SUFIJO}`
      await prisma.usuario.create({
        data: { email, nombre: `Admin ${rol}`, passwordHash, rol, estado: "activo" },
      })

      const login = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email, contrasena: CONTRASENA })
        .expect(200)

      tokens.set(rol, login.body.tokenAcceso)
    }

    for (const persona of CARTERA) {
      await prisma.usuario.create({
        data: {
          email: `${persona.nombre.toLowerCase()}${SUFIJO}`,
          nombre: persona.nombre,
          apellidos: persona.apellidos,
          passwordHash,
          rol: persona.rol,
          estado: persona.estado,
        },
      })
    }
  })

  afterAll(async () => {
    await prisma.usuario.deleteMany({ where: { email: { endsWith: SUFIJO } } })
    await app.close()
  })

  it("solo el entrenador puede listar", async () => {
    for (const rol of ROLES) {
      await listar(rol).expect(rol === "entrenador" ? 200 : 403)
    }
  })

  it("sin sesion no se lista nada", async () => {
    await request(app.getHttpServer()).get("/usuarios").expect(401)
  })

  it("devuelve la cartera con su total", async () => {
    const respuesta = await listar("entrenador").expect(200)

    expect(Array.isArray(respuesta.body.usuarios)).toBe(true)
    expect(typeof respuesta.body.total).toBe("number")
    expect(respuesta.body.total).toBeGreaterThanOrEqual(CARTERA.length)
  })

  it("no se incluye a si mismo en la lista", async () => {
    const respuesta = await listar("entrenador").expect(200)
    const correos: string[] = respuesta.body.usuarios.map((u: { email: string }) => u.email)

    // Verse en la propia cartera solo invita a desactivarse por error.
    expect(correos).not.toContain(`admin-entrenador${SUFIJO}`)
  })

  it("nunca devuelve el hash de la contrasena", async () => {
    const respuesta = await listar("entrenador").expect(200)

    expect(JSON.stringify(respuesta.body)).not.toContain("passwordHash")
    expect(JSON.stringify(respuesta.body)).not.toContain("argon2")
  })

  it("distingue los tres estados", async () => {
    const respuesta = await listar("entrenador", "?rol=cliente").expect(200)
    const nuestros = respuesta.body.usuarios.filter((u: { email: string }) =>
      u.email.endsWith(SUFIJO),
    )
    const estados = new Set(nuestros.map((u: { estado: string }) => u.estado))

    // Ver quien sigue pendiente es lo que el entrenador necesita para
    // perseguirlo, asi que los tres estados tienen que llegar a la pantalla.
    expect(estados).toContain("activo")
    expect(estados).toContain("pendiente")
    expect(estados).toContain("desactivado")
  })

  it("busca por nombre", async () => {
    const respuesta = await listar("entrenador", "?buscar=Ana").expect(200)
    const nombres = respuesta.body.usuarios.map((u: { nombre: string }) => u.nombre)

    expect(nombres).toContain("Ana")
    expect(nombres).not.toContain("Luis")
  })

  it("busca por apellidos y por correo", async () => {
    const porApellido = await listar("entrenador", "?buscar=Soler").expect(200)
    expect(porApellido.body.usuarios[0]?.nombre).toBe("Marta")

    const porCorreo = await listar("entrenador", "?buscar=nuria").expect(200)
    expect(porCorreo.body.usuarios[0]?.nombre).toBe("Nuria")
  })

  it("la busqueda ignora mayusculas", async () => {
    const respuesta = await listar("entrenador", "?buscar=mArTa").expect(200)

    expect(respuesta.body.usuarios[0]?.nombre).toBe("Marta")
  })

  it("filtra por rol", async () => {
    const respuesta = await listar("entrenador", "?rol=nutricionista").expect(200)
    const roles = new Set(respuesta.body.usuarios.map((u: { rol: string }) => u.rol))

    expect(roles).toEqual(new Set(["nutricionista"]))
  })

  it("filtra por estado", async () => {
    const respuesta = await listar("entrenador", "?estado=pendiente").expect(200)
    const estados = new Set(respuesta.body.usuarios.map((u: { estado: string }) => u.estado))

    expect(estados).toEqual(new Set(["pendiente"]))
  })

  it("el limite recorta pero el total sigue diciendo la verdad", async () => {
    const respuesta = await listar("entrenador", "?limite=2").expect(200)

    // Una lista cortada en silencio es de los fallos que mas tardan en
    // descubrirse. El total permite decir "mostrando 2 de 9".
    expect(respuesta.body.usuarios).toHaveLength(2)
    expect(respuesta.body.total).toBeGreaterThan(2)
  })

  it("rechaza filtros con la forma equivocada", async () => {
    await listar("entrenador", "?rol=jefe").expect(400)
    await listar("entrenador", "?estado=inventado").expect(400)
    await listar("entrenador", "?limite=0").expect(400)
    await listar("entrenador", "?limite=todos").expect(400)
    await listar("entrenador", "?limite=99999").expect(400)
  })

  it("una busqueda sin resultados devuelve una lista vacia, no un error", async () => {
    const respuesta = await listar("entrenador", "?buscar=nadiesellamaasi").expect(200)

    expect(respuesta.body.usuarios).toHaveLength(0)
    expect(respuesta.body.total).toBe(0)
  })
})
