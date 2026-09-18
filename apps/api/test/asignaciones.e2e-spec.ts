import { Controller, Get, Param, UseGuards, type INestApplication } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import type { Rol } from "@alpha-omega/shared"
import { ROLES } from "@alpha-omega/shared"
import request from "supertest"

import { AppModule } from "../src/app.module.js"
import { AlcanceClienteGuard } from "../src/identity/alcance-cliente.guard.js"
import { cifrarContrasena } from "../src/identity/contrasenas.js"
import { Roles } from "../src/identity/roles.decorator.js"
import { PrismaService } from "../src/prisma/prisma.service.js"

const SUFIJO = "@e2e-asignaciones.test"
const CONTRASENA = "contrasena-de-prueba-asignaciones"

/**
 * Ruta representativa de las que trataran datos de un cliente concreto: la
 * dieta, el peso, las medidas. Todavia no existe ninguna de verdad, pero la
 * regla que se comprueba aqui si es la definitiva: el rol deja pasar al
 * nutricionista y el guard de alcance decide sobre QUIEN.
 */
@Controller("clientes")
class DatosDeCliente {
  @Roles("entrenador", "nutricionista", "cliente")
  @UseGuards(AlcanceClienteGuard)
  @Get(":clienteId/datos")
  datos(@Param("clienteId") clienteId: string): { clienteId: string } {
    return { clienteId }
  }
}

