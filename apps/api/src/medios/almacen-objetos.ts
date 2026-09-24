import { createHmac, randomBytes, timingSafeEqual } from "node:crypto"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { dirname, isAbsolute, relative, resolve } from "node:path"
import type { EnlaceTemporal, FormatoFoto } from "@alpha-omega/shared"

import { leerVariableOpcional } from "../config/entorno.js"

/**
 * Almacén de objetos privado (ADR 0005). Mismo contrato que un almacén
 * compatible con S3 con URLs prefirmadas: el móvil sube y lee directamente con
 * un enlace que caduca y que solo sirve para ese objeto y esa operación. Nunca
 * hay una dirección pública ni se guarda un enlace.
 *
 * En producción lo implementa `AlmacenS3` sobre cualquier servicio compatible
 * con S3 de la UE (el proveedor está sin decidir: PENDIENTE-PARA-PRODUCCION,
 * punto 5). `AlmacenLocal` implementa el mismo contrato en el disco del
 * servidor de desarrollo. `crearAlmacen` elige según `ALMACEN`.
 */
export interface AlmacenObjetos {
  enlaceDeSubida(
    clave: string,
    tipoMime: FormatoFoto,
    bytes: number,
    caducaEn: Date,
  ): Promise<EnlaceTemporal>
  enlaceDeLectura(clave: string, tipoMime: FormatoFoto, caducaEn: Date): Promise<EnlaceTemporal>
  /** El objeto tal como está, o `null` si no existe. */
  leer(clave: string): Promise<Uint8Array | null>
  /** Sustituye el objeto (por ejemplo, tras retirar metadatos). */
  reemplazar(clave: string, contenido: Uint8Array): Promise<void>
  /** Borra el objeto; no falla si ya no existía. */
  borrar(clave: string): Promise<void>
}

export const ALMACEN_OBJETOS = Symbol("AlmacenObjetos")

/** Caducidad de los enlaces: lo justo para subir o ver una foto. */
export const MINUTOS_ENLACE_SUBIDA = 15
export const MINUTOS_ENLACE_LECTURA = 5

/** Destino temporal del PUT: ninguna foto nueva confirmada se sirve desde esta clave. */
export const claveTemporalFoto = (clienteId: string, medioId: string): string =>
  `clientes/${clienteId}/${medioId}`

type Operacion = "subir" | "leer"

export type PermisoLocal = { operacion: Operacion; tipoMime: FormatoFoto; bytes: number }

export const CLAVE_VALIDA = /^[a-z0-9-]+(\/[a-z0-9-]+)*$/

/**
 * Implementación local para desarrollo y pruebas. Los objetos viven en un
 * directorio ignorado por git y los enlaces apuntan a la propia API
 * (`/medios/almacen-local/...`), firmados con HMAC y con caducidad.
 */
export class AlmacenLocal implements AlmacenObjetos {
  constructor(
    private readonly directorio: string,
    private readonly urlBase: string,
    private readonly secreto: Buffer,
  ) {}

  private ruta(clave: string): string {
    if (!CLAVE_VALIDA.test(clave)) throw new Error("Clave de objeto no válida")
    const ruta = resolve(this.directorio, clave)
    const dentro = relative(this.directorio, ruta)
    if (dentro.startsWith("..") || isAbsolute(dentro)) throw new Error("Clave fuera del almacén")
    return ruta
  }

  private firmar(
    clave: string,
    operacion: Operacion,
    tipoMime: string,
    bytes: number,
    caduca: number,
  ): string {
    return createHmac("sha256", this.secreto)
      .update([operacion, clave, tipoMime, bytes, caduca].join("\n"))
      .digest("base64url")
  }

