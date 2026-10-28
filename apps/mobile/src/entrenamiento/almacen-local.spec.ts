import { z } from "zod"
import { crearAlmacenLocal, type PersistenciaCifrada, type Cifrado } from "./almacen-local"

function memoria() {
  const filas = new Map<string, string>()
  const persistencia: PersistenciaCifrada = {
    leer: async (cuenta, clave) => filas.get(`${cuenta}/${clave}`) ?? null,
    escribir: async (cuenta, clave, valor) => {
      filas.set(`${cuenta}/${clave}`, valor)
    },
    borrar: async (cuenta, clave) => {
      filas.delete(`${cuenta}/${clave}`)
    },
    listar: async (cuenta) =>
      [...filas.keys()]
        .filter((k) => k.startsWith(`${cuenta}/`))
        .map((k) => k.slice(cuenta.length + 1)),
    limpiar: async (cuenta) => {
      for (const k of filas.keys()) if (k.startsWith(`${cuenta}/`)) filas.delete(k)
    },
  }
  const cifrado: Cifrado = {
    cifrar: async (cuenta, clave, texto) => JSON.stringify([cuenta, clave, texto]),
    descifrar: async (cuenta, clave, texto) => {
      const valor = JSON.parse(texto) as string[]
      if (valor[0] !== cuenta || valor[1] !== clave) throw new Error("Propietario incorrecto")
      return valor[2]!
    },
    olvidar: async () => undefined,
  }
  return { filas, persistencia, cifrado }
}
const CUENTA = "10000000-0000-4000-8000-000000000000"
const OTRA = "20000000-0000-4000-8000-000000000000"

it("no confunde el orden de propiedades de una copia idéntica con otra edición", async () => {
  const deps = memoria()
  const a = crearAlmacenLocal(deps.persistencia, deps.cifrado)
  const b = crearAlmacenLocal(deps.persistencia, deps.cifrado)
  const esquema = z.object({ notas: z.string(), series: z.array(z.string()) })
  await a.guardar(CUENTA, "sesion-compartida", { notas: "igual", series: [] })
  await b.leer(CUENTA, "sesion-compartida", esquema)
  await a.guardar(CUENTA, "sesion-compartida", { series: [], notas: "igual" })
  await expect(
    b.guardar(CUENTA, "sesion-compartida", { notas: "nueva", series: [] }),
  ).resolves.toBeUndefined()
})

it("rechaza la escritura de una pestaña que leyó un borrador anterior", async () => {
  const deps = memoria()
  const a = crearAlmacenLocal(deps.persistencia, deps.cifrado)
  const b = crearAlmacenLocal(deps.persistencia, deps.cifrado)
  await a.guardar(CUENTA, "sesion-compartida", "base")
  await b.leer(CUENTA, "sesion-compartida", z.string())
  await a.guardar(CUENTA, "sesion-compartida", "edición A")
  await expect(b.guardar(CUENTA, "sesion-compartida", "edición B")).rejects.toThrow(/otra edición/i)
  expect(await a.leer(CUENTA, "sesion-compartida", z.string())).toBe("edición A")
})

it("recupera documentos mayores de 2 KiB y no los mezcla entre cuentas", async () => {
  const deps = memoria()
  const almacen = crearAlmacenLocal(deps.persistencia, deps.cifrado)
  const texto = "Entrenamiento ñ ".repeat(1000)
  await almacen.guardar(CUENTA, "sesion-uno", texto)
  const reabierto = crearAlmacenLocal(deps.persistencia, deps.cifrado)
  expect(await reabierto.leer(CUENTA, "sesion-uno", z.string())).toBe(texto)
  expect(await reabierto.leer(OTRA, "sesion-uno", z.string())).toBeNull()
  await almacen.guardar(OTRA, "sesion-uno", "otro")
  await almacen.limpiar(CUENTA)
  expect(await almacen.leer(OTRA, "sesion-uno", z.string())).toBe("otro")
})

it("una escritura fallida conserva la anterior y no bloquea la cola siguiente", async () => {
  const deps = memoria()
  const almacen = crearAlmacenLocal(deps.persistencia, deps.cifrado)
  await almacen.guardar(CUENTA, "borrador", "anterior")
  const escribir = jest
    .spyOn(deps.persistencia, "escribir")
    .mockRejectedValueOnce(new Error("Disco lleno"))
  await expect(almacen.guardar(CUENTA, "borrador", "perdido")).rejects.toThrow("Disco lleno")
  expect(await almacen.leer(CUENTA, "borrador", z.string())).toBe("anterior")
  escribir.mockRestore()
  await Promise.all([
    almacen.guardar(CUENTA, "borrador", "primero"),
    almacen.guardar(CUENTA, "borrador", "último"),
  ])
  expect(await almacen.leer(CUENTA, "borrador", z.string())).toBe("último")
})

it("no sobrescribe documentos corruptos o de una versión desconocida al leer", async () => {
  const deps = memoria()
  const original = JSON.stringify([
    CUENTA,
    "sesion",
    JSON.stringify({ version: 999, datos: "futuro" }),
  ])
  deps.filas.set(`${CUENTA}/sesion`, original)
  const almacen = crearAlmacenLocal(deps.persistencia, deps.cifrado)
  await expect(almacen.leer(CUENTA, "sesion", z.string())).rejects.toThrow()
  expect(deps.filas.get(`${CUENTA}/sesion`)).toBe(original)
})

it("cerrar una cuenta bloquea escrituras tardías hasta autenticarla de nuevo", async () => {
  const deps = memoria()
  const almacen = crearAlmacenLocal(deps.persistencia, deps.cifrado)
  await almacen.guardar(CUENTA, "sesion", "anterior")
  await almacen.limpiar(CUENTA)
  await expect(almacen.guardar(CUENTA, "sesion", "respuesta tardía")).rejects.toThrow()
  await expect(almacen.listar(CUENTA)).rejects.toThrow()
  almacen.habilitar(CUENTA)
  await almacen.guardar(CUENTA, "sesion", "nueva sesión autenticada")
  expect(await almacen.leer(CUENTA, "sesion", z.string())).toBe("nueva sesión autenticada")
})

it("una lectura diferida no entrega datos después de cerrar la cuenta", async () => {
  const deps = memoria()
  const almacen = crearAlmacenLocal(deps.persistencia, deps.cifrado)
  await almacen.guardar(CUENTA, "sesion", "privado")
  let liberar!: (texto: string) => void
  jest.spyOn(deps.cifrado, "descifrar").mockImplementation(
    () =>
      new Promise((resolve) => {
        liberar = resolve
      }),
  )
  const lectura = almacen.leer(CUENTA, "sesion", z.string())
  while (!liberar) await new Promise((resolve) => setTimeout(resolve, 1))
  const cierre = almacen.limpiar(CUENTA)
  liberar(JSON.stringify({ version: 1, datos: "privado" }))
  await expect(lectura).rejects.toThrow("cerrado")
  await cierre
})
