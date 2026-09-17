import { CambiosDePerfilSchema, CambiosDeUsuarioSchema } from "@alpha-omega/shared"

describe.each([
  ["perfil propio", CambiosDePerfilSchema],
  ["ficha del cliente", CambiosDeUsuarioSchema],
] as const)("Fechas en %s", (_nombre, esquema) => {
  it.each(["2026-02-31", "2026-99-99", "2025-02-29"])(
    "rechaza la fecha inexistente %s",
    (fechaNacimiento) => {
      expect(esquema.safeParse({ fechaNacimiento }).success).toBe(false)
    },
  )

  it.each(["2024-02-29", "1990-05-17", null])("acepta %s", (fechaNacimiento) => {
    expect(esquema.parse({ fechaNacimiento }).fechaNacimiento).toBe(fechaNacimiento)
  })
})