  private enlace(
    clave: string,
    operacion: Operacion,
    tipoMime: FormatoFoto,
    bytes: number,
    caducaEn: Date,
  ): EnlaceTemporal {
    this.ruta(clave)
    const caduca = caducaEn.getTime()
    const consulta = new URLSearchParams({
      operacion,
      tipo: tipoMime,
      bytes: String(bytes),
      caduca: String(caduca),
      firma: this.firmar(clave, operacion, tipoMime, bytes, caduca),
    })
    return {
      url: `${this.urlBase}/medios/almacen-local/${encodeURIComponent(clave)}?${consulta.toString()}`,
      metodo: operacion === "subir" ? "PUT" : "GET",
      cabeceras: operacion === "subir" ? { "Content-Type": tipoMime } : {},
      caducaEn: caducaEn.toISOString(),
    }
  }

  async enlaceDeSubida(
    clave: string,
    tipoMime: FormatoFoto,
    bytes: number,
    caducaEn: Date,
  ): Promise<EnlaceTemporal> {
    return this.enlace(clave, "subir", tipoMime, bytes, caducaEn)
  }

  async enlaceDeLectura(
    clave: string,
    tipoMime: FormatoFoto,
    caducaEn: Date,
  ): Promise<EnlaceTemporal> {
    return this.enlace(clave, "leer", tipoMime, 0, caducaEn)
  }

  /** Comprueba firma y caducidad de un enlace recibido. `null` si no vale. */
  permiso(
    clave: string,
    consulta: Record<string, unknown>,
    ahora = Date.now(),
  ): PermisoLocal | null {
    const { operacion, tipo, bytes, caduca, firma } = consulta
    if (
      (operacion !== "subir" && operacion !== "leer") ||
      typeof tipo !== "string" ||
      typeof bytes !== "string" ||
      typeof caduca !== "string" ||
      typeof firma !== "string" ||
      !CLAVE_VALIDA.test(clave)
    )
      return null
    const esperada = Buffer.from(this.firmar(clave, operacion, tipo, Number(bytes), Number(caduca)))
    const recibida = Buffer.from(firma)
    if (esperada.length !== recibida.length || !timingSafeEqual(esperada, recibida)) return null
    if (!(Number(caduca) > ahora)) return null
    if (tipo !== "image/jpeg" && tipo !== "image/png" && tipo !== "image/webp") return null
    return { operacion, tipoMime: tipo, bytes: Number(bytes) }
  }

  async guardar(clave: string, contenido: Uint8Array): Promise<void> {
    const ruta = this.ruta(clave)
    await mkdir(dirname(ruta), { recursive: true })
    await writeFile(ruta, contenido)
  }

  async leer(clave: string): Promise<Uint8Array | null> {
    try {
      return await readFile(this.ruta(clave))
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT")
        return null
      throw error
    }
  }

  reemplazar(clave: string, contenido: Uint8Array): Promise<void> {
    return this.guardar(clave, contenido)
  }

  async borrar(clave: string): Promise<void> {
    await rm(this.ruta(clave), { force: true })
  }
}

/**
 * Almacén configurado para este proceso. Variables (todas opcionales en local):
 * `ALMACEN_LOCAL_DIR` (por defecto `.almacen-local` bajo el directorio de
 * trabajo), `API_URL_PUBLICA` (por defecto `http://localhost:<API_PORT>`) y
 * `ALMACEN_LOCAL_SECRETO` (si falta, uno aleatorio por arranque: los enlaces
 * dejan de valer al reiniciar, que es lo prudente).
 */
export function crearAlmacenLocal(): AlmacenLocal {
  const puerto = leerVariableOpcional("API_PORT", "3000")
  const secreto = leerVariableOpcional("ALMACEN_LOCAL_SECRETO", "")
  return new AlmacenLocal(
    resolve(leerVariableOpcional("ALMACEN_LOCAL_DIR", ".almacen-local")),
    leerVariableOpcional("API_URL_PUBLICA", `http://localhost:${puerto}`).replace(/\/+$/, ""),
    secreto === "" ? randomBytes(32) : Buffer.from(secreto, "utf8"),
  )
}
