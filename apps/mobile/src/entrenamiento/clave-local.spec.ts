import { recuperarClave } from "./clave-local"

it("dos pestañas recuperan una sola clave cuando comparten el candado de la cuenta", async () => {
  let clave: string | null = null
  let cola: Promise<unknown> = Promise.resolve()
  let numero = 0
  const proveedor = {
    leer: async () => clave,
    crear: async () => `clave-${++numero}`,
    guardar: async (valor: string) => {
      clave = valor
    },
    hayDocumentos: async () => false,
    exclusiva: <T>(accion: () => Promise<T>): Promise<T> => {
      const siguiente = cola.then(accion)
      cola = siguiente.catch(() => undefined)
      return siguiente
    },
  }
  const claves = await Promise.all([
    recuperarClave({ ...proveedor }, true),
    recuperarClave({ ...proveedor }, true),
  ])
  expect(claves[0]).toBe(claves[1])
  expect(numero).toBe(1)
  expect(clave).toBe(claves[0])
})

it("no genera ni reemplaza una clave ausente cuando sobreviven documentos cifrados", async () => {
  const crear = jest.fn(async () => "clave-nueva")
  const guardar = jest.fn(async () => undefined)
  await expect(
    recuperarClave(
      { leer: async () => null, crear, guardar, hayDocumentos: async () => true },
      true,
    ),
  ).rejects.toThrow()
  expect(crear).not.toHaveBeenCalled()
  expect(guardar).not.toHaveBeenCalled()
  expect(
    await recuperarClave(
      { leer: async () => "original", crear, guardar, hayDocumentos: async () => true },
      true,
    ),
  ).toBe("original")
})

it("solo crea una clave para una cuenta vacía y la guarda antes de devolverla", async () => {
  const guardar = jest.fn(async () => undefined)
  expect(
    await recuperarClave(
      {
        leer: async () => null,
        crear: async () => "nueva",
        guardar,
        hayDocumentos: async () => false,
      },
      true,
    ),
  ).toBe("nueva")
  expect(guardar).toHaveBeenCalledWith("nueva")
  await expect(
    recuperarClave(
      {
        leer: async () => null,
        crear: async () => "nueva",
        guardar,
        hayDocumentos: async () => false,
      },
      false,
    ),
  ).rejects.toThrow()
})
