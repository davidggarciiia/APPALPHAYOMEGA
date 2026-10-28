import { jest } from "@jest/globals"
import { S3Client } from "@aws-sdk/client-s3"

import { AlmacenS3 } from "./almacen-s3.js"

/** Configuración inventada: evita leer .env y no abre conexiones. */
async function configurado(modo: string, endpoint: string): Promise<AlmacenS3> {
  let almacen!: AlmacenS3
  const variables: Record<string, string> = {
    NODE_ENV: modo,
    S3_ENDPOINT: endpoint,
    S3_REGION: "eu-west-3",
    S3_BUCKET: "fotos-privadas",
    S3_ACCESS_KEY_ID: "AKIAEJEMPLO",
    S3_SECRET_ACCESS_KEY: "secreto-de-prueba",
    S3_FORZAR_RUTA: "true",
  }
  await jest.isolateModulesAsync(async () => {
    jest.unstable_mockModule("../config/entorno.js", () => ({
      leerVariableOpcional: (nombre: string, porDefecto: string) => variables[nombre] || porDefecto,
      leerVariable: (nombre: string) => variables[nombre]!,
    }))
    const modulo = await import("./almacen-s3.js")
    almacen = modulo.crearAlmacenS3()
  })
  return almacen
}

describe("endpoint S3 de producción", () => {
  it("el endpoint automático del SDK no elude HTTPS de producción", async () => {
    const anterior = process.env.AWS_ENDPOINT_URL_S3
    const ignorar = process.env.AWS_IGNORE_CONFIGURED_ENDPOINT_URLS
    process.env.AWS_ENDPOINT_URL_S3 = "http://storage-inseguro.example.test"
    process.env.AWS_IGNORE_CONFIGURED_ENDPOINT_URLS = "false"
    try {
      const almacen = await configurado("production", "")
      const enlace = await almacen.enlaceDeSubida(
        CLAVE,
        "image/jpeg",
        123,
        new Date(Date.now() + 60_000),
      )
      expect(new URL(enlace.url).protocol).toBe("https:")
    } finally {
      if (anterior === undefined) delete process.env.AWS_ENDPOINT_URL_S3
      else process.env.AWS_ENDPOINT_URL_S3 = anterior
      if (ignorar === undefined) delete process.env.AWS_IGNORE_CONFIGURED_ENDPOINT_URLS
      else process.env.AWS_IGNORE_CONFIGURED_ENDPOINT_URLS = ignorar
    }
  })
  it.each([
    "http://s3.ejemplo.test",
    "https://usuario:secreto@s3.ejemplo.test",
    "https://s3.ejemplo.test/?token=no",
    "https://s3.ejemplo.test/#fragmento",
    "no-es-una-url",
  ])("rechaza %s antes de crear el almacén", async (endpoint) => {
    await expect(configurado("production", endpoint)).rejects.toThrow(/S3_ENDPOINT/)
  })
  it("firma enlaces HTTPS en producción y conserva HTTP explícito de desarrollo", async () => {
    for (const [modo, endpoint] of [
      ["production", "https://s3.ejemplo.test"],
      ["development", "http://localhost:9000"],
    ]) {
      const almacen = await configurado(modo!, endpoint!)
      const enlace = await almacen.enlaceDeSubida(
        CLAVE,
        "image/jpeg",
        123,
        new Date(Date.now() + 60_000),
      )
      expect(new URL(enlace.url).origin).toBe(endpoint)
    }
  })
})

// Credenciales y bucket inventados: firmar una URL no llama a ningún servicio.
const AHORA = Date.parse("2026-09-24T10:00:00.000Z")
const CLAVE =
  "clientes/10000000-0000-4000-8000-000000000000/fotos/20000000-0000-4000-8000-000000000000"

function cliente(): S3Client {
  return new S3Client({
    region: "eu-west-3",
    endpoint: "https://s3.ejemplo.test",
    forcePathStyle: true,
    credentials: { accessKeyId: "AKIAEJEMPLO", secretAccessKey: "secreto-de-prueba" },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  })
}

