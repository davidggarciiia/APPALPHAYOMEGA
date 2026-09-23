import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common"
import { createHash } from "node:crypto"
import type { Dieta, Prisma } from "@prisma/client"
import {
  DocumentoDietaSchema,
  type BorradorDieta,
  type ConsultarHistoricoDietas,
  type DietaDelHistorico,
  type DietaPublicada,
  type DocumentoDieta,
  type ErrorDeApi,
  type GuardarBorradorDieta,
  type LecturaBorradorDieta,
  type LecturaDietaVigente,
  type ListadoDietas,
  type PublicarDieta,
  type ResumenDieta,
} from "@alpha-omega/shared"

import type { IdentidadVerificada } from "../identity/peticion.js"
import { PrismaService } from "../prisma/prisma.service.js"

type Cliente = Prisma.TransactionClient | PrismaService

function conflicto(
  codigo: Extract<ErrorDeApi, { statusCode: 409 }>["codigo"],
  message: string,
): ConflictException {
  return new ConflictException({ statusCode: 409, codigo, message } satisfies ErrorDeApi)
}

/** Lo que sale de la base se vuelve a validar: la versión decide cómo leerlo. */
export function leerDocumento(fila: Pick<Dieta, "documento" | "version">): DocumentoDieta {
  const resultado = DocumentoDietaSchema.safeParse(fila.documento)
  if (fila.version !== 1 || !resultado.success) {
    // Sin detalles: el documento es dato personal y no se escribe en ningún log.
    throw new InternalServerErrorException("No se puede leer la dieta guardada")
  }
  return resultado.data
}

type FilaConAutor = Dieta & {
  publicadaPor: { id: string; nombre: string; apellidos: string | null } | null
}

const CON_AUTOR = {
  publicadaPor: { select: { id: true, nombre: true, apellidos: true } },
} satisfies Prisma.DietaInclude

const EN_HISTORICO = { in: ["publicada", "archivada"] } satisfies Prisma.EnumEstadoDietaFilter

function publicadaEn(fila: Dieta): string {
  if (fila.publicadaEn === null) {
    throw new InternalServerErrorException("La dieta publicada no tiene fecha")
  }
  return fila.publicadaEn.toISOString()
}

function aPublicada(fila: Dieta): DietaPublicada {
  return {
    id: fila.id,
    clienteId: fila.clienteId,
    documento: leerDocumento(fila),
    publicadaEn: publicadaEn(fila),
  }
}

function aResumen(fila: FilaConAutor): ResumenDieta {
  if ((fila.estado !== "publicada" && fila.estado !== "archivada") || fila.publicadaPor === null) {
    throw new InternalServerErrorException("La dieta del histórico no está publicada")
  }
  return {
    id: fila.id,
    nombre: leerDocumento(fila).nombre,
    estado: fila.estado,
    publicadaEn: publicadaEn(fila),
    archivadaEn: fila.archivadaEn?.toISOString() ?? null,
    publicadaPor: {
      id: fila.publicadaPor.id,
      nombre: [fila.publicadaPor.nombre, fila.publicadaPor.apellidos].filter(Boolean).join(" "),
    },
  }
}

/** Huella de lo que se pidió publicar: el mismo id con otra revisión es otra operación. */
function huella(datos: PublicarDieta): string {
  return createHash("sha256")
    .update(JSON.stringify({ revision: datos.revision }))
    .digest("hex")
}

function aBorrador(fila: Dieta): BorradorDieta {
  return {
    id: fila.id,
    clienteId: fila.clienteId,
    revision: fila.revision,
    documento: leerDocumento(fila),
    actualizadoEn: fila.actualizadaEn.toISOString(),
  }
}

/**
 * Dietas por cliente (SPEC-nutricion.md).
 *
 * Quién puede tocar a qué cliente lo deciden `@Roles` y `AlcanceClienteGuard` en
 * el controlador. Aquí viven las reglas del dominio: que la persona sea un
 * cliente, que no esté de baja, la revisión del borrador y la publicación.
 */
