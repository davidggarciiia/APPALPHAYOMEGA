import { z } from "zod"
import { FechaAgendaSchema, RevisionSchema } from "./agenda"
import { problemasDeDefinicionPrueba, problemasDeResultadoPrueba } from "./pruebas-valoracion"

/**
 * Valoración inicial y revisiones periódicas (plan del 24-09-2026).
 *
 * Una valoración es una visita. Al crearla se copia la plantilla del
 * entrenador: las definiciones viajan con la visita y cambiar la plantilla no
 * altera visitas anteriores. Repetir una visita copia definiciones, nunca
 * resultados. Publicar crea una versión inmutable; corregir crea otra versión
 * de la misma visita que sustituye a la vigente y conserva la anterior.
 *
 * Cada dato distingue pendiente, registrado y no realizado. Un cero es un
 * resultado real; «sin dato» es `pendiente`, nunca un cero.
 */

/** Texto que se muestra tal cual: sin etiquetas, sin fórmulas que ejecutar. */
const TextoPlano = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .regex(/^[^<>]*$/, "Escribe texto sin los signos < y >")
const TextoPlanoOpcional = (max: number) => TextoPlano(max).nullable()

/** Un valor medido. El rango concreto depende de la unidad de su definición. */
const ValorSchema = z
  .number()
  .min(0)
  .max(100_000)
  .refine((valor) => Number(valor.toFixed(2)) === valor, "Dos decimales como máximo")

export const BLOQUES_VALORACION = [
  "medidas",
  "pliegues",
  "bioimpedancia",
  "pruebas",
  "fotos",
] as const
export const BloqueValoracionSchema = z.enum(BLOQUES_VALORACION)
export type BloqueValoracion = z.infer<typeof BloqueValoracionSchema>

const BloqueCorporalSchema = BloqueValoracionSchema.extract([
  "medidas",
  "pliegues",
  "bioimpedancia",
])
export type BloqueCorporal = z.infer<typeof BloqueCorporalSchema>

export const UNIDADES_CORPORALES = ["kg", "cm", "mm", "%", "l", "kcal", "años", "indice"] as const
export const UnidadCorporalSchema = z.enum(UNIDADES_CORPORALES)
export type UnidadCorporal = z.infer<typeof UnidadCorporalSchema>

/**
 * Qué se mide. Masa muscular y masa libre de grasa son magnitudes distintas;
 * nunca se tratan como equivalentes. Lo que no encaje es `otra`.
 */
export const MagnitudCorporalSchema = z.enum([
  "peso",
  "altura",
  "perimetro",
  "pliegue",
  "grasa",
  "masaMuscular",
  "masaLibreDeGrasa",
  "agua",
  "grasaVisceral",
  "otra",
])
export type MagnitudCorporal = z.infer<typeof MagnitudCorporalSchema>

const UNIDADES_POR_MAGNITUD: Record<MagnitudCorporal, readonly UnidadCorporal[]> = {
  peso: ["kg"],
  altura: ["cm"],
  perimetro: ["cm"],
  pliegue: ["mm"],
  grasa: ["%", "kg"],
  masaMuscular: ["kg", "%"],
  masaLibreDeGrasa: ["kg"],
  agua: ["%", "l", "kg"],
  grasaVisceral: ["indice"],
  otra: UNIDADES_CORPORALES,
}

const MAGNITUDES_POR_BLOQUE: Record<BloqueCorporal, readonly MagnitudCorporal[]> = {
  medidas: ["peso", "altura", "perimetro", "otra"],
  pliegues: ["pliegue"],
  bioimpedancia: [
    "peso",
    "grasa",
    "masaMuscular",
    "masaLibreDeGrasa",
    "agua",
    "grasaVisceral",
    "otra",
  ],
}

/** Rangos admisibles por unidad; los índices del fabricante se validan aparte de kg y %. */
export const RANGO_POR_UNIDAD: Record<UnidadCorporal, { min: number; max: number }> = {
  kg: { min: 0, max: 400 },
  cm: { min: 0, max: 300 },
  mm: { min: 0, max: 100 },
  "%": { min: 0, max: 100 },
  l: { min: 0, max: 100 },
  kcal: { min: 0, max: 10_000 },
  años: { min: 0, max: 150 },
  indice: { min: 0, max: 1_000 },
}

/**
 * Un campo corporal de la plantilla: perímetro, punto de pliegue o dato de
 * báscula. La identidad es `id`; cambiar nombre la conserva, cambiar
 * magnitud, unidad, zona, lateralidad, instrumento o protocolo exige otra
 * `version` (ver `versionarDefinicionCorporal`).
 */
