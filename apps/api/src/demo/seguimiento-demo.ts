import { randomUUID } from "node:crypto"

import {
  crearPruebaEstandar,
  diaSemanaFecha,
  sumarDiasFecha,
  type ConfiguracionSeguimiento,
  type DefinicionCorporal,
  type DefinicionPrueba,
  type IntencionSubida,
  type ListadoAvisosSeguimiento,
  type MedioFoto,
  type PlantillaValoracion,
  type ProximaRevision,
  type PublicacionValoracion,
  type ResultadoCorporal,
  type ResultadoPrueba,
  type SolicitudFotos,
  type ValoracionProfesional,
  type VistaFoto,
} from "@alpha-omega/shared"

import type { Cuenta } from "./api-demo.js"
import { unDecimal } from "./azar.js"
import { dia, diasEntre, instante, type ContextoDemo } from "./contexto-demo.js"
import { silueta } from "./imagen-demo.js"

// ─── Curvas inventadas ───

/** Interpolación lineal entre puntos `[día, valor]` ordenados. */
function curva(puntos: [number, number][]): (d: number) => number {
  return (d) => {
    const primero = puntos[0]!
    if (d <= primero[0]) return primero[1]
    for (let i = 1; i < puntos.length; i++) {
      const [x1, y1] = puntos[i]!
      const [x0, y0] = puntos[i - 1]!
      if (d <= x1) return y0 + ((y1 - y0) * (d - x0)) / (x1 - x0)
    }
    return puntos.at(-1)![1]
  }
}

/** Lucía: día 0 = hace 84 días (valoración inicial); día 42 = revisión; día 84 = hoy. */
const PESO_LUCIA = curva([
  [0, 72.1],
  [14, 71.2],
  [28, 70.1],
  [42, 69.2],
  [56, 68.3],
  [70, 67.3],
  [84, 66.5],
])
const CINTURA_LUCIA = curva([
  [0, 82.0],
  [42, 78.6],
  [84, 75.6],
])
const GRASA_LUCIA = curva([
  [0, 31.6],
  [42, 29.4],
  [84, 27.5],
])
const DIAS_LUCIA = 84

// ─── Escrituras pequeñas ───

async function configurar(
  ctx: ContextoDemo,
  clienteId: string,
  documento: Omit<ConfiguracionSeguimiento, "revision">,
): Promise<void> {
  await ctx.api.pedir(ctx.entrenador, "PUT", `/seguimiento/clientes/${clienteId}/configuracion`, {
    revision: 0,
    ...documento,
  })
}

type Dia = { pesoKg?: number; pasos?: number; suenoMin?: number; creatina?: boolean }

async function apuntarDia(
  ctx: ContextoDemo,
  cuenta: Cuenta,
  fecha: string,
  datos: Dia,
): Promise<void> {
  if (Object.keys(datos).length === 0) return
  await ctx.api.pedir(cuenta, "PUT", `/seguimiento/clientes/${cuenta.id}/dias/${fecha}`, datos)
}

async function medir(
  ctx: ContextoDemo,
  autor: Cuenta,
  clienteId: string,
  fecha: string,
  valores: { pesoKg?: number; cinturaCm?: number; grasaPct?: number; alturaCm?: number },
): Promise<void> {
  const medida = await ctx.api.pedir<{ id: string }>(
    autor,
    "POST",
    `/seguimiento/clientes/${clienteId}/medidas`,
    {
      operacionId: randomUUID(),
      fecha,
      pesoKg: valores.pesoKg ?? null,
      cinturaCm: valores.cinturaCm ?? null,
      grasaPct: valores.grasaPct ?? null,
      alturaCm: valores.alturaCm ?? null,
    },
  )
  await ctx.prisma.medidaCorporal.update({
    where: { id: medida.id },
    data: { creadoEn: instante(fecha, 8, 20) },
  })
}

async function anotarPrueba(
  ctx: ContextoDemo,
  autor: Cuenta,
  clienteId: string,
  fecha: string,
  pruebaId: string,
  valor: number,
): Promise<void> {
  const prueba = await ctx.api.pedir<{ id: string }>(
    autor,
    "POST",
    `/seguimiento/clientes/${clienteId}/pruebas`,
    { operacionId: randomUUID(), fecha, pruebaId, valor },
  )
  await ctx.prisma.pruebaFisica.update({
    where: { id: prueba.id },
    data: { creadoEn: instante(fecha, 19, 10) },
  })
}