describe("Asignacion de clientes al nutricionista", () => {
  let app: INestApplication
  let prisma: PrismaService
  const tokens = new Map<string, string>()
  const ids = new Map<string, string>()

  function como(quien: string): string {
    return `Bearer ${tokens.get(quien) ?? ""}`
  }

  function id(quien: string): string {
    return ids.get(quien) ?? "00000000-0000-4000-8000-000000000000"
  }

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

  function asignar(nutricionista: string, cliente: string): request.Test {
    return request(app.getHttpServer())
      .put(`/nutricionistas/${id(nutricionista)}/clientes/${id(cliente)}`)
      .set("Authorization", como("entrenador"))
  }

  function retirar(nutricionista: string, cliente: string): request.Test {
    return request(app.getHttpServer())
      .delete(`/nutricionistas/${id(nutricionista)}/clientes/${id(cliente)}`)
      .set("Authorization", como("entrenador"))
  }

  /**
   * Filtro para contar solo las filas de la gente de este fichero.
   *
   * La tabla de asignaciones es unica y otros ficheros de prueba escriben en
   * ella a la vez. Un recuento global convertiria este test en uno que depende
   * de quien mas se este ejecutando.
   */
  function mios(): { nutricionistaId: { in: string[] } } {
    return { nutricionistaId: { in: [id("elena"), id("otronutri"), id("ana")] } }
  }

  /** Lo que el nutricionista puede pedir de un cliente concreto. */
  function pedirDatos(quien: string, sobre: string): request.Test {
    return request(app.getHttpServer())
      .get(`/clientes/${id(sobre)}/datos`)
      .set("Authorization", como(quien))
  }

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [DatosDeCliente],
    }).compile()

    app = modulo.createNestApplication()
    await app.init()
    prisma = app.get(PrismaService)
  })

  beforeEach(async () => {
    await prisma.usuario.deleteMany({ where: { email: { endsWith: SUFIJO } } })
    tokens.clear()
    ids.clear()

    await crear("entrenador", "entrenador")
    await crear("elena", "nutricionista")
    await crear("otronutri", "nutricionista")
    await crear("ana", "cliente")
    await crear("luis", "cliente")
    await crear("informatico", "empleado")
  })

  afterAll(async () => {
    await prisma.usuario.deleteMany({ where: { email: { endsWith: SUFIJO } } })
    await app.close()
  })

  describe("repartir acceso", () => {
    it("solo el entrenador asigna y retira", async () => {
      for (const rol of ["cliente", "nutricionista", "empleado"] as const) {
        const quien = rol === "cliente" ? "ana" : rol === "nutricionista" ? "elena" : "informatico"

        await request(app.getHttpServer())
          .put(`/nutricionistas/${id("elena")}/clientes/${id("ana")}`)
          .set("Authorization", como(quien))
          .expect(403)

        await request(app.getHttpServer())
          .delete(`/nutricionistas/${id("elena")}/clientes/${id("ana")}`)
          .set("Authorization", como(quien))
          .expect(403)

        await request(app.getHttpServer())
          .get(`/nutricionistas/${id("elena")}/clientes`)
          .set("Authorization", como(quien))
          .expect(403)
      }

      // Y nadie se ha colado por el camino. El recuento va acotado a los
      // usuarios de este fichero: la tabla es la misma para toda la suite y
      // contarla entera haria que un test de otro fichero rompiera este.
      expect(await prisma.asignacionNutricionista.count({ where: mios() })).toBe(0)
    })

    it("sin sesion no se reparte nada", async () => {
      await request(app.getHttpServer())
        .put(`/nutricionistas/${id("elena")}/clientes/${id("ana")}`)
        .expect(401)

      await request(app.getHttpServer()).get("/mis-clientes").expect(401)
    })

    it("el nutricionista ve a quien se le asigna, y solo a ese", async () => {
      await asignar("elena", "ana").expect(204)

      const mios = await request(app.getHttpServer())
        .get("/mis-clientes")
        .set("Authorization", como("elena"))
        .expect(200)

      expect(mios.body.usuarios).toHaveLength(1)
      expect(mios.body.usuarios[0].nombre).toBe("ana")
      expect(mios.body.total).toBe(1)
    })

    it("la lista de un nutricionista no incluye los clientes de otro", async () => {
      await asignar("elena", "ana").expect(204)
      await asignar("otronutri", "luis").expect(204)

      const mios = await request(app.getHttpServer())
        .get("/mis-clientes")
        .set("Authorization", como("elena"))
        .expect(200)

      const nombres = mios.body.usuarios.map((u: { nombre: string }) => u.nombre)
      expect(nombres).toEqual(["ana"])
    })

    it("asignar dos veces no crea dos filas", async () => {
      await asignar("elena", "ana").expect(204)
      await asignar("elena", "ana").expect(204)

      expect(
        await prisma.asignacionNutricionista.count({
          where: { nutricionistaId: id("elena"), clienteId: id("ana") },
        }),
      ).toBe(1)
    })

    it("retirar algo que no estaba no es un error", async () => {
      await retirar("elena", "ana").expect(204)
    })

    it("el entrenador consulta a quien ve cada nutricionista", async () => {
      await asignar("elena", "ana").expect(204)

      const respuesta = await request(app.getHttpServer())
        .get(`/nutricionistas/${id("elena")}/clientes`)
        .set("Authorization", como("entrenador"))
        .expect(200)

      expect(respuesta.body.nutricionistaId).toBe(id("elena"))
      expect(respuesta.body.clienteIds).toEqual([id("ana")])
    })
  })

  describe("retirar corta el acceso de inmediato", () => {
    it("deniega en la peticion siguiente, sin cerrar sesion ni esperar a nada", async () => {
      await asignar("elena", "ana").expect(204)

      // Con asignacion entra.
      await pedirDatos("elena", "ana").expect(200)

      await retirar("elena", "ana").expect(204)

      // La peticion siguiente ya no. Mismo token, misma sesion: lo que cambia es
      // el alcance, y el alcance se consulta en cada peticion.
      await pedirDatos("elena", "ana").expect(403)
    })

    it("retirar a uno no toca el acceso al otro", async () => {
      await asignar("elena", "ana").expect(204)
      await asignar("elena", "luis").expect(204)

      await retirar("elena", "ana").expect(204)

      await pedirDatos("elena", "ana").expect(403)
      await pedirDatos("elena", "luis").expect(200)
    })

    it("sin asignacion no ve nada de nadie", async () => {
      await pedirDatos("elena", "ana").expect(403)
      await pedirDatos("elena", "luis").expect(403)

      const mios = await request(app.getHttpServer())
        .get("/mis-clientes")
        .set("Authorization", como("elena"))
        .expect(200)

      expect(mios.body.usuarios).toHaveLength(0)
    })
  })

  describe("a quien se puede asignar", () => {
    it("solo a un nutricionista, y solo clientes", async () => {
      // Un cliente no es nutricionista.
      await request(app.getHttpServer())
        .put(`/nutricionistas/${id("ana")}/clientes/${id("luis")}`)
        .set("Authorization", como("entrenador"))
        .expect(400)

      // Y el empleado no es cliente de nadie.
      await request(app.getHttpServer())
        .put(`/nutricionistas/${id("elena")}/clientes/${id("informatico")}`)
        .set("Authorization", como("entrenador"))
        .expect(400)

      expect(await prisma.asignacionNutricionista.count({ where: mios() })).toBe(0)
    })

    it("un identificador que no existe devuelve 404, no 500", async () => {
      const inventado = "00000000-0000-4000-8000-000000000000"

      await request(app.getHttpServer())
        .put(`/nutricionistas/${inventado}/clientes/${id("ana")}`)
        .set("Authorization", como("entrenador"))
        .expect(404)

      await request(app.getHttpServer())
        .get(`/nutricionistas/${inventado}/clientes`)
        .set("Authorization", como("entrenador"))
        .expect(404)
    })

    it("un identificador con otra forma devuelve 400", async () => {
      await request(app.getHttpServer())
        .put(`/nutricionistas/no-es-un-id/clientes/${id("ana")}`)
        .set("Authorization", como("entrenador"))
        .expect(400)
    })
  })

  describe("cada rol en su sitio", () => {
    it("solo el nutricionista tiene lista propia", async () => {
      for (const rol of ROLES.filter((r) => r !== "nutricionista")) {
        const quien =
          rol === "cliente"
            ? "ana"
            : rol === "entrenador"
              ? "entrenador"
              : rol === "empleado"
                ? "informatico"
                : "elena"

        await request(app.getHttpServer())
          .get("/mis-clientes")
          .set("Authorization", como(quien))
          .expect(403)
      }
    })

    it("un nutricionista no puede mirar la lista de otro", async () => {
      await asignar("otronutri", "luis").expect(204)

      await request(app.getHttpServer())
        .get(`/nutricionistas/${id("otronutri")}/clientes`)
        .set("Authorization", como("elena"))
        .expect(403)
    })

    it("el cliente asignado sigue viendo lo suyo y nada mas", async () => {
      await asignar("elena", "ana").expect(204)

      await pedirDatos("ana", "ana").expect(200)
      await pedirDatos("ana", "luis").expect(403)
    })

    it("dar de baja a un cliente le corta el acceso al nutricionista", async () => {
      await asignar("elena", "ana").expect(204)
      await pedirDatos("elena", "ana").expect(200)

      await request(app.getHttpServer())
        .post(`/usuarios/${id("ana")}/desactivar`)
        .set("Authorization", como("entrenador"))
        .expect(200)

      // Conservar la fila de asignacion es conservar el rastro de quien tuvo
      // acceso a que, no el acceso. Alguien que deja de ser cliente deja de
      // verse, y su peso y sus medidas dejan de estar al alcance de un
      // subcontratado en la peticion siguiente.
      await pedirDatos("elena", "ana").expect(403)

      const mios = await request(app.getHttpServer())
        .get("/mis-clientes")
        .set("Authorization", como("elena"))
        .expect(200)

      expect(mios.body.usuarios).toHaveLength(0)
    })

    it("reactivar a un cliente le devuelve el acceso al nutricionista", async () => {
      await asignar("elena", "ana").expect(204)

      await request(app.getHttpServer())
        .post(`/usuarios/${id("ana")}/desactivar`)
        .set("Authorization", como("entrenador"))
        .expect(200)

      await request(app.getHttpServer())
        .post(`/usuarios/${id("ana")}/reactivar`)
        .set("Authorization", como("entrenador"))
        .expect(200)

      // La asignacion nunca se toco, asi que vuelve tal cual estaba. Es la otra
      // cara de no borrar la fila.
      await pedirDatos("elena", "ana").expect(200)
    })

    it("dar de baja a un cliente no borra su asignacion", async () => {
      await asignar("elena", "ana").expect(204)

      await request(app.getHttpServer())
        .post(`/usuarios/${id("ana")}/desactivar`)
        .set("Authorization", como("entrenador"))
        .expect(200)

      // La fila sobrevive a proposito: borrarla perderia el rastro de quien tuvo
      // acceso a los datos de salud de quien. Filtrar por estado a quien ve el
      // nutricionista es trabajo aparte, anotado en PENDIENTE-PARA-PRODUCCION.
      expect(
        await prisma.asignacionNutricionista.count({
          where: { nutricionistaId: id("elena"), clienteId: id("ana") },
        }),
      ).toBe(1)
    })
  })
})
