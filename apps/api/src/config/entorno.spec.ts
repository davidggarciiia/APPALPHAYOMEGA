import { leerEnteroPositivo, leerSecretoJwt } from "./entorno.js"

describe("enteros positivos del entorno", () => {
  const nombre = "PRUEBA_ENTERO_POSITIVO"
  afterEach(() => {
    delete process.env[nombre]
  })

  it("usa el valor por defecto si la variable falta o está vacía", () => {
    expect(leerEnteroPositivo(nombre, 7)).toBe(7)
    process.env[nombre] = ""
    expect(leerEnteroPositivo(nombre, 7)).toBe(7)
  })

  it("lee un entero positivo explícito, también con espacios alrededor", () => {
    process.env[nombre] = " 250 "
    expect(leerEnteroPositivo(nombre, 7)).toBe(250)
  })

  it.each(["abc", "0", "-5", "1.5", "1e3", "12 ms", "99999999999999999999"])(
    "rechaza %s al arrancar en lugar de convertirlo en un plazo absurdo",
    (valor) => {
      process.env[nombre] = valor
      expect(() => leerEnteroPositivo(nombre, 7)).toThrow(nombre)
    },
  )
})

describe("secreto JWT de producción", () => {
  const previo = { modo: process.env.NODE_ENV, secreto: process.env.JWT_SECRET }
  afterEach(() => {
    for (const [nombre, valor] of Object.entries({
      NODE_ENV: previo.modo,
      JWT_SECRET: previo.secreto,
    }))
      if (valor === undefined) delete process.env[nombre]
      else process.env[nombre] = valor
  })

  it("rechaza el secreto corto de desarrollo en producción", () => {
    process.env.NODE_ENV = "production"
    process.env.JWT_SECRET = "secreto-corto"
    expect(() => leerSecretoJwt()).toThrow("32")
    process.env.JWT_SECRET = " ".repeat(32)
    expect(() => leerSecretoJwt()).toThrow("32")
  })

  it("admite un secreto largo explícito y conserva el entorno de pruebas", () => {
    process.env.NODE_ENV = "production"
    process.env.JWT_SECRET = "sintetico-".repeat(6)
    expect(leerSecretoJwt()).toBe(process.env.JWT_SECRET)
    process.env.NODE_ENV = "test"
    process.env.JWT_SECRET = "solo-prueba"
    expect(leerSecretoJwt()).toBe("solo-prueba")
  })
})
