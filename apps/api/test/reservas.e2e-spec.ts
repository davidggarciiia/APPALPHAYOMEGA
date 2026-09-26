import type { NestExpressApplication } from "@nestjs/platform-express"
import { Test } from "@nestjs/testing"
import { randomUUID } from "node:crypto"
import request from "supertest"
import {
  aInstante,
  hoyEnZona,
  mesDeFecha,
  sumarDiasFecha,
  sumarMeses,
  ZONA_AGENDA,
  type Disponibilidad,
  type Reserva,
  type ResumenSaldo,
} from "@alpha-omega/shared"

import { AppModule } from "../src/app.module.js"
import { configurarCuerposHttp } from "../src/config/http.js"
import { cifrarContrasena } from "../src/identity/contrasenas.js"
import { asegurarCatalogoInicial } from "../src/planes/catalogo-planes.js"
import { nombreDeMes } from "../src/planes/saldo.service.js"
import { PrismaService } from "../src/prisma/prisma.service.js"

/**
 * Criterios de aceptación de SPEC-agenda.md («Ampliación: horarios y reservas»)
 * y SPEC-planes.md contra Postgres real. La agenda es única (franjas y ajustes
 * globales): esta suite guarda los que había y los deja como estaban.
 */

const SUFIJO = "@e2e-reservas.test"
const CLAVE = "Prueba-reservas-2026!"
const PERSONAS = [
  "entrenador",
  "ana",
  "berta",
  "carla",
  "dora",
  "eva",
  "fede",
  "gala",
  "hugo",
  "nutri",
  "empleado",
] as const
type Persona = (typeof PERSONAS)[number]

let app: NestExpressApplication
let prisma: PrismaService
const ids = {} as Record<Persona, string>
const tokens = {} as Record<Persona, string>
let franjasPrevias: { diaSemana: number; inicioMin: number; finMin: number }[] = []
let ajustesPrevios: {
  antelacionMin: number
  horizonteDias: number
  cancelacionHoras: number
  intervaloMin: number
}
let servicioEp = ""
let servicioGrupo = ""
const productos: Record<string, string> = {}

const hoy = hoyEnZona(ZONA_AGENDA)
/** Un día con huecos de sobra: más allá de la antelación y dentro del horizonte. */
const DIA = sumarDiasFecha(hoy, 3)
const hora = (fecha: string, h: number): string =>
  aInstante(fecha, h * 60, ZONA_AGENDA)!.toISOString()

const como = (persona: Persona) => ({ Authorization: `Bearer ${tokens[persona]}` })
const http = () => request(app.getHttpServer())

async function limpiar(): Promise<void> {
  const usuarios = await prisma.usuario.findMany({
    where: { email: { endsWith: SUFIJO } },
    select: { id: true },
  })
  const clienteId = { in: usuarios.map((u) => u.id) }
  await prisma.$transaction([
    prisma.cobro.deleteMany({ where: { clienteId } }),
    prisma.solicitudProducto.deleteMany({ where: { clienteId } }),
    prisma.movimientoSaldo.deleteMany({ where: { clienteId } }),
    prisma.bono.deleteMany({ where: { clienteId } }),
    prisma.suscripcion.deleteMany({ where: { clienteId } }),
    prisma.reserva.deleteMany({ where: { clienteId } }),
    prisma.excepcionAgenda.deleteMany({ where: { autorId: clienteId } }),
    prisma.usuario.deleteMany({ where: { id: clienteId } }),
  ])
}

function reservar(
  persona: Persona,
  inicio: string,
  extra: { operacionId?: string; servicioId?: string; personas?: number } = {},
): request.Test {
  return http()
    .post("/agenda/mis-reservas")
    .set(como(persona))
    .send({
      operacionId: extra.operacionId ?? randomUUID(),
      servicioId: extra.servicioId ?? servicioEp,
      inicio,
      personas: extra.personas ?? 1,
    })
}

async function saldo(persona: Persona): Promise<ResumenSaldo> {
  return (await http().get("/planes/mi-saldo").set(como(persona)).expect(200)).body as ResumenSaldo
}

