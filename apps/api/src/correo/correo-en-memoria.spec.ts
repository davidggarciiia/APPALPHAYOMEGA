import { CorreoEnMemoria } from "./correo-en-memoria.js"

const CORREO = {
  para: "cliente@ejemplo.com",
  asunto: "Activa tu cuenta",
  html: "<p>hola</p>",
  texto: "hola",
}

describe("CorreoEnMemoria", () => {
  it("guarda lo que se envia en lugar de mandarlo", async () => {
    const correo = new CorreoEnMemoria()

    await correo.enviar(CORREO)

    expect(correo.enviados).toHaveLength(1)
    expect(correo.enviados[0]?.asunto).toBe("Activa tu cuenta")
  })

  it("devuelve el ultimo correo enviado a una direccion", async () => {
    const correo = new CorreoEnMemoria()

    await correo.enviar({ ...CORREO, asunto: "primero" })
    await correo.enviar({ ...CORREO, para: "otro@ejemplo.com", asunto: "de otro" })
    await correo.enviar({ ...CORREO, asunto: "segundo" })

    expect(correo.ultimoPara("cliente@ejemplo.com")?.asunto).toBe("segundo")
    expect(correo.ultimoPara("nadie@ejemplo.com")).toBeUndefined()
  })

  it("se puede vaciar entre tests", async () => {
    const correo = new CorreoEnMemoria()
    await correo.enviar(CORREO)

    correo.limpiar()

    expect(correo.enviados).toHaveLength(0)
  })
})
