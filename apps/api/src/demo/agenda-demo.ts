import { randomUUID } from "node:crypto"

import { ConflictException } from "@nestjs/common"
import {
  aInstante,
  diaSemanaFecha,
  lunesDeFecha,
  mesDeFecha,
  partesLocales,
  sumarDiasFecha,
  ZONA_AGENDA,
  type ActivacionProducto,
  type Disponibilidad,
  type FranjaSemanal,
  type ListadoProductos,
  type ListadoServicios,
  type Producto,
  type Reserva,
  type Servicio,
  type SolicitudProducto,
} from "@alpha-omega/shared"

import { SaldoService } from "../planes/saldo.service.js"
import { ErrorApiDemo, type Cuenta } from "./api-demo.js"
import { dia, fechasDeLaSemana, instante, type ContextoDemo } from "./contexto-demo.js"

const MS_MINUTO = 60_000

/** Lunes a viernes de 8:00 a 14:00 y de 17:00 a 21:00; sábado de 9:00 a 13:00. */
const HORARIO: FranjaSemanal[] = [
  ...[1, 2, 3, 4, 5].flatMap((diaSemana) => [
    { diaSemana, inicioMin: 8 * 60, finMin: 14 * 60 },
    { diaSemana, inicioMin: 17 * 60, finMin: 21 * 60 },
  ]),
  { diaSemana: 6, inicioMin: 9 * 60, finMin: 13 * 60 },
]

/** Una marca de tiempo del pasado: nunca después de ahora. */
function pasado(fecha: Date): Date {
  return new Date(Math.min(fecha.getTime(), Date.now() - 5 * MS_MINUTO))
}

type Catalogo = { productos: Map<string, Producto>; ep: Servicio; grupo: Servicio }

async function catalogo(ctx: ContextoDemo): Promise<Catalogo> {
  const { productos } = await ctx.api.pedir<ListadoProductos>(
    ctx.entrenador,
    "GET",
    "/planes/productos",
  )
  const { servicios } = await ctx.api.pedir<ListadoServicios>(
    ctx.entrenador,
    "GET",
    "/agenda/servicios",
  )
  const servicio = (codigo: string): Servicio => {
    const encontrado = servicios.find((s) => s.codigo === codigo)
    if (!encontrado) throw new Error(`Falta el servicio ${codigo} en el catálogo inicial`)
    return encontrado
  }
  return {
    productos: new Map(productos.map((p) => [p.codigo, p])),
    ep: servicio("ep_individual"),
    grupo: servicio("ep_grupo"),
  }
}

function producto(cat: Catalogo, codigo: string): Producto {
  const encontrado = cat.productos.get(codigo)
  if (!encontrado) throw new Error(`Falta el producto ${codigo} en el catálogo inicial`)
  return encontrado
}

/** Mueve el cobro, y el saldo que creó la activación, al día en que se hizo. */
async function fecharActivacion(
  ctx: ContextoDemo,
  cobroId: string,
  clienteId: string,
  cuando: Date,
): Promise<void> {
  const fecha = pasado(cuando)
  const cobro = await ctx.prisma.cobro.findUniqueOrThrow({ where: { id: cobroId } })
  await ctx.prisma.cobro.update({
    where: { id: cobroId },
    data: { creadoEn: fecha, ...(cobro.estado === "cobrado" && { cobradoEn: fecha }) },
  })
  // Lo que se concedió en la misma operación: el bono o la suscripción más recientes.
  const desde = new Date(cobro.creadoEn.getTime() - 5_000)
  await ctx.prisma.bono.updateMany({
    where: { clienteId, creadoEn: { gte: desde } },
    data: { creadoEn: fecha },
  })
  await ctx.prisma.suscripcion.updateMany({
    where: { clienteId, creadaEn: { gte: desde } },
    data: { creadaEn: fecha },
  })
}

async function activar(
  ctx: ContextoDemo,
  cat: Catalogo,
  clienteId: string,
  codigo: string,
  opciones: { mesInicio: "actual" | "siguiente"; cobrado: boolean; cuando: Date },
): Promise<ActivacionProducto> {
  const elegido = producto(cat, codigo)
  const activacion = await ctx.api.pedir<ActivacionProducto>(
    ctx.entrenador,
    "POST",
    `/planes/clientes/${clienteId}/activaciones`,
    {
      operacionId: randomUUID(),
      productoId: elegido.id,
      importeCentimos: elegido.precioCentimos,
      mesInicio: opciones.mesInicio,
      cobrado: opciones.cobrado,
    },
  )
  await fecharActivacion(ctx, activacion.cobro.id, clienteId, opciones.cuando)
  return activacion
}

