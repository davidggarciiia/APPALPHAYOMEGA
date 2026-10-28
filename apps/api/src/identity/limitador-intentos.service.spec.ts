import { HttpException, Logger } from "@nestjs/common"
import { jest } from "@jest/globals"

import { LimitadorDeIntentos } from "./limitador-intentos.service.js"

const CLAVE = "alguien@ejemplo.com|127.0.0.1"

function fallar(limitador: LimitadorDeIntentos, veces: number): void {
  for (let i = 0; i < veces; i++) {
    limitador.registrarFallo(CLAVE)
  }
}

describe("LimitadorDeIntentos", () => {
  it("olvida los fallos tras una hora también cuando hay pocas claves", () => {
    const ahora = jest.spyOn(Date, "now").mockReturnValue(1_000_000)
    try {
      const limitador = new LimitadorDeIntentos()
      fallar(limitador, 15)
      ahora.mockReturnValue(1_000_000 + 61 * 60_000)
      limitador.comprobar(CLAVE)
      fallar(limitador, 1)
      expect(() => limitador.comprobar(CLAVE)).not.toThrow()
    } finally {
      ahora.mockRestore()
    }
  })
  it("el aviso de bloqueo no registra el correo de la persona", () => {
    const aviso = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined)
    try {
      const limitador = new LimitadorDeIntentos()
      for (let i = 0; i < 6; i++)
        limitador.registrarFallo("login:ana.privada@example.test|127.0.0.1")
      expect(aviso).toHaveBeenCalled()
      expect(JSON.stringify(aviso.mock.calls)).not.toContain("ana.privada@example.test")
    } finally {
      aviso.mockRestore()
    }
  })

  it("no molesta durante los primeros intentos", () => {
    const limitador = new LimitadorDeIntentos()

    fallar(limitador, 5)

    // Quien se equivoca de contrasena un par de veces no debe encontrarse un
    // muro. El limitador es contra una maquina, no contra una persona.
    expect(() => {
      limitador.comprobar(CLAVE)
    }).not.toThrow()
  })

  it("bloquea a partir del sexto fallo", () => {
    const limitador = new LimitadorDeIntentos()

    fallar(limitador, 6)

    expect(() => {
      limitador.comprobar(CLAVE)
    }).toThrow(HttpException)
  })

  it("responde 429 y dice cuanto hay que esperar", () => {
    const limitador = new LimitadorDeIntentos()
    fallar(limitador, 8)

    try {
      limitador.comprobar(CLAVE)
      throw new Error("deberia haber bloqueado")
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException)
      const excepcion = error as HttpException
      expect(excepcion.getStatus()).toBe(429)
      const cuerpo = excepcion.getResponse() as { reintentarEnSegundos: number }
      expect(cuerpo.reintentarEnSegundos).toBeGreaterThan(0)
    }
  })

  it("la espera crece con cada fallo", () => {
    const pocos = new LimitadorDeIntentos()
    const muchos = new LimitadorDeIntentos()

    fallar(pocos, 6)
    fallar(muchos, 12)

    const esperaDe = (limitador: LimitadorDeIntentos): number => {
      try {
        limitador.comprobar(CLAVE)
        return 0
      } catch (error) {
        const cuerpo = (error as HttpException).getResponse() as { reintentarEnSegundos: number }
        return cuerpo.reintentarEnSegundos
      }
    }

    expect(esperaDe(muchos)).toBeGreaterThan(esperaDe(pocos))
  })

  it("un login correcto borra el historial", () => {
    const limitador = new LimitadorDeIntentos()
    fallar(limitador, 10)

    limitador.registrarExito(CLAVE)

    expect(() => {
      limitador.comprobar(CLAVE)
    }).not.toThrow()
  })

  it("bloquear una clave no bloquea a otra", () => {
    const limitador = new LimitadorDeIntentos()
    fallar(limitador, 10)

    // Dos personas distintas, o la misma desde otra red, no se estorban.
    expect(() => {
      limitador.comprobar("otra@ejemplo.com|10.0.0.5")
    }).not.toThrow()
  })
})
