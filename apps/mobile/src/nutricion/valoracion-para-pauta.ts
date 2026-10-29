import {
  ListadoValoracionesPublicadasSchema,
  ListadoValoracionesSchema,
  ValoracionCorporalSchema,
  ValoracionProfesionalSchema,
  proyeccionCorporal,
  type ResumenValoracion,
  type ResumenValoracionPublicada,
  type ValoracionCorporal,
} from "@alpha-omega/shared"

import type { PeticionAutenticada } from "../lib/peticion-autenticada"

const listadoSchema = ListadoValoracionesSchema.or(ListadoValoracionesPublicadasSchema)
const detalleSchema = ValoracionProfesionalSchema.or(ValoracionCorporalSchema)
type Fila = ResumenValoracion | ResumenValoracionPublicada
type Fechas = { fechaToma: string; publicadaEn: string | null }

const masReciente = (a: Fechas, b: Fechas): number =>
  b.fechaToma.localeCompare(a.fechaToma) || (b.publicadaEn ?? "").localeCompare(a.publicadaEn ?? "")

/** Ambos profesionales leen los mismos datos publicados, con la proyección que autoriza la API. */
export function crearConsultaValoracionParaPauta(
  pedir: PeticionAutenticada,
): (clienteId: string) => Promise<ValoracionCorporal | null> {
  return async (clienteId) => {
    const base = `/seguimiento/clientes/${encodeURIComponent(clienteId)}/valoraciones`
    const filas: Fila[] = []
    let desplazamiento = 0
    for (;;) {
      const pagina = await pedir(
        `${base}?limite=50&desplazamiento=${desplazamiento}`,
        listadoSchema,
      )
      filas.push(...pagina.valoraciones.filter((v) => v.publicadaEn !== null))
      desplazamiento += pagina.valoraciones.length
      if (desplazamiento >= pagina.total) break
      if (pagina.valoraciones.length === 0)
        throw new Error("No se pudo leer el historial completo de valoraciones.")
    }
    // En una corrección el resumen lleva la fecha del borrador: hay que leer su publicación.
    const corrigiendo = filas.filter((v) => "estado" in v && v.estado === "corrigiendo")
    const ordinaria = filas
      .filter((v) => !("estado" in v) || v.estado === "publicada")
      .sort(masReciente)[0]
    const candidatas = ordinaria ? [ordinaria, ...corrigiendo] : corrigiendo
    let ultima: ValoracionCorporal | null = null
    for (const candidata of candidatas) {
      const respuesta = await pedir(`${base}/${encodeURIComponent(candidata.id)}`, detalleSchema)
      const corporal =
        "publicacion" in respuesta
          ? respuesta.publicacion && proyeccionCorporal(respuesta.publicacion)
          : respuesta
      if (!corporal) throw new Error("No se pudo leer la valoración publicada.")
      if (!ultima || masReciente(corporal, ultima) < 0) ultima = corporal
    }
    return ultima
  }
}