// ─── Fotos ───

/** Sube una silueta inventada por el flujo real: intención, PUT al almacén y confirmación. */
async function subirFoto(
  ctx: ContextoDemo,
  cliente: Cuenta,
  destino: { tipo: "solicitud"; solicitudId: string } | { tipo: "progreso" },
  vista: VistaFoto,
  fechaToma: string,
  volumen: number,
): Promise<MedioFoto> {
  const png = silueta(vista === "frente" ? "frente" : "perfil", volumen)
  const { medio, subida } = await ctx.api.pedir<IntencionSubida>(
    cliente,
    "POST",
    "/medios/subidas",
    {
      operacionId: randomUUID(),
      clienteId: cliente.id,
      destino,
      vista,
      etiqueta: null,
      fechaToma,
      tipoMime: "image/png",
      bytes: png.length,
    },
  )
  if (subida) await ctx.api.subirArchivo(subida.url, "image/png", png)
  const confirmado = await ctx.api.pedir<MedioFoto>(
    cliente,
    "POST",
    `/medios/${medio.id}/confirmacion`,
  )
  const subidaEn = instante(fechaToma, 8, 35)
  await ctx.prisma.medioFoto.update({
    where: { id: medio.id },
    data: { creadoEn: subidaEn, confirmadoEn: new Date(subidaEn.getTime() + 40_000) },
  })
  return confirmado
}

type Toma = { fecha: string; volumen: number; vistas: VistaFoto[] }

/** El entrenador pide fotos; el cliente las aporta. `revisar` cierra la solicitud. */
async function tomaPedida(
  ctx: ContextoDemo,
  cliente: Cuenta,
  toma: Toma,
  mensaje: string,
  revisar: boolean,
): Promise<{ solicitudId: string; medios: MedioFoto[] }> {
  const solicitud = await ctx.api.pedir<SolicitudFotos>(
    ctx.entrenador,
    "POST",
    `/seguimiento/clientes/${cliente.id}/solicitudes-fotos`,
    {
      operacionId: randomUUID(),
      vistas: toma.vistas,
      fechaLimite: sumarDiasFecha(toma.fecha, 2),
      mensaje,
    },
  )
  const medios: MedioFoto[] = []
  for (const vista of toma.vistas)
    medios.push(
      await subirFoto(
        ctx,
        cliente,
        { tipo: "solicitud", solicitudId: solicitud.id },
        vista,
        toma.fecha,
        toma.volumen,
      ),
    )
  if (revisar)
    await ctx.api.pedir(
      ctx.entrenador,
      "POST",
      `/seguimiento/clientes/${cliente.id}/solicitudes-fotos/${solicitud.id}/revision`,
      { operacionId: randomUUID() },
    )
  await ctx.prisma.solicitudFotos.update({
    where: { id: solicitud.id },
    data: {
      creadaEn: instante(sumarDiasFecha(toma.fecha, -2), 12, 30),
      recibidaEn: instante(toma.fecha, 8, 36),
      ...(revisar && { revisadaEn: instante(sumarDiasFecha(toma.fecha, 1), 9, 40) }),
    },
  })
  return { solicitudId: solicitud.id, medios }
}

// ─── Valoraciones ───

const corporal = (
  bloque: DefinicionCorporal["bloque"],
  magnitud: DefinicionCorporal["magnitud"],
  nombre: string,
  unidad: DefinicionCorporal["unidad"],
  extra: Partial<
    Pick<DefinicionCorporal, "zona" | "lateralidad" | "instrumento" | "protocolo">
  > = {},
): DefinicionCorporal => ({
  id: randomUUID(),
  version: 1,
  bloque,
  magnitud,
  nombre,
  unidad,
  zona: extra.zona ?? null,
  lateralidad: extra.lateralidad ?? null,
  instrumento: extra.instrumento ?? null,
  protocolo: extra.protocolo ?? null,
  activa: true,
})

type Visita = {
  tipo: "inicial" | "revision"
  fecha: string
  anteriorId?: string
  cumplePauta?: number | null
  corporales: Record<string, number>
  lecturas?: Record<string, number[]>
  pruebas: Record<string, Record<string, number>>
  grasaPorPliegues?: { valorPct: number; metodo: string }
  destacados?: string[]
  conclusion: string
  notasInternas: string | null
  fotos: string[]
}