/**
 * Reserva ya pasada. La API no reserva en el pasado, así que se escribe como lo
 * haría `ReservasService.reservar`: la reserva y, en la misma transacción, el
 * consumo de saldo con el propio `SaldoService`. Sin saldo o con el hueco
 * ocupado no se crea (devuelve `false`).
 */
async function reservaPasada(
  ctx: ContextoDemo,
  saldo: SaldoService,
  datos: { cliente: Cuenta; servicio: Servicio; inicio: Date; creadaPor: string },
): Promise<boolean> {
  const id = randomUUID()
  const { fecha } = partesLocales(datos.inicio, ZONA_AGENDA)
  const creadaEn = new Date(datos.inicio.getTime() - ctx.azar.entero(2, 6) * 86_400_000)
  try {
    await ctx.prisma.$transaction(async (tx) => {
      await saldo.bloquearCliente(tx, datos.cliente.id)
      await tx.reserva.create({
        data: {
          id,
          servicioId: datos.servicio.id,
          clienteId: datos.cliente.id,
          inicio: datos.inicio,
          fin: new Date(datos.inicio.getTime() + datos.servicio.duracionMin * MS_MINUTO),
          personas: 1,
          cargoSaldo: datos.servicio.claseDeSaldo ? id : null,
          creadaPorId: datos.creadaPor,
          operacionId: randomUUID(),
          creadaEn,
        },
      })
      if (datos.servicio.claseDeSaldo)
        await saldo.consumir(tx, {
          clienteId: datos.cliente.id,
          clase: datos.servicio.claseDeSaldo,
          fechaSesion: fecha,
          origen: { tipo: "reserva", id },
          autorId: datos.creadaPor,
        })
      await tx.movimientoSaldo.updateMany({
        where: { origenTipo: "reserva", origenId: id },
        data: { creadoEn: creadaEn },
      })
    })
    return true
  } catch (error) {
    const texto = String(error)
    if (error instanceof ConflictException || texto.includes("23P01") || texto.includes("solape"))
      return false
    throw error
  }
}

/**
 * Reserva futura por la API, en el hueco pedido o en el primero libre que se le
 * parezca (el hueco pedido puede estar ocupado o cerrado). Devuelve `null` si no
 * queda saldo o no hay hueco esa semana.
 */
async function reservarCerca(
  ctx: ContextoDemo,
  datos: {
    cliente: Cuenta
    comoCliente: boolean
    servicio: Servicio
    fecha: string
    minutos: number
    personas?: number
  },
): Promise<Reserva | null> {
  const actor = datos.comoCliente ? datos.cliente : ctx.entrenador
  const { dias } = await ctx.api.pedir<Disponibilidad>(
    actor,
    "GET",
    `/agenda/disponibilidad?servicioId=${datos.servicio.id}&desde=${datos.fecha}&dias=7`,
  )
  const huecos = dias.flatMap((d) => d.huecos.map((h) => ({ fecha: d.fecha, inicio: h.inicio })))
  const objetivo = aInstante(datos.fecha, datos.minutos, ZONA_AGENDA)?.getTime()
  const minutosDe = (iso: string): number => partesLocales(new Date(iso), ZONA_AGENDA).minutos
  const elegido =
    huecos.find((h) => Date.parse(h.inicio) === objetivo) ??
    huecos.find((h) => h.fecha === datos.fecha && minutosDe(h.inicio) >= datos.minutos) ??
    huecos.find((h) => minutosDe(h.inicio) === datos.minutos) ??
    huecos[0]
  if (!elegido) return null
  const ruta = datos.comoCliente
    ? "/agenda/mis-reservas"
    : `/agenda/clientes/${datos.cliente.id}/reservas`
  try {
    return await ctx.api.pedir<Reserva>(actor, "POST", ruta, {
      operacionId: randomUUID(),
      servicioId: datos.servicio.id,
      inicio: elegido.inicio,
      personas: datos.personas ?? 1,
    })
  } catch (error) {
    if (error instanceof ErrorApiDemo && error.codigo === "sin_saldo") return null
    throw error
  }
}

export type ResumenAgenda = {
  pasadas: number
  proximas: number
  canceladas: number
  cobrosPendientes: number
}

