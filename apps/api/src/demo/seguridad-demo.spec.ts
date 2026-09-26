import { esCorreoDemo, motivoParaNoSembrar } from "./seguridad-demo.js"

describe("límites del sembrado de demostración", () => {
  it("solo acepta bases cuyo nombre diga demo", () => {
    expect(motivoParaNoSembrar("alpha_omega_demo")).toBeNull()
    expect(motivoParaNoSembrar("alpha_omega_demo_prueba")).toBeNull()
    expect(motivoParaNoSembrar("ALPHA_OMEGA_DEMO")).toBeNull()
    expect(motivoParaNoSembrar("alpha_omega")).toMatch(/no es de demostración/)
    expect(motivoParaNoSembrar("produccion")).toMatch(/no es de demostración/)
    expect(motivoParaNoSembrar("")).toMatch(/Falta POSTGRES_DB/)
    expect(motivoParaNoSembrar(undefined)).toMatch(/Falta POSTGRES_DB/)
  })

  it("reconoce solo los correos del dominio reservado de la demo", () => {
    expect(esCorreoDemo("lucia.martin@demo.alphaomega.test")).toBe(true)
    expect(esCorreoDemo(" Lucia.Martin@DEMO.alphaomega.test ")).toBe(true)
    expect(esCorreoDemo("entrenador@alphayomegatraining.com")).toBe(false)
    expect(esCorreoDemo("alguien@demo.alphaomega.test.com")).toBe(false)
    expect(esCorreoDemo("demo.alphaomega.test@gmail.com")).toBe(false)
  })
})