async function activar(persona: Persona, codigo: string, mesInicio = "actual"): Promise<void> {
  await http()
    .post(`/planes/clientes/${ids[persona]}/activaciones`)
    .set(como("entrenador"))
    .send({
      operacionId: randomUUID(),
      productoId: productos[codigo],
      importeCentimos: 100,
      mesInicio,
      cobrado: true,
    })
    .expect(200)
}

beforeAll(async () => {
  const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile()
  app = modulo.createNestApplication<NestExpressApplication>()
  configurarCuerposHttp(app)
  await app.init()
  prisma = app.get(PrismaService)
  await limpiar()
  await asegurarCatalogoInicial(prisma)

  const passwordHash = await cifrarContrasena(CLAVE)
  for (const persona of PERSONAS) {
    const rol =
      persona === "entrenador" || persona === "empleado"
        ? persona
        : persona === "nutri"
          ? "nutricionista"
          : "cliente"
    const usuario = await prisma.usuario.create({
      data: { email: `${persona}${SUFIJO}`, nombre: persona, passwordHash, rol, estado: "activo" },
    })
    ids[persona] = usuario.id
    const login = await http()
      .post("/auth/login")
      .send({ email: usuario.email, contrasena: CLAVE })
      .expect(200)
    tokens[persona] = login.body.tokenAcceso as string
  }

  franjasPrevias = (await prisma.franjaSemanal.findMany()).map(
    ({ diaSemana, inicioMin, finMin }) => ({
      diaSemana,
      inicioMin,
      finMin,
    }),
  )
  const ajustes = await prisma.ajustesAgenda.upsert({
    where: { id: 1 },
    create: { id: 1 },
    update: {},
  })
  ajustesPrevios = {
    antelacionMin: ajustes.antelacionMin,
    horizonteDias: ajustes.horizonteDias,
    cancelacionHoras: ajustes.cancelacionHoras,
    intervaloMin: ajustes.intervaloMin,
  }
  await prisma.ajustesAgenda.update({
    where: { id: 1 },
    data: { antelacionMin: 120, horizonteDias: 28, cancelacionHoras: 24, intervaloMin: 60 },
  })

  // Criterio 1: de lunes a domingo de 8:00 a 14:00.
  await http()
    .put("/agenda/horario-semanal")
    .set(como("entrenador"))
    .send({
      franjas: [1, 2, 3, 4, 5, 6, 7].map((diaSemana) => ({
        diaSemana,
        inicioMin: 480,
        finMin: 840,
      })),
    })
    .expect(200)

  const servicios = await prisma.servicio.findMany()
  servicioEp = servicios.find((s) => s.codigo === "ep_individual")!.id
  servicioGrupo = servicios.find((s) => s.codigo === "ep_grupo")!.id
  for (const p of await prisma.producto.findMany()) productos[p.codigo] = p.id
})

afterAll(async () => {
  try {
    await limpiar()
    await prisma.franjaSemanal.deleteMany({})
    if (franjasPrevias.length > 0) await prisma.franjaSemanal.createMany({ data: franjasPrevias })
    await prisma.ajustesAgenda.update({ where: { id: 1 }, data: ajustesPrevios })
  } finally {
    await app.close()
  }
})

describe("disponibilidad", () => {
  it("ofrece huecos de 60 minutos en punto solo dentro del horario, y nunca dice quién ocupa", async () => {
    const respuesta = await http()
      .get(`/agenda/disponibilidad?servicioId=${servicioEp}&desde=${DIA}&dias=1`)
      .set(como("ana"))
      .expect(200)
    const disponibilidad = respuesta.body as Disponibilidad
    expect(disponibilidad.dias[0]?.huecos.map((h) => h.inicio)).toEqual(
      [8, 9, 10, 11, 12, 13].map((h) => hora(DIA, h)),
    )
    expect(JSON.stringify(disponibilidad)).not.toContain("clienteId")
  })

  it("al cliente no le ofrece nada más allá del horizonte; al entrenador sí", async () => {
    const lejos = sumarDiasFecha(hoy, 40)
    const cliente = await http()
      .get(`/agenda/disponibilidad?servicioId=${servicioEp}&desde=${lejos}&dias=1`)
      .set(como("ana"))
      .expect(200)
    expect((cliente.body as Disponibilidad).dias[0]?.huecos).toEqual([])
    const entrenador = await http()
      .get(`/agenda/disponibilidad?servicioId=${servicioEp}&desde=${lejos}&dias=1`)
      .set(como("entrenador"))
      .expect(200)
    expect((entrenador.body as Disponibilidad).dias[0]?.huecos).toHaveLength(6)
  })
})