describe("AlmacenS3", () => {
  it("la subida firma tipo y tamaño, caduca a tiempo y no lleva sumas de comprobación", async () => {
    const almacen = new AlmacenS3(cliente(), "fotos-privadas", () => AHORA)
    const enlace = await almacen.enlaceDeSubida(
      CLAVE,
      "image/jpeg",
      12345,
      new Date(AHORA + 15 * 60_000),
    )
    const url = new URL(enlace.url)
    expect(url.origin).toBe("https://s3.ejemplo.test")
    expect(url.pathname).toBe(`/fotos-privadas/${CLAVE}`)
    expect(url.searchParams.get("X-Amz-Expires")).toBe("900")
    expect(url.searchParams.get("X-Amz-SignedHeaders")?.split(";")).toEqual(
      expect.arrayContaining(["content-length", "content-type", "host"]),
    )
    expect([...url.searchParams.keys()].some((k) => /checksum/i.test(k))).toBe(false)
    expect(enlace).toMatchObject({
      metodo: "PUT",
      cabeceras: { "Content-Type": "image/jpeg" },
      caducaEn: "2026-09-24T10:15:00.000Z",
    })
  })

  it("la lectura es un GET firmado de cinco minutos que no se cachea", async () => {
    const almacen = new AlmacenS3(cliente(), "fotos-privadas", () => AHORA)
    const enlace = await almacen.enlaceDeLectura(CLAVE, "image/png", new Date(AHORA + 5 * 60_000))
    const url = new URL(enlace.url)
    expect(url.searchParams.get("X-Amz-Expires")).toBe("300")
    expect(url.searchParams.get("response-content-type")).toBe("image/png")
    expect(url.searchParams.get("response-cache-control")).toBe("private, no-store")
    expect(enlace).toMatchObject({ metodo: "GET", cabeceras: {} })
  })

  it("rechaza claves con recorridos o caracteres fuera del patrón", async () => {
    const almacen = new AlmacenS3(cliente(), "fotos-privadas", () => AHORA)
    await expect(
      almacen.enlaceDeSubida("../otro", "image/jpeg", 1, new Date(AHORA + 60_000)),
    ).rejects.toThrow("Clave de objeto no válida")
    await expect(almacen.leer("Clientes/X")).rejects.toThrow("Clave de objeto no válida")
  })

  it("leer devuelve null si el objeto no existe y propaga otros fallos", async () => {
    const falso = cliente()
    const enviar = jest.spyOn(falso, "send")
    const almacen = new AlmacenS3(falso, "fotos-privadas", () => AHORA)
    enviar.mockRejectedValueOnce(Object.assign(new Error("no"), { name: "NoSuchKey" }) as never)
    await expect(almacen.leer(CLAVE)).resolves.toBeNull()
    enviar.mockRejectedValueOnce(
      Object.assign(new Error("denegado"), {
        name: "AccessDenied",
        $metadata: { httpStatusCode: 403 },
      }) as never,
    )
    await expect(almacen.leer(CLAVE)).rejects.toThrow("denegado")
    enviar.mockResolvedValueOnce({
      Body: { transformToByteArray: async () => new Uint8Array([1, 2, 3]) },
    } as never)
    await expect(almacen.leer(CLAVE)).resolves.toEqual(new Uint8Array([1, 2, 3]))
  })

  it("reemplazar y borrar envían la orden al bucket configurado", async () => {
    const falso = cliente()
    const enviar = jest.spyOn(falso, "send").mockResolvedValue({} as never)
    const almacen = new AlmacenS3(falso, "fotos-privadas", () => AHORA)
    await almacen.reemplazar(CLAVE, new Uint8Array([9]))
    await almacen.borrar(CLAVE)
    type Orden = { constructor: { name: string }; input: Record<string, unknown> }
    const [[subida], [borrado]] = enviar.mock.calls as unknown as [[Orden], [Orden]]
    expect(subida.constructor.name).toBe("PutObjectCommand")
    expect(subida.input).toMatchObject({ Bucket: "fotos-privadas", Key: CLAVE })
    expect(borrado.constructor.name).toBe("DeleteObjectCommand")
    expect(borrado.input).toEqual({ Bucket: "fotos-privadas", Key: CLAVE })
  })
})