export const DefinicionCorporalSchema = z
  .strictObject({
    id: z.uuid(),
    version: z.number().int().min(1).max(10_000),
    bloque: BloqueCorporalSchema,
    magnitud: MagnitudCorporalSchema,
    nombre: TextoPlano(60),
    unidad: UnidadCorporalSchema,
    zona: TextoPlanoOpcional(60),
    lateralidad: z.enum(["izquierda", "derecha"]).nullable(),
    instrumento: TextoPlanoOpcional(80),
    protocolo: TextoPlanoOpcional(300),
    /** Desactivar la retira de visitas futuras sin tocar resultados guardados. */
    activa: z.boolean(),
  })
  .refine(
    (d) => MAGNITUDES_POR_BLOQUE[d.bloque].includes(d.magnitud),
    "Esa magnitud no pertenece a este bloque",
  )
  .refine(
    (d) => UNIDADES_POR_MAGNITUD[d.magnitud].includes(d.unidad),
    "Esa unidad no corresponde a la magnitud",
  )
export type DefinicionCorporal = z.infer<typeof DefinicionCorporalSchema>

export const TIPOS_DE_PRUEBA = [
  "dominadas",
  "suspension",
  "flexiones1min",
  "sentadillas1min",
  "pressBanca1rm",
  "cooper",
  "personalizada",
] as const
export const TipoDePruebaSchema = z.enum(TIPOS_DE_PRUEBA)
export type TipoDePrueba = z.infer<typeof TipoDePruebaSchema>

export const UNIDADES_DE_PRUEBA = ["reps", "s", "kg", "m", "cm", "lpm", "puntos"] as const
export const UnidadDePruebaSchema = z.enum(UNIDADES_DE_PRUEBA)
export type UnidadDePrueba = z.infer<typeof UnidadDePruebaSchema>

/** Un resultado que se anota en la prueba: repeticiones, distancia, FC final… */
export const MetricaDePruebaSchema = z.strictObject({
  clave: z.string().regex(/^[a-z][a-zA-Z0-9]{0,31}$/, "Clave de métrica no válida"),
  nombre: TextoPlano(40),
  unidad: UnidadDePruebaSchema,
  /** La que se representa en la evolución. Hay exactamente una. */
  principal: z.boolean(),
  /** Opcional: se guarda solo si se recogió (por ejemplo, FC de recuperación). */
  opcional: z.boolean(),
})
export type MetricaDePrueba = z.infer<typeof MetricaDePruebaSchema>

/**
 * Una prueba física de la plantilla. Variante, protocolo, duración o unidades
 * distintas son otra `version` y otra serie de comparación.
 */
export const DefinicionPruebaSchema = z
  .strictObject({
    id: z.uuid(),
    version: z.number().int().min(1).max(10_000),
    tipo: TipoDePruebaSchema,
    nombre: TextoPlano(60),
    variante: TextoPlanoOpcional(80),
    protocolo: TextoPlanoOpcional(300),
    duracionPrescritaS: z.number().int().min(1).max(3_600).nullable(),
    instrumento: TextoPlanoOpcional(80),
    metricas: z.array(MetricaDePruebaSchema).min(1).max(8),
    activa: z.boolean(),
  })
  .refine(
    (p) => new Set(p.metricas.map((m) => m.clave)).size === p.metricas.length,
    "Métrica repetida",
  )
  .refine(
    (p) => p.metricas.filter((m) => m.principal).length === 1,
    "Indica una sola métrica principal",
  )
  .refine(
    (p) => p.metricas.every((m) => !(m.principal && m.opcional)),
    "La métrica principal no puede ser opcional",
  )
  .superRefine((p, ctx) => {
    for (const message of problemasDeDefinicionPrueba(p)) ctx.addIssue({ code: "custom", message })
  })
export type DefinicionPrueba = z.infer<typeof DefinicionPruebaSchema>

const DefinicionesSchema = z.strictObject({
  corporales: z.array(DefinicionCorporalSchema).max(60),
  pruebas: z.array(DefinicionPruebaSchema).max(20),
})
export type DefinicionesValoracion = z.infer<typeof DefinicionesSchema>

const idsUnicos = (d: DefinicionesValoracion): boolean => {
  const ids = [...d.corporales, ...d.pruebas].map((x) => x.id)
  return new Set(ids).size === ids.length
}

/** Plantilla del entrenador para un cliente. `revision` evita sobrescribir otra edición. */
export const PlantillaValoracionSchema = DefinicionesSchema.safeExtend({
  revision: RevisionSchema,
}).refine(idsUnicos, "Definición repetida")
export type PlantillaValoracion = z.infer<typeof PlantillaValoracionSchema>
export const GuardarPlantillaValoracionSchema = PlantillaValoracionSchema
export type GuardarPlantillaValoracion = z.infer<typeof GuardarPlantillaValoracionSchema>

const CAMPOS_DE_VERSION_CORPORAL = [
  "bloque",
  "magnitud",
  "unidad",
  "zona",
  "lateralidad",
  "instrumento",
  "protocolo",
] as const
const CAMPOS_DE_VERSION_PRUEBA = [
  "tipo",
  "variante",
  "protocolo",
  "duracionPrescritaS",
  "instrumento",
] as const