describe("reservar con saldo", () => {
  it("sin saldo rechaza con sin_saldo", async () => {
    const respuesta = await reservar("ana", hora(DIA, 8)).expect(409)
    expect(respuesta.body.codigo).toBe("sin_saldo")
    expect(await prisma.reserva.count({ where: { clienteId: ids.ana } })).toBe(0)
  })

  it("con un plan del mes gasta de él, y el hueco desaparece para otro cliente", async () => {
    const dia = sumarDiasFecha(hoy, 1)
    const mismoMes = mesDeFecha(dia) === mesDeFecha(hoy)
    await activar("ana", "presencial-esencial", mismoMes ? "actual" : "siguiente")
    const antes = await saldo("ana")
    expect(mismoMes ? antes.ep.mesActual : antes.ep.mesSiguiente).toMatchObject({
      cupo: 2,
      quedan: 2,
    })

    const reserva = (await reservar("ana", hora(dia, 12)).expect(201)).body as Reserva
    expect(reserva.fuenteSaldo).toBe(`Presencial Esencial · ${nombreDeMes(mesDeFecha(dia))}`)
    expect(reserva.estado).toBe("confirmada")
    const despues = await saldo("ana")
    expect(mismoMes ? despues.ep.mesActual : despues.ep.mesSiguiente).toMatchObject({
      quedan: 1,
      usadas: 1,
    })

    const huecos = await http()
      .get(`/agenda/disponibilidad?servicioId=${servicioEp}&desde=${dia}&dias=1`)
      .set(como("berta"))
      .expect(200)
    expect((huecos.body as Disponibilidad).dias[0]?.huecos.map((h) => h.inicio)).not.toContain(
      hora(dia, 12),
    )
  })

  it("repetir la operación con el mismo contenido devuelve la misma reserva y no gasta otra sesión", async () => {
    await activar("berta", "bono-ep-6")
    const operacionId = randomUUID()
    const primera = (await reservar("berta", hora(DIA, 9), { operacionId }).expect(201))
      .body as Reserva
    const segunda = (await reservar("berta", hora(DIA, 9), { operacionId }).expect(201))
      .body as Reserva
    expect(segunda.id).toBe(primera.id)
    expect((await saldo("berta")).ep.bonos[0]?.quedan).toBe(5)
    const distinta = await reservar("berta", hora(DIA, 10), { operacionId }).expect(409)
    expect(distinta.body.codigo).toBe("operacion_incompatible")
  })

  it("dos clientes a por el mismo hueco a la vez: uno lo consigue, el otro recibe conflicto", async () => {
    await activar("carla", "bono-ep-6")
    const [a, b] = await Promise.all([
      reservar("berta", hora(DIA, 11)),
      reservar("carla", hora(DIA, 11)),
    ])
    expect([a.status, b.status].sort()).toEqual([201, 409])
    const perdedora = a.status === 409 ? a : b
    expect(perdedora.body.codigo).toBe("hueco_no_disponible")
    expect(
      await prisma.reserva.count({
        where: { inicio: new Date(hora(DIA, 11)), estado: "confirmada" },
      }),
    ).toBe(1)
  })

  it("con una sola sesión, dos reservas a la vez dejan una sola", async () => {
    await activar("dora", "ep-suelta")
    const [a, b] = await Promise.all([
      reservar("dora", hora(DIA, 13)),
      reservar("dora", hora(DIA, 8)),
    ])
    expect([a.status, b.status].sort()).toEqual([201, 409])
    expect([a.body.codigo, b.body.codigo]).toContain("sin_saldo")
    expect(
      await prisma.reserva.count({ where: { clienteId: ids.dora, estado: "confirmada" } }),
    ).toBe(1)
    expect((await saldo("dora")).ep.disponibles).toBe(0)
  })

  it("un hueco fuera de la disponibilidad se rechaza aunque esté libre", async () => {
    const respuesta = await reservar("berta", hora(DIA, 15)).expect(409)
    expect(respuesta.body.codigo).toBe("hueco_no_disponible")
  })
})

