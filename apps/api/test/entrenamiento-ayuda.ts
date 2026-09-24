import type { INestApplication } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import type { NestExpressApplication } from "@nestjs/platform-express"
import { configurarCuerposHttp } from "../src/config/http.js"
import { randomUUID } from "node:crypto"
import request from "supertest"
import { ROLES, type AsignarPlan } from "@alpha-omega/shared"
import { AppModule } from "../src/app.module.js"
import { PrismaService } from "../src/prisma/prisma.service.js"
import { cifrarContrasena } from "../src/identity/contrasenas.js"

export async function entornoEntrenamiento(nombre: string): Promise<{
  app: INestApplication
  prisma: PrismaService
  ids: Record<string, string>
  como: (rol: string) => { Authorization: string }
  plan: () => AsignarPlan
  cerrar: () => Promise<void>
}> {
  const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile()
  const app = modulo.createNestApplication<NestExpressApplication>()
  configurarCuerposHttp(app)
  await app.init()
  const prisma = app.get(PrismaService)
  const sufijo = `@e2e-entrenamiento-${nombre}.test`
  const prefijo = `e2e-entrenamiento-${nombre}`

  async function limpiar(): Promise<void> {
    const usuarios = await prisma.usuario.findMany({
      where: { email: { endsWith: sufijo } },
      select: { id: true },
    })
    const ids = usuarios.map((fila) => fila.id)
    const sesiones = await prisma.sesionProgramada.findMany({
      where: { clienteId: { in: ids } },
      select: { id: true },
    })
    const sesionId = { in: sesiones.map((fila) => fila.id) }
    await prisma.$transaction([
      prisma.molestia.deleteMany({ where: { sesionId } }),
      prisma.operacionEntrenamiento.deleteMany({ where: { sesionId } }),
      prisma.referenciaEjercicio.deleteMany({ where: { sesionId } }),
      prisma.cambioDeFecha.deleteMany({ where: { sesionId } }),
      prisma.sesionEntrenamiento.deleteMany({ where: { id: sesionId } }),
      prisma.sesionProgramada.deleteMany({ where: { id: sesionId } }),
      prisma.planEntrenamiento.deleteMany({ where: { clienteId: { in: ids } } }),
      prisma.rutinaGuardada.deleteMany({ where: { creadorId: { in: ids } } }),
      prisma.usuario.deleteMany({ where: { id: { in: ids } } }),
      prisma.ejercicio.deleteMany({ where: { nombreNormalizado: { startsWith: prefijo } } }),
    ])
  }

  await limpiar()
  const ids: Record<string, string> = {}
  const tokens = new Map<string, string>()
  const contrasena = "Prueba-entrenamiento-2026!"
  const passwordHash = await cifrarContrasena(contrasena)
  for (const clave of [...ROLES, "otro", "pendiente", "desactivado"]) {
    const usuario = await prisma.usuario.create({
      data: {
        nombre: clave,
        email: `${clave}${sufijo}`,
        passwordHash,
        rol: ROLES.includes(clave as (typeof ROLES)[number])
          ? (clave as (typeof ROLES)[number])
          : "cliente",
        estado: clave === "pendiente" || clave === "desactivado" ? clave : "activo",
      },
    })
    ids[clave] = usuario.id
    if (usuario.estado === "activo") {
      const login = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: usuario.email, contrasena })
        .expect(200)
      tokens.set(clave, login.body.tokenAcceso)
    }
  }
  const ejercicio = await prisma.ejercicio.create({
    data: {
      nombre: prefijo,
      nombreNormalizado: prefijo,
      grupoPrincipal: "espalda",
      instrucciones: "Prueba de integración",
    },
  })
  ids.ejercicio = ejercicio.id
  return {
    app,
    prisma,
    ids,
    como: (rol) => ({ Authorization: `Bearer ${tokens.get(rol) ?? "sin-token"}` }),
    plan: () => ({
      operacionId: randomUUID(),
      nombre: "Rutina de prueba",
      semanaInicial: "2026-09-14",
      semanas: 1,
      patron: {
        sesiones: [
          {
            id: randomUUID(),
            nombre: "Fuerza",
            diaSemana: 1,
            ejercicios: [
              {
                id: randomUUID(),
                ejercicioId: ejercicio.id,
                indicaciones: null,
                series: [
                  { id: randomUUID(), tipoMedicion: "repeticiones", pesoKg: 20, repeticiones: 10 },
                  { id: randomUUID(), tipoMedicion: "tiempo", pesoKg: null, segundos: 30 },
                ],
              },
            ],
          },
        ],
      },
    }),
    cerrar: async () => {
      try {
        await limpiar()
      } finally {
        await app.close()
      }
    },
  }
}
