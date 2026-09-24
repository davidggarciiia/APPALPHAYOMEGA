import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from "@nestjs/common"

import { leerVariableOpcional } from "../config/entorno.js"
import { PrismaService } from "../prisma/prisma.service.js"
import { ALMACEN_OBJETOS, type AlmacenObjetos } from "./almacen-objetos.js"

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
   * Borra primero el objeto y después la fila, y solo si sigue «pendiente» y
   * caducada: si el almacén falla, la intención queda para el siguiente pase;
   * si se confirmó o se renovó con un reintento entretanto, se conserva.
   * Devuelve cuántas se limpiaron.
   */
  async limpiar(ahora = new Date()): Promise<number> {
    const limite = new Date(ahora.getTime() - MARGEN_LIMPIEZA_MS)
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
          await this.almacen.borrar(clave)
        } catch (error) {
          this.registro.warn(
            `No se pudo borrar la subida abandonada ${id}; se reintentará: ${error instanceof Error ? error.message : "error desconocido"}`,
          )
          continue
        }
        const borradas = await this.prisma.medioFoto.deleteMany({
          where: { id, estado: "pendiente", subidaCaducaEn: { lt: limite } },
        })
        limpiadas += borradas.count
      }
      if (tanda.length < TANDA) return limpiadas
      ultima = tanda[tanda.length - 1]!.id
    }
  }
}
