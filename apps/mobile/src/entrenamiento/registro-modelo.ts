import { z } from "zod"
import {
  CheckinSchema,
  CierreSchema,
  crearRegistroDeSesionSchema,
  type Prescripcion,
  type Registro,
} from "@alpha-omega/shared"

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

export function desdePrescripcion(
  prescripcion: Prescripcion,
  registro?: Registro,
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
        const real = reales.get(s.id)
        const valor = real?.tipoMedicion === "tiempo" ? real.segundos : real?.repeticiones
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

export function registroParaEnviar(prescripcion: Prescripcion, edicion: EdicionRegistro): Registro {
  const unidades = new Map(
    prescripcion.ejercicios.flatMap((e) => e.series.map((s) => [s.id, s.tipoMedicion] as const)),
  )
  const numero = (texto: string): number | null =>
    texto.trim() === "" ? null : Number(texto.replace(",", "."))
  return crearRegistroDeSesionSchema(prescripcion).parse({
    notas: edicion.notas.trim() || null,
    checkin: edicion.checkin ?? null,
    inicio: edicion.inicio ?? null,
    ...(edicion.tiempoActivoSegundos !== undefined && {
      tiempoActivoSegundos: edicion.tiempoActivoSegundos,
    }),
    cierre: edicion.cierre ?? null,
    series: edicion.series.map((s) => ({
      serieId: s.serieId,
      tipoMedicion: unidades.get(s.serieId),
      pesoKg: numero(s.peso),
      hecha: s.hecha,
      ...(s.omitida === true && { omitida: true as const }),
      ...(typeof s.rir === "number" && { rir: s.rir }),
      ...(unidades.get(s.serieId) === "tiempo"
        ? { segundos: numero(s.valor) }
        : { repeticiones: numero(s.valor) }),
    })),
  })
}