export async function sembrarAgenda(ctx: ContextoDemo): Promise<ResumenAgenda> {
  const { lucia, marcos, sara, nerea, pablo } = ctx.clientes
  const saldo = ctx.app.get(SaldoService)
  const resumen: ResumenAgenda = { pasadas: 0, proximas: 0, canceladas: 0, cobrosPendientes: 0 }

  await ctx.api.pedir(ctx.entrenador, "PUT", "/agenda/horario-semanal", { franjas: HORARIO })
  await ctx.api.pedir(ctx.entrenador, "PATCH", "/agenda/ajustes", {
    antelacionMin: 120,
    horizonteDias: 28,
    cancelacionHoras: 24,
    intervaloMin: 60,
  })
  const cat = await catalogo(ctx)
  const mes = mesDeFecha(ctx.hoy)

  // ─ Planes y bonos, cada uno el día en que se activó ─
  await activar(ctx, cat, lucia.id, "bono-ep-10", {
    mesInicio: "actual",
    cobrado: true,
    cuando: instante(dia(ctx, -84), 11, 20),
  })
  // El plan de este mes lo pidió ella con «Lo quiero» y el entrenador lo activó.
  const plus = producto(cat, "presencial-plus")
  const pedido = await ctx.api.pedir<SolicitudProducto>(lucia, "POST", "/planes/mis-solicitudes", {
    operacionId: randomUUID(),
    productoId: plus.id,
  })
  const activada = await ctx.api.pedir<ActivacionProducto>(
    ctx.entrenador,
    "POST",
    `/planes/solicitudes/${pedido.id}/activar`,
    { importeCentimos: plus.precioCentimos, mesInicio: "actual", cobrado: true },
  )
  const activadaEn = pasado(instante(mes, 18, 45))
  await ctx.prisma.solicitudProducto.update({
    where: { id: pedido.id },
    data: { creadaEn: pasado(instante(sumarDiasFecha(mes, -2), 21, 5)), resueltaEn: activadaEn },
  })
  await fecharActivacion(ctx, activada.cobro.id, lucia.id, activadaEn)
  // La renovación del mes que viene ya está activada, pendiente de cobro.
  await activar(ctx, cat, lucia.id, "presencial-plus", {
    mesInicio: "siguiente",
    cobrado: false,
    cuando: instante(dia(ctx, -1), 19, 40),
  })
  await activar(ctx, cat, marcos.id, "presencial-esencial", {
    mesInicio: "actual",
    cobrado: true,
    cuando: instante(mes, 8, 30),
  })
  await activar(ctx, cat, sara.id, "bono-ep-10", {
    mesInicio: "actual",
    cobrado: true,
    cuando: instante(dia(ctx, -24), 10, 50),
  })
  await activar(ctx, cat, nerea.id, "ep-suelta", {
    mesInicio: "actual",
    cobrado: true,
    cuando: instante(dia(ctx, -15), 20, 10),
  })
  await activar(ctx, cat, pablo.id, "online-entrenamiento-3m", {
    mesInicio: "actual",
    cobrado: true,
    cuando: instante(mes, 9, 15),
  })

  // Sara quiere un Bono EP 6 para cuando acabe el suyo: «Lo quiero» sin resolver.
  const solicitud = await ctx.api.pedir<SolicitudProducto>(
    sara,
    "POST",
    "/planes/mis-solicitudes",
    {
      operacionId: randomUUID(),
      productoId: producto(cat, "bono-ep-6").id,
    },
  )
  await ctx.prisma.solicitudProducto.update({
    where: { id: solicitud.id },
    data: { creadaEn: pasado(instante(dia(ctx, -1), 21, 10)) },
  })

  // ─ Cierre puntual: el miércoles que viene por la tarde ─
  const miercoles = sumarDiasFecha(lunesDeFecha(ctx.hoy), 9)
  try {
    await ctx.api.pedir(ctx.entrenador, "POST", "/agenda/excepciones", {
      tipo: "cierre",
      inicio: instante(miercoles, 17).toISOString(),
      fin: instante(miercoles, 21).toISOString(),
      motivo: "Formación de primeros auxilios",
    })
  } catch (error) {
    // Una reserva ajena a la demo en ese tiempo impide el cierre; la demo sigue sin él.
    if (!(error instanceof ErrorApiDemo && error.codigo === "reservas_afectadas")) throw error
    ctx.informar("  ! No se crea el cierre del miércoles: hay reservas ajenas a la demo")
  }

  // ─ Reservas pasadas, en orden, gastando saldo como lo gastaría la API ─
  const ahora = Date.now()
  const pasadas: { cliente: Cuenta; inicio: Date }[] = []
  const semanal = (cliente: Cuenta, desde: string, diaSemana: number, hora: number): void => {
    for (const fecha of fechasDeLaSemana(desde, ctx.hoy, diaSemana))
      pasadas.push({ cliente, inicio: instante(fecha, hora) })
  }
  semanal(lucia, dia(ctx, -83), 2, 18)
  semanal(sara, dia(ctx, -23), 4, 10)
  // Marcos gasta una de las dos sesiones de su plan de este mes; la otra, en la próxima cita.
  const lunesPasado = fechasDeLaSemana(mes, dia(ctx, -1), 1).at(-1)
  if (lunesPasado) pasadas.push({ cliente: marcos, inicio: instante(lunesPasado, 19) })
  // Una cita de Sara esta misma mañana (una hora después de abrir), si ya ha pasado.
  const franjaDeHoy = HORARIO.find((f) => f.diaSemana === diaSemanaFecha(ctx.hoy))
  if (franjaDeHoy)
    pasadas.push({ cliente: sara, inicio: instante(ctx.hoy, franjaDeHoy.inicioMin / 60 + 1) })
  pasadas.sort((a, b) => a.inicio.getTime() - b.inicio.getTime())
  for (const { cliente, inicio } of pasadas) {
    if (inicio.getTime() + cat.ep.duracionMin * MS_MINUTO > ahora) continue
    const creadaPor = ctx.azar.probabilidad(0.6) ? cliente.id : ctx.entrenador.id
    if (await reservaPasada(ctx, saldo, { cliente, servicio: cat.ep, inicio, creadaPor }))
      resumen.pasadas++
  }

  // ─ Próximas: la primera cita libre (hoy o mañana) y las habituales ─
  // La primera libre es para Marcos; si su plan ya no cubre ese día, para Sara.
  let primeraLibre: Reserva | null = null
  for (const cliente of [marcos, sara]) {
    primeraLibre = await reservarCerca(ctx, {
      cliente,
      comoCliente: false,
      servicio: cat.ep,
      fecha: ctx.hoy,
      minutos: 0,
    })
    if (primeraLibre) break
  }
  const proximas: (Reserva | null)[] = [primeraLibre]
  const lunesSiguiente = sumarDiasFecha(lunesDeFecha(ctx.hoy), 7)
  for (const semana of [0, 7]) {
    const martes = sumarDiasFecha(lunesDeFecha(ctx.hoy), 1 + semana)
    if (martes > ctx.hoy)
      proximas.push(
        await reservarCerca(ctx, {
          cliente: lucia,
          comoCliente: true,
          servicio: cat.ep,
          fecha: martes,
          minutos: 18 * 60,
        }),
      )
  }
  proximas.push(
    await reservarCerca(ctx, {
      cliente: lucia,
      comoCliente: true,
      servicio: cat.ep,
      fecha: sumarDiasFecha(lunesSiguiente, 8),
      minutos: 18 * 60,
    }),
    await reservarCerca(ctx, {
      cliente: sara,
      comoCliente: true,
      servicio: cat.ep,
      fecha: sumarDiasFecha(lunesSiguiente, 3),
      minutos: 10 * 60,
    }),
  )
  // Nerea: sesión en pareja con una amiga, se paga allí (cobro pendiente).
  proximas.push(
    await reservarCerca(ctx, {
      cliente: nerea,
      comoCliente: false,
      servicio: cat.grupo,
      fecha: sumarDiasFecha(lunesSiguiente, 3),
      minutos: 19 * 60,
      personas: 2,
    }),
  )
  resumen.proximas = proximas.filter((r) => r !== null).length

  // Nerea reservó con su sesión suelta y canceló a tiempo: la sesión vuelve.
  const cancelable = await reservarCerca(ctx, {
    cliente: nerea,
    comoCliente: true,
    servicio: cat.ep,
    fecha: sumarDiasFecha(lunesSiguiente, 4),
    minutos: 9 * 60,
  })
  if (cancelable) {
    await ctx.api.pedir(nerea, "POST", `/agenda/mis-reservas/${cancelable.id}/cancelar`, {
      motivo: "Me ha surgido un viaje de trabajo",
    })
    resumen.canceladas++
  }

  resumen.cobrosPendientes = await ctx.prisma.cobro.count({
    where: { clienteId: { in: Object.values(ctx.ids) }, estado: "pendiente" },
  })
  return resumen
}
