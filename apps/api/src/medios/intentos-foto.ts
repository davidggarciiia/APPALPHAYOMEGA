import type { PrismaService } from "../prisma/prisma.service.js"
import type { AlmacenObjetos } from "./almacen-objetos.js"

export const VIDA_INTENTO_FOTO_MS = 60 * 60_000
const REPASO_DESCARTADAS_MS = 24 * 60 * 60_000

/**
 * Descartar y publicar compiten por la misma fila. El descarte se confirma
 * ANTES del DELETE externo: ninguna operación lenta puede alcanzar la clave
 * de una confirmación ganadora. Una fila ausente nunca autoriza borrar.
 */
export async function limpiarIntentoFoto(
  prisma: PrismaService,
  almacen: AlmacenObjetos,
  clave: string,
  ahora = new Date(),
): Promise<void> {
  const descartadas = await prisma.intentoFoto.updateMany({
    where: { clave },
    data: { descartadoEn: ahora, reintentarEn: ahora },
  })
  if (descartadas.count === 0) return
  await almacen.borrar(clave)
  // Conservamos la clave descartada, incluso si la intención original ya no
  // existe: un PUT remoto puede terminar después de un error o una caída.
  // Los fallos se reintentan en el siguiente pase; las retiradas se repasan al día.
  await prisma.intentoFoto.updateMany({
    where: { clave, descartadoEn: { not: null } },
    data: { reintentarEn: new Date(ahora.getTime() + REPASO_DESCARTADAS_MS) },
  })
}
