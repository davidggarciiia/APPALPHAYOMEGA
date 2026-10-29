import { z } from "zod"
import {
  CheckinSchema,
  CierreSchema,
  crearRegistroDeSesionSchema,
  type EjercicioPrescrito,
  type Prescripcion,
  type Registro,
  type SeriePrescrita,
  type SerieRegistrada,
  type ValoresEjecutados,
} from "@alpha-omega/shared"

export type SerieConDistancia = SeriePrescrita
export type EjercicioConDistancia = EjercicioPrescrito
export type PrescripcionConDistancia = Prescripcion
type SerieRegistradaConDistancia = SerieRegistrada
export type RegistroConDistancia = Registro

/** La API ofrece la mejor serie de la última sesión, solo comparable en reps y kg conocidos. */
export function mejoraPersonal(
  serie: SerieRegistrada,
  anterior?: ValoresEjecutados,
): string | null {
  if (
    !serie.hecha ||
    serie.omitida ||
    serie.tipoMedicion !== "repeticiones" ||
    anterior?.tipoMedicion !== "repeticiones" ||
    serie.pesoKg === null ||
    anterior.pesoKg === null ||
    serie.repeticiones === null ||
    !Number.isFinite(serie.pesoKg) ||
    !Number.isFinite(anterior.pesoKg) ||
    !Number.isFinite(serie.repeticiones) ||
    !Number.isFinite(anterior.repeticiones)
  )
    return null
  if (serie.pesoKg > anterior.pesoKg && serie.repeticiones >= anterior.repeticiones) {
    const diferencia = Number((serie.pesoKg - anterior.pesoKg).toPrecision(12))
    return `+${String(diferencia).replace(".", ",")} kg`
  }
  if (serie.pesoKg === anterior.pesoKg && serie.repeticiones > anterior.repeticiones)
    return `+${serie.repeticiones - anterior.repeticiones} reps`
  return null
}

export const EdicionRegistroSchema = z.strictObject({
  notas: z.string().max(2000),
  series: z
    .array(
      z.strictObject({
        serieId: z.uuid(),
        peso: z.string().max(30),
        valor: z.string().max(30),
        hecha: z.boolean(),
        omitida: z.literal(true).optional(),
        /** «¿Cuántas te quedaban?». Opcional: las copias anteriores no lo tienen. */
        rir: z.number().int().min(0).max(5).nullable().optional(),
      }),
    )
    .max(1200),
  checkin: CheckinSchema.nullable().optional(),
  inicio: z.iso.datetime().nullable().optional(),
  tiempoActivoSegundos: z.number().int().nonnegative().optional(),
  tramoActivoDesde: z.iso.datetime().nullable().optional(),
  cierre: CierreSchema.nullable().optional(),
})
export type EdicionRegistro = z.infer<typeof EdicionRegistroSchema>

/** Lo registrado en la unidad de la serie; nunca se lee de otra. */
function cantidadRegistrada(serie: SerieRegistradaConDistancia): number | null {
  switch (serie.tipoMedicion) {
    case "repeticiones":
      return serie.repeticiones
    case "tiempo":
      return serie.segundos
    case "distancia":
      return serie.metros
  }
}

export function desdePrescripcion(
  prescripcion: PrescripcionConDistancia,
  registro?: RegistroConDistancia,
): EdicionRegistro {
  const reales = new Map(registro?.series.map((serie) => [serie.serieId, serie]))
  return {
    notas: registro?.notas ?? "",
    checkin: registro?.checkin ?? null,
    inicio: registro?.inicio ?? null,
    ...(registro?.tiempoActivoSegundos !== undefined && {
      tiempoActivoSegundos: registro.tiempoActivoSegundos,
    }),
    cierre: registro?.cierre ?? null,
    series: prescripcion.ejercicios.flatMap((e) =>
      e.series.map((s) => {
        // Lo registrado en otra unidad no se reinterpreta: la serie queda pendiente.
        const registrada = reales.get(s.id)
        const real = registrada?.tipoMedicion === s.tipoMedicion ? registrada : undefined
        const valor = real ? cantidadRegistrada(real) : null
        return {
          serieId: s.id,
          peso: real?.pesoKg?.toString().replace(".", ",") ?? "",
          valor: valor?.toString() ?? "",
          hecha: real?.hecha ?? false,
          ...(real?.omitida === true && { omitida: true as const }),
          // Solo si se anotó: las copias y registros anteriores no llevan RIR.
          ...(typeof real?.rir === "number" && { rir: real.rir }),
        }
      }),
    ),
  }
}