/** Crea, rellena y publica una visita, con la fecha en que se hizo. */
async function valorar(
  ctx: ContextoDemo,
  clienteId: string,
  plantilla: PlantillaValoracion,
  visita: Visita,
): Promise<PublicacionValoracion> {
  const base = `/seguimiento/clientes/${clienteId}/valoraciones`
  const bloques = [
    ...new Set([
      ...plantilla.corporales.map((d) => d.bloque),
      ...(plantilla.pruebas.length > 0 ? (["pruebas"] as const) : []),
      ...(visita.fotos.length > 0 ? (["fotos"] as const) : []),
    ]),
  ]
  const creada = await ctx.api.pedir<ValoracionProfesional>(ctx.entrenador, "POST", base, {
    operacionId: randomUUID(),
    tipo: visita.tipo,
    fechaToma: visita.fecha,
    bloques,
    ...(visita.tipo === "revision" && {
      anteriorId: visita.anteriorId,
      cumplePauta: visita.cumplePauta ?? null,
    }),
  })
  const borrador = creada.borrador!
  const corporales: ResultadoCorporal[] = borrador.documento.definiciones.corporales.map((d) => {
    const valor = visita.corporales[d.nombre]
    if (valor === undefined) return { definicionId: d.id, estado: "noRealizado", motivo: null }
    const lecturas = visita.lecturas?.[d.nombre]
    return { definicionId: d.id, estado: "registrado", valor, ...(lecturas && { lecturas }) }
  })
  const pruebas: ResultadoPrueba[] = borrador.documento.definiciones.pruebas.map((d) => {
    const valores = visita.pruebas[d.nombre]
    if (!valores)
      return { definicionId: d.id, estado: "noRealizado", motivo: "No dio tiempo en la visita" }
    return {
      definicionId: d.id,
      estado: "registrado",
      valores,
      protocoloCompleto: true,
      fecha: null,
      notas: null,
    }
  })
  const definiciones = [
    ...borrador.documento.definiciones.corporales,
    ...borrador.documento.definiciones.pruebas,
  ]
  const guardada = await ctx.api.pedir<ValoracionProfesional>(
    ctx.entrenador,
    "PUT",
    `${base}/${creada.id}`,
    {
      borradorId: borrador.id,
      revision: borrador.revision,
      fechaToma: visita.fecha,
      contenido: {
        bloques,
        corporales,
        pruebas,
        grasaPorPliegues: visita.grasaPorPliegues
          ? { ...visita.grasaPorPliegues, fecha: visita.fecha }
          : null,
        destacados: (visita.destacados ?? [])
          .map((nombre) => definiciones.find((d) => d.nombre === nombre)?.id)
          .filter((id): id is string => id !== undefined),
        conclusion: visita.conclusion,
        notasInternas: visita.notasInternas,
      },
    },
  )
  for (const medioId of visita.fotos)
    await ctx.api.pedir(ctx.entrenador, "POST", `${base}/${creada.id}/fotos`, { medioId })
  const publicada = await ctx.api.pedir<PublicacionValoracion>(
    ctx.entrenador,
    "POST",
    `${base}/${creada.id}/publicaciones`,
    {
      operacionId: randomUUID(),
      borradorId: borrador.id,
      revision: guardada.borrador!.revision,
      sustituyePublicacionId: null,
    },
  )

  // La visita, su borrador y su publicación, el día en que se hicieron.
  const empezada = instante(visita.fecha, 10, 0)
  const publicadaEn = instante(visita.fecha, 13, 20)
  await ctx.prisma.valoracion.update({ where: { id: creada.id }, data: { creadaEn: empezada } })
  await ctx.prisma.borradorValoracion.update({
    where: { id: borrador.id },
    data: { creadoEn: empezada, actualizadoEn: instante(visita.fecha, 12, 45) },
  })
  await ctx.prisma.publicacionValoracion.update({
    where: { id: publicada.id },
    data: { publicadaEn },
  })
  await ctx.prisma.operacionValoracion.updateMany({
    where: { valoracionId: creada.id },
    data: { creadoEn: empezada },
  })
  await ctx.prisma.medioFoto.updateMany({
    where: { valoracionId: creada.id, publicadaEn: { not: null } },
    data: { publicadaEn },
  })
  return publicada
}

async function pautar(
  ctx: ContextoDemo,
  clienteId: string,
  pauta: { fecha: string | null; intervaloSemanas: number | null; bloques: string[] },
): Promise<number> {
  const ruta = `/seguimiento/clientes/${clienteId}/proxima-revision`
  const actual = await ctx.api.pedir<ProximaRevision>(ctx.entrenador, "GET", ruta)
  const guardada = await ctx.api.pedir<ProximaRevision>(ctx.entrenador, "PUT", ruta, {
    revision: actual.revision,
    pauta,
  })
  return guardada.revision
}

