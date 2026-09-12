import { Controller, Get, Param, UseGuards, type INestApplication } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import type { Rol } from "@alpha-omega/shared"
import request from "supertest"

import { AppModule } from "../src/app.module.js"
import { AlcanceClienteGuard } from "../src/identity/alcance-cliente.guard.js"
import { cifrarContrasena } from "../src/identity/contrasenas.js"
import { Roles } from "../src/identity/roles.decorator.js"
import { PrismaService } from "../src/prisma/prisma.service.js"

const SUFIJO = "@e2e-alcance.test"
const CONTRASENA = "contrasena-de-prueba-alcance"

/**
 * Ruta representativa de las que trataran datos de un cliente concreto: la
 * dieta, el peso, las medidas. El rol deja pasar al nutricionista, y el guard de
 * alcance decide sobre QUIEN.
 */
@Controller("clientes")
class ControladorDeCliente {
  @Roles("entrenador", "nutricionista", "cliente")
  @UseGuards(AlcanceClienteGuard)
  @Get(":clienteId/datos")
  datos(@Param("clienteId") clienteId: string): { clienteId: string } {
    return { clienteId }
  }
}

describe("Alcance por asignacion del nutricionista", () => {
  let app: INestApplication
  let prisma: PrismaService
  const tokens = new Map<string, string>()
  const ids = new Map<string, string>()

  async function crear(nombre: string, rol: Rol): Promise<void> {
    const email = `${nombre}${SUFIJO}`
    const creado = await prisma.usuario.create({
      data: {
        email,
        nombre,
        passwordHash: await cifrarContrasena(CONTRASENA),
        rol,
        estado: "activo",
      },
    })
    ids.set(nombre, creado.id)

    const login = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email, contrasena: CONTRASENA })
      .expect(200)

    tokens.set(nombre, login.body.tokenAcceso)
  }

  function pedir(quien: string, sobre: string): request.Test {
    return request(app.getHttpServer())
      .get(`/clientes/${ids.get(sobre) ?? "desconocido"}/datos`)
      .set("Authorization", `Bearer ${tokens.get(quien) ?? ""}`)
  }

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ControladorDeCliente],
    }).compile()

    app = modulo.createNestApplication()
    await app.init()

    prisma = app.get(PrismaService)
    await prisma.usuario.deleteMany({ where: { email: { endsWith: SUFIJO } } })

    await crear("entrenador", "entrenador")
    await crear("nutri", "nutricionista")
    await crear("ana", "cliente")
    await crear("luis", "cliente")

    // El nutricionista solo lleva a Ana.
    await prisma.asignacionNutricionista.create({
      data: {
        nutricionistaId: ids.get("nutri") ?? "",
        clienteId: ids.get("ana") ?? "",
      },
    })
  })

  afterAll(async () => {
    await prisma.usuario.deleteMany({ where: { email: { endsWith: SUFIJO } } })
    await app.close()
  })

  it("el entrenador accede a cualquiera de sus clientes", async () => {
    await pedir("entrenador", "ana").expect(200)
    await pedir("entrenador", "luis").expect(200)
  })

  it("un cliente accede a sus propios datos", async () => {
    await pedir("ana", "ana").expect(200)
  })

  it("un cliente NO accede a los datos de otro cliente", async () => {
    await pedir("ana", "luis").expect(403)
    await pedir("luis", "ana").expect(403)
  })

  it("el nutricionista accede al cliente que tiene asignado", async () => {
    const respuesta = await pedir("nutri", "ana").expect(200)

    expect(respuesta.body.clienteId).toBe(ids.get("ana"))
  })

  it("el nutricionista NO accede a un cliente que no tiene asignado", async () => {
    // Este es el caso que separa un producto de un incidente de proteccion de
    // datos: un profesional externo dentro de la misma app que los datos de
    // salud de personas que no son sus clientes.
    await pedir("nutri", "luis").expect(403)
  })

  it("retirar la asignacion corta el acceso en la siguiente peticion", async () => {
    await pedir("nutri", "ana").expect(200)

    await prisma.asignacionNutricionista.deleteMany({
      where: { nutricionistaId: ids.get("nutri") ?? "", clienteId: ids.get("ana") ?? "" },
    })

    await pedir("nutri", "ana").expect(403)

    // Se restituye para no dejar el estado tocado a los siguientes casos.
    await prisma.asignacionNutricionista.create({
      data: { nutricionistaId: ids.get("nutri") ?? "", clienteId: ids.get("ana") ?? "" },
    })
  })

  it("asignar dos veces no crea dos filas", async () => {
    const antes = await prisma.asignacionNutricionista.count({
      where: { nutricionistaId: ids.get("nutri") ?? "" },
    })

    await prisma.asignacionNutricionista.upsert({
      where: {
        nutricionistaId_clienteId: {
          nutricionistaId: ids.get("nutri") ?? "",
          clienteId: ids.get("ana") ?? "",
        },
      },
      create: { nutricionistaId: ids.get("nutri") ?? "", clienteId: ids.get("ana") ?? "" },
      update: {},
    })

    const despues = await prisma.asignacionNutricionista.count({
      where: { nutricionistaId: ids.get("nutri") ?? "" },
    })

    expect(despues).toBe(antes)
  })

  it("un cliente inexistente tambien deniega, sin delatar que no existe", async () => {
    await request(app.getHttpServer())
      .get("/clientes/00000000-0000-0000-0000-000000000000/datos")
      .set("Authorization", `Bearer ${tokens.get("nutri") ?? ""}`)
      .expect(403)
  })
})
