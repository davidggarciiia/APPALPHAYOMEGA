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
  type ListadoFotos,
  type MedioFoto,
  type SolicitarSubida,
} from "@alpha-omega/shared"
import type { MedioFoto as FilaMedio, Usuario } from "@prisma/client"
import { randomUUID } from "node:crypto"

import { fechaSql } from "../agenda/fechas.js"
import { conflicto, invalida } from "../entrenamiento/documentos.js"
import { AlcanceClienteService } from "../identity/alcance-cliente.service.js"
import { ConsentimientoService } from "../identity/consentimiento.service.js"
import type { IdentidadVerificada } from "../identity/peticion.js"
import { PrismaService } from "../prisma/prisma.service.js"
import {
  ALMACEN_OBJETOS,
  MINUTOS_ENLACE_LECTURA,
  MINUTOS_ENLACE_SUBIDA,
  claveTemporalFoto,
  type AlmacenObjetos,
} from "./almacen-objetos.js"
import { formatoReal, sinMetadatos } from "./imagenes.js"
import { validarImagen } from "./validar-imagen.js"
import { MARGEN_LIMPIEZA_MS } from "./limpieza-medios.js"
import { limpiarIntentoFoto, VIDA_INTENTO_FOTO_MS } from "./intentos-foto.js"

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
    private readonly consentimiento: ConsentimientoService,
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
          clave: claveTemporalFoto(datos.clienteId, id),
          subidaCaducaEn: caducaEn,
          valoracionId: destino.tipo === "valoracion" ? destino.valoracionId : null,
          solicitudId: destino.tipo === "solicitud" ? destino.solicitudId : null,
        },
        include: { autor: { select: { id: true, nombre: true, apellidos: true } } },
      })
      return {
        medio: medioPublico(fila),
        subida: await this.almacen.enlaceDeSubida(
          fila.clave,
          datos.tipoMime,
          datos.bytes,
          caducaEn,
        ),
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
      subida: await this.almacen.enlaceDeSubida(
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
    await this.consentimiento.exigirVigente(fila.clienteId, actor.sub)
    const contenido = await this.almacen.leer(fila.clave)
    if (!contenido || contenido.length === 0) {
      // Otra confirmación puede haber terminado y limpiado el temporal después
      // de que leyéramos la fila pendiente. Su resultado sigue siendo válido.
      const actual = await this.prisma.medioFoto.findUnique({
        where: { id },
        include: { autor: { select: { id: true, nombre: true, apellidos: true } } },
      })
      if (actual?.estado === "disponible") return medioPublico(actual)
      throw conflicto("estado_incompatible", "La foto aún no ha llegado: vuelve a subirla")
    }
    if (contenido.length > fila.bytes || formatoReal(contenido) !== fila.tipoMime) {
      await this.almacen.borrar(fila.clave)
      throw invalida("El archivo no es una imagen del formato y tamaño anunciados")
    }
    let limpio: Uint8Array
    try {
      limpio = sinMetadatos(contenido, fila.tipoMime as FormatoFoto)
      await validarImagen(limpio)
    } catch {
      await this.almacen.borrar(fila.clave)
      throw invalida("La imagen está dañada: vuelve a subirla")
    }
    // Cada intento escribe una clave nueva y duradera antes de tocar el almacén.
    // Nunca se reutiliza una clave final, aunque una operación externa tarde.
    const claveFinal = `clientes/${fila.clienteId}/verificadas/${id}-${randomUUID()}`
    await this.prisma.intentoFoto.create({
      data: {
        clave: claveFinal,
        medioId: id,
        reintentarEn: new Date(Date.now() + VIDA_INTENTO_FOTO_MS),
      },
    })
    let confirmada: FilaConAutor | null
    try {
      await this.almacen.reemplazar(claveFinal, limpio)
      confirmada = await this.prisma.$transaction(async (tx) => {
        const ahora = new Date()
        // Esta escritura bloquea la fila frente al descarte hasta el commit.
        // No hay I/O del almacén dentro de la transacción.
        const activo = await tx.intentoFoto.updateMany({
          where: { clave: claveFinal, descartadoEn: null, reintentarEn: { gt: ahora } },
          data: { descartadoEn: null },
        })
        if (activo.count === 0)
          return tx.medioFoto.findUnique({
            where: { id },
            include: { autor: { select: { id: true, nombre: true, apellidos: true } } },
          })
        await this.consentimiento.exigirVigente(fila.clienteId, actor.sub, tx)
        if (fila.solicitudId) {
          // Confirmar y revisar compiten por la solicitud, en ese orden antes
          // de tocar la foto. El dato idéntico solo toma el candado de fila.
          await tx.solicitudFotos.updateMany({
            where: { id: fila.solicitudId, clienteId: fila.clienteId },
            data: { clienteId: fila.clienteId },
          })
        }
        // Una intención que la limpieza ya puede descartar no pasa a disponible.
        const cambiadas = await tx.medioFoto.updateMany({
          where: {
            id,
            estado: "pendiente",
            subidaCaducaEn: { gte: new Date(ahora.getTime() - MARGEN_LIMPIEZA_MS) },
          },
          data: {
            estado: "disponible",
            confirmadoEn: ahora,
            bytes: limpio.length,
            clave: claveFinal,
          },
        })
        if (cambiadas.count === 1 && fila.solicitudId)
          await tx.solicitudFotos.updateMany({
            where: { id: fila.solicitudId },
            // Se conserva la operación anterior para que su reintento no
            // marque como revisada una foto que aún no ha visto el entrenador.
            data: { estado: "recibida", recibidaEn: ahora, revisadaEn: null },
          })
        if (cambiadas.count === 1) await tx.intentoFoto.delete({ where: { clave: claveFinal } })
        return tx.medioFoto.findUnique({
          where: { id },
          include: { autor: { select: { id: true, nombre: true, apellidos: true } } },
        })
      })
    } catch (error) {
      // Si se perdió la respuesta del commit, la fila del ganador ya no existe
      // y el descarte no tiene permiso para borrar su clave.
      await this.descartarIntento(id, claveFinal)
      throw error
    }
    if (confirmada?.clave !== claveFinal) await this.descartarIntento(id, claveFinal)
    if (confirmada?.estado !== "disponible") {
      // Se retiró, se limpió o caducó mientras se verificaba.
      await this.almacen.borrar(fila.clave).catch(() => {
        this.registro.warn(`No se pudo borrar el temporal de la foto ${id}`)
      })
      throw conflicto(
        "estado_incompatible",
        confirmada?.estado === "pendiente"
          ? "La subida ha caducado: vuelve a subirla"
          : "Esta foto se ha retirado",
      )
    }
    // Un PUT repetido puede recrear el temporal hasta que caduque su enlace.
    // LimpiezaMedios lo vuelve a eliminar después de esa caducidad.
    await this.almacen.borrar(fila.clave).catch(() => {
      this.registro.warn(`No se pudo borrar el temporal de la foto ${id}; se limpiará al caducar`)
    })
    return medioPublico(confirmada)
  }

  private async descartarIntento(id: string, clave: string): Promise<void> {
    try {
      await limpiarIntentoFoto(this.prisma, this.almacen, clave)
    } catch {
      this.registro.warn(`No se pudo comprobar o limpiar el intento de confirmación de ${id}`)
    }
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
      await this.almacen.borrar(claveTemporalFoto(fila.clienteId, id))
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

  /**
   * Todas las fotos del cliente que puede ver quien pregunta, para compararlas
   * por vista y fecha. Sin las que aún no se han confirmado; las retiradas
   * aparecen como tales. El cliente ve las suyas y las del entrenador ya
   * publicadas.
   */
  async deCliente(actor: IdentidadVerificada, clienteId: string): Promise<ListadoFotos> {
    await this.exigirAlcance(actor, clienteId)
    const filas = await this.prisma.medioFoto.findMany({
      where: {
        clienteId,
        estado: { not: "pendiente" },
        ...(actor.rol === "cliente" && {
          OR: [{ origen: "cliente" as const }, { publicadaEn: { not: null } }],
        }),
      },
      include: { autor: { select: { id: true, nombre: true, apellidos: true } } },
      orderBy: [{ vista: "asc" }, { fechaToma: "asc" }, { creadoEn: "asc" }],
    })
    return { fotos: filas.map(medioPublico) }
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
      lectura: await this.almacen.enlaceDeLectura(
        fila.clave,
        fila.tipoMime as FormatoFoto,
        minutos(MINUTOS_ENLACE_LECTURA),
      ),
    }
  }
}