describe("orden de gasto y caducidad de los bonos", () => {
  it("gasta el bono empezado antes que el sin empezar, fija la caducidad al primer uso y la deshace al devolver la única", async () => {
    const dia = sumarDiasFecha(hoy, 4)
    await activar("eva", "bono-ep-8")
    await activar("eva", "ep-suelta")
    const primera = (await reservar("eva", hora(dia, 8)).expect(201)).body as Reserva
    expect(primera.fuenteSaldo).toBe("Bono EP 8")
    let resumen = await saldo("eva")
    const bono8 = resumen.ep.bonos.find((b) => b.nombre === "Bono EP 8")!
    expect(bono8).toMatchObject({ quedan: 7, primerUsoEn: dia, caducaEn: sumarDiasFecha(dia, 365) })

    await activar("eva", "bono-ep-6")
    const segunda = (await reservar("eva", hora(dia, 9)).expect(201)).body as Reserva
    expect(segunda.fuenteSaldo).toBe("Bono EP 8")

    await http()
      .post(`/agenda/mis-reservas/${segunda.id}/cancelar`)
      .set(como("eva"))
      .send({})
      .expect(200)
    await http()
      .post(`/agenda/mis-reservas/${primera.id}/cancelar`)
      .set(como("eva"))
      .send({})
      .expect(200)
    resumen = await saldo("eva")
    expect(resumen.ep.bonos.find((b) => b.nombre === "Bono EP 8")).toMatchObject({
      quedan: 8,
      primerUsoEn: null,
      caducaEn: null,
    })
    // La suelta va al final: primero los bonos.
    expect(resumen.ep.bonos.at(-1)?.nombre).toBe("EP suelta")
    expect(resumen.ep.disponibles).toBe(15)
  })
})

describe("cancelar y devolver", () => {
  it("antes del plazo devuelve la sesión; después libera el hueco y la pierde; el entrenador siempre la devuelve y puede devolverla a mano una vez", async () => {
    const dia = sumarDiasFecha(hoy, 5)
    const aTiempo = (await reservar("carla", hora(dia, 8)).expect(201)).body as Reserva
    await http()
      .post(`/agenda/mis-reservas/${aTiempo.id}/cancelar`)
      .set(como("carla"))
      .send({})
      .expect(200)
    expect((await saldo("carla")).ep.disponibles).toBe(6)

    await prisma.ajustesAgenda.update({ where: { id: 1 }, data: { cancelacionHoras: 168 } })
    try {
      const tarde = (await reservar("carla", hora(dia, 9)).expect(201)).body as Reserva
      const cancelada = (
        await http()
          .post(`/agenda/mis-reservas/${tarde.id}/cancelar`)
          .set(como("carla"))
          .send({ motivo: "No llego" })
          .expect(200)
      ).body as Reserva
      expect(cancelada.cancelacion).toMatchObject({
        porEntrenador: false,
        sesionDevuelta: false,
        motivo: "No llego",
      })
      expect((await saldo("carla")).ep.disponibles).toBe(5)
      // El hueco queda libre.
      const libre = await http()
        .get(`/agenda/disponibilidad?servicioId=${servicioEp}&desde=${dia}&dias=1`)
        .set(como("berta"))
        .expect(200)
      expect((libre.body as Disponibilidad).dias[0]?.huecos.map((h) => h.inicio)).toContain(
        hora(dia, 9),
      )

      const devuelta = (
        await http()
          .post(`/agenda/reservas/${tarde.id}/devolver`)
          .set(como("entrenador"))
          .expect(200)
      ).body as Reserva
      expect(devuelta.devueltaAMano).toBe(true)
      expect((await saldo("carla")).ep.disponibles).toBe(6)
      const otraVez = await http()
        .post(`/agenda/reservas/${tarde.id}/devolver`)
        .set(como("entrenador"))
        .expect(409)
      expect(otraVez.body.codigo).toBe("estado_incompatible")

      const delEntrenador = (await reservar("carla", hora(dia, 10)).expect(201)).body as Reserva
      const porEl = (
        await http()
          .post(`/agenda/reservas/${delEntrenador.id}/cancelar`)
          .set(como("entrenador"))
          .send({})
          .expect(200)
      ).body as Reserva
      expect(porEl.cancelacion).toMatchObject({ porEntrenador: true, sesionDevuelta: true })
      expect((await saldo("carla")).ep.disponibles).toBe(6)
    } finally {
      await prisma.ajustesAgenda.update({ where: { id: 1 }, data: { cancelacionHoras: 24 } })
    }
  })

  it("otro cliente no ve ni cancela una reserva ajena", async () => {
    const ajena = await prisma.reserva.findFirstOrThrow({
      where: { clienteId: ids.berta, estado: "confirmada" },
    })
    await http()
      .post(`/agenda/mis-reservas/${ajena.id}/cancelar`)
      .set(como("carla"))
      .send({})
      .expect(404)
    const mias = await http().get("/agenda/mis-reservas").set(como("carla")).expect(200)
    expect(JSON.stringify(mias.body)).not.toContain(ajena.id)
  })
})

