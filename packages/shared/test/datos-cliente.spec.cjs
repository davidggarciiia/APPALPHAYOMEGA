const assert = require("node:assert/strict")
const { test } = require("node:test")
const { CambiosDeUsuarioSchema, FichaDeUsuarioSchema } = require("../dist")

test("datos del cliente: el sexo es opcional y admite hombre, mujer y null", () => {
  for (const sexo of ["hombre", "mujer", null]) {
    assert.equal(CambiosDeUsuarioSchema.parse({ sexo }).sexo, sexo)
  }
  assert.deepEqual(CambiosDeUsuarioSchema.parse({}), {})
  for (const sexo of ["otro", "", 1]) {
    assert.equal(CambiosDeUsuarioSchema.safeParse({ sexo }).success, false)
  }
})

test("datos del cliente: las fichas anteriores sin sexo siguen siendo válidas", () => {
  const ficha = {
    id: "cliente",
    email: "ana@ejemplo.test",
    nombre: "Ana",
    apellidos: null,
    rol: "cliente",
    estado: "pendiente",
    telefono: null,
    fechaNacimiento: null,
    creadoEn: "2026-10-29T00:00:00.000Z",
    tieneContrasena: false,
  }
  assert.deepEqual(FichaDeUsuarioSchema.parse(ficha), ficha)
  for (const sexo of ["hombre", "mujer", null]) {
    assert.equal(FichaDeUsuarioSchema.parse({ ...ficha, sexo }).sexo, sexo)
  }
})