// ─── Lucía: todo el seguimiento ───

async function seguimientoLucia(ctx: ContextoDemo): Promise<Record<string, number>> {
  const lucia = ctx.clientes.lucia
  const dia0 = dia(ctx, -DIAS_LUCIA)
  const flexiones = randomUUID()
  const plancha = randomUUID()
  const sentadillas = randomUUID()
  await configurar(ctx, lucia.id, {
    indicadores: ["peso", "cintura", "pasos", "sueno", "fuerza", "pruebas"],
    registrosSolicitados: [
      { indicador: "peso", frecuencia: "diaria", diaSemana: null },
      { indicador: "pasos", frecuencia: "diaria", diaSemana: null },
      { indicador: "sueno", frecuencia: "diaria", diaSemana: null },
      { indicador: "cintura", frecuencia: "semanal", diaSemana: diaSemanaFecha(dia0) },
    ],
    objetivoPeso: { direccion: "bajar", rangoKg: { minimo: 64, maximo: 66 } },
    pruebasPrescritas: [
      { id: flexiones, nombre: "Flexiones seguidas", unidad: "reps" },
      { id: plancha, nombre: "Plancha", unidad: "s" },
      { id: sentadillas, nombre: "Sentadillas en 1 minuto", unidad: "reps" },
    ],
  })

  // Registro diario: peso en ayunas casi todos los días, pasos y sueño.
  let dias = 0
  for (let d = 0; d <= DIAS_LUCIA; d++) {
    const fecha = dia(ctx, d - DIAS_LUCIA)
    const esHoy = d === DIAS_LUCIA
    if (!esHoy && ctx.azar.probabilidad(0.04)) continue
    const semana = new Date(`${fecha}T00:00:00Z`).getUTCDay()
    const finde = semana === 0 || semana === 6
    const lunes = semana === 1
    const pasosDia = Math.round(
      5800 +
        3200 * (d / DIAS_LUCIA) +
        (semana === 0 ? 4200 : finde ? -900 : 0) +
        ctx.azar.ruido(1400),
    )
    await apuntarDia(ctx, lucia, fecha, {
      ...(ctx.azar.probabilidad(0.86) && {
        pesoKg: unDecimal(PESO_LUCIA(d) + (lunes ? 0.35 : 0) + ctx.azar.ruido(0.3)),
      }),
      pasos: esHoy ? Math.round(pasosDia * 0.35) : Math.max(1500, pasosDia),
      suenoMin: Math.round(415 + (finde ? 35 : 0) + ctx.azar.ruido(45)),
      ...(d >= 3 && { creatina: ctx.azar.probabilidad(0.88) }),
    })
    dias++
  }

  // Medidas cada semana, el mismo día: las apunta ella; los días de visita, el entrenador.
  let medidas = 0
  for (let d = 0; d <= DIAS_LUCIA; d += 7) {
    const fecha = dia(ctx, d - DIAS_LUCIA)
    const visita = d === 0 || d === 42
    if (visita)
      await medir(ctx, ctx.entrenador, lucia.id, fecha, {
        pesoKg: unDecimal(PESO_LUCIA(d)),
        cinturaCm: unDecimal(CINTURA_LUCIA(d)),
        grasaPct: unDecimal(GRASA_LUCIA(d)),
        ...(d === 0 && { alturaCm: 166 }),
      })
    else
      await medir(ctx, lucia, lucia.id, fecha, {
        pesoKg: unDecimal(PESO_LUCIA(d) + ctx.azar.ruido(0.2)),
        cinturaCm: unDecimal(CINTURA_LUCIA(d) + ctx.azar.ruido(0.3)),
      })
    medidas++
  }

  // Pruebas cada cuatro semanas.
  const marcas: [number, number, number, number][] = [
    [0, 8, 40, 30],
    [28, 11, 55, 34],
    [56, 15, 70, 37],
    [DIAS_LUCIA - 1, 18, 85, 40],
  ]
  for (const [d, f, p, s] of marcas) {
    const fecha = dia(ctx, d - DIAS_LUCIA)
    await anotarPrueba(ctx, lucia, lucia.id, fecha, flexiones, f)
    await anotarPrueba(ctx, lucia, lucia.id, fecha, plancha, p)
    await anotarPrueba(ctx, lucia, lucia.id, fecha, sentadillas, s)
  }

  // Plantilla de valoración: medidas, pliegues, báscula y pruebas estándar.
  const cinta = { instrumento: "Cinta métrica" }
  const plicometro = { instrumento: "Plicómetro Harpenden" }
  const bascula = { instrumento: "Báscula de bioimpedancia" }
  const plantilla = await ctx.api.pedir<PlantillaValoracion>(
    ctx.entrenador,
    "PUT",
    `/seguimiento/clientes/${lucia.id}/plantilla-valoracion`,
    {
      revision: 0,
      corporales: [
        corporal("medidas", "peso", "Peso", "kg", { instrumento: "Báscula del centro" }),
        corporal("medidas", "altura", "Altura", "cm", { instrumento: "Tallímetro" }),
        corporal("medidas", "perimetro", "Cintura", "cm", {
          ...cinta,
          zona: "A la altura del ombligo",
        }),
        corporal("medidas", "perimetro", "Cadera", "cm", { ...cinta, zona: "Parte más ancha" }),
        corporal("medidas", "perimetro", "Muslo derecho", "cm", {
          ...cinta,
          zona: "Mitad del muslo",
          lateralidad: "derecha",
        }),
        corporal("medidas", "perimetro", "Brazo derecho", "cm", {
          ...cinta,
          zona: "Mitad del brazo, relajado",
          lateralidad: "derecha",
        }),
        corporal("pliegues", "pliegue", "Tríceps", "mm", { ...plicometro, lateralidad: "derecha" }),
        corporal("pliegues", "pliegue", "Suprailíaco", "mm", {
          ...plicometro,
          lateralidad: "derecha",
        }),
        corporal("pliegues", "pliegue", "Muslo", "mm", { ...plicometro, lateralidad: "derecha" }),
        corporal("bioimpedancia", "grasa", "Grasa corporal", "%", bascula),
        corporal("bioimpedancia", "masaMuscular", "Masa muscular", "kg", bascula),
        corporal("bioimpedancia", "agua", "Agua corporal", "%", bascula),
        corporal("bioimpedancia", "grasaVisceral", "Grasa visceral", "indice", bascula),
      ],
      pruebas: [
        crearPruebaEstandar("flexiones1min", randomUUID(), "Con rodillas apoyadas"),
        crearPruebaEstandar("sentadillas1min", randomUUID()),
        crearPruebaEstandar("suspension", randomUUID()),
        crearPruebaEstandar("cooper", randomUUID()),
      ] satisfies DefinicionPrueba[],
    },
  )

  // Tres tomas de fotos, de frente y de perfil: pedida, por su cuenta y pedida
  // y aún sin revisar. Entre medias, dos fotos de frente sueltas desde Progreso.
  const toma1 = await tomaPedida(
    ctx,
    lucia,
    { fecha: dia0, volumen: 0.9, vistas: ["frente", "perfilIzquierdo"] },
    "Fotos de partida: con luz natural y ropa ajustada.",
    true,
  )
  const sueltas = [await subirFoto(ctx, lucia, { tipo: "progreso" }, "frente", dia(ctx, -63), 0.75)]
  const fecha2 = dia(ctx, -42)
  const toma2 = [
    await subirFoto(ctx, lucia, { tipo: "progreso" }, "frente", fecha2, 0.55),
    await subirFoto(ctx, lucia, { tipo: "progreso" }, "perfilIzquierdo", fecha2, 0.55),
  ]
  sueltas.push(await subirFoto(ctx, lucia, { tipo: "progreso" }, "frente", dia(ctx, -21), 0.4))
  await tomaPedida(
    ctx,
    lucia,
    { fecha: dia(ctx, -2), volumen: 0.25, vistas: ["frente", "perfilIzquierdo"] },
    "Fotos para la revisión de la semana que viene, con la misma luz que las primeras.",
    false,
  )

  const inicial = await valorar(ctx, lucia.id, plantilla, {
    tipo: "inicial",
    fecha: dia0,
    corporales: {
      Peso: 72.1,
      Altura: 166,
      Cintura: 82,
      Cadera: 104,
      "Muslo derecho": 60.5,
      "Brazo derecho": 30.5,
      Tríceps: 24,
      Suprailíaco: 22,
      Muslo: 31,
      "Grasa corporal": 31.6,
      "Masa muscular": 45.2,
      "Agua corporal": 49.5,
      "Grasa visceral": 6,
    },
    lecturas: { Tríceps: [23.5, 24.5], Suprailíaco: [22, 22], Muslo: [30.5, 31.5] },
    grasaPorPliegues: { valorPct: 30.4, metodo: "Jackson-Pollock, 3 pliegues" },
    pruebas: {
      "Flexiones en 1 minuto": { repeticiones: 14 },
      "Sentadillas en 1 minuto": { repeticiones: 32 },
      "Aguante en barra": { duracion: 18 },
      Cooper: { distancia: 1850, duracion: 720, fcMedia: 162, fcMaxima: 181 },
    },
    conclusion:
      "Buen punto de partida. Objetivo del bloque: bajar unos 5 kg de grasa sin perder masa muscular. Tres días de fuerza, 8.000 pasos al día y dieta con un déficit suave.",
    notasInternas: "Hombro derecho algo rígido en rotación externa: vigilar en los press.",
    fotos: toma1.medios.map((m) => m.id),
  })

  const pautaRevision = await pautar(ctx, lucia.id, {
    fecha: fecha2,
    intervaloSemanas: null,
    bloques: ["medidas", "pliegues", "bioimpedancia", "pruebas", "fotos"],
  })
  await valorar(ctx, lucia.id, plantilla, {
    tipo: "revision",
    fecha: fecha2,
    anteriorId: inicial.valoracionId,
    cumplePauta: pautaRevision,
    corporales: {
      Peso: 69.2,
      Altura: 166,
      Cintura: 78.6,
      Cadera: 101.5,
      "Muslo derecho": 58.8,
      "Brazo derecho": 30.2,
      Tríceps: 21,
      Suprailíaco: 18.5,
      Muslo: 27.5,
      "Grasa corporal": 29.4,
      "Masa muscular": 45.6,
      "Agua corporal": 51,
      "Grasa visceral": 5,
    },
    lecturas: { Tríceps: [21, 21], Suprailíaco: [18, 19], Muslo: [27.5, 27.5] },
    grasaPorPliegues: { valorPct: 27.3, metodo: "Jackson-Pollock, 3 pliegues" },
    pruebas: {
      "Flexiones en 1 minuto": { repeticiones: 19 },
      "Sentadillas en 1 minuto": { repeticiones: 38 },
      "Aguante en barra": { duracion: 27 },
      Cooper: { distancia: 2010, duracion: 720, fcMedia: 158, fcMaxima: 178 },
    },
    destacados: ["Cintura", "Grasa corporal", "Masa muscular"],
    conclusion:
      "Seis semanas muy constantes: casi 3 kg menos, 3,4 cm menos de cintura y algo más de masa muscular. Seguimos con la misma línea y subimos cargas en la fase de fuerza.",
    notasInternas: null,
    fotos: toma2.map((m) => m.id),
  })
  await pautar(ctx, lucia.id, {
    fecha: dia(ctx, 12),
    intervaloSemanas: null,
    bloques: ["medidas", "bioimpedancia", "pruebas", "fotos"],
  })

  return { dias, medidas, pruebas: marcas.length * 3, fotos: 2 + sueltas.length + 2 + 2 }
}

