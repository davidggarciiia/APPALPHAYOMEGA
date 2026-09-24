import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common"
import {
  MedioFotoSchema,
  type AccesoMedio,
  type FormatoFoto,
  type IntencionSubida,
  type MedioFoto,
  type SolicitarSubida,
} from "@alpha-omega/shared"
import type { MedioFoto as FilaMedio, Usuario } from "@prisma/client"
import { randomUUID } from "node:crypto"

import { fechaSql } from "../agenda/fechas.js"
import { conflicto, invalida } from "../entrenamiento/documentos.js"
import { AlcanceClienteService } from "../identity/alcance-cliente.service.js"
import type { IdentidadVerificada } from "../identity/peticion.js"
import { PrismaService } from "../prisma/prisma.service.js"
import {
  ALMACEN_OBJETOS,
  MINUTOS_ENLACE_LECTURA,
  MINUTOS_ENLACE_SUBIDA,
  type AlmacenObjetos,
} from "./almacen-objetos.js"
import { formatoReal, sinMetadatos } from "./imagenes.js"
import { MARGEN_LIMPIEZA_MS } from "./limpieza-medios.js"

const minutos = (n: number): Date => new Date(Date.now() + n * 60_000)
const fecha = (valor: Date): string => valor.toISOString().slice(0, 10)

type FilaConAutor = FilaMedio & { autor: Pick<Usuario, "id" | "nombre" | "apellidos"> }

/** Lo que ven los roles autorizados: nunca la clave del objeto ni enlaces. */
export function medioPublico(fila: FilaConAutor): MedioFoto {
  return MedioFotoSchema.parse({
    id: fila.id,
    clienteId: fila.clienteId,
    autor: {
      id: fila.autor.id,
      nombre: [fila.autor.nombre, fila.autor.apellidos].filter(Boolean).join(" "),
    },
    origen: fila.origen,
    vista: fila.vista,
    etiqueta: fila.etiqueta,
    fechaToma: fecha(fila.fechaToma),
    estado: fila.estado,
    tipoMime: fila.tipoMime,
    bytes: fila.bytes,
    valoracionId: fila.valoracionId,
    solicitudId: fila.solicitudId,
    creadoEn: fila.creadoEn.toISOString(),
    confirmadoEn: fila.confirmadoEn?.toISOString() ?? null,
  })
}

/**
 * Fotos privadas: intención de subida, confirmación verificada y lectura
 * temporal. Cada operación comprueba rol, cliente, vínculo y estado antes de
 * firmar nada. El nutricionista no recibe fotos en esta entrega.
 */
@Injectable()
export class MediosService {
  private readonly registro = new Logger(MediosService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly alcance: AlcanceClienteService,
    @Inject(ALMACEN_OBJETOS) private readonly almacen: AlmacenObjetos,
  ) {}

  private async medio(id: string): Promise<FilaConAutor> {
    const fila = await this.prisma.medioFoto.findUnique({
      where: { id },
      include: { autor: { select: { id: true, nombre: true, apellidos: true } } },
    })
    if (!fila) throw new NotFoundException("Foto no disponible")
    return fila
  }

  /** Quien no puede ver al cliente recibe lo mismo que si la foto no existiera. */
  private async exigirAlcance(actor: IdentidadVerificada, clienteId: string): Promise<void> {
    if (actor.rol === "nutricionista" || actor.rol === "empleado")
      throw new ForbiddenException("Las fotos solo las ven el cliente y su entrenador")
    if (!(await this.alcance.puedeAcceder(actor, clienteId)))
      throw new NotFoundException("Foto no disponible")
  }

  /** ¿Puede el cliente ver esta foto? Las suyas, y las del entrenador ya publicadas. */
  private visibleParaCliente(fila: FilaMedio): boolean {
    return fila.origen === "cliente" || fila.publicadaEn !== null
  }

