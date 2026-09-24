import type {
  EjercicioPrescrito,
  Prescripcion,
  SeccionDeSesion,
  SeriePrescrita,
} from "@alpha-omega/shared"
import type { EdicionRegistro } from "../registro-modelo"

const numero = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 })

/** «67,5 kg». */
export function kg(valor: number): string {
  return `${numero.format(valor)} kg`
}

/**
 * Segundos de descanso a partir de lo que escribió el entrenador. Se toma el
 * primer número del rango: «2–3 min» → 120, «90–120 s» → 90, «1:30» → 90.
 */
export function segundosDeDescanso(texto: string | undefined): number | null {
  if (texto === undefined) return null
  const reloj = texto.match(/(\d+):(\d{2})/)
  if (reloj) return Number(reloj[1]) * 60 + Number(reloj[2])
  const cifra = texto.match(/\d+(?:[.,]\d+)?/)
  if (!cifra) return null
  const valor = Number(cifra[0].replace(",", "."))
  return Math.round(/min/i.test(texto) ? valor * 60 : valor)
}

/** «34:12» o, pasada la hora, «1:02:05». */
export function reloj(segundos: number): string {
  const total = Math.max(0, Math.floor(segundos))
  const horas = Math.floor(total / 3600)
  const minutos = Math.floor((total % 3600) / 60)
  const resto = String(total % 60).padStart(2, "0")
  return horas > 0 ? `${horas}:${String(minutos).padStart(2, "0")}:${resto}` : `${minutos}:${resto}`
}

/** «1 h 38 min» o «45 min». */
export function duracionLegible(desde: string, hasta: Date): string {
  const minutos = Math.max(0, Math.round((hasta.getTime() - new Date(desde).getTime()) / 60000))
  const horas = Math.floor(minutos / 60)
  return horas > 0 ? `${horas} h ${minutos % 60} min` : `${minutos} min`
}

export function textoRir(rir: EjercicioPrescrito["rir"]): string | null {
  if (rir === undefined) return null
  return rir.min === rir.max ? `RIR ${rir.min}` : `RIR ${rir.min}–${rir.max}`
}

export function objetivoDeSerie(serie: SeriePrescrita): string {
  if (serie.tipoMedicion === "tiempo") return `${serie.segundos} s`
  return serie.repeticionesMax !== undefined && serie.repeticionesMax !== serie.repeticiones
    ? `${serie.repeticiones}–${serie.repeticionesMax}`
    : String(serie.repeticiones)
}

/** «4 × 6 · RIR 3 · 2–3 min», como bajo el nombre del ejercicio en el diseño. */
export function resumenPrescrito(ejercicio: EjercicioPrescrito): string {
  const objetivos = [...new Set(ejercicio.series.map(objetivoDeSerie))]
  return [
    `${ejercicio.series.length} × ${objetivos.join(" / ")}`,
    textoRir(ejercicio.rir),
    ejercicio.descanso,
  ]
    .filter(Boolean)
    .join(" · ")
}

export type Seccion = { seccion: SeccionDeSesion; ejercicios: EjercicioPrescrito[] }

const ORDEN: SeccionDeSesion[] = ["calentamiento", "principal", "circuito", "final"]

/** La sesión por partes, en el orden en que se hacen. Sin parte: principal. */
export function porSecciones(prescripcion: Prescripcion): Seccion[] {
  return ORDEN.map((seccion) => ({
    seccion,
    ejercicios: prescripcion.ejercicios.filter((e) => (e.seccion ?? "principal") === seccion),
  })).filter((grupo) => grupo.ejercicios.length > 0)
}

/** Las series que cuentan en «9 de 20 series»: las de la parte principal y el circuito. */
function seriesDe(prescripcion: Prescripcion, seccion: SeccionDeSesion): string[] {
  return prescripcion.ejercicios
    .filter((e) => (e.seccion ?? "principal") === seccion)
    .flatMap((e) => e.series.map((s) => s.id))
}

/** Las series que cuenta el progreso («9 de 20 series»): las de la parte principal. */
export function seriesDeTrabajo(prescripcion: Prescripcion): string[] {
  return seriesDe(prescripcion, "principal")
}

/** El recorrido conserva el orden de calentamiento, principal, circuito y vuelta a la calma. */
export function ejerciciosOrdenados(prescripcion: Prescripcion): EjercicioPrescrito[] {
  return porSecciones(prescripcion).flatMap((grupo) => grupo.ejercicios)
}

/** La primera serie pendiente; una omisión explícita permite seguir adelante. */
export function serieEnCurso(prescripcion: Prescripcion, edicion: EdicionRegistro): string | null {
  const cerradas = new Set(edicion.series.filter((s) => s.hecha || s.omitida).map((s) => s.serieId))
  return (
    ejerciciosOrdenados(prescripcion)
      .flatMap((e) => e.series.map((s) => s.id))
      .find((id) => !cerradas.has(id)) ?? null
  )
}