describe("horario, cierres y mover", () => {
  it("un cierre que pisa reservas no se aplica y devuelve cuáles; tras moverla, sí", async () => {
    const dia = sumarDiasFecha(hoy, 6)
    const reserva = (await reservar("berta", hora(dia, 10)).expect(201)).body as Reserva
    const cierre = { tipo: "cierre", inicio: hora(dia, 9), fin: hora(dia, 12), motivo: "Médico" }
    const conflicto = await http()
      .post("/agenda/excepciones")
      .set(como("entrenador"))
      .send(cierre)
      .expect(409)
    expect(conflicto.body.codigo).toBe("reservas_afectadas")
    expect(conflicto.body.conflictos.map((r: Reserva) => r.id)).toEqual([reserva.id])
    expect(await prisma.excepcionAgenda.count({ where: { autorId: ids.entrenador } })).toBe(0)

    const movida = (
      await http()
        .patch(`/agenda/reservas/${reserva.id}`)
        .set(como("entrenador"))
        .send({ inicio: hora(dia, 13), revision: reserva.revision })
        .expect(200)
    ).body as Reserva
    expect(movida.inicio).toBe(hora(dia, 13))
    await http()
      .patch(`/agenda/reservas/${reserva.id}`)
      .set(como("entrenador"))
      .send({ inicio: hora(dia, 8), revision: reserva.revision })
      .expect(409)

    await http().post("/agenda/excepciones").set(como("entrenador")).send(cierre).expect(201)
    const huecos = await http()
      .get(`/agenda/disponibilidad?servicioId=${servicioEp}&desde=${dia}&dias=1`)
      .set(como("ana"))
      .expect(200)
    expect((huecos.body as Disponibilidad).dias[0]?.huecos.map((h) => h.inicio)).toEqual([
      hora(dia, 8),
      hora(dia, 12),
    ])
  })

  it("quitar del horario un tramo con reservas devuelve la lista y no cambia nada", async () => {
    const respuesta = await http()
      .put("/agenda/horario-semanal")
      .set(como("entrenador"))
      .send({ franjas: [{ diaSemana: 1, inicioMin: 480, finMin: 600 }] })
      .expect(409)
    expect(respuesta.body.codigo).toBe("reservas_afectadas")
    expect(respuesta.body.conflictos.length).toBeGreaterThan(0)
    expect(await prisma.franjaSemanal.count()).toBe(7)
  })
})

describe("pareja o grupo", () => {
  it("no gasta saldo, crea un cobro pendiente de 50 € y cancelar lo anula", async () => {
    const dia = sumarDiasFecha(hoy, 7)
    const reserva = (
      await reservar("ana", hora(dia, 10), { servicioId: servicioGrupo, personas: 2 }).expect(201)
    ).body as Reserva
    expect(reserva.fuenteSaldo).toBeNull()
    expect(reserva.cobroCentimos).toBe(5000)
    const cobro = await prisma.cobro.findFirstOrThrow({
      where: { origenTipo: "reserva", origenId: reserva.id },
    })
    expect(cobro).toMatchObject({ estado: "pendiente", importeCentimos: 5000 })
    await http()
      .post(`/agenda/mis-reservas/${reserva.id}/cancelar`)
      .set(como("ana"))
      .send({})
      .expect(200)
    expect((await prisma.cobro.findUniqueOrThrow({ where: { id: cobro.id } })).estado).toBe(
      "anulado",
    )
    await reservar("ana", hora(dia, 11), { servicioId: servicioGrupo, personas: 1 }).expect(400)
  })
})