/**
 * Devuelve la definición nueva con la versión que le corresponde: renombrar o
 * desactivar la conserva; cambiar cómo se mide la sube. La usan el editor y el
 * servidor, que rechaza una plantilla que no la respete.
 */
export function versionarDefinicionCorporal(
  anterior: DefinicionCorporal,
  nueva: DefinicionCorporal,
): DefinicionCorporal {
  const cambia = CAMPOS_DE_VERSION_CORPORAL.some((campo) => anterior[campo] !== nueva[campo])
  return { ...nueva, version: cambia ? anterior.version + 1 : anterior.version }
}

export function versionarDefinicionPrueba(
  anterior: DefinicionPrueba,
  nueva: DefinicionPrueba,
): DefinicionPrueba {
  // El orden de las métricas es presentación: reordenarlas no parte la serie.
  const firma = (metricas: MetricaDePrueba[]) =>
    metricas
      .map((m) => `${m.clave}|${m.unidad}|${m.principal}|${m.opcional}`)
      .sort()
      .join(",")
  const cambia =
    CAMPOS_DE_VERSION_PRUEBA.some((campo) => anterior[campo] !== nueva[campo]) ||
    firma(anterior.metricas) !== firma(nueva.metricas)
  return { ...nueva, version: cambia ? anterior.version + 1 : anterior.version }
}

const PendienteSchema = z.strictObject({
  definicionId: z.uuid(),
  estado: z.literal("pendiente"),
})
const NoRealizadoSchema = z.strictObject({
  definicionId: z.uuid(),
  estado: z.literal("noRealizado"),
  /** Visible para el cliente al publicar (en corporales, también para el nutricionista). */
  motivo: TextoPlanoOpcional(200),
})
const LecturasSchema = z.array(ValorSchema).min(1).max(5)

export const ResultadoCorporalSchema = z.discriminatedUnion("estado", [
  z.strictObject({
    definicionId: z.uuid(),
    estado: z.literal("pendiente"),
    /** Lecturas del plicómetro anotadas antes de adoptar un valor. Solo en pliegues. */
    lecturas: LecturasSchema.optional(),
  }),
  NoRealizadoSchema,
  z.strictObject({
    definicionId: z.uuid(),
    estado: z.literal("registrado"),
    /** El valor adoptado. En pliegues, elegido explícitamente por el profesional. */
    valor: ValorSchema,
    /** Lecturas originales del plicómetro, si se tomaron varias. Solo en pliegues. */
    lecturas: LecturasSchema.optional(),
  }),
])
export type ResultadoCorporal = z.infer<typeof ResultadoCorporalSchema>

export const ResultadoPruebaSchema = z.discriminatedUnion("estado", [
  PendienteSchema,
  NoRealizadoSchema,
  z.strictObject({
    definicionId: z.uuid(),
    estado: z.literal("registrado"),
    /** Por clave de métrica. Las opcionales que no se recogieron no aparecen. */
    valores: z.record(z.string(), ValorSchema),
    /** Si se completó el protocolo (por ejemplo, el minuto entero). */
    protocoloCompleto: z.boolean(),
    /** Si la prueba se hizo otro día que la visita. */
    fecha: FechaAgendaSchema.nullable(),
    /** Visible para el cliente al publicar; lo que es solo del entrenador va en `notasInternas`. */
    notas: TextoPlanoOpcional(500),
  }),
])
export type ResultadoPrueba = z.infer<typeof ResultadoPruebaSchema>

/**
 * Porcentaje de grasa que ya calculó el profesional a partir de sus pliegues.
 * La app no lo calcula ni reconstruye lecturas a partir de él.
 */
export const GrasaPorPlieguesSchema = z.strictObject({
  valorPct: ValorSchema.refine((v) => v > 0 && v <= 100, "Un porcentaje mayor que 0 y hasta 100"),
  metodo: TextoPlano(120),
  fecha: FechaAgendaSchema,
})
export type GrasaPorPliegues = z.infer<typeof GrasaPorPlieguesSchema>

/** Lo que el entrenador edita en un borrador. Las definiciones no: vienen de la plantilla. */
const CamposContenido = {
  bloques: z.array(BloqueValoracionSchema).min(1).max(BLOQUES_VALORACION.length),
  corporales: z.array(ResultadoCorporalSchema).max(60),
  pruebas: z.array(ResultadoPruebaSchema).max(20),
  grasaPorPliegues: GrasaPorPlieguesSchema.nullable(),
  /** Definiciones cuyo cambio el entrenador destaca al cliente. */
  destacados: z.array(z.uuid()).max(6),
  /** Visible para el cliente al publicar. */
  conclusion: TextoPlanoOpcional(2_000),
}

