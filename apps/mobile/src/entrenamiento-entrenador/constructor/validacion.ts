import type { z } from "zod"

/** Zod usa inglés para los límites; el entrenador necesita el campo y cómo corregirlo. */
export function errorDeValidacion(error: z.ZodError): string {
  const fallo = error.issues[0]
  if (!fallo) return "Revisa el plan."
  const campos: Record<string, string> = {
    nombre: "nombre",
    semanaInicial: "lunes de inicio",
    semanas: "número de semanas",
    bloque: "bloque",
    fases: "fase",
    desde: "primera semana",
    hasta: "última semana",
    detalle: "detalle",
    ajustes: "ajustes",
    rirCompuestos: "RIR de compuestos",
    rirAccesorios: "RIR de accesorios",
    factorSeries: "factor de series",
    factorCarga: "factor de carga",
    deportes: "deporte",
    dias: "días",
    minutos: "minutos",
    objetivos: "qué buscamos",
    notas: "notas del bloque",
    pasosDiarios: "pasos al día",
    ejercicios: "ejercicios",
    series: "series",
    pesoKg: "carga inicial (kg)",
    subidaKg: "subida (kg)",
    repeticiones: "repeticiones",
    repeticionesMax: "repeticiones máximas",
    segundos: "segundos",
    metros: "metros",
    rir: "RIR",
    min: "mínimo",
    max: "máximo",
    descanso: "descanso",
    nota: "nota",
    indicaciones: "indicaciones",
    alternativas: "alternativas",
    dosis: "cómo se hace",
    circuito: "circuito",
    vueltas: "vueltas",
    partes: "minutos de cada parte",
    calentamiento: "calentamiento",
    fuerza: "fuerza",
    cardio: "cardio",
    calma: "calma",
    duracion: "duración estimada",
  }
  const campo = fallo.path
    .map((parte) => (typeof parte === "number" ? String(parte + 1) : campos[String(parte)]))
    .filter(Boolean)
    .join(" · ")
  let detalle = "escribe un valor válido"
  if (fallo.code === "custom") detalle = fallo.message
  else if (fallo.code === "too_big" || fallo.code === "too_small") {
    const limite = fallo.code === "too_big" ? fallo.maximum : fallo.minimum
    const unidad =
      fallo.origin === "string" ? " caracteres" : fallo.origin === "array" ? " elementos" : ""
    detalle = `${fallo.code === "too_big" ? "como máximo" : fallo.inclusive ? "como mínimo" : "más de"} ${limite}${unidad}`
  } else if (fallo.path.includes("semanaInicial"))
    detalle = "escribe una fecha válida (AAAA-MM-DD) que sea lunes"
  return `${campo || "Plan"}: ${detalle}.`
}
