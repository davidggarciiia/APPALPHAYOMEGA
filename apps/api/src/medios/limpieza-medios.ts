import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from "@nestjs/common"

import { leerVariableOpcional } from "../config/entorno.js"
import { PrismaService } from "../prisma/prisma.service.js"
import { ALMACEN_OBJETOS, claveTemporalFoto, type AlmacenObjetos } from "./almacen-objetos.js"
import { limpiarIntentoFoto } from "./intentos-foto.js"

/** Margen tras caducar el enlace de subida antes de dar la intención por abandonada. */
export const MARGEN_LIMPIEZA_MS = 60 * 60_000

/** Filas por consulta: la limpieza avanza por tandas sin cargar todo en memoria. */
const TANDA = 100

/** Límite de `setInterval`: por encima, Node lo convierte en 1 ms. */
const INTERVALO_MAXIMO_MS = 2_147_483_647

/**
 * Cada cuánto se limpia, en milisegundos; `null` si está desactivada.
 * `MEDIOS_LIMPIEZA_MINUTOS`: por defecto 60; 0 la desactiva.
 */
function intervaloConfigurado(): number | null {
  const texto = leerVariableOpcional("MEDIOS_LIMPIEZA_MINUTOS", "60")
  const minutos = Number(texto)
  const ms = minutos * 60_000
  // Menos de un minuto convertiría la limpieza en una consulta continua a la base.
  const valido = minutos === 0 || (Number.isInteger(minutos) && minutos >= 1)
  if (!Number.isFinite(minutos) || !valido || ms > INTERVALO_MAXIMO_MS)
    throw new Error(
      `MEDIOS_LIMPIEZA_MINUTOS debe ser un número entero de minutos (0 la desactiva); se recibió «${texto}»`,
    )
  return minutos === 0 ? null : ms
}

/**
 * Limpieza de subidas abandonadas (ADR 0005): borra del almacén y de la base
 * las intenciones que siguen «pendiente» una hora después de caducar su enlace.
 * Nunca toca fotos confirmadas, retiradas o retirándose, ni las visitas o
 * solicitudes a las que iban destinadas.
 */