const unicos = (valores: string[]) => new Set(valores).size === valores.length
const mismosIds = (definiciones: { id: string }[], resultados: { definicionId: string }[]) =>
  definiciones.length === resultados.length &&
  definiciones.every((d) => resultados.some((r) => r.definicionId === d.id))

export const ContenidoValoracionSchema = z
  .strictObject({
    ...CamposContenido,
    /** Solo profesional: no viaja nunca en una respuesta del cliente. */
    notasInternas: TextoPlanoOpcional(4_000),
  })
  .refine((c) => unicos(c.bloques), "Bloque repetido")
  .refine((c) => unicos(c.corporales.map((r) => r.definicionId)), "Resultado repetido")
  .refine((c) => unicos(c.pruebas.map((r) => r.definicionId)), "Resultado repetido")
  .refine((c) => unicos(c.destacados), "Destacado repetido")
export type ContenidoValoracion = z.infer<typeof ContenidoValoracionSchema>

type DocumentoComprobable = {
  bloques: BloqueValoracion[]
  definiciones: DefinicionesValoracion
  corporales: ResultadoCorporal[]
  pruebas: ResultadoPrueba[]
  grasaPorPliegues: GrasaPorPliegues | null
  destacados: string[]
}

/** Magnitudes físicas que no pueden valer cero: un 0 ahí sería un dato falso, no un resultado. */
const POSITIVAS: readonly MagnitudCorporal[] = [
  "peso",
  "altura",
  "perimetro",
  "pliegue",
  "grasa",
  "masaMuscular",
  "masaLibreDeGrasa",
  "agua",
]
/** El mismo mínimo que el peso del registro diario. */
const PESO_MINIMO_KG = 30

/** Límites de un valor de esta definición; los usan el servidor y el formulario. */
export function limitesDeDefinicion(d: DefinicionCorporal): {
  min: number
  max: number
  ceroValido: boolean
} {
  const rango = RANGO_POR_UNIDAD[d.unidad]
  return {
    min: d.magnitud === "peso" ? PESO_MINIMO_KG : rango.min,
    max: rango.max,
    ceroValido: !POSITIVAS.includes(d.magnitud),
  }
}

/** Si un valor cabe en los límites de su definición. */
export function valorAdmisible(d: DefinicionCorporal, valor: number): boolean {
  const { min, max, ceroValido } = limitesDeDefinicion(d)
  return valor >= min && valor <= max && (ceroValido || valor > 0)
}

/**
 * Coherencia entre resultados y definiciones copiadas. La usan los esquemas y
 * el servidor al aplicar un cambio sobre la copia que guarda.
 */
export function problemasDelDocumento(doc: DocumentoComprobable): string[] {
  const problemas: string[] = []
  if (!unicos(doc.bloques)) problemas.push("Bloque repetido")
  if (!idsUnicos(doc.definiciones)) problemas.push("Definición repetida")
  const corporales = new Map(doc.definiciones.corporales.map((d) => [d.id, d]))
  const pruebas = new Map(doc.definiciones.pruebas.map((d) => [d.id, d]))
  for (const d of doc.definiciones.corporales)
    if (!doc.bloques.includes(d.bloque)) problemas.push(`«${d.nombre}» no está en los bloques`)
  if (doc.definiciones.pruebas.length > 0 && !doc.bloques.includes("pruebas"))
    problemas.push("Hay pruebas sin el bloque de pruebas")
  if (!unicos(doc.corporales.map((r) => r.definicionId))) problemas.push("Resultado repetido")
  if (!unicos(doc.pruebas.map((r) => r.definicionId))) problemas.push("Resultado repetido")
  for (const r of doc.corporales) {
    const d = corporales.get(r.definicionId)
    if (!d) {
      problemas.push("Resultado sin definición")
      continue
    }
    if (r.estado === "noRealizado") continue
    const { min: minimo, max, ceroValido } = limitesDeDefinicion(d)
    const fuera = (v: number) => !valorAdmisible(d, v)
    const rango = { max }
    if (r.lecturas && d.bloque !== "pliegues")
      problemas.push(`«${d.nombre}»: las lecturas solo se anotan en pliegues`)
    if (r.lecturas?.some(fuera))
      problemas.push(`«${d.nombre}»: lectura fuera de ${minimo}–${rango.max} ${d.unidad}`)
    if (r.estado === "registrado" && fuera(r.valor))
      problemas.push(
        `«${d.nombre}»: ${!ceroValido && minimo === 0 ? "mayor que 0" : `desde ${minimo}`} y hasta ${rango.max} ${d.unidad}`,
      )
  }
  for (const r of doc.pruebas) {
    const d = pruebas.get(r.definicionId)
    if (!d) {
      problemas.push("Resultado sin definición")
      continue
    }
    if (r.estado !== "registrado") continue
    const claves = new Set(d.metricas.map((m) => m.clave))
    if (Object.keys(r.valores).some((clave) => !claves.has(clave)))
      problemas.push(`«${d.nombre}»: métrica desconocida`)
    const tiene = (clave: string) => Object.prototype.hasOwnProperty.call(r.valores, clave)
    const faltan = d.metricas.filter((m) => !m.opcional && !tiene(m.clave))
    if (faltan.length > 0)
      problemas.push(`«${d.nombre}»: falta ${faltan.map((m) => m.nombre).join(", ")}`)
    problemas.push(...problemasDeResultadoPrueba(d, r.valores))
  }
  if (doc.grasaPorPliegues && !doc.bloques.includes("pliegues"))
    problemas.push("El porcentaje por pliegues necesita el bloque de pliegues")
  if (doc.destacados.some((id) => !corporales.has(id) && !pruebas.has(id)))
    problemas.push("Destacado sin definición")
  return problemas
}