describe("productos, solicitudes y cobros", () => {
  it("«Lo quiero»: productos ocultos no, una pendiente por producto, activar crea saldo y cobro una sola vez", async () => {
    const visibles = await http().get("/planes/productos").set(como("dora")).expect(200)
    expect(
      visibles.body.productos.every((p: { visibleParaCliente: boolean }) => p.visibleParaCliente),
    ).toBe(true)
    await http()
      .post("/planes/mis-solicitudes")
      .set(como("dora"))
      .send({ operacionId: randomUUID(), productoId: productos["online-entrenamiento"] })
      .expect(404)

    const primera = await http()
      .post("/planes/mis-solicitudes")
      .set(como("dora"))
      .send({ operacionId: randomUUID(), productoId: productos["bono-ep-6"] })
      .expect(201)
    const repetida = await http()
      .post("/planes/mis-solicitudes")
      .set(como("dora"))
      .send({ operacionId: randomUUID(), productoId: productos["bono-ep-6"] })
      .expect(201)
    expect(repetida.body.id).toBe(primera.body.id)
    expect(primera.body).toMatchObject({ estado: "pendiente", precioCentimos: 19200 })

    const pendientes = await http()
      .get("/planes/solicitudes?estado=pendiente")
      .set(como("entrenador"))
      .expect(200)
    expect(pendientes.body.solicitudes.map((s: { id: string }) => s.id)).toContain(primera.body.id)

    const activacion = await http()
      .post(`/planes/solicitudes/${primera.body.id}/activar`)
      .set(como("entrenador"))
      .send({ importeCentimos: 19200 })
      .expect(200)
    expect(activacion.body.cobro).toMatchObject({ estado: "cobrado", importeCentimos: 19200 })
    expect(activacion.body.saldo.ep.disponibles).toBe(6)
    await http()
      .post(`/planes/solicitudes/${primera.body.id}/activar`)
      .set(como("entrenador"))
      .send({ importeCentimos: 19200 })
      .expect(409)
    expect(await prisma.bono.count({ where: { clienteId: ids.dora, nombre: "Bono EP 6" } })).toBe(1)

    const mes = mesDeFecha(hoy)
    const resumen = await http()
      .get(`/planes/cobros/resumen?mes=${mes}`)
      .set(como("entrenador"))
      .expect(200)
    expect(resumen.body.cobrados.map((c: { id: string }) => c.id)).toContain(
      activacion.body.cobro.id,
    )
  })

  it("un plan que empieza «el siguiente» mes no da saldo este", async () => {
    await activar("berta", "presencial-plus", "siguiente")
    const resumen = await saldo("berta")
    expect(resumen.ep.mesActual).toBeNull()
    expect(resumen.ep.mesSiguiente).toMatchObject({ cupo: 4, quedan: 4 })
  })

  it("marcar cobrado un cobro pendiente guarda la fecha", async () => {
    const cobro = await http()
      .post(`/planes/clientes/${ids.eva}/activaciones`)
      .set(como("entrenador"))
      .send({
        operacionId: randomUUID(),
        productoId: productos["ep-suelta"],
        importeCentimos: 3500,
        cobrado: false,
      })
      .expect(200)
    expect(cobro.body.cobro.estado).toBe("pendiente")
    const cobrado = await http()
      .post(`/planes/cobros/${cobro.body.cobro.id}/cobrar`)
      .set(como("entrenador"))
      .expect(200)
    expect(cobrado.body.estado).toBe("cobrado")
    expect(cobrado.body.cobradoEn).not.toBeNull()
  })
})

describe("baja del cliente", () => {
  it("cancela sus reservas futuras con devolución y anula sus solicitudes pendientes", async () => {
    const dia = sumarDiasFecha(hoy, 8)
    const reserva = (await reservar("carla", hora(dia, 8)).expect(201)).body as Reserva
    await http()
      .post("/planes/mis-solicitudes")
      .set(como("carla"))
      .send({ operacionId: randomUUID(), productoId: productos["bono-ep-10"] })
      .expect(201)
    await http().post(`/usuarios/${ids.carla}/desactivar`).set(como("entrenador")).expect(200)
    const fila = await prisma.reserva.findUniqueOrThrow({ where: { id: reserva.id } })
    expect(fila.estado).toBe("cancelada")
    const devolucion = await prisma.movimientoSaldo.findFirst({
      where: { origenTipo: "reserva", origenId: reserva.id, motivo: "devolucion" },
    })
    expect(devolucion).not.toBeNull()
    expect(
      await prisma.solicitudProducto.count({
        where: { clienteId: ids.carla, estado: "pendiente" },
      }),
    ).toBe(0)
  })
})

