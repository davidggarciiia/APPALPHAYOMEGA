import { createServer } from "node:http"
import type { IncomingHttpHeaders, Server, ServerResponse } from "node:http"
import type { AddressInfo, Socket } from "node:net"

import { jest } from "@jest/globals"
import { Logger } from "@nestjs/common"

import { CorreoConResend } from "./correo.service.js"

type Peticion = { cuerpo: Record<string, unknown>; cabeceras: IncomingHttpHeaders }

/**
 * Servidor local que hace de Resend: la SDK real le habla por HTTP gracias a
 * RESEND_BASE_URL, asi que se prueba el servicio completo sin tocar la red.
 */
async function levantarResendFalso(
  responder: (respuesta: ServerResponse) => void,
  recibidas: Peticion[],
): Promise<{ servidor: Server; cerrar: () => Promise<void>; url: string }> {
  const sockets = new Set<Socket>()
  const servidor = createServer((peticion, respuesta) => {
    let texto = ""
    peticion.on("data", (trozo: Buffer) => (texto += trozo.toString()))
    peticion.on("end", () => {
      recibidas.push({
        cuerpo: JSON.parse(texto) as Record<string, unknown>,
        cabeceras: peticion.headers,
      })
      responder(respuesta)
    })
  })
  servidor.on("connection", (socket) => sockets.add(socket))
  await new Promise<void>((listo) => servidor.listen(0, "127.0.0.1", listo))
  const { port } = servidor.address() as AddressInfo
  return {
    servidor,
    url: `http://127.0.0.1:${String(port)}`,
    cerrar: async () => {
      for (const socket of sockets) socket.destroy()
      await new Promise<void>((listo) => servidor.close(() => listo()))
    },
  }
}

const correo = {
  para: "cliente.sintetico@ejemplo.com",
  asunto: "Activa tu cuenta",
  html: "<p>Hola</p>",
  texto: "Hola",
}

describe("CorreoConResend", () => {
  const nombres = [
    "NODE_ENV",
    "CORREO_REMITENTE",
    "CORREO_PLAZO_MS",
    "RESEND_API_KEY",
    "RESEND_BASE_URL",
  ] as const
  const anteriores: Record<string, string | undefined> = {}
  let cierre: (() => Promise<void>) | undefined
  const recibidas: Peticion[] = []

  beforeEach(() => {
    recibidas.length = 0
    for (const nombre of nombres) {
      anteriores[nombre] = process.env[nombre]
      delete process.env[nombre]
    }
    process.env.NODE_ENV = "test"
    process.env.RESEND_API_KEY = "re_sintetica_sin_uso_de_red"
    // La SDK registra por consola los rechazos del proveedor; aqui son esperados.
    jest.spyOn(console, "error").mockImplementation(() => undefined)
  })

  afterEach(async () => {
    jest.restoreAllMocks()
    await cierre?.()
    cierre = undefined
    for (const nombre of nombres)
      if (anteriores[nombre] === undefined) delete process.env[nombre]
      else process.env[nombre] = anteriores[nombre]
  })

  async function conProveedor(responder: (respuesta: ServerResponse) => void): Promise<void> {
    const falso = await levantarResendFalso(responder, recibidas)
    cierre = falso.cerrar
    process.env.RESEND_BASE_URL = falso.url
  }

  it("envia con el remitente configurado y enmascara el destinatario en el registro", async () => {
    await conProveedor((r) => {
      r.setHeader("content-type", "application/json")
      r.end(JSON.stringify({ id: "correo-1" }))
    })
    process.env.CORREO_REMITENTE = "Alpha <no-responder@alphayomegatraining.com>"
    const registro = jest.spyOn(Logger.prototype, "log").mockImplementation(() => undefined)

    await new CorreoConResend().enviar(correo)

    expect(recibidas).toHaveLength(1)
    expect(recibidas[0]?.cuerpo).toMatchObject({
      from: "Alpha <no-responder@alphayomegatraining.com>",
      to: correo.para,
      subject: correo.asunto,
      html: correo.html,
      text: correo.texto,
    })
    expect(recibidas[0]?.cabeceras.authorization).toBe("Bearer re_sintetica_sin_uso_de_red")
    const mensajes = registro.mock.calls.map((llamada) => String(llamada[0]))
    expect(mensajes.some((m) => m.includes("cl***@ejemplo.com"))).toBe(true)
    expect(mensajes.some((m) => m.includes(correo.para))).toBe(false)
  })

  it("usa el remitente de pruebas de Resend cuando no se ha configurado otro", async () => {
    await conProveedor((r) => {
      r.setHeader("content-type", "application/json")
      r.end(JSON.stringify({ id: "correo-2" }))
    })
    jest.spyOn(Logger.prototype, "log").mockImplementation(() => undefined)

    await new CorreoConResend().enviar(correo)

    expect(recibidas[0]?.cuerpo.from).toBe("Alpha & Omega <onboarding@resend.dev>")
  })

  it("oculta al llamante el motivo por el que el proveedor rechaza el envio", async () => {
    await conProveedor((r) => {
      r.statusCode = 422
      r.setHeader("content-type", "application/json")
      r.end(
        JSON.stringify({
          statusCode: 422,
          name: "validation_error",
          message: "La direccion cliente.sintetico@ejemplo.com no existe",
        }),
      )
    })
    const registro = jest.spyOn(Logger.prototype, "error").mockImplementation(() => undefined)

    const fallo = await new CorreoConResend().enviar(correo).catch((error: unknown) => error)

    expect(fallo).toBeInstanceOf(Error)
    expect((fallo as Error).message).toBe("No se ha podido enviar el correo")
    expect(registro).toHaveBeenCalledWith(expect.stringContaining("Resend rechazo el envio"))
  })

  it("falla con el mismo error generico si el proveedor no contesta dentro del plazo", async () => {
    await conProveedor(() => undefined)
    process.env.CORREO_PLAZO_MS = "200"
    jest.spyOn(Logger.prototype, "error").mockImplementation(() => undefined)
    const inicio = Date.now()

    await expect(new CorreoConResend().enviar(correo)).rejects.toThrow(
      "No se ha podido enviar el correo",
    )
    expect(Date.now() - inicio).toBeLessThan(3000)
  })

  it("rechaza al arrancar un plazo que no sea un entero positivo", () => {
    for (const valor of ["0", "-1", "abc", "1.5"]) {
      process.env.CORREO_PLAZO_MS = valor
      expect(() => new CorreoConResend()).toThrow("CORREO_PLAZO_MS")
    }
  })

  it("deja una direccion demasiado corta sin reconocer en el registro", async () => {
    await conProveedor((r) => {
      r.setHeader("content-type", "application/json")
      r.end(JSON.stringify({ id: "correo-3" }))
    })
    const registro = jest.spyOn(Logger.prototype, "log").mockImplementation(() => undefined)

    await new CorreoConResend().enviar({ ...correo, para: "a@ejemplo.com" })

    const mensajes = registro.mock.calls.map((llamada) => String(llamada[0]))
    expect(mensajes.some((m) => m.includes("***") && !m.includes("a@ejemplo.com"))).toBe(true)
  })
})