const conProblemas = <T extends DocumentoComprobable>(doc: T, ctx: z.RefinementCtx): void => {
  for (const message of problemasDelDocumento(doc)) ctx.addIssue({ code: "custom", message })
}

/** Documento completo de un borrador: definiciones copiadas y resultados. */
export const DocumentoValoracionSchema = z
  .strictObject({
    definiciones: DefinicionesSchema,
    ...CamposContenido,
    notasInternas: TextoPlanoOpcional(4_000),
  })
  .superRefine(conProblemas)
export type DocumentoValoracion = z.infer<typeof DocumentoValoracionSchema>

/**
 * Lo que recibe el cliente de una publicación: sin notas internas, sin datos
 * pendientes y solo las definiciones que tienen un resultado que mostrar.
 */
export const DocumentoPublicoSchema = z
  .strictObject({
    definiciones: DefinicionesSchema,
    bloques: CamposContenido.bloques,
    corporales: z.array(
      ResultadoCorporalSchema.refine((r) => r.estado !== "pendiente", "Sin datos pendientes"),
    ),
    pruebas: z.array(
      ResultadoPruebaSchema.refine((r) => r.estado !== "pendiente", "Sin datos pendientes"),
    ),
    grasaPorPliegues: CamposContenido.grasaPorPliegues,
    destacados: CamposContenido.destacados,
    conclusion: CamposContenido.conclusion,
  })
  .superRefine(conProblemas)
  .refine(
    (d) =>
      mismosIds(d.definiciones.corporales, d.corporales) &&
      mismosIds(d.definiciones.pruebas, d.pruebas),
    "Cada definición publicada lleva su resultado",
  )
export type DocumentoPublico = z.infer<typeof DocumentoPublicoSchema>

/** Proyección que se congela al publicar. Nada interno sobrevive a ella. */
export function proyeccionPublica(doc: DocumentoValoracion): DocumentoPublico {
  const corporales = doc.corporales.filter((r) => r.estado !== "pendiente")
  const pruebas = doc.pruebas.filter((r) => r.estado !== "pendiente")
  const usados = new Set([...corporales, ...pruebas].map((r) => r.definicionId))
  return DocumentoPublicoSchema.parse({
    definiciones: {
      corporales: doc.definiciones.corporales.filter((d) => usados.has(d.id)),
      pruebas: doc.definiciones.pruebas.filter((d) => usados.has(d.id)),
    },
    bloques: doc.bloques,
    corporales,
    pruebas,
    grasaPorPliegues: doc.grasaPorPliegues,
    destacados: doc.destacados.filter((id) => usados.has(id)),
    conclusion: doc.conclusion,
  })
}

export const TipoValoracionSchema = z.enum(["inicial", "revision"])
export type TipoValoracion = z.infer<typeof TipoValoracionSchema>

/**
 * `borrador`: nunca publicada. `publicada`: tiene versión vigente y ningún
 * borrador abierto. `corrigiendo`: publicada, con una corrección en curso.
 */
export const EstadoValoracionSchema = z.enum(["borrador", "publicada", "corrigiendo"])
export type EstadoValoracion = z.infer<typeof EstadoValoracionSchema>

const AutorSchema = z.strictObject({ id: z.uuid(), nombre: z.string().min(1).max(200) })

/** Versión publicada e inmutable. Una corrección apunta a la que sustituye. */
export const PublicacionValoracionSchema = z.strictObject({
  id: z.uuid(),
  valoracionId: z.uuid(),
  /** 1 la primera publicación; cada corrección suma uno. */
  numero: z.number().int().min(1),
  sustituyeId: z.uuid().nullable(),
  tipo: TipoValoracionSchema,
  /** Día en que se tomaron los datos; no confundir con la publicación. */
  fechaToma: FechaAgendaSchema,
  autor: AutorSchema,
  publicadaEn: z.iso.datetime(),
  documento: DocumentoPublicoSchema,
})
export type PublicacionValoracion = z.infer<typeof PublicacionValoracionSchema>

