import { esRutaInterna, guardarDestino, olvidarDestino, tomarDestino } from "./destino-tras-login"

afterEach(olvidarDestino)

it.each([
  "/progreso",
  "/entrenador/cliente/abc/plan",
  "/progreso?abrir=fotos",
  "/nutricion/comida",
])("acepta la ruta interna %s", (ruta) => {
  expect(esRutaInterna(ruta)).toBe(true)
})

it.each([
  "",
  "progreso",
  "//otro-sitio.com/x",
  "https://otro-sitio.com",
  "/ruta?next=https://otro-sitio.com",
  "alphaomega://activar?token=x",
  String.raw`/\otro-sitio.com`,
  "/login",
  "/activar?token=abc",
  "/recuperar",
  `/${"a".repeat(400)}`,
])("rechaza %s", (ruta) => {
  expect(esRutaInterna(ruta)).toBe(false)
})

it("guarda el destino una sola vez y no guarda la raíz ni rutas inválidas", () => {
  guardarDestino("/")
  expect(tomarDestino()).toBeNull()
  guardarDestino("https://malo.example")
  expect(tomarDestino()).toBeNull()
  guardarDestino("/progreso")
  expect(tomarDestino()).toBe("/progreso")
  expect(tomarDestino()).toBeNull()
  guardarDestino("/progreso")
  olvidarDestino()
  expect(tomarDestino()).toBeNull()
})
