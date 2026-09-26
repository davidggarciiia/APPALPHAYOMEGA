import type { PrismaClient } from "@prisma/client"

import type { AlmacenObjetos } from "../medios/almacen-objetos.js"
import { DOMINIO_DEMO } from "./seguridad-demo.js"

/**
 * Borra las cuentas de demostración y todo lo que cuelga de ellas, en el orden
 * que imponen las claves ajenas (casi todas RESTRICT, por auditoría). Nunca
 * toca otro usuario: todo se filtra por los ids de las cuentas del dominio de
 * la demo o por filas que solo existen por ellas. Las fotos se borran también
 * del almacén.
 *
 * Devuelve cuántas cuentas de demo había.
 */
export async function limpiarDemo(prisma: PrismaClient, almacen: AlmacenObjetos): Promise<number> {
  const usuarios = await prisma.usuario.findMany({
    where: { email: { endsWith: `@${DOMINIO_DEMO}` } },
    select: { id: true },
  })
  const ids = usuarios.map((u) => u.id)
  if (ids.length === 0) return 0
  const deDemo = { in: ids }

  // Planes, saldo, cobros y agenda.
  await prisma.$transaction([
    prisma.cobro.deleteMany({ where: { clienteId: deDemo } }),
    prisma.solicitudProducto.deleteMany({ where: { clienteId: deDemo } }),
    prisma.movimientoSaldo.deleteMany({ where: { clienteId: deDemo } }),
    prisma.bono.deleteMany({ where: { clienteId: deDemo } }),
    prisma.suscripcion.deleteMany({ where: { clienteId: deDemo } }),
    prisma.reserva.deleteMany({ where: { clienteId: deDemo } }),
    prisma.excepcionAgenda.deleteMany({ where: { autorId: deDemo } }),
  ])

  // Fotos: primero los objetos del almacén, luego sus filas.
  const medios = await prisma.medioFoto.findMany({
    where: { OR: [{ clienteId: deDemo }, { autorId: deDemo }] },
    select: { id: true, clave: true },
  })
  const intentos = await prisma.intentoFoto.findMany({
    where: {
      OR: [
        { medioId: { in: medios.map((m) => m.id) } },
        ...ids.map((id) => ({ clave: { startsWith: `clientes/${id}/` } })),
      ],
    },
    select: { clave: true },
  })
  for (const clave of new Set([...medios.map((m) => m.clave), ...intentos.map((i) => i.clave)]))
    await almacen.borrar(clave)
  await prisma.intentoFoto.deleteMany({ where: { clave: { in: intentos.map((i) => i.clave) } } })

  // Valoraciones, solicitudes de fotos y avisos. Publicaciones y visitas se
  // referencian entre sí: se retiran primero las que nadie sustituye o toma
  // como anterior.
  const valoracion = { clienteId: deDemo }
  const avisos = [
    ...(
      await prisma.publicacionValoracion.findMany({ where: { valoracion }, select: { id: true } })
    ).map((p) => p.id),
    ...(
      await prisma.solicitudFotos.findMany({
        where: { OR: [{ clienteId: deDemo }, { autorId: deDemo }] },
        select: { id: true },
      })
    ).map((s) => s.id),
  ]
  await prisma.lecturaAvisoSeguimiento.deleteMany({
    where: { OR: [{ usuarioId: deDemo }, { avisoId: { in: avisos } }] },
  })
  await prisma.medioFoto.deleteMany({ where: { OR: [{ clienteId: deDemo }, { autorId: deDemo }] } })
  await prisma.solicitudFotos.deleteMany({
    where: { OR: [{ clienteId: deDemo }, { autorId: deDemo }] },
  })
  await prisma.operacionValoracion.deleteMany({
    where: { OR: [{ valoracion }, { autorId: deDemo }] },
  })
  await prisma.proximaRevisionValoracion.deleteMany({ where: { clienteId: deDemo } })
  await prisma.borradorValoracion.updateMany({
    where: { valoracion },
    data: { corrigePublicacionId: null },
  })
  while ((await prisma.publicacionValoracion.count({ where: { valoracion } })) > 0)
    await prisma.publicacionValoracion.deleteMany({ where: { valoracion, sustituidaPor: null } })
  await prisma.borradorValoracion.deleteMany({ where: { valoracion } })
  while ((await prisma.valoracion.count({ where: valoracion })) > 0)
    await prisma.valoracion.deleteMany({ where: { ...valoracion, siguientes: { none: {} } } })
  await prisma.plantillaValoracion.deleteMany({ where: { clienteId: deDemo } })

  // Entrenamiento: sesiones de los clientes de demo y rutinas de su entrenador.
  const sesiones = await prisma.sesionProgramada.findMany({
    where: { clienteId: deDemo },
    select: { id: true },
  })
  const sesionId = { in: sesiones.map((s) => s.id) }
  await prisma.$transaction([
    prisma.lecturaNovedad.deleteMany({
      where: { OR: [{ novedad: { sesionId } }, { usuarioId: deDemo }] },
    }),
    prisma.novedadEntrenamiento.deleteMany({ where: { OR: [{ sesionId }, { autorId: deDemo }] } }),
    prisma.comentarioSesion.deleteMany({ where: { OR: [{ sesionId }, { autorId: deDemo }] } }),
    prisma.molestia.deleteMany({ where: { OR: [{ sesionId }, { clienteId: deDemo }] } }),
    prisma.operacionEntrenamiento.deleteMany({ where: { sesionId } }),
    prisma.referenciaEjercicio.deleteMany({ where: { sesionId } }),
    prisma.cambioDeFecha.deleteMany({ where: { OR: [{ sesionId }, { autorId: deDemo }] } }),
    prisma.sesionEntrenamiento.deleteMany({ where: { id: sesionId } }),
    prisma.sesionProgramada.deleteMany({ where: { id: sesionId } }),
    prisma.planEntrenamiento.deleteMany({ where: { clienteId: deDemo } }),
    prisma.rutinaGuardada.deleteMany({ where: { creadorId: deDemo } }),
  ])

  // Nutrición, seguimiento, consentimiento y, por último, las cuentas. Tokens y
  // asignaciones de nutricionista se van con ellas (CASCADE).
  await prisma.$transaction([
    prisma.comidaRegistrada.deleteMany({ where: { clienteId: deDemo } }),
    prisma.dieta.deleteMany({ where: { clienteId: deDemo } }),
    prisma.diaSeguimiento.deleteMany({ where: { clienteId: deDemo } }),
    prisma.configuracionSeguimiento.deleteMany({ where: { clienteId: deDemo } }),
    prisma.medidaCorporal.deleteMany({
      where: { OR: [{ clienteId: deDemo }, { autorId: deDemo }] },
    }),
    prisma.pruebaFisica.deleteMany({ where: { OR: [{ clienteId: deDemo }, { autorId: deDemo }] } }),
    prisma.consentimientoSalud.deleteMany({ where: { usuarioId: deDemo } }),
    prisma.usuario.deleteMany({ where: { id: deDemo } }),
  ])
  return ids.length
}