describe("casos límite de la revisión", () => {
  it("un plan «este mes» no se desplaza detrás de un plan posterior con el que no se solapa", async () => {
    await activar("fede", "presencial-esencial", "siguiente")
    await activar("fede", "presencial-plus", "actual")
    const resumen = await saldo("fede")
    expect(resumen.ep.mesActual).toMatchObject({ cupo: 4, quedan: 4 })
    expect(resumen.ep.mesSiguiente).toMatchObject({ cupo: 2 })
    // Otro plan «este mes» sí pisa el Plus y empieza cuando acaban los dos.
    await activar("fede", "presencial-integral", "actual")
    const planes = (await saldo("fede")).suscripciones.map((s) => [s.nombre, s.mesInicio])
    expect(planes).toContainEqual(["Presencial Integral", sumarMeses(mesDeFecha(hoy), 2)])
  })

  it("mismo id de operación con otro producto o importe: conflicto, no la activación anterior", async () => {
    const operacionId = randomUUID()
    const cuerpo = { operacionId, productoId: productos["bono-ep-6"], cobrado: true }
    const primera = await http()
      .post(`/planes/clientes/${ids.fede}/activaciones`)
      .set(como("entrenador"))
      .send(cuerpo)
      .expect(200)
    // Sin importe, el precio del producto.
    expect(primera.body.cobro.importeCentimos).toBe(19200)
    await http()
      .post(`/planes/clientes/${ids.fede}/activaciones`)
      .set(como("entrenador"))
      .send(cuerpo)
      .expect(200)
    const otra = await http()
      .post(`/planes/clientes/${ids.fede}/activaciones`)
      .set(como("entrenador"))
      .send({ ...cuerpo, productoId: productos["bono-ep-10"] })
      .expect(409)
    expect(otra.body.codigo).toBe("operacion_incompatible")
    expect(await prisma.bono.count({ where: { clienteId: ids.fede, nombre: "Bono EP 10" } })).toBe(
      0,
    )
  })

  it("mover a una fecha en la que el bono ya habrá caducado vuelve a elegir la fuente, o no se mueve", async () => {
    await activar("gala", "ep-suelta")
    const bono = await prisma.bono.findFirstOrThrow({ where: { clienteId: ids.gala } })
    // Una sesión gastada hace casi un año: el bono caduca dentro de cinco días.
    const haceUnAnio = sumarDiasFecha(hoy, -360)
    await prisma.bono.update({
      where: { id: bono.id },
      data: {
        sesiones: 2,
        primerUsoEn: new Date(`${haceUnAnio}T00:00:00Z`),
        caducaEn: new Date(`${sumarDiasFecha(haceUnAnio, 365)}T00:00:00Z`),
      },
    })
    await prisma.movimientoSaldo.create({
      data: {
        clienteId: ids.gala,
        cantidad: -1,
        motivo: "consumo",
        bonoId: bono.id,
        fechaSesion: new Date(`${haceUnAnio}T00:00:00Z`),
        origenTipo: "manual",
        origenId: randomUUID(),
        autorId: ids.entrenador,
      },
    })
    const reserva = (await reservar("gala", hora(sumarDiasFecha(hoy, 2), 10)).expect(201))
      .body as Reserva
    expect(reserva.fuenteSaldo).toBe("EP suelta")
    const lejos = await http()
      .patch(`/agenda/reservas/${reserva.id}`)
      .set(como("entrenador"))
      .send({ inicio: hora(sumarDiasFecha(hoy, 9), 9), revision: reserva.revision })
      .expect(409)
    expect(lejos.body.codigo).toBe("sin_saldo")
    const intacta = await prisma.reserva.findUniqueOrThrow({ where: { id: reserva.id } })
    expect(intacta.inicio.toISOString()).toBe(reserva.inicio)
  })

  it("la caducidad sigue a la sesión gastada más temprana, también si se reserva antes otra más tarde y se cancela", async () => {
    await activar("hugo", "bono-ep-6")
    const tarde = (
      await http()
        .post(`/agenda/clientes/${ids.hugo}/reservas`)
        .set(como("entrenador"))
        .send({
          operacionId: randomUUID(),
          servicioId: servicioEp,
          inicio: hora(sumarDiasFecha(hoy, 20), 10),
          personas: 1,
        })
        .expect(201)
    ).body as Reserva
    const pronto = sumarDiasFecha(hoy, 3)
    await reservar("hugo", hora(pronto, 12)).expect(201)
    let bono = (await saldo("hugo")).ep.bonos[0]
    expect(bono).toMatchObject({ primerUsoEn: pronto, caducaEn: sumarDiasFecha(pronto, 365) })
    await http()
      .post(`/agenda/reservas/${tarde.id}/cancelar`)
      .set(como("entrenador"))
      .send({})
      .expect(200)
    bono = (await saldo("hugo")).ep.bonos[0]
    expect(bono).toMatchObject({ quedan: 5, primerUsoEn: pronto })
  })

  it("las tarifas de grupo no admiten huecos, repetidos ni importes desorbitados, y se responde 400", async () => {
    const ruta = `/agenda/servicios/${servicioGrupo}`
    const incompleta = await http()
      .patch(ruta)
      .set(como("entrenador"))
      .send({ tarifas: [{ personas: 2, precioPorPersonaCentimos: 2500 }] })
      .expect(400)
    expect(incompleta.body.message).toContain("3, 4, 5, 6")
    await http()
      .patch(ruta)
      .set(como("entrenador"))
      .send({
        tarifas: [
          { personas: 2, precioPorPersonaCentimos: 2500 },
          { personas: 2, precioPorPersonaCentimos: 2000 },
        ],
      })
      .expect(400)
    await http()
      .patch(ruta)
      .set(como("entrenador"))
      .send({ tarifas: [{ personas: 2, precioPorPersonaCentimos: 3_000_000_000 }] })
      .expect(400)
    const servicio = await prisma.servicio.findUniqueOrThrow({
      where: { id: servicioGrupo },
      include: { tarifas: true },
    })
    expect(servicio.tarifas).toHaveLength(5)
  })

  it("el saldo de alguien que no es cliente no existe", async () => {
    await http().get(`/planes/clientes/${ids.entrenador}/saldo`).set(como("entrenador")).expect(404)
    await http().get(`/planes/clientes/${randomUUID()}/saldo`).set(como("entrenador")).expect(404)
  })
})

