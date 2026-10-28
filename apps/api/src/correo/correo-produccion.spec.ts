import { CorreoConResend } from "./correo.service.js"

describe("correo de producción", () => {
  const nombres = ["NODE_ENV", "CORREO_REMITENTE", "RESEND_API_KEY"] as const
  const anteriores: Record<string, string | undefined> = {}
  beforeEach(() => {
    for (const nombre of nombres) {
      anteriores[nombre] = process.env[nombre]
      delete process.env[nombre]
    }
    process.env.NODE_ENV = "production"
    process.env.RESEND_API_KEY = "re_sintetica_sin_uso_de_red"
  })
  afterEach(() => {
    for (const nombre of nombres)
      if (anteriores[nombre] === undefined) delete process.env[nombre]
      else process.env[nombre] = anteriores[nombre]
  })

  it("rechaza arrancar sin remitente o con el dominio de pruebas", () => {
    expect(() => new CorreoConResend()).toThrow("CORREO_REMITENTE")
    process.env.CORREO_REMITENTE = "   "
    expect(() => new CorreoConResend()).toThrow("CORREO_REMITENTE")
    process.env.CORREO_REMITENTE = "Alpha <onboarding@resend.dev>"
    expect(() => new CorreoConResend()).toThrow("CORREO_REMITENTE")
  })

  it("exige la clave al arrancar y no contacta al proveedor", () => {
    process.env.CORREO_REMITENTE = "Alpha <no-responder@alphayomegatraining.com>"
    delete process.env.RESEND_API_KEY
    expect(() => new CorreoConResend()).toThrow("RESEND_API_KEY")
    process.env.RESEND_API_KEY = "re_sintetica_sin_uso_de_red"
    expect(() => new CorreoConResend()).not.toThrow()
  })
})
