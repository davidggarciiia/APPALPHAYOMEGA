import { z } from "zod"
import {
  GuardarBorradorSchema,
  EnviarEntrenamientoSchema,
  ResultadoEntrenamientoSchema,
  SesionClienteSchema,
  PrescripcionSchema,
  AsignarPlanSchema,
  type SesionCliente,
} from "@alpha-omega/shared"
import type { AlmacenLocal } from "./almacen-local"
import { EdicionRegistroSchema, desdePrescripcion } from "./registro-modelo"

const CopiaLocalSchema = z.strictObject({
  edicion: EdicionRegistroSchema,
  prescripcion: PrescripcionSchema,
})

export const DocumentoSesionSchema = z.strictObject({
  sesion: SesionClienteSchema,
  edicion: EdicionRegistroSchema,
  secuencia: z.number().int().nonnegative(),
  sincronizada: z.number().int().nonnegative(),
  revisionBorrador: z.number().int().nonnegative(),
  /** Navegación y descanso pertenecen a esta copia privada, no a la prescripción. */
  ejercicioElegidoId: z.uuid().nullable().optional(),
  descansoHasta: z.iso.datetime().nullable().optional(),
  descansoTotal: z.number().int().nonnegative().nullable().optional(),
  /** Envío confirmado por el cliente y guardado antes de necesitar red. */
  intencionEnvio: z
    .strictObject({
      operacionId: z.uuid(),
      revisionPrescripcion: z.number().int().nonnegative(),
      registro: GuardarBorradorSchema.shape.registro,
    })
    .nullable()
    .optional(),
  pendiente: z
    .strictObject({ peticion: GuardarBorradorSchema, secuencia: z.number().int().nonnegative() })
    .nullable(),
  envioPendiente: EnviarEntrenamientoSchema.nullable(),
  respaldo: CopiaLocalSchema.nullable(),
  /** Copias de ediciones concurrentes, conservadas hasta que el cliente las descarte. */
  respaldosLocales: z.array(CopiaLocalSchema).optional(),
  conflictoLocal: z.boolean().optional(),
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
    ejercicioElegidoId: null,
    descansoHasta: null,
    descansoTotal: null,
    intencionEnvio: null,
    pendiente: null,
    envioPendiente: null,
    respaldo: null,
    resultado: null,
  }
}

export async function hayCambiosLocales(almacen: AlmacenLocal, cuenta: string): Promise<boolean> {
  const claves = await almacen.listar(cuenta)
  // La semana consultada es caché. La solicitud del constructor es una
  // publicación pendiente que todavía necesita conservar su operación exacta.
  const planLocal = z.object({ solicitud: AsignarPlanSchema.optional() })
  for (const clave of claves.filter((clave) => clave.startsWith("plan-"))) {
    const documento = await almacen.leer(cuenta, clave, planLocal)
    if (documento?.solicitud) return true
  }
  for (const clave of claves.filter((clave) => clave.startsWith("sesion-"))) {
    const documento = await almacen.leer(cuenta, clave, DocumentoSesionSchema)
    if (
      documento &&
      (documento.secuencia > documento.sincronizada ||
        documento.pendiente !== null ||
        documento.intencionEnvio != null ||
        documento.envioPendiente !== null ||
        documento.respaldo !== null ||
        (documento.respaldosLocales?.length ?? 0) > 0)
    )
      return true
  }
  return false
}
