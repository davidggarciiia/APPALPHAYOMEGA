import {
  SesionEnRutinaSchema,
  type SeccionDeSesion,
  type SesionEnRutina,
} from "@alpha-omega/shared"

/**
 * El constructor edita cada ejercicio como una fila de la tabla del diseño:
 * series, repeticiones (o segundos), RIR, descanso, carga inicial o «Calibrar»
 * y subida. Todas las series de un ejercicio comparten objetivo.
 */
export type EjercicioDelConstructor = {
  id: string
  ejercicioId: string
  nombre: string
  seccion: SeccionDeSesion
  tipo: "repeticiones" | "tiempo"
  series: string
  /** «6», «8–10» o, si es tiempo, segundos: «40». */
  objetivo: string
  rir: string
  descanso: string
  carga: string
  calibrar: boolean
  subida: string
  /** Cómo se hace en calentamiento, circuito o final: «1×8 por lado». */
  dosis: string
  nota: string
  /** Una por línea. */
  alternativas: string
  compuesto: boolean
  indicaciones: string
  /** Se conservan para no romper registros al volver a publicar la misma rutina. */
  idsSeries: string[]
}

export type DiaDelConstructor = {
  id: string
  nombre: string
  diaSemana: number
  duracion: string
  nota: string
  partes: { calentamiento: string; fuerza: string; cardio: string; calma: string }
  circuito: { nombre: string; vueltas: string; descanso: string }
  ejercicios: EjercicioDelConstructor[]
}

const coma = (valor: number): string => String(valor).replace(".", ",")

/** «8–10», «8-10» u «8» → { min, max }. */
export function leerRango(texto: string): { min: number; max: number } | null {
  const partes = texto
    .trim()
    .split(/\s*[–-]\s*/)
    .filter((p) => p !== "")
  if (partes.length === 0 || partes.length > 2 || !partes.every((p) => /^\d+$/.test(p))) return null
  const min = Number(partes[0])
  const max = Number(partes[partes.length - 1])
  return max < min ? null : { min, max }
}

function rango(min: number, max: number | undefined): string {
  return max !== undefined && max !== min ? `${min}–${max}` : String(min)
}

export function nuevoEjercicio(
  ejercicio: { id: string; nombre: string },
  seccion: SeccionDeSesion,
  nuevoId: () => string,
): EjercicioDelConstructor {
  const principal = seccion === "principal"
  return {
    id: nuevoId(),
    ejercicioId: ejercicio.id,
    nombre: ejercicio.nombre,
    seccion,
    tipo: "repeticiones",
    series: principal ? "3" : "1",
    objetivo: principal ? "8–10" : "10",
    rir: principal ? "2" : "",
    descanso: principal ? "90 s" : "",
    carga: "",
    calibrar: principal,
    subida: "",
    dosis: "",
    nota: "",
    alternativas: "",
    compuesto: false,
    indicaciones: "",
    idsSeries: [],
  }
}

export function nuevoDia(nuevoId: () => string, diaSemana = 1): DiaDelConstructor {
  return {
    id: nuevoId(),
    nombre: "",
    diaSemana,
    duracion: "",
    nota: "",
    partes: { calentamiento: "", fuerza: "", cardio: "", calma: "" },
    circuito: { nombre: "", vueltas: "", descanso: "" },
    ejercicios: [],
  }
}

/** De la sesión guardada al constructor. */
export function desdeSesionEnRutina(
  sesion: SesionEnRutina,
  nombres: Record<string, string>,
): DiaDelConstructor {
  return {
    id: sesion.id,
    nombre: sesion.nombre,
    diaSemana: sesion.diaSemana,
    duracion: sesion.duracion ?? "",
    nota: sesion.nota ?? "",
    partes: {
      calentamiento: sesion.partes?.calentamiento ?? "",
      fuerza: sesion.partes?.fuerza ?? "",
      cardio: sesion.partes?.cardio ?? "",
      calma: sesion.partes?.calma ?? "",
    },
    circuito: {
      nombre: sesion.circuito?.nombre ?? "",
      vueltas: sesion.circuito ? String(sesion.circuito.vueltas) : "",
      descanso: sesion.circuito?.descanso ?? "",
    },
    ejercicios: sesion.ejercicios.map((e) => {
      const primera = e.series[0]
      const tiempo = primera?.tipoMedicion === "tiempo"
      return {
        id: e.id,
        ejercicioId: e.ejercicioId,
        nombre: nombres[e.ejercicioId] ?? "Ejercicio",
        seccion: e.seccion ?? "principal",
        tipo: tiempo ? "tiempo" : "repeticiones",
        series: String(e.series.length),
        objetivo:
          primera === undefined
            ? ""
            : primera.tipoMedicion === "tiempo"
              ? String(primera.segundos)
              : rango(primera.repeticiones, primera.repeticionesMax),
        rir: e.rir ? rango(e.rir.min, e.rir.max) : "",
        descanso: e.descanso ?? "",
        carga: primera?.pesoKg != null ? coma(primera.pesoKg) : "",
        calibrar: e.calibrar ?? false,
        subida: e.subidaKg !== undefined ? coma(e.subidaKg) : "",
        dosis: e.dosis ?? "",
        nota: e.nota ?? "",
        alternativas: (e.alternativas ?? []).join("\n"),
        compuesto: e.compuesto ?? false,
        indicaciones: e.indicaciones ?? "",
        idsSeries: e.series.map((s) => s.id),
      }
    }),
  }
}

