import { jest } from "@jest/globals"
import { S3Client } from "@aws-sdk/client-s3"

import { AlmacenS3 } from "./almacen-s3.js"

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