describe("permisos", () => {
  const pedir = (metodo: string, ruta: string): request.Test =>
    metodo === "post" ? http().post(ruta) : metodo === "put" ? http().put(ruta) : http().get(ruta)
  const rutas: [string, string][] = [
    ["get", "/agenda/servicios"],
    ["get", `/agenda/disponibilidad?servicioId=${randomUUID()}&desde=${hoy}`],
    ["get", "/agenda/mis-reservas"],
    ["post", "/agenda/mis-reservas"],
    ["get", `/agenda/reservas?desde=${hoy}&hasta=${hoy}`],
    ["put", "/agenda/horario-semanal"],
    ["get", "/planes/productos"],
    ["get", "/planes/mi-saldo"],
    ["get", "/planes/cobros"],
    ["get", "/planes/solicitudes"],
  ]

  it.each(["nutri", "empleado"] as const)("%s recibe 403 en todas las rutas", async (persona) => {
    for (const [metodo, ruta] of rutas) {
      const respuesta = await pedir(metodo, ruta).set(como(persona)).send({})
      expect([ruta, respuesta.status]).toEqual([ruta, 403])
    }
  })

  it("sin sesión, 401", async () => {
    for (const [metodo, ruta] of rutas) {
      const respuesta = await pedir(metodo, ruta).send({})
      expect([ruta, respuesta.status]).toEqual([ruta, 401])
    }
  })

  it("el cliente no usa las rutas del entrenador", async () => {
    await http().get(`/agenda/reservas?desde=${hoy}&hasta=${hoy}`).set(como("ana")).expect(403)
    await http().get("/planes/cobros").set(como("ana")).expect(403)
    await http().put("/agenda/horario-semanal").set(como("ana")).send({ franjas: [] }).expect(403)
  })
})
