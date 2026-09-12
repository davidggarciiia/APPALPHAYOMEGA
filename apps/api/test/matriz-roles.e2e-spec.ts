import { Controller, Get, type INestApplication } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import type { Rol } from "@alpha-omega/shared"
import { ROLES } from "@alpha-omega/shared"
import request from "supertest"

import { AppModule } from "../src/app.module.js"
import { cifrarContrasena } from "../src/identity/contrasenas.js"
import { Roles } from "../src/identity/roles.decorator.js"
import { PrismaService } from "../src/prisma/prisma.service.js"

const SUFIJO = "@e2e-matriz.test"
const CONTRASENA = "contrasena-de-prueba-matriz"

/**
 * Un endpoint por capacidad de la matriz de SPEC-identity.md, decorado como
 * dice la especificacion.
 *
 * No tienen logica: existen para que la matriz de permisos se pueda comprobar
 * entera hoy, antes de que existan los endpoints de verdad. Cuando cada
 * capacidad tenga su ruta real, hereda estos decoradores y estos casos.
 */
@Controller("matriz")
class ControladorDeMatriz {
  @Roles("cliente", "entrenador", "nutricionista", "empleado")
  @Get("perfil-propio")
  perfilPropio(): string {
    return "ok"
  }

  @Roles("cliente")
  @Get("datos-propios")
  datosPropios(): string {
    return "ok"
  }

  @Roles("entrenador", "nutricionista")
  @Get("datos-de-otro-cliente")
  datosDeOtroCliente(): string {
    return "ok"
  }

  @Roles("cliente", "entrenador", "nutricionista")
  @Get("composicion-corporal")
  composicionCorporal(): string {
    return "ok"
  }

  @Roles("entrenador")
  @Get("gestion-de-clientes")
  gestionDeClientes(): string {
    return "ok"
  }

  @Roles("entrenador")
  @Get("asignar-nutricionista")
  asignarNutricionista(): string {
    return "ok"
  }

  @Roles("entrenador", "nutricionista")
  @Get("editar-dietas")
  editarDietas(): string {
    return "ok"
  }

  @Roles("empleado")
  @Get("fichaje-propio")
  fichajePropio(): string {
    return "ok"
  }

  @Roles("entrenador")
  @Get("fichajes-ajenos")
  fichajesAjenos(): string {
    return "ok"
  }

  @Roles("entrenador")
  @Get("leads")
  leads(): string {
    return "ok"
  }

  /** A proposito sin declarar. Debe denegar a los cuatro roles. */
  @Get("sin-declarar")
  sinDeclarar(): string {
    return "no deberia verse nunca"
  }
}

/**
 * La matriz, escrita otra vez y de forma independiente al controlador.
 *
 * Esa duplicacion es deliberada: si alguien relaja un decorador de arriba, esta
 * tabla deja de cuadrar y el test lo caza. Un test que leyera los decoradores
 * para construir sus expectativas se limitaria a comprobar que el codigo hace lo
 * que el codigo hace.
 */
const MATRIZ: ReadonlyArray<{ ruta: string; permitidos: readonly Rol[] }> = [
  { ruta: "perfil-propio", permitidos: ["cliente", "entrenador", "nutricionista", "empleado"] },
  { ruta: "datos-propios", permitidos: ["cliente"] },
  { ruta: "datos-de-otro-cliente", permitidos: ["entrenador", "nutricionista"] },
  { ruta: "composicion-corporal", permitidos: ["cliente", "entrenador", "nutricionista"] },
  { ruta: "gestion-de-clientes", permitidos: ["entrenador"] },
  { ruta: "asignar-nutricionista", permitidos: ["entrenador"] },
  { ruta: "editar-dietas", permitidos: ["entrenador", "nutricionista"] },
  { ruta: "fichaje-propio", permitidos: ["empleado"] },
  { ruta: "fichajes-ajenos", permitidos: ["entrenador"] },
  { ruta: "leads", permitidos: ["entrenador"] },
  { ruta: "sin-declarar", permitidos: [] },
]

describe("Matriz de roles", () => {
  let app: INestApplication
  let prisma: PrismaService
  const tokens = new Map<Rol, string>()

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ControladorDeMatriz],
    }).compile()

    app = modulo.createNestApplication()
    await app.init()

    prisma = app.get(PrismaService)
    await prisma.usuario.deleteMany({ where: { email: { endsWith: SUFIJO } } })

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

  afterAll(async () => {
    await prisma.usuario.deleteMany({ where: { email: { endsWith: SUFIJO } } })
    await app.close()
  })

  // Una celda de la matriz por caso. 11 capacidades x 4 roles = 44 comprobaciones.
  for (const { ruta, permitidos } of MATRIZ) {
    for (const rol of ROLES) {
      const deberiaPasar = permitidos.includes(rol)
      const veredicto = deberiaPasar ? "permite" : "DENIEGA"

      it(`${veredicto} a ${rol} en /matriz/${ruta}`, async () => {
        const token = tokens.get(rol)
        expect(token).toBeDefined()

        await request(app.getHttpServer())
          .get(`/matriz/${ruta}`)
          .set("Authorization", `Bearer ${token ?? ""}`)
          .expect(deberiaPasar ? 200 : 403)
      })
    }
  }

  it("sin sesion deniega en todas las rutas de la matriz", async () => {
    for (const { ruta } of MATRIZ) {
      await request(app.getHttpServer()).get(`/matriz/${ruta}`).expect(401)
    }
  })
})
