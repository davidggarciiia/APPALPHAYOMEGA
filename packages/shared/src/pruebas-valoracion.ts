import type {
  DefinicionPrueba,
  MetricaDePrueba,
  TipoDePrueba,
  UnidadDePrueba,
} from "./valoraciones"

/**
 * Las cinco pruebas que indicó David (plan del 24-09-2026) y sus condiciones.
 * No hay sexta prueba: cualquier otra la define el entrenador como
 * `personalizada`. No se incluyen baremos, fórmulas de VO₂máx ni instrucciones
 * para realizar esfuerzos máximos: la app registra lo realizado y su contexto.
 */
export const PRUEBAS_ESTANDAR = [
  "dominadas",
  "suspension",
  "flexiones1min",
  "sentadillas1min",
  "pressBanca1rm",
  "cooper",
] as const satisfies readonly TipoDePrueba[]
export type PruebaEstandar = (typeof PRUEBAS_ESTANDAR)[number]

const metrica = (
  clave: string,
  nombre: string,
  unidad: UnidadDePrueba,
  principal = false,
  opcional = !principal,
): MetricaDePrueba => ({ clave, nombre, unidad, principal, opcional })

type Plantilla = Pick<
  DefinicionPrueba,
  "nombre" | "duracionPrescritaS" | "instrumento" | "metricas"
>

const ESTANDAR: Record<PruebaEstandar, Plantilla> = {
  // Dominadas y aguante en barra son variantes distintas: repeticiones frente a segundos.
  dominadas: {
    nombre: "Dominadas",
    duracionPrescritaS: null,
    instrumento: null,
    metricas: [metrica("repeticiones", "Repeticiones", "reps", true)],
  },
  suspension: {
    nombre: "Aguante en barra",
    duracionPrescritaS: null,
    instrumento: null,
    metricas: [metrica("duracion", "Duración", "s", true)],
  },
  flexiones1min: {
    nombre: "Flexiones en 1 minuto",
    duracionPrescritaS: 60,
    instrumento: null,
    metricas: [metrica("repeticiones", "Repeticiones válidas", "reps", true)],
  },
  sentadillas1min: {
    nombre: "Sentadillas en 1 minuto",
    duracionPrescritaS: 60,
    instrumento: null,
    metricas: [metrica("repeticiones", "Repeticiones válidas", "reps", true)],
  },
  // 1RM medido: es otra serie que la fuerza estimada a partir de las sesiones.
  pressBanca1rm: {
    nombre: "Press banca 1RM",
    duracionPrescritaS: null,
    instrumento: null,
    metricas: [metrica("carga", "Carga lograda", "kg", true)],
  },
  // La frecuencia cardiaca solo se guarda si se recogió.
  cooper: {
    nombre: "Cooper",
    duracionPrescritaS: null,
    instrumento: "Banda pectoral",
    metricas: [
      metrica("distancia", "Distancia", "m", true),
      metrica("duracion", "Duración", "s", false, false),
      metrica("fcMedia", "FC media", "lpm"),
      metrica("fcMaxima", "FC máxima", "lpm"),
      metrica("fcFinal", "FC final", "lpm"),
      metrica("fcRecuperacion", "FC de recuperación", "lpm"),
      metrica("tiempoRecuperacion", "Tiempo hasta la FC de recuperación", "s"),
    ],
  },
}

/** Una prueba estándar nueva, versión 1, con la variante que elija el entrenador. */
export function crearPruebaEstandar(
  tipo: PruebaEstandar,
  id: string,
  variante: string | null = null,
): DefinicionPrueba {
  const base = ESTANDAR[tipo]
  return {
    id,
    version: 1,
    tipo,
    nombre: base.nombre,
    variante,
    protocolo: null,
    duracionPrescritaS: base.duracionPrescritaS,
    instrumento: base.instrumento,
    metricas: base.metricas.map((m) => ({ ...m })),
    activa: true,
  }
}

/** La unidad de la métrica principal que exige cada tipo estándar. */
const PRINCIPAL: Record<PruebaEstandar, UnidadDePrueba> = {
  dominadas: "reps",
  suspension: "s",
  flexiones1min: "reps",
  sentadillas1min: "reps",
  pressBanca1rm: "kg",
  cooper: "m",
}

/** Reglas de cada tipo estándar sobre su definición. `personalizada` no tiene. */
export function problemasDeDefinicionPrueba(p: DefinicionPrueba): string[] {
  if (p.tipo === "personalizada") return []
  const problemas: string[] = []
  const principal = p.metricas.find((m) => m.principal)
  if (principal && principal.unidad !== PRINCIPAL[p.tipo])
    problemas.push(`«${p.nombre}» se mide en ${PRINCIPAL[p.tipo]}`)
  if ((p.tipo === "flexiones1min" || p.tipo === "sentadillas1min") && p.duracionPrescritaS !== 60)
    problemas.push(`«${p.nombre}» dura 60 s`)
  if (p.tipo === "cooper" && !p.metricas.some((m) => m.clave === "duracion" && m.unidad === "s"))
    problemas.push(`«${p.nombre}» guarda también la duración`)
  return problemas
}

/** Rango y cifras admisibles de un resultado por unidad. No son baremos. */
const RANGO_DE_PRUEBA: Record<UnidadDePrueba, { max: number; entero: boolean }> = {
  reps: { max: 1_000, entero: true },
  s: { max: 7_200, entero: false },
  kg: { max: 500, entero: false },
  m: { max: 20_000, entero: false },
  cm: { max: 1_000, entero: false },
  lpm: { max: 250, entero: true },
  puntos: { max: 100_000, entero: false },
}

/** Coherencia de los valores de una prueba registrada con su definición. */
export function problemasDeResultadoPrueba(
  p: DefinicionPrueba,
  valores: Record<string, number>,
): string[] {
  const problemas: string[] = []
  const tiene = (clave: string) => Object.prototype.hasOwnProperty.call(valores, clave)
  for (const m of p.metricas) {
    if (!tiene(m.clave)) continue
    const valor = valores[m.clave]!
    const rango = RANGO_DE_PRUEBA[m.unidad]
    if (valor > rango.max) problemas.push(`«${p.nombre}»: ${m.nombre} hasta ${rango.max}`)
    if (rango.entero && !Number.isInteger(valor))
      problemas.push(`«${p.nombre}»: ${m.nombre} es un número entero`)
  }
  // La FC de recuperación solo tiene sentido con el tiempo que pasó desde el final.
  if (tiene("fcRecuperacion") !== tiene("tiempoRecuperacion") && p.tipo === "cooper")
    problemas.push(`«${p.nombre}»: la recuperación necesita su FC y el tiempo desde el final`)
  return problemas
}
