import type { INestApplication } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import {
  PlanAsignadoSchema,
  type EstadoUsuario,
  type PlanAsignado,
  type Rol,
} from "@alpha-omega/shared"
import { randomUUID } from "node:crypto"
import request from "supertest"

import { AppModule } from "../src/app.module.js"
import { CorreoEnMemoria } from "../src/correo/correo-en-memoria.js"
import { ServicioDeCorreo } from "../src/correo/correo.service.js"
import { cifrarContrasena } from "../src/identity/contrasenas.js"
import { PrismaService } from "../src/prisma/prisma.service.js"

/**
 * Piezas comunes de los e2e de catálogo, agenda y entrenamiento.
 *
 * Cada fichero usa su propio sufijo de correo y su propio prefijo de nombres,
 * y limpia primero usuarios (que arrastran sus sesiones en cascada) y después
 * ejercicios y rutinas: al revés, la referencia `Restrict` lo impediría.
 */
export const ID_INEXISTENTE = "00000000-0000-4000-8000-000000000000"
const CONTRASENA = "contrasena-de-prueba-entrenamiento"

export type Entorno = {
  app: INestApplication
  prisma: PrismaService
  servidor: () => ReturnType<INestApplication["getHttpServer"]>
}

export async function levantar(): Promise<Entorno> {
  const modulo = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(ServicioDeCorreo)
    .useValue(new CorreoEnMemoria())
    .compile()
  const app = modulo.createNestApplication()
  await app.init()
  const prisma = app.get(PrismaService)
  return { app, prisma, servidor: () => app.getHttpServer() }
}

export type Cuenta = { id: string; token: string; email: string; cabecera: string }

/** Crea una cuenta activa con contraseña y entra con ella. */
export async function crearCuenta(
  entorno: Entorno,
  nombre: string,
  rol: Rol,
  sufijo: string,
  estado: EstadoUsuario = "activo",
): Promise<Cuenta> {
  const email = `${nombre}${sufijo}`
  const creado = await entorno.prisma.usuario.create({
    data: {
      email,
      nombre,
      passwordHash: await cifrarContrasena(CONTRASENA),
      rol,
      estado: estado === "desactivado" ? "activo" : estado,
    },
  })
  let token = ""
  if (estado === "activo" || estado === "desactivado") {
    const login = await request(entorno.servidor())
      .post("/auth/login")
      .send({ email, contrasena: CONTRASENA })
      .expect(200)
    token = String(login.body.tokenAcceso)
  }
  if (estado === "desactivado") {
    await entorno.prisma.usuario.update({ where: { id: creado.id }, data: { estado } })
  }
  return { id: creado.id, token, email, cabecera: `Bearer ${token}` }
}

/** Cliente pendiente: existe y recibe entrenos, pero no puede entrar. */
export async function crearPendiente(
  entorno: Entorno,
  nombre: string,
  sufijo: string,
): Promise<string> {
  const creado = await entorno.prisma.usuario.create({
    data: { email: `${nombre}${sufijo}`, nombre, rol: "cliente", estado: "pendiente" },
  })
  return creado.id
}

export async function limpiar(
  entorno: Entorno,
  sufijo: string,
  prefijoEjercicios?: string,
): Promise<void> {
  await entorno.prisma.usuario.deleteMany({ where: { email: { endsWith: sufijo } } })
  if (prefijoEjercicios !== undefined) {
    const prefijo = prefijoEjercicios.toLowerCase()
    await entorno.prisma.rutinaGuardada.deleteMany({
      where: { nombre: { startsWith: prefijoEjercicios } },
    })
    await entorno.prisma.ejercicio.deleteMany({
      where: { nombreNormalizado: { startsWith: prefijo } },
    })
  }
}

/** Un ejercicio publicado de pruebas, creado directamente en la base. */
export async function crearEjercicio(
  entorno: Entorno,
  nombre: string,
): Promise<{ id: string; nombre: string }> {
  const fila = await entorno.prisma.ejercicio.create({
    data: {
      nombre,
      nombreNormalizado: nombre.trim().replace(/\s+/g, " ").toLowerCase(),
      grupoPrincipal: "pecho",
      instrucciones: "Instrucciones de prueba.",
    },
  })
  return { id: fila.id, nombre: fila.nombre }
}

type SerieDePrueba =
  | { tipoMedicion: "repeticiones"; pesoKg: number | null; repeticiones: number }
  | { tipoMedicion: "tiempo"; pesoKg: number | null; segundos: number }

/** Un patrón semanal válido con un ejercicio por sesión e ids nuevos. */
export function patronDe(
  ejercicioId: string,
  sesiones: ReadonlyArray<{ nombre: string; diaSemana: number; series?: SerieDePrueba[] }>,
): { sesiones: Array<Record<string, unknown>> } {
  return {
    sesiones: sesiones.map((sesion) => ({
      id: randomUUID(),
      nombre: sesion.nombre,
      diaSemana: sesion.diaSemana,
      ejercicios: [
        {
          id: randomUUID(),
          ejercicioId,
          indicaciones: null,
          series: (
            sesion.series ?? [{ tipoMedicion: "repeticiones", pesoKg: 40, repeticiones: 10 }]
          ).map((serie) => ({ id: randomUUID(), ...serie })),
        },
      ],
    })),
  }
}

export function planDe(
  ejercicioId: string,
  semanaInicial: string,
  semanas: number,
  sesiones: ReadonlyArray<{ nombre: string; diaSemana: number; series?: SerieDePrueba[] }>,
): Record<string, unknown> {
  return {
    operacionId: randomUUID(),
    nombre: "Plan de prueba",
    semanaInicial,
    semanas,
    patron: patronDe(ejercicioId, sesiones),
  }
}

/** Asigna un plan como entrenador y devuelve el cuerpo de la respuesta. */
export async function asignar(
  entorno: Entorno,
  entrenador: Cuenta,
  clienteId: string,
  plan: Record<string, unknown>,
): Promise<PlanAsignado> {
  const respuesta = await request(entorno.servidor())
    .post(`/entrenamiento/clientes/${clienteId}/planes`)
    .set("Authorization", entrenador.cabecera)
    .send(plan)
    .expect(201)
  return PlanAsignadoSchema.parse(respuesta.body)
}
