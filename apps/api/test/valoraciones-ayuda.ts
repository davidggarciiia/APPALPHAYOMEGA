import { VERSION_CONSENTIMIENTO } from "@alpha-omega/shared"

import type { PrismaService } from "../src/prisma/prisma.service.js"

/**
 * Los clientes de prueba que guardan datos de salud necesitan el
 * consentimiento vigente, igual que uno real. Son cuentas sintéticas.
 */
export async function darConsentimiento(prisma: PrismaService, ids: string[]): Promise<void> {
  await prisma.consentimientoSalud.createMany({
    data: ids.map((usuarioId) => ({ usuarioId, version: VERSION_CONSENTIMIENTO })),
    skipDuplicates: true,
  })
}

/**
 * Borra las valoraciones, fotos, solicitudes y consentimientos de los usuarios de prueba. Las publicaciones y visitas
 * se referencian entre sí con RESTRICT (auditoría), así que se retiran primero
 * las que nadie sustituye o toma como anterior.
 */
export async function limpiarValoraciones(prisma: PrismaService, ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const clienteId = { in: ids }
  const valoracion = { clienteId }
  await prisma.lecturaAvisoSeguimiento.deleteMany({ where: { usuarioId: { in: ids } } })
  await prisma.medioFoto.deleteMany({ where: { OR: [{ clienteId }, { autorId: { in: ids } }] } })
  await prisma.solicitudFotos.deleteMany({
    where: { OR: [{ clienteId }, { autorId: { in: ids } }] },
  })
  await prisma.operacionValoracion.deleteMany({
    where: { OR: [{ valoracion }, { autorId: { in: ids } }] },
  })
  await prisma.proximaRevisionValoracion.deleteMany({ where: { clienteId } })
  await prisma.borradorValoracion.updateMany({
    where: { valoracion },
    data: { corrigePublicacionId: null },
  })
  while ((await prisma.publicacionValoracion.count({ where: { valoracion } })) > 0)
    await prisma.publicacionValoracion.deleteMany({ where: { valoracion, sustituidaPor: null } })
  await prisma.borradorValoracion.deleteMany({ where: { valoracion } })
  while ((await prisma.valoracion.count({ where: valoracion })) > 0)
    await prisma.valoracion.deleteMany({ where: { ...valoracion, siguientes: { none: {} } } })
  await prisma.plantillaValoracion.deleteMany({ where: { clienteId } })
  await prisma.consentimientoSalud.deleteMany({ where: { usuarioId: { in: ids } } })
}
