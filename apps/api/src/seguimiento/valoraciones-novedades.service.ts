import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common"
import {
  ListadoAvisosSeguimientoSchema,
  type AvisoSeguimiento,
  type LeerAvisosSeguimiento,
  type ListadoAvisosSeguimiento,
} from "@alpha-omega/shared"

import { invalida } from "../entrenamiento/documentos.js"
import type { IdentidadVerificada } from "../identity/peticion.js"
import { PrismaService } from "../prisma/prisma.service.js"

/** Inicio muestra los avisos más recientes; su origen conserva el resto. */
const MAXIMO = 50
const AUTOR = { select: { id: true, nombre: true, apellidos: true } } as const

type Autor = { id: string; nombre: string; apellidos: string | null }
type Aviso = Omit<AvisoSeguimiento, "leidoEn">

function autor(fila: Autor): AvisoSeguimiento["autor"] {
  return { id: fila.id, nombre: [fila.nombre, fila.apellidos].filter(Boolean).join(" ") }
}

/** Más recientes primero; a igual fecha, un orden estable por id. */
function masReciente(a: Aviso, b: Aviso): number {
  return b.creadoEn.localeCompare(a.creadoEn) || b.id.localeCompare(a.id)
}

/**
 * Avisos de valoraciones y solicitudes de fotos con lectura por usuario (E02a).
 * No hay tabla de avisos: se derivan de publicaciones y solicitudes, y cada
 * usuario guarda su propia lectura. Leer un aviso no publica, corrige ni revisa.
 */
@Injectable()
export class ValoracionesNovedadesService {
  constructor(private readonly prisma: PrismaService) {}

  private async clienteExiste(clienteId: string): Promise<void> {
    const cliente = await this.prisma.usuario.findFirst({
      where: { id: clienteId, rol: "cliente" },
      select: { id: true },
    })
    if (!cliente) throw new NotFoundException("Cliente no disponible")
  }

  /**
   * Cliente: cada versión publicada de sus visitas (vigente mientras nadie la
   * sustituya) y cada solicitud de fotos (vigente mientras esté pendiente).
   */
  private async delCliente(clienteId: string): Promise<Aviso[]> {
    const [publicaciones, solicitudes] = await Promise.all([
      this.prisma.publicacionValoracion.findMany({
        where: { valoracion: { clienteId } },
        select: {
          id: true,
          valoracionId: true,
          numero: true,
          publicadaEn: true,
          autor: AUTOR,
          sustituidaPor: { select: { id: true } },
        },
        orderBy: [{ publicadaEn: "desc" }, { id: "desc" }],
        take: MAXIMO,
      }),
      this.prisma.solicitudFotos.findMany({
        where: { clienteId },
        select: { id: true, estado: true, creadaEn: true, autor: AUTOR },
        orderBy: [{ creadaEn: "desc" }, { id: "desc" }],
        take: MAXIMO,
      }),
    ])
    return [
      ...publicaciones.map((fila): Aviso => ({
        id: fila.id,
        tipo: fila.numero === 1 ? "valoracionPublicada" : "valoracionCorregida",
        clienteId,
        autor: autor(fila.autor),
        creadoEn: fila.publicadaEn.toISOString(),
        destino: { tipo: "valoracion", valoracionId: fila.valoracionId },
        vigente: fila.sustituidaPor === null,
      })),
      ...solicitudes.map((fila): Aviso => ({
        id: fila.id,
        tipo: "fotosSolicitadas",
        clienteId,
        autor: autor(fila.autor),
        creadoEn: fila.creadaEn.toISOString(),
        destino: { tipo: "solicitud", solicitudId: fila.id },
        vigente: fila.estado === "pendiente",
      })),
    ]
  }

  /**
   * Entrenador: solicitudes con fotos recibidas, vigentes hasta que las revise.
   * Solo el cliente aporta a una solicitud, así que él es el autor del aviso.
   */
  private async delEntrenador(clienteId: string): Promise<Aviso[]> {
    const solicitudes = await this.prisma.solicitudFotos.findMany({
      where: { clienteId, recibidaEn: { not: null } },
      select: { id: true, estado: true, recibidaEn: true, cliente: AUTOR },
      orderBy: [{ recibidaEn: "desc" }, { id: "desc" }],
      take: MAXIMO,
    })
    return solicitudes.flatMap((fila): Aviso[] =>
      fila.recibidaEn
        ? [
            {
              id: fila.id,
              tipo: "fotosRecibidas",
              clienteId,
              autor: autor(fila.cliente),
              creadoEn: fila.recibidaEn.toISOString(),
              destino: { tipo: "solicitud", solicitudId: fila.id },
              vigente: fila.estado === "recibida",
            },
          ]
        : [],
    )
  }

  /** El nutricionista no recibe estos avisos: no ve fotos ni solicitudes. */
  private derivar(actor: IdentidadVerificada, clienteId: string): Promise<Aviso[]> {
    switch (actor.rol) {
      case "cliente":
        return this.delCliente(clienteId)
      case "entrenador":
        return this.delEntrenador(clienteId)
      case "nutricionista":
      case "empleado":
        throw new ForbiddenException()
    }
  }

  /** Lo que este usuario ve ahora mismo, sin lectura. */
  private async visibles(actor: IdentidadVerificada, clienteId: string): Promise<Aviso[]> {
    await this.clienteExiste(clienteId)
    return (await this.derivar(actor, clienteId)).sort(masReciente).slice(0, MAXIMO)
  }

  private async conLectura(
    actor: IdentidadVerificada,
    avisos: Aviso[],
  ): Promise<ListadoAvisosSeguimiento> {
    const lecturas = await this.prisma.lecturaAvisoSeguimiento.findMany({
      where: { usuarioId: actor.sub, avisoId: { in: avisos.map((a) => a.id) } },
      select: { avisoId: true, leidoEn: true },
    })
    const leidos = new Map(lecturas.map((l) => [l.avisoId, l.leidoEn.toISOString()]))
    const listado = avisos.map((a) => ({ ...a, leidoEn: leidos.get(a.id) ?? null }))
    return ListadoAvisosSeguimientoSchema.parse({
      avisos: listado,
      sinLeer: listado.filter((a) => a.vigente && a.leidoEn === null).length,
    })
  }

  async avisos(actor: IdentidadVerificada, clienteId: string): Promise<ListadoAvisosSeguimiento> {
    return this.conLectura(actor, await this.visibles(actor, clienteId))
  }

  /**
   * Marca como leídos avisos que el usuario ve ahora. Es idempotente: repetir
   * conserva la primera lectura. Si alguno no es visible, no se marca ninguno.
   */
  async leer(
    actor: IdentidadVerificada,
    clienteId: string,
    datos: LeerAvisosSeguimiento,
  ): Promise<ListadoAvisosSeguimiento> {
    const avisos = await this.visibles(actor, clienteId)
    const tipos = new Map(avisos.map((a) => [a.id, a.tipo]))
    const lecturas = datos.avisoIds.flatMap((avisoId) => {
      const tipo = tipos.get(avisoId)
      return tipo ? [{ usuarioId: actor.sub, avisoId, tipo }] : []
    })
    if (lecturas.length !== datos.avisoIds.length)
      throw invalida("Algún aviso no está disponible para este usuario")
    await this.prisma.lecturaAvisoSeguimiento.createMany({ data: lecturas, skipDuplicates: true })
    return this.conLectura(actor, avisos)
  }
}