export const BorradorValoracionSchema = z.strictObject({
  id: z.uuid(),
  revision: RevisionSchema,
  fechaToma: FechaAgendaSchema,
  /** Si es una corrección, la publicación vigente que sustituirá. */
  corrigePublicacionId: z.uuid().nullable(),
  documento: DocumentoValoracionSchema,
  creadoEn: z.iso.datetime(),
  actualizadoEn: z.iso.datetime(),
})
export type BorradorValoracion = z.infer<typeof BorradorValoracionSchema>

/**
 * Lo que ve el entrenador: la visita, su borrador abierto y la versión vigente.
 * `documentoVigente` es el documento interno que produjo esa versión (con notas
 * internas y pendientes): solo lo recibe el entrenador y de él parte una corrección.
 */
export const ValoracionProfesionalSchema = z.strictObject({
  id: z.uuid(),
  clienteId: z.uuid(),
  tipo: TipoValoracionSchema,
  /** En una revisión, la visita anterior de referencia. */
  anteriorId: z.uuid().nullable(),
  estado: EstadoValoracionSchema,
  creadaEn: z.iso.datetime(),
  borrador: BorradorValoracionSchema.nullable(),
  publicacion: PublicacionValoracionSchema.nullable(),
  documentoVigente: DocumentoValoracionSchema.nullable(),
})
export type ValoracionProfesional = z.infer<typeof ValoracionProfesionalSchema>

/** Lo que ve el cliente: solo la publicación vigente, nunca borradores ni notas internas. */
export const ValoracionClienteSchema = z.strictObject({
  publicacion: PublicacionValoracionSchema,
})
export type ValoracionCliente = z.infer<typeof ValoracionClienteSchema>

/**
 * Lo que ve el nutricionista asignado: resultados corporales publicados. Sin
 * pruebas, conclusión, notas, borradores ni fotos mientras no se decida otra cosa.
 */
export const ValoracionCorporalSchema = z
  .strictObject({
    id: z.uuid(),
    publicacionId: z.uuid(),
    numero: z.number().int().min(1),
    tipo: TipoValoracionSchema,
    fechaToma: FechaAgendaSchema,
    publicadaEn: z.iso.datetime(),
    definiciones: z.array(DefinicionCorporalSchema),
    corporales: z.array(
      ResultadoCorporalSchema.refine((r) => r.estado !== "pendiente", "Sin datos pendientes"),
    ),
    grasaPorPliegues: GrasaPorPlieguesSchema.nullable(),
  })
  .refine(
    (v) => mismosIds(v.definiciones, v.corporales),
    "Cada definición publicada lleva su resultado",
  )
export type ValoracionCorporal = z.infer<typeof ValoracionCorporalSchema>

export function proyeccionCorporal(publicacion: PublicacionValoracion): ValoracionCorporal {
  return ValoracionCorporalSchema.parse({
    id: publicacion.valoracionId,
    publicacionId: publicacion.id,
    numero: publicacion.numero,
    tipo: publicacion.tipo,
    fechaToma: publicacion.fechaToma,
    publicadaEn: publicacion.publicadaEn,
    definiciones: publicacion.documento.definiciones.corporales,
    corporales: publicacion.documento.corporales,
    grasaPorPliegues: publicacion.documento.grasaPorPliegues,
  })
}

/**
 * Una fila del historial profesional. `fechaToma` es la del borrador abierto si
 * lo hay; si no, la de la versión vigente.
 */
export const ResumenValoracionSchema = z.strictObject({
  id: z.uuid(),
  tipo: TipoValoracionSchema,
  estado: EstadoValoracionSchema,
  fechaToma: FechaAgendaSchema,
  /** Fecha de la versión vigente; `null` si nunca se publicó. */
  publicadaEn: z.iso.datetime().nullable(),
  numeroPublicacion: z.number().int().min(1).nullable(),
})
export type ResumenValoracion = z.infer<typeof ResumenValoracionSchema>

/**
 * Una fila del historial del cliente y del nutricionista: solo versiones
 * vigentes publicadas, sin estado de trabajo. `numeroPublicacion` > 1 es una
 * valoración corregida.
 */
export const ResumenValoracionPublicadaSchema = z.strictObject({
  id: z.uuid(),
  tipo: TipoValoracionSchema,
  fechaToma: FechaAgendaSchema,
  publicadaEn: z.iso.datetime(),
  numeroPublicacion: z.number().int().min(1),
})
export type ResumenValoracionPublicada = z.infer<typeof ResumenValoracionPublicadaSchema>

export const ConsultarValoracionesSchema = z.strictObject({
  limite: z.coerce.number().int().min(1).max(50).default(20),
  desplazamiento: z.coerce.number().int().min(0).max(100_000).default(0),
})
export type ConsultarValoraciones = z.infer<typeof ConsultarValoracionesSchema>