/** Qué falta en un día para poder publicarlo, o null si está listo. */
export function faltaEnDia(dia: DiaDelConstructor): string | null {
  const nombre = dia.nombre.trim() || "El día"
  if (dia.nombre.trim() === "") return "Pon nombre a cada día (Empuje, Tracción…)."
  if (dia.ejercicios.length === 0) return `${nombre}: añade al menos un ejercicio.`
  for (const e of dia.ejercicios) {
    const series = Number(e.series)
    if (e.seccion !== "circuito" && (!Number.isInteger(series) || series < 1 || series > 30))
      return `${e.nombre}: de 1 a 30 series.`
    if (!leerRango(e.objetivo)) return `${e.nombre}: escribe las repeticiones, como 6 u 8–10.`
    if (e.rir.trim() !== "") {
      const r = leerRango(e.rir)
      if (!r || r.max > 5) return `${e.nombre}: el RIR va de 0 a 5, como 3 o 2–3.`
    }
    if (!e.calibrar && e.carga.trim() !== "" && Number.isNaN(Number(e.carga.replace(",", "."))))
      return `${e.nombre}: la carga inicial es un número de kilos.`
    if (e.subida.trim() !== "" && !(Number(e.subida.replace(",", ".")) > 0))
      return `${e.nombre}: la subida es un número de kilos.`
  }
  if (dia.ejercicios.some((e) => e.seccion === "circuito")) {
    const vueltas = Number(dia.circuito.vueltas)
    if (!Number.isInteger(vueltas) || vueltas < 1 || vueltas > 10)
      return `${nombre}: el circuito necesita de 1 a 10 vueltas.`
  }
  return null
}

/** Del constructor a la sesión que guarda el servidor. Lanza si falta algo. */
export function aSesionEnRutina(dia: DiaDelConstructor, nuevoId: () => string): SesionEnRutina {
  const falta = faltaEnDia(dia)
  if (falta) throw new Error(falta)
  const texto = (valor: string): string | undefined =>
    valor.trim() === "" ? undefined : valor.trim()
  const partes = Object.fromEntries(
    Object.entries(dia.partes).flatMap(([k, v]) => (v.trim() === "" ? [] : [[k, v.trim()]])),
  )
  const circuito = dia.ejercicios.some((e) => e.seccion === "circuito")
  return SesionEnRutinaSchema.parse({
    id: dia.id,
    nombre: dia.nombre.trim(),
    diaSemana: dia.diaSemana,
    ...(texto(dia.duracion) && { duracion: texto(dia.duracion) }),
    ...(texto(dia.nota) && { nota: texto(dia.nota) }),
    ...(Object.keys(partes).length > 0 && { partes }),
    ...(circuito && {
      circuito: {
        vueltas: Number(dia.circuito.vueltas),
        ...(texto(dia.circuito.nombre) && { nombre: texto(dia.circuito.nombre) }),
        ...(texto(dia.circuito.descanso) && { descanso: texto(dia.circuito.descanso) }),
      },
    }),
    ejercicios: dia.ejercicios.map((e) => {
      const objetivo = leerRango(e.objetivo)!
      const rir = e.rir.trim() === "" ? null : leerRango(e.rir)
      const carga = e.calibrar || e.carga.trim() === "" ? null : Number(e.carga.replace(",", "."))
      const alternativas = e.alternativas
        .split("\n")
        .map((a) => a.trim())
        .filter(Boolean)
      return {
        id: e.id,
        ejercicioId: e.ejercicioId,
        indicaciones: texto(e.indicaciones) ?? null,
        ...(e.seccion !== "principal" && { seccion: e.seccion }),
        ...(rir && { rir }),
        ...(texto(e.descanso) && { descanso: texto(e.descanso) }),
        ...(texto(e.dosis) && { dosis: texto(e.dosis) }),
        ...(e.calibrar && { calibrar: true }),
        ...(texto(e.subida) && { subidaKg: Number(e.subida.replace(",", ".")) }),
        ...(texto(e.nota) && { nota: texto(e.nota) }),
        ...(alternativas.length > 0 && { alternativas }),
        ...(e.compuesto && { compuesto: true }),
        // En el circuito, una serie por vuelta.
        series: Array.from(
          { length: e.seccion === "circuito" ? Number(dia.circuito.vueltas) : Number(e.series) },
          (_, n) => ({
            id: e.idsSeries[n] ?? nuevoId(),
            pesoKg: carga,
            ...(e.tipo === "tiempo"
              ? { tipoMedicion: "tiempo", segundos: objetivo.min }
              : {
                  tipoMedicion: "repeticiones",
                  repeticiones: objetivo.min,
                  ...(objetivo.max > objetivo.min && { repeticionesMax: objetivo.max }),
                }),
          }),
        ),
      }
    }),
  })
}

/** «4 ejercicios · 2 vueltas», «7 ejercicios · 20 series», para la cabecera de cada parte. */
export function resumenDeSeccion(dia: DiaDelConstructor, seccion: SeccionDeSesion): string {
  const ejercicios = dia.ejercicios.filter((e) => e.seccion === seccion)
  const n = `${ejercicios.length} ejercicio${ejercicios.length === 1 ? "" : "s"}`
  if (seccion === "principal")
    return `${n} · ${ejercicios.reduce((t, e) => t + (Number(e.series) || 0), 0)} series`
  if (seccion === "circuito" && dia.circuito.vueltas)
    return `${n} · ${dia.circuito.vueltas} vueltas${dia.circuito.descanso ? ` · ${dia.circuito.descanso} entre vueltas` : ""}`
  return n
}