// ─── El resto de clientes, más ligero ───

async function diasSueltos(
  ctx: ContextoDemo,
  cuenta: Cuenta,
  opciones: {
    desde: string
    hasta: string
    probabilidad: number
    peso?: (d: number) => number
    pasos: [number, number]
    sueno: [number, number]
    creatina?: boolean
  },
): Promise<number> {
  let dias = 0
  const total = diasEntre(opciones.desde, opciones.hasta)
  for (let d = 0; d <= total; d++) {
    const fecha = sumarDiasFecha(opciones.desde, d)
    if (!ctx.azar.probabilidad(opciones.probabilidad)) continue
    await apuntarDia(ctx, cuenta, fecha, {
      ...(opciones.peso && ctx.azar.probabilidad(0.45) && { pesoKg: unDecimal(opciones.peso(d)) }),
      pasos: Math.round(ctx.azar.entre(...opciones.pasos)),
      suenoMin: Math.round(ctx.azar.entre(...opciones.sueno)),
      ...(opciones.creatina && { creatina: ctx.azar.probabilidad(0.8) }),
    })
    dias++
  }
  return dias
}

async function seguimientoMarcos(ctx: ContextoDemo): Promise<void> {
  const marcos = ctx.clientes.marcos
  const inicio = dia(ctx, -50)
  const dominadas = randomUUID()
  await configurar(ctx, marcos.id, {
    indicadores: ["fuerza", "peso", "pasos", "sueno", "pruebas"],
    registrosSolicitados: [{ indicador: "peso", frecuencia: "semanal", diaSemana: 1 }],
    objetivoPeso: { direccion: "mantener", rangoKg: { minimo: 80, maximo: 82 } },
    pruebasPrescritas: [{ id: dominadas, nombre: "Dominadas seguidas", unidad: "reps" }],
  })
  await diasSueltos(ctx, marcos, {
    desde: inicio,
    hasta: dia(ctx, -1),
    probabilidad: 0.6,
    peso: (d) => 81.2 + Math.sin(d / 5) * 0.4 + ctx.azar.ruido(0.3),
    pasos: [6500, 11000],
    sueno: [360, 450],
  })
  for (let d = 0; d <= 49; d += 14)
    await medir(ctx, marcos, marcos.id, sumarDiasFecha(inicio, d), {
      pesoKg: unDecimal(81.4 - d * 0.004 + ctx.azar.ruido(0.3)),
      cinturaCm: unDecimal(88.5 - d * 0.02),
    })
  await anotarPrueba(ctx, marcos, marcos.id, inicio, dominadas, 9)
  await anotarPrueba(ctx, marcos, marcos.id, dia(ctx, -20), dominadas, 11)

  // Valoración inicial publicada y la próxima, pautada por intervalo.
  const bascula = { instrumento: "Báscula de bioimpedancia" }
  const plantilla = await ctx.api.pedir<PlantillaValoracion>(
    ctx.entrenador,
    "PUT",
    `/seguimiento/clientes/${marcos.id}/plantilla-valoracion`,
    {
      revision: 0,
      corporales: [
        corporal("medidas", "peso", "Peso", "kg", { instrumento: "Báscula del centro" }),
        corporal("medidas", "perimetro", "Cintura", "cm", {
          instrumento: "Cinta métrica",
          zona: "A la altura del ombligo",
        }),
        corporal("bioimpedancia", "grasa", "Grasa corporal", "%", bascula),
        corporal("bioimpedancia", "masaMuscular", "Masa muscular", "kg", bascula),
      ],
      pruebas: [
        crearPruebaEstandar("dominadas", randomUUID(), "Agarre prono"),
        crearPruebaEstandar("pressBanca1rm", randomUUID()),
      ],
    },
  )
  await valorar(ctx, marcos.id, plantilla, {
    tipo: "inicial",
    fecha: inicio,
    corporales: { Peso: 81.4, Cintura: 88.5, "Grasa corporal": 19.8, "Masa muscular": 61.3 },
    pruebas: { Dominadas: { repeticiones: 9 }, "Press banca 1RM": { carga: 85 } },
    conclusion:
      "Buena base de fuerza. Bloque de 12 semanas centrado en sentadilla y press militar manteniendo el peso.",
    notasInternas: null,
    fotos: [],
  })
  await pautar(ctx, marcos.id, {
    fecha: null,
    intervaloSemanas: 12,
    bloques: ["medidas", "bioimpedancia", "pruebas"],
  })
}