@Injectable()
export class DietasService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Comprueba que existe un cliente con ese id. Dentro de una escritura bloquea
   * su fila, el mismo candado que usan identidad y entrenamiento: dos guardados
   * o una publicación a la vez sobre el mismo cliente se serializan.
   */
  private async cliente(
    tx: Cliente,
    clienteId: string,
    bloquear: boolean,
  ): Promise<{ estado: string }> {
    const filas = bloquear
      ? await tx.$queryRaw<Array<{ rol: string; estado: string }>>`
          SELECT "rol", "estado" FROM "usuarios" WHERE "id" = ${clienteId} FOR UPDATE`
      : await tx.$queryRaw<Array<{ rol: string; estado: string }>>`
          SELECT "rol", "estado" FROM "usuarios" WHERE "id" = ${clienteId}`
    const fila = filas[0]
    if (fila === undefined || fila.rol !== "cliente") {
      throw new NotFoundException("Cliente no disponible")
    }
    return fila
  }

  private async clienteQueAdmiteCambios(tx: Cliente, clienteId: string): Promise<void> {
    const { estado } = await this.cliente(tx, clienteId, true)
    if (estado === "desactivado") {
      throw conflicto(
        "operacion_incompatible",
        "Este cliente está dado de baja y su dieta no se puede cambiar",
      )
    }
  }

  async leerBorrador(clienteId: string): Promise<LecturaBorradorDieta> {
    await this.cliente(this.prisma, clienteId, false)
    const fila = await this.prisma.dieta.findFirst({ where: { clienteId, estado: "borrador" } })
    return { borrador: fila === null ? null : aBorrador(fila) }
  }

  /** La revisión 0 crea; cualquier otra actualiza si coincide con la guardada. */
  async guardarBorrador(
    actor: IdentidadVerificada,
    clienteId: string,
    datos: GuardarBorradorDieta,
  ): Promise<BorradorDieta> {
    return this.prisma.$transaction(async (tx) => {
      await this.clienteQueAdmiteCambios(tx, clienteId)
      const actual = await tx.dieta.findFirst({ where: { clienteId, estado: "borrador" } })
      const obsoleta = conflicto(
        "revision_obsoleta",
        "La dieta ha cambiado mientras la editabas. Recarga la versión actual.",
      )
      if (datos.revision === 0) {
        if (actual !== null) throw obsoleta
        return aBorrador(
          await tx.dieta.create({
            data: {
              clienteId,
              estado: "borrador",
              documento: datos.documento,
              revision: 1,
              creadaPorId: actor.sub,
            },
          }),
        )
      }
      if (actual === null || actual.revision !== datos.revision) throw obsoleta
      return aBorrador(
        await tx.dieta.update({
          where: { id: actual.id },
          data: { documento: datos.documento, revision: { increment: 1 } },
        }),
      )
    })
  }

  /**
   * Publica el borrador y archiva la vigente en la misma transacción.
   *
   * Repetir la misma operación devuelve la publicación ya hecha aunque después
   * se haya archivado: el móvil que perdió la respuesta no publica dos veces.
   */
  async publicar(
    actor: IdentidadVerificada,
    clienteId: string,
    datos: PublicarDieta,
  ): Promise<DietaPublicada> {
    return this.prisma.$transaction(async (tx) => {
      const { estado } = await this.cliente(tx, clienteId, true)
      const previa = await tx.dieta.findUnique({
        where: {
          clienteId_operacionPublicacion: { clienteId, operacionPublicacion: datos.operacionId },
        },
      })
      if (previa !== null) {
        if (previa.hashPublicacion !== huella(datos)) {
          throw conflicto(
            "operacion_incompatible",
            "Esta operación ya se utilizó con otro contenido",
          )
        }
        return aPublicada(previa)
      }
      if (estado === "desactivado") {
        throw conflicto(
          "operacion_incompatible",
          "Este cliente está dado de baja y su dieta no se puede cambiar",
        )
      }
      const borrador = await tx.dieta.findFirst({ where: { clienteId, estado: "borrador" } })
      if (borrador === null || borrador.revision !== datos.revision) {
        throw conflicto(
          "revision_obsoleta",
          "El borrador ha cambiado o ya no existe. Recarga antes de publicar.",
        )
      }
      const ahora = new Date()
      await tx.dieta.updateMany({
        where: { clienteId, estado: "publicada" },
        data: { estado: "archivada", archivadaEn: ahora },
      })
      return aPublicada(
        await tx.dieta.update({
          where: { id: borrador.id },
          data: {
            estado: "publicada",
            publicadaEn: ahora,
            publicadaPorId: actor.sub,
            operacionPublicacion: datos.operacionId,
            hashPublicacion: huella(datos),
          },
        }),
      )
    })
  }

  /** Descarta el borrador. La dieta vigente y el histórico no se tocan. */
  async descartar(clienteId: string, revision: number): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.clienteQueAdmiteCambios(tx, clienteId)
      const { count } = await tx.dieta.deleteMany({
        where: { clienteId, estado: "borrador", revision },
      })
      if (count !== 1) {
        throw conflicto(
          "revision_obsoleta",
          "El borrador ha cambiado o ya no existe. Recarga antes de descartarlo.",
        )
      }
    })
  }

  async vigente(clienteId: string): Promise<LecturaDietaVigente> {
    await this.cliente(this.prisma, clienteId, false)
    const fila = await this.prisma.dieta.findFirst({ where: { clienteId, estado: "publicada" } })
    return { dieta: fila === null ? null : aPublicada(fila) }
  }

  async historico(clienteId: string, consulta: ConsultarHistoricoDietas): Promise<ListadoDietas> {
    await this.cliente(this.prisma, clienteId, false)
    const donde = { clienteId, estado: EN_HISTORICO } satisfies Prisma.DietaWhereInput
    const [filas, total] = await this.prisma.$transaction([
      this.prisma.dieta.findMany({
        where: donde,
        include: CON_AUTOR,
        orderBy: [{ publicadaEn: "desc" }, { id: "asc" }],
        take: consulta.limite,
        skip: consulta.desplazamiento,
      }),
      this.prisma.dieta.count({ where: donde }),
    ])
    return { dietas: filas.map(aResumen), total }
  }

  async delHistorico(clienteId: string, dietaId: string): Promise<DietaDelHistorico> {
    const fila = await this.prisma.dieta.findFirst({
      where: { id: dietaId, clienteId, estado: EN_HISTORICO },
      include: CON_AUTOR,
    })
    if (fila === null) throw new NotFoundException("Dieta no disponible")
    return { ...aResumen(fila), clienteId: fila.clienteId, documento: leerDocumento(fila) }
  }
}
