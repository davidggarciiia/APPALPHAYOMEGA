import { z } from "zod"
import { RevisionSchema } from "./agenda"

/**
 * Contratos de `nutricion` (SPEC-nutricion.md).
 *
 * La dieta viaja como un documento completo, validado de una pieza, igual que
 * la prescripción del entrenamiento. Los números los escribe el profesional y
 * son siempre opcionales: la app no calcula calorías ni macros.
 */

const Texto = (min: number, max: number) => z.string().trim().min(min).max(max)
const TextoOpcional = (max: number) => z.string().trim().max(max).nullable()
const Hora = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Escribe la hora como HH:MM")
  .nullable()
const Gramos = z.number().int().min(0).max(2000).nullable()

export const MacrosSchema = z.strictObject({
  kcal: z.number().int().min(0).max(10000).nullable(),
  proteinaG: Gramos,
  hidratosG: Gramos,
  grasaG: Gramos,
})
export type Macros = z.infer<typeof MacrosSchema>

export function tieneAlgunNumero(macros: Macros | null): boolean {
  return macros !== null && Object.values(macros).some((valor) => valor !== null)
}

/** La cantidad es texto libre: "80 g", "1 ud", "al gusto". "Pieza de fruta" no lleva. */
export const AlimentoSchema = z.strictObject({
  nombre: Texto(1, 80),
  cantidad: TextoOpcional(40),
})
export type Alimento = z.infer<typeof AlimentoSchema>

export const AlternativaSchema = z.strictObject({
  id: z.uuid(),
  titulo: Texto(1, 80),
  alimentos: z.array(AlimentoSchema).min(1).max(20),
  nota: TextoOpcional(300),
  macros: MacrosSchema.nullable(),
})
export type Alternativa = z.infer<typeof AlternativaSchema>

export const GrupoDeAlternativasSchema = z.strictObject({
  nombre: TextoOpcional(40),
  alternativas: z.array(AlternativaSchema).min(1).max(20),
})
export type GrupoDeAlternativas = z.infer<typeof GrupoDeAlternativasSchema>

export const ColumnaDeIntercambioSchema = z.strictObject({
  nombre: Texto(1, 40),
  alimentos: z.array(AlimentoSchema).min(1).max(40),
})
export type ColumnaDeIntercambio = z.infer<typeof ColumnaDeIntercambioSchema>

const CamposComida = {
  id: z.uuid(),
  nombre: Texto(1, 40),
  hora: Hora,
  indicacion: TextoOpcional(500),
}

export const MAX_ALTERNATIVAS_POR_COMIDA = 20

// Una comida se expresa de una sola forma, y cada forma excluye los campos de la otra.
// https://zod.dev/api#discriminated-unions
export const ComidaSchema = z.discriminatedUnion("forma", [
  z.strictObject({
    ...CamposComida,
    forma: z.literal("alternativas"),
    grupos: z
      .array(GrupoDeAlternativasSchema)
      .min(1)
      .max(6)
      .refine(
        (grupos) =>
          grupos.flatMap((grupo) => grupo.alternativas).length <= MAX_ALTERNATIVAS_POR_COMIDA,
        "Como máximo 20 alternativas por comida",
      ),
  }),
  z.strictObject({
    ...CamposComida,
    forma: z.literal("intercambio"),
    columnas: z.array(ColumnaDeIntercambioSchema).min(1).max(6),
  }),
])
export type Comida = z.infer<typeof ComidaSchema>

export const TipoDeDiaSchema = z
  .strictObject({
    id: z.uuid(),
    nombre: Texto(1, 40),
    objetivo: MacrosSchema.nullable(),
    comidas: z.array(ComidaSchema).max(10),
  })
  .refine(
    (tipo) => tipo.comidas.length > 0 || tieneAlgunNumero(tipo.objetivo),
    "Un tipo de día sin comidas necesita un objetivo con algún número",
  )
export type TipoDeDia = z.infer<typeof TipoDeDiaSchema>

export const IndicacionSchema = z.strictObject({
  titulo: Texto(1, 60),
  texto: Texto(1, 3000),
})
export type Indicacion = z.infer<typeof IndicacionSchema>

