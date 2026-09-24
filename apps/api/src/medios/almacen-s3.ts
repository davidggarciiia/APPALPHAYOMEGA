import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import type { EnlaceTemporal, FormatoFoto } from "@alpha-omega/shared"

import { leerVariable, leerVariableOpcional } from "../config/entorno.js"
import { CLAVE_VALIDA } from "./almacen-objetos.js"

/**
 * Almacén de producción sobre cualquier servicio compatible con S3 (ADR 0005).
 * El proveedor concreto sigue sin decidir (PENDIENTE-PARA-PRODUCCION, punto 5):
 * este adaptador vale para AWS S3 y para los compatibles con región en la UE
 * que aceptan URLs prefirmadas con firma v4.
 *
 * La subida firma el tipo y el tamaño declarados: el servicio rechaza un cuerpo
 * distinto. Al confirmar, la API vuelve a leer el objeto y comprueba formato y
 * metadatos igual que con el almacén local.
 */
export class AlmacenS3 {
  constructor(
    private readonly cliente: S3Client,
    private readonly bucket: string,
    private readonly ahora: () => number = Date.now,
  ) {}

  private clave(clave: string): string {
    if (!CLAVE_VALIDA.test(clave)) throw new Error("Clave de objeto no válida")
    return clave
  }

  /** Segundos de validez que pide el enlace; como mínimo uno. */
  private segundosHasta(caducaEn: Date): number {
    return Math.max(1, Math.floor((caducaEn.getTime() - this.ahora()) / 1000))
  }

  async enlaceDeSubida(
    clave: string,
    tipoMime: FormatoFoto,
    bytes: number,
    caducaEn: Date,
  ): Promise<EnlaceTemporal> {
    const url = await getSignedUrl(
      this.cliente,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.clave(clave),
        ContentType: tipoMime,
        ContentLength: bytes,
      }),
      {
        expiresIn: this.segundosHasta(caducaEn),
        signableHeaders: new Set(["content-type", "content-length"]),
      },
    )
    return {
      url,
      metodo: "PUT",
      cabeceras: { "Content-Type": tipoMime },
      caducaEn: caducaEn.toISOString(),
    }
  }

  async enlaceDeLectura(
    clave: string,
    tipoMime: FormatoFoto,
    caducaEn: Date,
  ): Promise<EnlaceTemporal> {
    const url = await getSignedUrl(
      this.cliente,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: this.clave(clave),
        ResponseContentType: tipoMime,
        ResponseCacheControl: "private, no-store",
      }),
      { expiresIn: this.segundosHasta(caducaEn) },
    )
    return { url, metodo: "GET", cabeceras: {}, caducaEn: caducaEn.toISOString() }
  }

  async leer(clave: string): Promise<Uint8Array | null> {
    try {
      const respuesta = await this.cliente.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: this.clave(clave) }),
      )
      return respuesta.Body ? await respuesta.Body.transformToByteArray() : null
    } catch (error) {
      if (noExiste(error)) return null
      throw error
    }
  }

  async reemplazar(clave: string, contenido: Uint8Array): Promise<void> {
    await this.cliente.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: this.clave(clave), Body: contenido }),
    )
  }

  async borrar(clave: string): Promise<void> {
    await this.cliente.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: this.clave(clave) }),
    )
  }
}

function noExiste(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false
  const { name, $metadata } = error as { name?: unknown; $metadata?: { httpStatusCode?: number } }
  return name === "NoSuchKey" || name === "NotFound" || $metadata?.httpStatusCode === 404
}

/**
 * Almacén S3 configurado por entorno:
 * - `S3_BUCKET` y `S3_REGION` (obligatorias).
 * - `S3_ENDPOINT`: solo para servicios compatibles distintos de AWS.
 * - `S3_FORZAR_RUTA=true`: direcciones `endpoint/bucket/clave`, que piden
 *   algunos compatibles.
 * - `S3_ACCESS_KEY_ID` y `S3_SECRET_ACCESS_KEY`: van juntas. Si faltan las dos
 *   se usa la cadena de credenciales estándar del SDK (rol de la máquina, etc.).
 */
export function crearAlmacenS3(): AlmacenS3 {
  const endpoint = leerVariableOpcional("S3_ENDPOINT", "")
  const idClave = leerVariableOpcional("S3_ACCESS_KEY_ID", "")
  const secreto = leerVariableOpcional("S3_SECRET_ACCESS_KEY", "")
  if ((idClave === "") !== (secreto === ""))
    throw new Error("S3_ACCESS_KEY_ID y S3_SECRET_ACCESS_KEY van juntas: define las dos o ninguna.")
  const cliente = new S3Client({
    region: leerVariable("S3_REGION"),
    ...(endpoint === "" ? {} : { endpoint }),
    forcePathStyle: leerVariableOpcional("S3_FORZAR_RUTA", "false") === "true",
    ...(idClave === "" ? {} : { credentials: { accessKeyId: idClave, secretAccessKey: secreto } }),
    // Sin sumas de comprobación automáticas: en una URL prefirmada firmarían un
    // cuerpo vacío y la subida real del móvil fallaría.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  })
  return new AlmacenS3(cliente, leerVariable("S3_BUCKET"))
}