export const ListadoValoracionesSchema = z.strictObject({
  valoraciones: z.array(ResumenValoracionSchema),
  total: z.number().int().nonnegative(),
})
export type ListadoValoraciones = z.infer<typeof ListadoValoracionesSchema>

export const ListadoValoracionesPublicadasSchema = z.strictObject({
  valoraciones: z.array(ResumenValoracionPublicadaSchema),
  total: z.number().int().nonnegative(),
})
export type ListadoValoracionesPublicadas = z.infer<typeof ListadoValoracionesPublicadasSchema>

const BloquesElegidosSchema = z
  .array(BloqueValoracionSchema)
  .min(1)
  .max(BLOQUES_VALORACION.length)
  .refine(unicos, "Bloque repetido")

/**
 * `POST valoraciones`. Tres acciones con rótulos distintos: primera visita,
 * revisión (copia definiciones de la plantilla, nunca resultados) y corrección
 * de una publicación (borrador nuevo sobre la misma visita).
 */
export const CrearValoracionSchema = z.union([
  z.strictObject({
    operacionId: z.uuid(),
    tipo: z.literal("inicial"),
    fechaToma: FechaAgendaSchema,
    bloques: BloquesElegidosSchema,
  }),
  z.strictObject({
    operacionId: z.uuid(),
    tipo: z.literal("revision"),
    fechaToma: FechaAgendaSchema,
    bloques: BloquesElegidosSchema,
    anteriorId: z.uuid(),
    /**
     * Revisión de la próxima revisión pautada que esta visita cumple, o `null`.
     * Solo esta acción la marca cumplida; abrir la pauta no.
     */
    cumplePauta: RevisionSchema.nullable(),
  }),
  z.strictObject({
    operacionId: z.uuid(),
    corrigePublicacionId: z.uuid(),
  }),
])
export type CrearValoracion = z.infer<typeof CrearValoracionSchema>

/**
 * `PUT valoraciones/:id`: cambia el borrador abierto, identificado por su id y
 * su `revision`. Otro borrador (por ejemplo, el ya publicado) es un conflicto.
 */
export const CambiarValoracionSchema = z.strictObject({
  borradorId: z.uuid(),
  revision: RevisionSchema,
  fechaToma: FechaAgendaSchema,
  contenido: ContenidoValoracionSchema,
})
export type CambiarValoracion = z.infer<typeof CambiarValoracionSchema>

/**
 * `POST valoraciones/:id/publicaciones`. Publica exactamente la `revision`
 * indicada. Una corrección nombra la publicación vigente que sustituye; una
 * primera publicación envía `null`.
 */
export const PublicarValoracionSchema = z.strictObject({
  operacionId: z.uuid(),
  borradorId: z.uuid(),
  revision: RevisionSchema,
  sustituyePublicacionId: z.uuid().nullable(),
})
export type PublicarValoracion = z.infer<typeof PublicarValoracionSchema>

/** Próxima revisión: fecha concreta o intervalo, y qué bloques se repetirán. */
export const PautaRevisionSchema = z
  .strictObject({
    fecha: FechaAgendaSchema.nullable(),
    intervaloSemanas: z.number().int().min(1).max(52).nullable(),
    bloques: BloquesElegidosSchema,
  })
  .refine(
    (p) => (p.fecha === null) !== (p.intervaloSemanas === null),
    "Indica una fecha o un intervalo, no los dos",
  )
export type PautaRevision = z.infer<typeof PautaRevisionSchema>

/**
 * `pauta: null` es «Sin programar». `cumplidaPorId` es la revisión que la
 * cumplió; guardar una pauta nueva la deja otra vez pendiente.
 */
export const ProximaRevisionSchema = z.strictObject({
  revision: RevisionSchema,
  pauta: PautaRevisionSchema.nullable(),
  cumplidaPorId: z.uuid().nullable(),
  actualizadaEn: z.iso.datetime().nullable(),
})
export type ProximaRevision = z.infer<typeof ProximaRevisionSchema>

export const GuardarProximaRevisionSchema = z.strictObject({
  revision: RevisionSchema,
  pauta: PautaRevisionSchema.nullable(),
})
export type GuardarProximaRevision = z.infer<typeof GuardarProximaRevisionSchema>

/**
 * Evolución: series de puntos comparables. Una serie reúne solo datos de la
 * misma definición y versión (o, en el histórico, del mismo campo y origen);
 * variantes, unidades, instrumentos o métodos distintos son series distintas.
 */
export const OrigenPuntoSchema = z.enum(["valoracion", "autorregistro", "historico"])
export type OrigenPunto = z.infer<typeof OrigenPuntoSchema>

