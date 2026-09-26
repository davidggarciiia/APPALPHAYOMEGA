import "reflect-metadata"

import type { AddressInfo } from "node:net"

import { hoyEnZona, ZONA_AGENDA } from "@alpha-omega/shared"
import { NestFactory } from "@nestjs/core"
import type { NestExpressApplication } from "@nestjs/platform-express"

import { AppModule } from "../app.module.js"
import { normalizarNombre } from "../catalogo-ejercicios/catalogo-ejercicios.service.js"
import { prepararCatalogo } from "../catalogo-ejercicios/preparar-catalogo.js"
import { cargarEntornoLocal, leerVariableOpcional } from "../config/entorno.js"
import { configurarCuerposHttp } from "../config/http.js"
import { cifrarContrasena } from "../identity/contrasenas.js"
import { ALMACEN_OBJETOS, type AlmacenObjetos } from "../medios/almacen-objetos.js"
import { asegurarCatalogoInicial } from "../planes/catalogo-planes.js"
import { PrismaService } from "../prisma/prisma.service.js"
import { sembrarAgenda } from "./agenda-demo.js"
import { ApiDemo } from "./api-demo.js"
import { Azar } from "./azar.js"
import type { ContextoDemo } from "./contexto-demo.js"
import { sembrarEntrenamiento } from "./entrenamiento-demo.js"
import { limpiarDemo } from "./limpiar-demo.js"
import { sembrarNutricion } from "./nutricion-demo.js"
import { crearCuentas, fecharCuentas, interceptarCorreo } from "./personas-demo.js"
import { DOMINIO_DEMO, esCorreoDemo, motivoParaNoSembrar } from "./seguridad-demo.js"
import { sembrarSeguimiento } from "./seguimiento-demo.js"

/**
 * Datos de demostración: `npm run demo:seed --workspace apps/api`.
 *
 * Llena una base de DEMO con un entrenador, una nutricionista y seis clientes
 * inventados, con doce semanas de historia calculadas desde hoy (Europe/Madrid)
 * para que la demo parezca siempre reciente. Ver docs/DEMO.md.
 *
 * - Solo escribe si `POSTGRES_DB` contiene «demo».
 * - Borra y recrea únicamente las cuentas `@demo.alphaomega.test` y lo suyo.
 *   Ejecutarlo dos veces deja lo mismo.
 * - Arranca la API en este proceso y escribe por HTTP todo lo que la API
 *   permite; con Prisma, solo lo que la API no deja fechar en el pasado
 *   (reservas pasadas con su consumo de saldo y marcas de tiempo antiguas).
 * - Los correos de activación no salen del proceso.
 */

/** Contraseña de todas las cuentas de demo. Solo aquí y en docs/DEMO.md; nunca por consola. */
const CONTRASENA_DEMO = "Demo-AlphaOmega-2026"

/** Misma semilla, mismos datos: dos ejecuciones el mismo día dejan la misma demo. */
const SEMILLA = 20260926

/** Crea la cuenta del entrenador del `.env` si falta, igual que `src/seed.ts`. */
async function asegurarEntrenadorDelSeed(prisma: PrismaService): Promise<string> {
  const email = leerVariableOpcional("SEED_ENTRENADOR_EMAIL", "").trim().toLowerCase()
  const contrasena = leerVariableOpcional("SEED_ENTRENADOR_PASSWORD", "")
  if (email === "" || contrasena === "")
    return "sin SEED_ENTRENADOR_EMAIL o SEED_ENTRENADOR_PASSWORD: no se comprueba"
  if (esCorreoDemo(email))
    return `${email} es del dominio de la demo: no se usa como cuenta del seed`
  if (await prisma.usuario.findUnique({ where: { email } }))
    return `${email} ya existía, no se toca`
  await prisma.usuario.create({
    data: {
      email,
      nombre: "Entrenador",
      passwordHash: await cifrarContrasena(contrasena),
      rol: "entrenador",
      estado: "activo",
    },
  })
  return `${email} creado`
}

/** Filas clave de la demo, para comprobar de un vistazo que dos ejecuciones dejan lo mismo. */
async function contar(prisma: PrismaService): Promise<Record<string, number>> {
  const usuarios = await prisma.usuario.findMany({
    where: { email: { endsWith: `@${DOMINIO_DEMO}` } },
    select: { id: true },
  })
  const clienteId = { in: usuarios.map((u) => u.id) }
  const [
    cuentas,
    planes,
    sesiones,
    enviadas,
    revisadas,
    molestias,
    comentarios,
    dias,
    medidas,
    pruebas,
    publicaciones,
    fotos,
    solicitudesFotos,
    dietas,
    comidas,
    reservas,
    canceladas,
    movimientos,
    cobrosPendientes,
    cobrosCobrados,
    loQuiero,
  ] = await Promise.all([
    prisma.usuario.count({ where: { id: clienteId } }),
    prisma.planEntrenamiento.count({ where: { clienteId } }),
    prisma.sesionEntrenamiento.count({ where: { clienteId } }),
    prisma.sesionEntrenamiento.count({ where: { clienteId, enviadoEn: { not: null } } }),
    prisma.sesionEntrenamiento.count({ where: { clienteId, revisadaEn: { not: null } } }),
    prisma.molestia.count({ where: { clienteId } }),
    prisma.comentarioSesion.count({ where: { clienteId } }),
    prisma.diaSeguimiento.count({ where: { clienteId } }),
    prisma.medidaCorporal.count({ where: { clienteId } }),
    prisma.pruebaFisica.count({ where: { clienteId } }),
    prisma.publicacionValoracion.count({ where: { valoracion: { clienteId } } }),
    prisma.medioFoto.count({ where: { clienteId, estado: "disponible" } }),
    prisma.solicitudFotos.count({ where: { clienteId } }),
    prisma.dieta.count({ where: { clienteId } }),
    prisma.comidaRegistrada.count({ where: { clienteId } }),
    prisma.reserva.count({ where: { clienteId, estado: "confirmada" } }),
    prisma.reserva.count({ where: { clienteId, estado: "cancelada" } }),
    prisma.movimientoSaldo.count({ where: { clienteId } }),
    prisma.cobro.count({ where: { clienteId, estado: "pendiente" } }),
    prisma.cobro.count({ where: { clienteId, estado: "cobrado" } }),
    prisma.solicitudProducto.count({ where: { clienteId, estado: "pendiente" } }),
  ])
  return {
    cuentas,
    planes,
    sesiones,
    enviadas,
    revisadas,
    molestias,
    comentarios,
    dias,
    medidas,
    pruebas,
    publicaciones,
    fotos,
    solicitudesFotos,
    dietas,
    comidas,
    reservas,
    canceladas,
    movimientos,
    cobrosPendientes,
    cobrosCobrados,
    loQuiero,
  }
}

