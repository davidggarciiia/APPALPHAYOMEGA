import { z } from "zod"
import { crearRegistroDeSesionSchema, type Prescripcion, type Registro } from "@alpha-omega/shared"

export const EdicionRegistroSchema = z.strictObject({
  notas: z.string().max(2000),
  series: z
    .array(
      z.strictObject({
        serieId: z.uuid(),
        peso: z.string().max(30),
        valor: z.string().max(30),
        hecha: z.boolean(),
      }),
    )
    .max(1200),
})
export type EdicionRegistro = z.infer<typeof EdicionRegistroSchema>

export function desdePrescripcion(
  prescripcion: Prescripcion,
  registro?: Registro,
): EdicionRegistro {
  const reales = new Map(registro?.series.map((serie) => [serie.serieId, serie]))
  return {
    notas: registro?.notas ?? "",
    series: prescripcion.ejercicios.flatMap((e) =>
      e.series.map((s) => {
        const real = reales.get(s.id)
        const valor = real?.tipoMedicion === "tiempo" ? real.segundos : real?.repeticiones
        return {
          serieId: s.id,
          peso: real?.pesoKg?.toString() ?? "",
          valor: valor?.toString() ?? "",
          hecha: real?.hecha ?? false,
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
    series: edicion.series.map((s) => ({
      serieId: s.serieId,
      tipoMedicion: unidades.get(s.serieId),
      pesoKg: numero(s.peso),
      hecha: s.hecha,
      ...(unidades.get(s.serieId) === "tiempo"
        ? { segundos: numero(s.valor) }
        : { repeticiones: numero(s.valor) }),
    })),
  })
}
