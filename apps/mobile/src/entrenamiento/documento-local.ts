import { z } from "zod"
import {
  GuardarBorradorSchema,
  EnviarEntrenamientoSchema,
  ResultadoEntrenamientoSchema,
  SesionClienteSchema,
  PrescripcionSchema,
  type SesionCliente,
} from "@alpha-omega/shared"
import type { AlmacenLocal } from "./almacen-local"
import { EdicionRegistroSchema, desdePrescripcion } from "./registro-modelo"

export const DocumentoSesionSchema = z.strictObject({
  sesion: SesionClienteSchema,
  edicion: EdicionRegistroSchema,
  secuencia: z.number().int().nonnegative(),
  sincronizada: z.number().int().nonnegative(),
  revisionBorrador: z.number().int().nonnegative(),
  pendiente: z
    .strictObject({ peticion: GuardarBorradorSchema, secuencia: z.number().int().nonnegative() })
    .nullable(),
  envioPendiente: EnviarEntrenamientoSchema.nullable(),
  respaldo: z
    .strictObject({ edicion: EdicionRegistroSchema, prescripcion: PrescripcionSchema })
    .nullable(),
  resultado: ResultadoEntrenamientoSchema.nullable(),
})
export type DocumentoSesion = z.infer<typeof DocumentoSesionSchema>
export const claveSesion = (id: string): string => `sesion-${id}`

export function nuevoDocumento(sesion: SesionCliente): DocumentoSesion {
  return {
    sesion,
    edicion: desdePrescripcion(sesion.prescripcion, sesion.borrador?.registro),
    secuencia: 0,
    sincronizada: 0,
    revisionBorrador: sesion.borrador?.revision ?? 0,
    pendiente: null,
    envioPendiente: null,
    respaldo: null,
    resultado: null,
  }
}

export async function hayCambiosLocales(almacen: AlmacenLocal, cuenta: string): Promise<boolean> {
  const claves = await almacen.listar(cuenta)
  if (claves.some((clave) => clave.startsWith("plan-"))) return true
  for (const clave of claves.filter((clave) => clave.startsWith("sesion-"))) {
    const documento = await almacen.leer(cuenta, clave, DocumentoSesionSchema)
    if (
      documento &&
      (documento.secuencia > documento.sincronizada ||
        documento.pendiente !== null ||
        documento.envioPendiente !== null ||
        documento.respaldo !== null)
    )
      return true
  }
  return false
}