function idsUnicos(dieta: { tiposDeDia: TipoDeDia[] }): boolean {
  const ids = dieta.tiposDeDia.flatMap((tipo) => [
    tipo.id,
    ...tipo.comidas.flatMap((comida) => [
      comida.id,
      ...(comida.forma === "alternativas"
        ? comida.grupos.flatMap((grupo) => grupo.alternativas.map((alternativa) => alternativa.id))
        : []),
    ]),
  ])
  return new Set(ids).size === ids.length
}

export const DocumentoDietaSchema = z
  .strictObject({
    formato: z.literal(1),
    nombre: Texto(1, 120),
    tiposDeDia: z.array(TipoDeDiaSchema).min(1).max(7),
    /** De lunes a domingo: el tipo de día que toca cada uno. */
    semana: z.array(z.uuid()).length(7),
    indicaciones: z.array(IndicacionSchema).max(10),
  })
  .refine(
    (dieta) => dieta.semana.every((id) => dieta.tiposDeDia.some((tipo) => tipo.id === id)),
    "Cada día de la semana tiene que apuntar a un tipo de día de la dieta",
  )
  .refine(idsUnicos, "Hay identificadores repetidos en la dieta")
export type DocumentoDieta = z.infer<typeof DocumentoDietaSchema>

/** La revisión 0 crea el borrador; cualquier otra actualiza el existente si coincide. */
export const GuardarBorradorDietaSchema = z.strictObject({
  revision: RevisionSchema,
  documento: DocumentoDietaSchema,
})
export type GuardarBorradorDieta = z.infer<typeof GuardarBorradorDietaSchema>

export const PublicarDietaSchema = z.strictObject({
  operacionId: z.uuid(),
  revision: RevisionSchema,
})
export type PublicarDieta = z.infer<typeof PublicarDietaSchema>

export const DescartarBorradorDietaSchema = z.strictObject({ revision: RevisionSchema })
export type DescartarBorradorDieta = z.infer<typeof DescartarBorradorDietaSchema>

export const BorradorDietaSchema = z.strictObject({
  id: z.uuid(),
  clienteId: z.uuid(),
  revision: RevisionSchema,
  documento: DocumentoDietaSchema,
  actualizadoEn: z.iso.datetime(),
})
export type BorradorDieta = z.infer<typeof BorradorDietaSchema>

export const LecturaBorradorDietaSchema = z.strictObject({
  borrador: BorradorDietaSchema.nullable(),
})
export type LecturaBorradorDieta = z.infer<typeof LecturaBorradorDietaSchema>

/** Lo que recibe el cliente: nunca quién la publicó ni el histórico. */
export const DietaPublicadaSchema = z.strictObject({
  id: z.uuid(),
  clienteId: z.uuid(),
  documento: DocumentoDietaSchema,
  publicadaEn: z.iso.datetime(),
})
export type DietaPublicada = z.infer<typeof DietaPublicadaSchema>

export const LecturaDietaVigenteSchema = z.strictObject({
  dieta: DietaPublicadaSchema.nullable(),
})
export type LecturaDietaVigente = z.infer<typeof LecturaDietaVigenteSchema>

const AutorSchema = z.strictObject({ id: z.uuid(), nombre: z.string() })

export const ResumenDietaSchema = z.strictObject({
  id: z.uuid(),
  nombre: Texto(1, 120),
  estado: z.enum(["publicada", "archivada"]),
  publicadaEn: z.iso.datetime(),
  archivadaEn: z.iso.datetime().nullable(),
  publicadaPor: AutorSchema,
})
export type ResumenDieta = z.infer<typeof ResumenDietaSchema>

export const ListadoDietasSchema = z.strictObject({
  dietas: z.array(ResumenDietaSchema),
  total: z.number().int().nonnegative(),
})
export type ListadoDietas = z.infer<typeof ListadoDietasSchema>

export const ConsultarHistoricoDietasSchema = z.strictObject({
  limite: z.coerce.number().int().min(1).max(50).default(20),
  desplazamiento: z.coerce.number().int().min(0).max(100000).default(0),
})
export type ConsultarHistoricoDietas = z.infer<typeof ConsultarHistoricoDietasSchema>

/** Una dieta publicada o archivada, para el profesional. */
export const DietaDelHistoricoSchema = ResumenDietaSchema.extend({
  clienteId: z.uuid(),
  documento: DocumentoDietaSchema,
})
export type DietaDelHistorico = z.infer<typeof DietaDelHistoricoSchema>
