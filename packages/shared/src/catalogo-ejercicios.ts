import { z } from "zod"

export const GRUPOS_MUSCULARES = [
  "pecho",
  "espalda",
  "hombros",
  "biceps",
  "triceps",
  "antebrazos",
  "abdomen",
  "gluteos",
  "cuadriceps",
  "isquiotibiales",
  "gemelos",
] as const
export const GrupoMuscularSchema = z.enum(GRUPOS_MUSCULARES)
export type GrupoMuscular = z.infer<typeof GrupoMuscularSchema>

const CamposEjercicio = {
  nombre: z.string().trim().min(1).max(120),
  grupoPrincipal: GrupoMuscularSchema,
  gruposSecundarios: z.array(GrupoMuscularSchema).max(10),
  instrucciones: z.string().trim().min(1).max(4000),
}

function gruposValidos(ejercicio: {
  grupoPrincipal: GrupoMuscular
  gruposSecundarios: GrupoMuscular[]
}): boolean {
  return (
    new Set(ejercicio.gruposSecundarios).size === ejercicio.gruposSecundarios.length &&
    !ejercicio.gruposSecundarios.includes(ejercicio.grupoPrincipal)
  )
}

// Objetos estrictos: no aceptar campos que el formulario no puede editar.
// https://zod.dev/api#zstrictobject
export const CrearEjercicioSchema = z.strictObject(CamposEjercicio).refine(gruposValidos, {
  message: "Los grupos secundarios no pueden repetirse ni incluir el principal",
  path: ["gruposSecundarios"],
})
export type CrearEjercicio = z.infer<typeof CrearEjercicioSchema>

// La edición envía la ficha textual completa para validar los grupos conjuntamente.
export const EditarEjercicioSchema = CrearEjercicioSchema
export type EditarEjercicio = z.infer<typeof EditarEjercicioSchema>

export const EjercicioSchema = z
  .strictObject({
    id: z.uuid(),
    ...CamposEjercicio,
    estado: z.enum(["publicado", "retirado"]),
    figura: z.null(),
    video: z.null(),
  })
  .refine(gruposValidos)
export type Ejercicio = z.infer<typeof EjercicioSchema>

export const BuscarEjerciciosSchema = z.strictObject({
  buscar: z.string().trim().max(120).optional(),
  grupo: GrupoMuscularSchema.optional(),
  estado: z.enum(["publicado", "retirado", "todos"]).default("publicado"),
  limite: z.coerce.number().int().min(1).max(100).default(30),
  desplazamiento: z.coerce.number().int().nonnegative().max(100000).default(0),
})
export type BuscarEjercicios = z.infer<typeof BuscarEjerciciosSchema>
export const ListadoEjerciciosSchema = z.strictObject({
  ejercicios: z.array(EjercicioSchema).max(100),
  total: z.number().int().nonnegative(),
})
export type ListadoEjercicios = z.infer<typeof ListadoEjerciciosSchema>