async function sembrar(app: NestExpressApplication, base: string): Promise<void> {
  const informar = (linea: string): void => console.log(linea)
  const prisma = app.get(PrismaService)
  const api = new ApiDemo(base)
  const buzon = interceptarCorreo(app)
  const hoy = hoyEnZona(ZONA_AGENDA)
  informar(`Hoy (${ZONA_AGENDA}): ${hoy}`)

  const borradas = await limpiarDemo(prisma, app.get<AlmacenObjetos>(ALMACEN_OBJETOS))
  informar(`· Limpieza: ${borradas} cuentas de demo anteriores borradas con todo lo suyo`)

  const planes = await asegurarCatalogoInicial(prisma)
  const ejercicios = await prepararCatalogo(prisma, { confirmar: true })
  informar(
    `· Catálogo: ${planes.productos} productos y ${planes.servicios} servicios nuevos; ` +
      `${ejercicios.creados} ejercicios creados, ${ejercicios.figurasAsociadas} figuras asociadas`,
  )
  informar(`· Entrenador del seed: ${await asegurarEntrenadorDelSeed(prisma)}`)

  const cuentas = await crearCuentas(prisma, api, buzon, CONTRASENA_DEMO)
  informar(
    `· Cuentas: entrenador, nutricionista y ${Object.keys(cuentas.ids).length} clientes ` +
      "(Javier, pendiente de activar)",
  )
  const publicados = await prisma.ejercicio.findMany({
    where: { estado: "publicado" },
    select: { id: true, nombreNormalizado: true },
  })
  const ctx: ContextoDemo = {
    app,
    api,
    prisma,
    azar: new Azar(SEMILLA),
    hoy,
    ...cuentas,
    ejercicios: new Map(publicados.map((e) => [normalizarNombre(e.nombreNormalizado), e.id])),
    informar,
  }

  informar("· Entrenamiento…")
  const entrenamiento = await sembrarEntrenamiento(ctx)
  informar(
    `  ${entrenamiento.planes} planes, ${entrenamiento.enviadas} sesiones enviadas ` +
      `(${entrenamiento.revisadas} revisadas), ${entrenamiento.hoy} sesiones hoy`,
  )
  informar("· Seguimiento…")
  const seguimiento = await sembrarSeguimiento(ctx)
  informar(
    `  Lucía: ${seguimiento.dias} días, ${seguimiento.medidas} medidas, ` +
      `${seguimiento.pruebas} pruebas, ${seguimiento.fotos} fotos y 2 valoraciones publicadas`,
  )
  informar("· Nutrición…")
  const nutricion = await sembrarNutricion(ctx)
  informar(`  ${nutricion.dietas} dietas, ${nutricion.comidas} comidas marcadas`)
  informar("· Planes, saldo y reservas…")
  const agenda = await sembrarAgenda(ctx)
  informar(
    `  ${agenda.pasadas} reservas pasadas, ${agenda.proximas} próximas, ` +
      `${agenda.canceladas} cancelada, ${agenda.cobrosPendientes} cobros pendientes`,
  )
  await fecharCuentas(prisma, cuentas, hoy)

  informar("Resumen de la demo:")
  for (const [clave, valor] of Object.entries(await contar(prisma)))
    informar(`  ${clave.padEnd(18)} ${valor}`)
  informar("Listo. Las cuentas están en docs/DEMO.md.")
}

async function principal(): Promise<number> {
  cargarEntornoLocal()
  const baseDeDatos = process.env.POSTGRES_DB
  const motivo = motivoParaNoSembrar(baseDeDatos)
  if (motivo !== null) {
    console.error(`No se siembra nada. ${motivo}`)
    return 1
  }
  console.log(`Base de datos destino: ${baseDeDatos}`)

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ["error", "warn"],
  })
  try {
    configurarCuerposHttp(app)
    await app.listen(0, "127.0.0.1")
    const { port } = app.getHttpServer().address() as AddressInfo
    await sembrar(app, `http://127.0.0.1:${port}`)
    return 0
  } catch (error) {
    console.error(
      "El sembrado de demo ha fallado:",
      error instanceof Error ? error.message : String(error),
    )
    if (error instanceof Error && error.stack) console.error(error.stack)
    return 1
  } finally {
    await app.close()
  }
}

process.exitCode = await principal()
