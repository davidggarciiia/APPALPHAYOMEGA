import type { INestApplication } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import type { NestExpressApplication } from "@nestjs/platform-express"
import request from "supertest"
import type { DocumentoDieta } from "@alpha-omega/shared"
import { configurarCuerposHttp } from "../src/config/http.js"
import { AppModule } from "../src/app.module.js"
import { PrismaService } from "../src/prisma/prisma.service.js"
import { cifrarContrasena } from "../src/identity/contrasenas.js"

/** Cuentas sintéticas de cada caso de la matriz de permisos de SPEC-nutricion.md. */
const CUENTAS = {
  entrenador: { rol: "entrenador", estado: "activo" },
  cliente: { rol: "cliente", estado: "activo" },
  otro: { rol: "cliente", estado: "activo" },
  pendiente: { rol: "cliente", estado: "pendiente" },
  desactivado: { rol: "cliente", estado: "desactivado" },
  nutricionista: { rol: "nutricionista", estado: "activo" },
  nutriAjeno: { rol: "nutricionista", estado: "activo" },
  empleado: { rol: "empleado", estado: "activo" },
} as const
type Cuenta = keyof typeof CUENTAS

export async function entornoNutricion(nombre: string): Promise<{
  app: INestApplication
  prisma: PrismaService
  ids: Record<Cuenta, string>
  como: (cuenta: Cuenta | "anonimo") => Record<string, string>
  cerrar: () => Promise<void>
}> {
  const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile()
  const app = modulo.createNestApplication<NestExpressApplication>()
  configurarCuerposHttp(app)
  await app.init()
  const prisma = app.get(PrismaService)
  const sufijo = `@e2e-nutricion-${nombre}.test`

  async function limpiar(): Promise<void> {
    const usuarios = await prisma.usuario.findMany({
      where: { email: { endsWith: sufijo } },
      select: { id: true },
    })
    const ids = usuarios.map((fila) => fila.id)
    await prisma.$transaction([
      prisma.dieta.deleteMany({ where: { clienteId: { in: ids } } }),
      prisma.usuario.deleteMany({ where: { id: { in: ids } } }),
    ])
  }

  await limpiar()
  const contrasena = "Prueba-nutricion-2026!"
  const passwordHash = await cifrarContrasena(contrasena)
  const ids = {} as Record<Cuenta, string>
  const tokens = new Map<Cuenta, string>()
  for (const [clave, datos] of Object.entries(CUENTAS) as [Cuenta, (typeof CUENTAS)[Cuenta]][]) {
    const usuario = await prisma.usuario.create({
      data: {
        nombre: clave,
        email: `${clave}${sufijo}`,
        passwordHash,
        rol: datos.rol,
        estado: datos.estado,
      },
    })
    ids[clave] = usuario.id
    if (datos.estado === "activo") {
      const login = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: usuario.email, contrasena })
        .expect(200)
      tokens.set(clave, login.body.tokenAcceso)
    }
  }
  // El nutricionista ve al cliente, al pendiente y al dado de baja. La baja le corta
  // el acceso igualmente, que es justo lo que se comprueba.
  await prisma.asignacionNutricionista.createMany({
    data: (["cliente", "pendiente", "desactivado"] as const).map((clave) => ({
      nutricionistaId: ids.nutricionista,
      clienteId: ids[clave],
    })),
  })

  return {
    app,
    prisma,
    ids,
    como: (cuenta) =>
      cuenta === "anonimo"
        ? ({} as Record<string, string>)
        : { Authorization: `Bearer ${tokens.get(cuenta) ?? "sin-token"}` },
    cerrar: async () => {
      try {
        await limpiar()
      } finally {
        await app.close()
      }
    },
  }
}

/** Dieta mínima válida: un solo tipo de día con objetivo. Datos inventados. */
export function documentoDeObjetivos(nombre = "Objetivos diarios"): DocumentoDieta {
  const todos = "00000000-0000-4000-8000-000000000001"
  return {
    formato: 1,
    nombre,
    tiposDeDia: [
      {
        id: todos,
        nombre: "Todos los días",
        objetivo: { kcal: 2100, proteinaG: 150, hidratosG: 220, grasaG: 70 },
        comidas: [],
      },
    ],
    semana: Array.from({ length: 7 }, () => todos),
    indicaciones: [],
  }
}