async function seguimientoResto(ctx: ContextoDemo): Promise<void> {
  const { sara, nerea, pablo } = ctx.clientes
  const inicial = {
    indicadores: ["peso", "pasos", "sueno", "fuerza"] as ConfiguracionSeguimiento["indicadores"],
    registrosSolicitados: [
      { indicador: "pasos" as const, frecuencia: "diaria" as const, diaSemana: null },
      { indicador: "sueno" as const, frecuencia: "diaria" as const, diaSemana: null },
    ],
    objetivoPeso: null,
    pruebasPrescritas: [],
  }

  await configurar(ctx, sara.id, inicial)
  await diasSueltos(ctx, sara, {
    desde: dia(ctx, -24),
    hasta: ctx.hoy,
    probabilidad: 0.8,
    pasos: [5500, 9000],
    sueno: [400, 500],
  })
  await medir(ctx, ctx.entrenador, sara.id, dia(ctx, -24), {
    pesoKg: 58.4,
    cinturaCm: 68,
    alturaCm: 163,
  })
  await medir(ctx, sara, sara.id, dia(ctx, -10), { pesoKg: 58.1, cinturaCm: 67.6 })

  // Nerea apuntaba al principio y lo ha dejado.
  await configurar(ctx, nerea.id, {
    ...inicial,
    objetivoPeso: { direccion: "bajar", rangoKg: null },
  })
  await diasSueltos(ctx, nerea, {
    desde: dia(ctx, -70),
    hasta: dia(ctx, -30),
    probabilidad: 0.35,
    peso: (d) => 68.9 - d * 0.01 + ctx.azar.ruido(0.3),
    pasos: [3500, 7000],
    sueno: [330, 420],
  })
  await medir(ctx, ctx.entrenador, nerea.id, dia(ctx, -70), {
    pesoKg: 68.9,
    cinturaCm: 79.5,
    alturaCm: 161,
  })

  // Pablo, online: muchos pasos y una prueba de 5 km en cinta cada mes.
  const cincoKm = randomUUID()
  await configurar(ctx, pablo.id, {
    indicadores: ["pasos", "sueno", "peso", "pruebas", "fuerza"],
    registrosSolicitados: [
      { indicador: "pasos", frecuencia: "diaria", diaSemana: null },
      { indicador: "peso", frecuencia: "semanal", diaSemana: 1 },
    ],
    objetivoPeso: { direccion: "mantener", rangoKg: null },
    pruebasPrescritas: [{ id: cincoKm, nombre: "5 km en cinta", unidad: "s" }],
  })
  await diasSueltos(ctx, pablo, {
    desde: dia(ctx, -60),
    hasta: dia(ctx, -1),
    probabilidad: 0.75,
    peso: (d) => 74.6 - d * 0.012 + ctx.azar.ruido(0.3),
    pasos: [9500, 16000],
    sueno: [390, 470],
  })
  for (const [d, segundos] of [
    [-58, 1532],
    [-30, 1494],
    [-3, 1461],
  ] as const)
    await anotarPrueba(ctx, pablo, pablo.id, dia(ctx, d), cincoKm, segundos)
  for (const d of [-60, -30, -2])
    await medir(ctx, pablo, pablo.id, dia(ctx, d), {
      pesoKg: unDecimal(74.6 - (d + 60) * 0.012),
    })
}