/** Lo escrito → registro sin validar, cada serie en la unidad que pauta la prescripción. */
export function registroSinValidar(
  prescripcion: PrescripcionConDistancia,
  edicion: EdicionRegistro,
): RegistroConDistancia {
  const unidades = new Map(
    prescripcion.ejercicios.flatMap((e) => e.series.map((s) => [s.id, s.tipoMedicion] as const)),
  )
  const numero = (texto: string): number | null =>
    texto.trim() === "" ? null : Number(texto.replace(",", "."))
  return {
    notas: edicion.notas.trim() || null,
    checkin: edicion.checkin ?? null,
    inicio: edicion.inicio ?? null,
    ...(edicion.tiempoActivoSegundos !== undefined && {
      tiempoActivoSegundos: edicion.tiempoActivoSegundos,
    }),
    cierre: edicion.cierre ?? null,
    series: edicion.series.map((s): SerieRegistradaConDistancia => {
      const comun = {
        serieId: s.serieId,
        pesoKg: numero(s.peso),
        hecha: s.hecha,
        ...(s.omitida === true && { omitida: true as const }),
        ...(typeof s.rir === "number" && { rir: s.rir }),
      }
      const valor = numero(s.valor)
      // Una serie ajena a la prescripción no tiene unidad; la validación la rechaza igual.
      switch (unidades.get(s.serieId) ?? "repeticiones") {
        case "repeticiones":
          return { ...comun, tipoMedicion: "repeticiones", repeticiones: valor }
        case "tiempo":
          return { ...comun, tipoMedicion: "tiempo", segundos: valor }
        case "distancia":
          return { ...comun, tipoMedicion: "distancia", metros: valor }
      }
    }),
  }
}

export function registroParaEnviar(prescripcion: Prescripcion, edicion: EdicionRegistro): Registro {
  return crearRegistroDeSesionSchema(prescripcion).parse(registroSinValidar(prescripcion, edicion))
}

/**
 * La copia que el cliente recupera sobre la pauta nueva. Solo vuelven las series
 * con la misma unidad y una carga que la pauta admita; las demás quedan pendientes
 * y su ejecución sigue en el respaldo, sin convertirse a otra unidad.
 */
export function edicionRecuperada(
  respaldo: { edicion: EdicionRegistro; prescripcion: PrescripcionConDistancia },
  prescripcion: PrescripcionConDistancia,
): EdicionRegistro {
  const anteriores = new Map(
    respaldo.prescripcion.ejercicios.flatMap((e) =>
      e.series.map((s) => [s.id, s.tipoMedicion] as const),
    ),
  )
  const actuales = new Map(
    prescripcion.ejercicios.flatMap((e) =>
      e.series.map(
        (s) => [s.id, { serie: s, tipoCarga: e.tipoCarga, seccion: e.seccion }] as const,
      ),
    ),
  )
  const valores = new Map(respaldo.edicion.series.map((s) => [s.serieId, s]))
  const base = desdePrescripcion(prescripcion)
  return {
    ...base,
    ...respaldo.edicion,
    series: base.series.map((s) => {
      const actual = actuales.get(s.serieId)
      const anterior = valores.get(s.serieId)
      if (!actual || !anterior || anteriores.get(s.serieId) !== actual.serie.tipoMedicion) return s
      // Una carga oculta o ausente dejaría una serie hecha imposible de enviar.
      const tienePeso = anterior.peso.trim() !== ""
      if (actual.tipoCarga === "sinCarga" && tienePeso) return s
      if (
        anterior.hecha &&
        !tienePeso &&
        (actual.seccion ?? "principal") === "principal" &&
        (actual.tipoCarga === "conCargaExterna" || actual.serie.pesoKg !== null)
      )
        return s
      return anterior
    }),
  }
}
