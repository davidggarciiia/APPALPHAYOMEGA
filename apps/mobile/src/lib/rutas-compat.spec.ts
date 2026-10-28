import { describe, expect, it } from "@jest/globals"
import { getPathFromState } from "expo-router/build/fork/getPathFromState"
import { getStateFromPath } from "expo-router/build/fork/getStateFromPath"

const opciones = { screens: { activar: "activar", restablecer: "restablecer" } }

describe("Enlaces del router tras actualizar el decodificador de URL", () => {
  it.each(["activar", "restablecer"])(
    "conserva el token de %s al abrir y generar el enlace",
    (ruta) => {
      const token = "prueba.á & +/%"
      const estado = getStateFromPath(`/${ruta}?token=${encodeURIComponent(token)}`, opciones)
      expect(estado?.routes[0]?.params).toMatchObject({ token })
      expect(estado).toBeDefined()
      const enlace = getPathFromState(estado!, opciones)
      expect(getStateFromPath(enlace, opciones)?.routes[0]?.params).toMatchObject({ token })
    },
  )

  it("admite parámetros repetidos sin mezclar el token ni bloquearse por escapes mal formados", () => {
    const estado = getStateFromPath("/activar?token=abc&x=1&x=2&bad=%E0%A4%A", opciones)
    expect(estado?.routes[0]?.params).toMatchObject({ token: "abc", x: ["1", "2"] })
    expect(() =>
      getStateFromPath(`/activar?bad=${"%E0%A4%A".repeat(1000)}`, opciones),
    ).not.toThrow()
  })
})