/**
 * Marca como leídos los avisos de seguimiento (visitas publicadas, fotos
 * pedidas o recibidas) con más de `diasMinimos` días, del cliente y del
 * entrenador; los recientes siguen sin leer.
 */
async function leerAvisos(
  ctx: ContextoDemo,
  clienteId: string,
  diasMinimos: number,
): Promise<void> {
  const limite = Date.now() - diasMinimos * 86_400_000
  const lectores = [
    ctx.entrenador,
    ...Object.values(ctx.clientes).filter((c) => c.id === clienteId),
  ]
  for (const lector of lectores) {
    const ruta = `/seguimiento/clientes/${clienteId}/avisos`
    const { avisos } = await ctx.api.pedir<ListadoAvisosSeguimiento>(lector, "GET", ruta)
    const avisoIds = avisos
      .filter((a) => a.leidoEn === null && Date.parse(a.creadoEn) < limite)
      .map((a) => a.id)
    if (avisoIds.length > 0) await ctx.api.pedir(lector, "POST", `${ruta}/leidos`, { avisoIds })
  }
}

export async function sembrarSeguimiento(ctx: ContextoDemo): Promise<Record<string, number>> {
  const lucia = await seguimientoLucia(ctx)
  await seguimientoMarcos(ctx)
  await seguimientoResto(ctx)
  for (const clave of ["lucia", "marcos"] as const) await leerAvisos(ctx, ctx.clientes[clave].id, 3)
  // Leídos al día siguiente de cada visita publicada o solicitud recibida.
  const ids = Object.values(ctx.ids)
  await ctx.prisma.$executeRaw`
    UPDATE "lecturas_avisos_seguimiento" AS l
    SET "leidoEn" = LEAST(p."publicadaEn" + interval '20 hours', now())
    FROM "publicaciones_valoracion" AS p
    JOIN "valoraciones" AS v ON v."id" = p."valoracionId"
    WHERE l."avisoId" = p."id" AND v."clienteId" = ANY(${ids}::text[])`
  await ctx.prisma.$executeRaw`
    UPDATE "lecturas_avisos_seguimiento" AS l
    SET "leidoEn" = LEAST(COALESCE(s."recibidaEn", s."creadaEn") + interval '20 hours', now())
    FROM "solicitudes_fotos" AS s
    WHERE l."avisoId" = s."id" AND s."clienteId" = ANY(${ids}::text[])`
  return lucia
}