  async solicitarSubida(
    actor: IdentidadVerificada,
    datos: SolicitarSubida,
  ): Promise<IntencionSubida> {
    await this.exigirAlcance(actor, datos.clienteId)
    const { destino } = datos
    if (destino.tipo === "valoracion") {
      if (actor.rol !== "entrenador")
        throw new ForbiddenException("Solo el entrenador adjunta fotos a una valoración")
      const visita = await this.prisma.valoracion.findFirst({
        where: { id: destino.valoracionId, clienteId: datos.clienteId },
        select: { id: true },
      })
      if (!visita) throw new NotFoundException("Valoración no disponible")
    } else {
      if (actor.rol !== "cliente" || actor.sub !== datos.clienteId)
        throw new ForbiddenException("Solo el cliente aporta las fotos que se le piden")
      const solicitud = await this.prisma.solicitudFotos.findFirst({
        where: { id: destino.solicitudId, clienteId: datos.clienteId },
        select: { estado: true, vistas: true },
      })
      if (!solicitud) throw new NotFoundException("Solicitud no disponible")
      if (solicitud.estado === "revisada")
        throw conflicto("estado_incompatible", "Esa solicitud ya está revisada")
      if (datos.vista === "otra" || !solicitud.vistas.includes(datos.vista))
        throw invalida("Esa vista no se ha pedido en la solicitud")
    }

    const previa = await this.prisma.medioFoto.findUnique({
      where: { autorId_operacionId: { autorId: actor.sub, operacionId: datos.operacionId } },
      include: { autor: { select: { id: true, nombre: true, apellidos: true } } },
    })
    if (previa) {
      const repetida = await this.repetida(previa, datos)
      // Si la limpieza se la llevó entretanto, la operación queda libre: se crea de nuevo.
      if (repetida) return repetida
    }

    const id = randomUUID()
    const caducaEn = minutos(MINUTOS_ENLACE_SUBIDA)
    try {
      const fila = await this.prisma.medioFoto.create({
        data: {
          id,
          clienteId: datos.clienteId,
          autorId: actor.sub,
          operacionId: datos.operacionId,
          origen: destino.tipo === "valoracion" ? "profesional" : "cliente",
          vista: datos.vista,
          etiqueta: datos.etiqueta,
          fechaToma: fechaSql(datos.fechaToma),
          tipoMime: datos.tipoMime,
          bytes: datos.bytes,
          clave: `clientes/${datos.clienteId}/${id}`,
          subidaCaducaEn: caducaEn,
          valoracionId: destino.tipo === "valoracion" ? destino.valoracionId : null,
          solicitudId: destino.tipo === "solicitud" ? destino.solicitudId : null,
        },
        include: { autor: { select: { id: true, nombre: true, apellidos: true } } },
      })
      return {
        medio: medioPublico(fila),
        subida: this.almacen.enlaceDeSubida(fila.clave, datos.tipoMime, datos.bytes, caducaEn),
      }
    } catch (error) {
      // La misma operación llegó dos veces a la vez: la segunda lee la primera.
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2002"
      ) {
        const ganadora = await this.prisma.medioFoto.findUnique({
          where: { autorId_operacionId: { autorId: actor.sub, operacionId: datos.operacionId } },
          include: { autor: { select: { id: true, nombre: true, apellidos: true } } },
        })
        const repetida = ganadora && (await this.repetida(ganadora, datos))
        if (repetida) return repetida
      }
      throw error
    }
  }

  /**
   * Reintento de una intención: mismo medio y, si sigue pendiente, un enlace
   * nuevo. Renovar el enlace renueva la intención: su caducidad se guarda antes
   * de firmar, porque la limpieza decide por ella. Devuelve `null` si la
   * intención ya no existe (se limpió mientras tanto).
   */
  private async repetida(
    fila: FilaConAutor,
    datos: SolicitarSubida,
  ): Promise<IntencionSubida | null> {
    const destino = datos.destino
    const igual =
      fila.clienteId === datos.clienteId &&
      fila.vista === datos.vista &&
      fila.etiqueta === datos.etiqueta &&
      fecha(fila.fechaToma) === datos.fechaToma &&
      fila.tipoMime === datos.tipoMime &&
      (destino.tipo === "valoracion"
        ? fila.origen === "profesional" && fila.valoracionId === destino.valoracionId
        : fila.solicitudId === destino.solicitudId)
    if (!igual)
      throw conflicto("operacion_incompatible", "Esta operación ya se utilizó con otro contenido")
    if (fila.estado !== "pendiente") return { medio: medioPublico(fila), subida: null }

    const caducaEn = minutos(MINUTOS_ENLACE_SUBIDA)
    const renovadas = await this.prisma.medioFoto.updateMany({
      where: { id: fila.id, estado: "pendiente" },
      data: { subidaCaducaEn: caducaEn },
    })
    if (renovadas.count === 0) {
      // Se confirmó, se retiró o se limpió entretanto: sin enlace nuevo.
      const actual = await this.prisma.medioFoto.findUnique({
        where: { id: fila.id },
        include: { autor: { select: { id: true, nombre: true, apellidos: true } } },
      })
      return actual && { medio: medioPublico(actual), subida: null }
    }
    return {
      medio: medioPublico(fila),
      subida: this.almacen.enlaceDeSubida(
        fila.clave,
        fila.tipoMime as FormatoFoto,
        fila.bytes,
        caducaEn,
      ),
    }
  }

  /**
   * Da la foto por disponible solo si el objeto existe, es realmente del
   * formato declarado y cabe en el tamaño anunciado. Antes de guardarla retira
   * los metadatos (ubicación incluida). Confirmar dos veces devuelve lo mismo.
   */
  async confirmar(actor: IdentidadVerificada, id: string): Promise<MedioFoto> {
    const fila = await this.medio(id)
    await this.exigirAlcance(actor, fila.clienteId)
    if (fila.autorId !== actor.sub) throw new ForbiddenException("Solo confirma quien la sube")
    if (fila.estado === "disponible") return medioPublico(fila)
    if (fila.estado !== "pendiente")
      throw conflicto("estado_incompatible", "Esta foto se ha retirado")
    const contenido = await this.almacen.leer(fila.clave)
    if (!contenido || contenido.length === 0)
      throw conflicto("estado_incompatible", "La foto aún no ha llegado: vuelve a subirla")
    if (contenido.length > fila.bytes || formatoReal(contenido) !== fila.tipoMime) {
      await this.almacen.borrar(fila.clave)
      throw invalida("El archivo no es una imagen del formato y tamaño anunciados")
    }
    let limpio: Uint8Array
    try {
      limpio = sinMetadatos(contenido, fila.tipoMime as FormatoFoto)
    } catch {
      await this.almacen.borrar(fila.clave)
      throw invalida("La imagen está dañada: vuelve a subirla")
    }
    await this.almacen.reemplazar(fila.clave, limpio)
    const ahora = new Date()
    const confirmada = await this.prisma.$transaction(async (tx) => {
      // Una intención que la limpieza ya puede descartar no pasa a disponible:
      // si lo hiciera, la limpieza podría borrar su objeto a la vez.
      const cambiadas = await tx.medioFoto.updateMany({
        where: {
          id,
          estado: "pendiente",
          subidaCaducaEn: { gte: new Date(ahora.getTime() - MARGEN_LIMPIEZA_MS) },
        },
        data: { estado: "disponible", confirmadoEn: ahora, bytes: limpio.length },
      })
      if (cambiadas.count === 1 && fila.solicitudId)
        await tx.solicitudFotos.updateMany({
          where: { id: fila.solicitudId, estado: "pendiente" },
          data: { estado: "recibida", recibidaEn: ahora },
        })
      return tx.medioFoto.findUnique({
        where: { id },
        include: { autor: { select: { id: true, nombre: true, apellidos: true } } },
      })
    })
    if (confirmada?.estado !== "disponible") {
      // Se retiró, se limpió o caducó mientras se verificaba: que no quede el
      // objeto reescrito. Si caducó, la misma operación renueva la subida.
      await this.almacen.borrar(fila.clave).catch(() => {
        this.registro.warn(`No se pudo borrar el objeto de la foto ${id} tras retirarse`)
      })
      throw conflicto(
        "estado_incompatible",
        confirmada?.estado === "pendiente"
          ? "La subida ha caducado: vuelve a subirla"
          : "Esta foto se ha retirado",
      )
    }
    return medioPublico(confirmada)
  }

  /**
   * Retira una foto: primero la marca «eliminando» (sin acceso desde ese
   * momento) y después borra el objeto. Si el almacén falla, queda así y la
   * misma orden se puede repetir; nunca se da por retirada sin haberla borrado.
   * La foto sigue en su visita o solicitud con su estado, sin volver a servirse.
   */
  async eliminar(actor: IdentidadVerificada, id: string): Promise<MedioFoto> {
    const fila = await this.medio(id)
    await this.exigirAlcance(actor, fila.clienteId)
    if (actor.rol === "cliente") {
      if (!this.visibleParaCliente(fila)) throw new NotFoundException("Foto no disponible")
      if (fila.origen !== "cliente" || fila.autorId !== actor.sub)
        throw new ForbiddenException("Solo puedes retirar las fotos que aportaste tú")
    }
    if (fila.estado === "eliminado") return medioPublico(fila)
    if (fila.estado === "pendiente")
      throw conflicto(
        "estado_incompatible",
        "Esta foto aún no se ha confirmado; si no se completa, se descarta sola",
      )

    // La decisión y el cambio de estado van en la misma escritura.
    await this.prisma.medioFoto.updateMany({
      where: { id, estado: "disponible" },
      data: { estado: "eliminando" },
    })
    try {
      await this.almacen.borrar(fila.clave)
    } catch (error) {
      this.registro.warn(
        `No se pudo borrar el objeto de la foto ${id}: ${error instanceof Error ? error.message : "error desconocido"}`,
      )
      throw new ServiceUnavailableException(
        "No se ha podido retirar la foto ahora mismo. Queda sin acceso; vuelve a intentarlo.",
      )
    }
    await this.prisma.medioFoto.updateMany({
      where: { id, estado: "eliminando" },
      data: { estado: "eliminado", eliminadoEn: new Date() },
    })
    return medioPublico(await this.medio(id))
  }

  /** Lectura temporal tras comprobar permisos; nunca de una foto no confirmada. */
  async acceso(actor: IdentidadVerificada, id: string): Promise<AccesoMedio> {
    const fila = await this.medio(id)
    await this.exigirAlcance(actor, fila.clienteId)
    if (actor.rol === "cliente" && !this.visibleParaCliente(fila))
      throw new NotFoundException("Foto no disponible")
    if (fila.estado !== "disponible") throw new NotFoundException("Foto no disponible")
    return {
      medioId: fila.id,
      lectura: this.almacen.enlaceDeLectura(
        fila.clave,
        fila.tipoMime as FormatoFoto,
        minutos(MINUTOS_ENLACE_LECTURA),
      ),
    }
  }
}