export function ejercicioEnCurso(
  prescripcion: Prescripcion,
  edicion: EdicionRegistro,
): EjercicioPrescrito | null {
  const serie = serieEnCurso(prescripcion, edicion)
  return ejerciciosOrdenados(prescripcion).find((e) => e.series.some((s) => s.id === serie)) ?? null
}

/** Retiene el ejercicio resuelto para que el RIR final opcional no desaparezca al avanzar. */
export function ejercicioParaRirFinal(
  prescripcion: Prescripcion,
  edicion: EdicionRegistro,
  serieId: string,
): string | null {
  const ejercicio = prescripcion.ejercicios.find((e) => e.series.some((s) => s.id === serieId))
  if (ejercicio?.modoRir !== "alFinalizarEjercicio") return null
  const reales = ejercicio.series.map((s) => edicion.series.find((r) => r.serieId === s.id))
  return reales.some((r) => r?.hecha) && reales.every((r) => r?.hecha || r?.omitida)
    ? ejercicio.id
    : null
}

export function estadoDeEjercicio(
  ejercicio: EjercicioPrescrito,
  edicion: EdicionRegistro,
): "pendiente" | "enCurso" | "hecho" | "omitido" | "mixto" {
  const reales = ejercicio.series.map((s) => edicion.series.find((r) => r.serieId === s.id))
  const hechas = reales.filter((r) => r?.hecha).length
  const omitidas = reales.filter((r) => r?.omitida).length
  if (hechas === reales.length) return "hecho"
  if (omitidas === reales.length) return "omitido"
  if (hechas + omitidas === reales.length) return "mixto"
  return hechas + omitidas > 0 ? "enCurso" : "pendiente"
}

export type ProximaVez = {
  ejercicioId: string
  nombre: string
  texto: string
  tipo: "sube" | "igual" | "revision" | "referencia"
}

/**
 * «La próxima vez», con la doble progresión de la guía: se sube la carga cuando
 * todas las series llegan al tope del rango sin apurar más que el RIR objetivo;
 * con RIR 1 o 0 no se sube; una molestia deja el ejercicio en revisión.
 */
export function proximaVez(
  prescripcion: Prescripcion,
  edicion: EdicionRegistro,
  conMolestia: ReadonlySet<string>,
): ProximaVez[] {
  const reales = new Map(edicion.series.map((s) => [s.serieId, s]))
  const lectura = (texto: string): number | null =>
    texto.trim() === "" ? null : Number(texto.replace(",", "."))
  return prescripcion.ejercicios
    .filter((e) => (e.seccion ?? "principal") === "principal")
    .flatMap((ejercicio): ProximaVez[] => {
      const base = { ejercicioId: ejercicio.id, nombre: ejercicio.nombre }
      if (conMolestia.has(ejercicio.id))
        return [{ ...base, texto: "En revisión", tipo: "revision" }]
      const hechas = ejercicio.series.flatMap((serie) => {
        const real = reales.get(serie.id)
        return real?.hecha ? [{ serie, real }] : []
      })
      if (hechas.length === 0) return []
      const cargas = hechas
        .map(({ serie, real }) => lectura(real.peso) ?? serie.pesoKg)
        .filter((c): c is number => c !== null && Number.isFinite(c))
      const carga = cargas.length === 0 ? null : Math.max(...cargas)
      if (ejercicio.calibrar && carga !== null)
        return [{ ...base, texto: `Referencia ${kg(carga)}`, tipo: "referencia" }]
      const rirMin = ejercicio.rir?.min
      const rir = (r: (typeof hechas)[number]["real"]): number | null => r.rir ?? null
      const alTope = hechas.every(({ serie, real }) => {
        const hecho = lectura(real.valor)
        if (hecho === null) return false
        const tope =
          serie.tipoMedicion === "tiempo"
            ? serie.segundos
            : (serie.repeticionesMax ?? serie.repeticiones)
        return hecho >= tope
      })
      const duro = hechas.some(({ real }) => {
        const valor = rir(real)
        return valor !== null && valor <= 1
      })
      const dentroDelRir =
        rirMin === undefined ||
        hechas.every(({ real }) => {
          const valor = rir(real)
          return valor === null || valor >= rirMin
        })
      if (hechas.length === ejercicio.series.length && alTope && dentroDelRir && !duro) {
        if (carga !== null && ejercicio.subidaKg !== undefined)
          return [{ ...base, texto: `Sube a ${kg(carga + ejercicio.subidaKg)}`, tipo: "sube" }]
        return [{ ...base, texto: "Sube la carga", tipo: "sube" }]
      }
      return [{ ...base, texto: carga === null ? "Igual" : `${kg(carga)}, igual`, tipo: "igual" }]
    })
}