export const PuntoEvolucionSchema = z.strictObject({
  fecha: FechaAgendaSchema,
  valor: z.number(),
  /** Publicación vigente de la visita; `null` en registros que no son valoraciones. */
  publicacionId: z.uuid().nullable(),
  valoracionId: z.uuid().nullable(),
  /** El punto procede de una versión corregida: sustituye al anterior, no se suma. */
  corregido: z.boolean(),
})
export type PuntoEvolucion = z.infer<typeof PuntoEvolucionSchema>

/**
 * Una serie solo junta valores comparables. Formatos de `clave`:
 * - `c:<definición>:<versión>`: campo corporal de las visitas.
 * - `g:pliegues:<método>`: % de grasa que declaró el profesional a partir de
 *   los pliegues; su identidad es el método que declara.
 * - `p:<definición>:<versión>:<métrica>`, con `:incompleto` al final si el
 *   protocolo no se completó: nunca se compara con el completo. Comparte
 *   `nombre` con la serie completa; se distinguen por `metodo`, que la
 *   pantalla debe mostrar cuando dos series se llaman igual.
 * - `h:medida:<campo>:<origen>`, `h:dia:pesoKg`, `h:prueba:<id>:<unidad>:<origen>`
 *   y `h:prueba-libre:<nombre>|<unidad>:<origen>`: histórico anterior a las
 *   valoraciones, sin clasificar.
 */
export const SerieEvolucionSchema = z.strictObject({
  /** Identidad estable de la serie; ver los formatos arriba. */
  clave: z.string().min(1).max(200),
  nombre: z.string().min(1).max(120),
  unidad: z.string().min(1).max(20),
  bloque: BloqueValoracionSchema.nullable(),
  origen: OrigenPuntoSchema,
  /** Instrumento, protocolo o variante que la distingue; `null` si no consta. */
  metodo: z.string().max(400).nullable(),
  /** `false` en el histórico sin método ni protocolo: se muestra, pero no se compara con visitas. */
  clasificada: z.boolean(),
  puntos: z.array(PuntoEvolucionSchema),
})
export type SerieEvolucion = z.infer<typeof SerieEvolucionSchema>

export const ConsultarEvolucionSchema = z
  .strictObject({ desde: FechaAgendaSchema.optional(), hasta: FechaAgendaSchema.optional() })
  .refine((c) => !c.desde || !c.hasta || c.desde <= c.hasta, "El periodo está invertido")
export type ConsultarEvolucion = z.infer<typeof ConsultarEvolucionSchema>

export const EvolucionSchema = z.strictObject({ series: z.array(SerieEvolucionSchema) })
export type Evolucion = z.infer<typeof EvolucionSchema>

/**
 * Avisos de seguimiento en Inicio. Se derivan de publicaciones y solicitudes;
 * cada usuario guarda su propia lectura. Leer un aviso no revisa nada.
 */
export const TipoAvisoSeguimientoSchema = z.enum([
  "valoracionPublicada",
  "valoracionCorregida",
  "fotosSolicitadas",
  "fotosRecibidas",
])
export type TipoAvisoSeguimiento = z.infer<typeof TipoAvisoSeguimientoSchema>

export const AvisoSeguimientoSchema = z.strictObject({
  /** Id de la publicación o de la solicitud de la que nace. */
  id: z.uuid(),
  tipo: TipoAvisoSeguimientoSchema,
  clienteId: z.uuid(),
  autor: AutorSchema,
  creadoEn: z.iso.datetime(),
  destino: z.discriminatedUnion("tipo", [
    z.strictObject({ tipo: z.literal("valoracion"), valoracionId: z.uuid() }),
    z.strictObject({ tipo: z.literal("solicitud"), solicitudId: z.uuid() }),
  ]),
  /** `false` si la publicación ya se sustituyó o la solicitud ya no pide nada. */
  vigente: z.boolean(),
  leidoEn: z.iso.datetime().nullable(),
})
export type AvisoSeguimiento = z.infer<typeof AvisoSeguimientoSchema>

/**
 * Los 50 avisos más recientes. `sinLeer` cuenta los vigentes y no leídos de
 * esa lista. En `fotosRecibidas` el autor es el cliente, que es quien aporta;
 * el aviso nace con la primera foto recibida y deja de estar vigente al revisar.
 */
export const ListadoAvisosSeguimientoSchema = z.strictObject({
  avisos: z.array(AvisoSeguimientoSchema),
  sinLeer: z.number().int().nonnegative(),
})
export type ListadoAvisosSeguimiento = z.infer<typeof ListadoAvisosSeguimientoSchema>

export const LeerAvisosSeguimientoSchema = z.strictObject({
  avisoIds: z
    .array(z.uuid())
    .min(1)
    .max(50)
    .refine((ids) => new Set(ids).size === ids.length, "Aviso repetido"),
})
export type LeerAvisosSeguimiento = z.infer<typeof LeerAvisosSeguimientoSchema>
