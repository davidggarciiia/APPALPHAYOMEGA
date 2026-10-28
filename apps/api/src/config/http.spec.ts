import { ExpressAdapter, type NestExpressApplication } from "@nestjs/platform-express"
import { configurarCuerposHttp } from "./http.js"

function servidor() {
  const express = new ExpressAdapter().getInstance()
  const app = {
    useBodyParser: () => undefined,
    use: express.use.bind(express),
    set: (clave: string, valor: unknown) => express.set(clave, valor),
  } as unknown as NestExpressApplication
  const ip = (remota: string, reenviada: string) => {
    const request = Object.create(express.request) as {
      app: unknown
      socket: unknown
      headers: unknown
      ip: string
    }
    request.app = express
    request.socket = { remoteAddress: remota }
    request.headers = { "x-forwarded-for": reenviada }
    return request.ip
  }
  return { app, express, ip }
}

describe("confianza HTTP en proxies", () => {
  const previo = process.env.API_PROXIES_CONFIABLES
  afterEach(() => {
    if (previo === undefined) delete process.env.API_PROXIES_CONFIABLES
    else process.env.API_PROXIES_CONFIABLES = previo
  })

  it("separa las IP cliente tras el proxy configurado", () => {
    process.env.API_PROXIES_CONFIABLES = "127.0.0.1/32,::1/128"
    const { app, ip } = servidor()
    configurarCuerposHttp(app)
    expect(ip("127.0.0.1", "203.0.113.10")).toBe("203.0.113.10")
    expect(ip("127.0.0.1", "203.0.113.20")).toBe("203.0.113.20")
    expect(ip("198.51.100.5", "203.0.113.10")).toBe("198.51.100.5")
  })

  it("ignora cabeceras reenviadas si no se configura confianza", () => {
    delete process.env.API_PROXIES_CONFIABLES
    const { app, express, ip } = servidor()
    configurarCuerposHttp(app)
    expect(express.get("trust proxy")).toBe(false)
    expect(ip("127.0.0.1", "203.0.113.10")).toBe("127.0.0.1")
  })

  it.each(["true", "1", "*", "0.0.0.0/0", "::/0", "127.0.0.1/33", "::1/129", "localhost"])(
    "rechaza confianza sin restricción de direcciones: %s",
    (configuracion) => {
      process.env.API_PROXIES_CONFIABLES = configuracion
      expect(() => configurarCuerposHttp(servidor().app)).toThrow("API_PROXIES_CONFIABLES")
    },
  )
})
