import type { Prisma } from "@prisma/client"
import type { TipoNovedadEntrenamiento } from "@alpha-omega/shared"

/** Crear el aviso en la misma transacción que el hecho que lo originó. */
export async function registrarNovedad(
  tx: Prisma.TransactionClient,
  datos: {
    sesionId: string
    clienteId: string
    autorId: string
    audiencia: "cliente" | "entrenador"
    tipo: TipoNovedadEntrenamiento
  },
): Promise<void> {
  await tx.novedadEntrenamiento.create({ data: datos })
}
