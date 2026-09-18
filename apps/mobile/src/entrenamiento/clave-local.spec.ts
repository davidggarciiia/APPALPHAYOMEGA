import { recuperarClave } from "./clave-local"

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
