import { crearAlmacen } from "./almacen-configurado.js"
import { AlmacenLocal } from "./almacen-objetos.js"
import { AlmacenS3 } from "./almacen-s3.js"

const VARIABLES = [
  "ALMACEN",
  "NODE_ENV",
  "S3_BUCKET",
  "S3_REGION",
  "S3_ENDPOINT",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
] as const

describe("crearAlmacen", () => {
  const antes: Record<string, string | undefined> = {}
  beforeEach(() => {
    for (const nombre of VARIABLES) {
      antes[nombre] = process.env[nombre]
      delete process.env[nombre]
    }
  })
  afterEach(() => {
    for (const nombre of VARIABLES)
      if (antes[nombre] === undefined) delete process.env[nombre]
      else process.env[nombre] = antes[nombre]
  })

  it("en desarrollo, sin elegir, usa el almacén local", () => {
    expect(crearAlmacen()).toBeInstanceOf(AlmacenLocal)
  })

  it("en producción no arranca sin elegir almacén", () => {
    process.env.NODE_ENV = "production"
    expect(() => crearAlmacen()).toThrow(/Falta ALMACEN/)
    process.env.ALMACEN = "local"
    expect(() => crearAlmacen()).toThrow(/ALMACEN=s3/)
  })

  it("con ALMACEN=s3 usa S3 y exige bucket, región y las dos claves juntas", () => {
    process.env.ALMACEN = "s3"
    expect(() => crearAlmacen()).toThrow(/S3_REGION/)
    process.env.S3_REGION = "eu-west-3"
    process.env.S3_BUCKET = "fotos-privadas"
    process.env.S3_ACCESS_KEY_ID = "AKIAEJEMPLO"
    expect(() => crearAlmacen()).toThrow(/van juntas/)
    process.env.S3_SECRET_ACCESS_KEY = "secreto-de-prueba"
    expect(crearAlmacen()).toBeInstanceOf(AlmacenS3)
  })

  it("rechaza un valor desconocido", () => {
    process.env.ALMACEN = "minio"
    expect(() => crearAlmacen()).toThrow(/ALMACEN no válido/)
  })
})
