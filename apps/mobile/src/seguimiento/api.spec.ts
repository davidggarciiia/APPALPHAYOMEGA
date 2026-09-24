import { describe, expect, it, jest } from "@jest/globals"
import { CONFIGURACION_SEGUIMIENTO_INICIAL } from "@alpha-omega/shared"

import type { PeticionAutenticada } from "../lib/peticion-autenticada"
import { crearApiSeguimiento } from "./api"

const CLIENTE = "10000000-0000-4000-8000-000000000000"

describe("API de seguimiento", () => {
  it("lee y guarda la configuración con la revisión en el cuerpo", async () => {
    const pedir = jest.fn(
      async (_ruta: string, _esquema: unknown, _opciones?: RequestInit) =>
        CONFIGURACION_SEGUIMIENTO_INICIAL,
    )
    const api = crearApiSeguimiento(pedir as unknown as PeticionAutenticada)
    expect(await api.configuracion(CLIENTE)).toEqual(CONFIGURACION_SEGUIMIENTO_INICIAL)
    expect(pedir).toHaveBeenCalledWith(
      `/seguimiento/clientes/${CLIENTE}/configuracion`,
      expect.anything(),
    )
    await api.guardarConfiguracion(CLIENTE, CONFIGURACION_SEGUIMIENTO_INICIAL)
    expect(pedir).toHaveBeenCalledWith(
      `/seguimiento/clientes/${CLIENTE}/configuracion`,
      expect.anything(),
      { method: "PUT", body: expect.any(String) },
    )
    expect(
      JSON.parse(
        (pedir.mock.calls[1] as unknown as [string, unknown, RequestInit])[2].body as string,
      ),
    ).toEqual(CONFIGURACION_SEGUIMIENTO_INICIAL)
  })
})