@Injectable()
export class LimpiezaMedios implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly registro = new Logger(LimpiezaMedios.name)
  private intervalo: NodeJS.Timeout | null = null
  private enCurso = false
  private ultimoCorteTemporal: Date | null = null

  constructor(
    private readonly prisma: PrismaService,
    @Inject(ALMACEN_OBJETOS) private readonly almacen: AlmacenObjetos,
  ) {}

  onApplicationBootstrap(): void {
    // Las pruebas la llaman a mano, con la fecha que necesitan.
    if (leerVariableOpcional("NODE_ENV", "") === "test") return
    const ms = intervaloConfigurado()
    if (ms === null) return
    this.intervalo = setInterval(() => void this.programada(), ms)
    this.intervalo.unref()
  }

  onApplicationShutdown(): void {
    if (this.intervalo) clearInterval(this.intervalo)
    this.intervalo = null
  }

  /** Un pase programado no se solapa con el anterior ni tumba el proceso si falla. */
  private async programada(): Promise<void> {
    if (this.enCurso) return
    this.enCurso = true
    try {
      const limpiadas = await this.limpiar()
      if (limpiadas > 0) this.registro.log(`Subidas abandonadas limpiadas: ${limpiadas}`)
    } catch (error) {
      this.registro.error(
        `La limpieza de subidas abandonadas falló: ${error instanceof Error ? error.message : "error desconocido"}`,
      )
    } finally {
      this.enCurso = false
    }
  }

  /**
   * Reclama la fila caducada y registra su borrado antes de tocar el almacén.
   * Si una renovación gana primero, no se borra nada. Si gana la limpieza,
   * el reintento crea otra intención y clave: un DELETE lento no la alcanza.
   * La intención de limpieza conserva los fallos externos para otro pase.
   * Devuelve cuántas se limpiaron.
   */
  async limpiar(ahora = new Date()): Promise<number> {
    const limite = new Date(ahora.getTime() - MARGEN_LIMPIEZA_MS)
    await this.limpiarIntentos(ahora)
    await this.limpiarTemporalesConfirmados(limite)
    let limpiadas = 0
    let ultima: string | undefined
    for (;;) {
      const tanda = await this.prisma.medioFoto.findMany({
        where: {
          estado: "pendiente",
          subidaCaducaEn: { lt: limite },
          ...(ultima !== undefined && { id: { gt: ultima } }),
        },
        select: { id: true, clave: true },
        orderBy: { id: "asc" },
        take: TANDA,
      })
      for (const { id, clave } of tanda) {
        try {
          const borradas = await this.prisma.$transaction(async (tx) => {
            const reclamadas = await tx.medioFoto.deleteMany({
              where: { id, clave, estado: "pendiente", subidaCaducaEn: { lt: limite } },
            })
            if (reclamadas.count === 1)
              await tx.intentoFoto.create({
                data: { clave, medioId: id, descartadoEn: ahora, reintentarEn: ahora },
              })
            return reclamadas
          })
          limpiadas += borradas.count
          if (borradas.count === 1)
            await limpiarIntentoFoto(this.prisma, this.almacen, clave, ahora)
        } catch (error) {
          this.registro.warn(
            `No se pudo borrar la subida abandonada ${id}; se reintentará: ${error instanceof Error ? error.message : "error desconocido"}`,
          )
          continue
        }
      }
      if (tanda.length < TANDA) return limpiadas
      ultima = tanda[tanda.length - 1]!.id
    }
  }

  private async limpiarIntentos(ahora: Date): Promise<void> {
    let ultima: string | undefined
    for (;;) {
      const tanda = await this.prisma.intentoFoto.findMany({
        where: { reintentarEn: { lte: ahora }, ...(ultima && { clave: { gt: ultima } }) },
        select: { clave: true },
        orderBy: { clave: "asc" },
        take: TANDA,
      })
      for (const { clave } of tanda) {
        try {
          await limpiarIntentoFoto(this.prisma, this.almacen, clave, ahora)
        } catch {
          this.registro.warn("No se pudo limpiar una copia de foto descartada; se reintentará")
        }
      }
      if (tanda.length < TANDA) return
      ultima = tanda[tanda.length - 1]!.clave
    }
  }

  /**
   * Un enlace aún válido puede recrear el temporal después de confirmar o
   * retirar la foto. Se elimina otra vez cuando ya no se puede reutilizar.
   * El corte solo avanza si toda la tanda se limpió; al reiniciar se revisa el
   * histórico una vez. Así los fallos se reintentan sin recorrerlo cada hora.
   */
  private async limpiarTemporalesConfirmados(limite: Date): Promise<void> {
    const desde = this.ultimoCorteTemporal
    if (desde && limite <= desde) return
    let ultima: string | undefined
    let huboFallos = false
    for (;;) {
      const tanda = await this.prisma.medioFoto.findMany({
        where: {
          estado: { not: "pendiente" },
          subidaCaducaEn: { lt: limite, ...(desde && { gte: desde }) },
          ...(ultima !== undefined && { id: { gt: ultima } }),
        },
        select: { id: true, clienteId: true, clave: true },
        orderBy: { id: "asc" },
        take: TANDA,
      })
      for (const { id, clienteId, clave } of tanda) {
        const temporal = claveTemporalFoto(clienteId, id)
        // Las fotos anteriores a la separación de claves siguen en esa ruta.
        if (temporal === clave) continue
        try {
          await this.almacen.borrar(temporal)
        } catch {
          huboFallos = true
          this.registro.warn(`No se pudo limpiar el temporal confirmado ${id}; se reintentará`)
        }
      }
      if (tanda.length < TANDA) break
      ultima = tanda[tanda.length - 1]!.id
    }
    if (!huboFallos) this.ultimoCorteTemporal = limite
  }
}
