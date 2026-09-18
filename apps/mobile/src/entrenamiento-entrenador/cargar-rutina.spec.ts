import { randomUUID } from "node:crypto"
import { cargarRutina } from "./cargar-rutina"
import {
  catalogoEnMemoria,
  ejercicioDePrueba,
} from "../catalogo-ejercicios/pruebas/catalogo-en-memoria"
import { convertirSesion } from "./editor-modelo"

jest.mock("expo-crypto", () => ({
  randomUUID: jest.requireActual<typeof import("node:crypto")>("node:crypto").randomUUID,
}))
it("avisa de retirados y convierte la plantilla en una copia independiente", async () => {
  const e = ejercicioDePrueba(randomUUID(), "Remo", "espalda", [])
  const api = catalogoEnMemoria([e])
  await api.retirar(e.id)
  const patron = {
    sesiones: [
      {
        id: randomUUID(),
        nombre: "Fuerza",
        diaSemana: 1,
        ejercicios: [
          {
            id: randomUUID(),
            ejercicioId: e.id,
            indicaciones: null,
            series: [
              {
                id: randomUUID(),
                tipoMedicion: "repeticiones" as const,
                pesoKg: 20,
                repeticiones: 10,
              },
            ],
          },
        ],
      },
    ],
  }
  const copia = await cargarRutina(patron, api)
  expect(copia.retirados).toEqual(["Remo"])
  copia.sesiones[0]!.ejercicios[0]!.series[0]!.peso = "30"
  expect(convertirSesion(copia.sesiones[0]!).ejercicios[0]?.series[0]?.pesoKg).toBe(30)
  expect(patron.sesiones[0]?.ejercicios[0]?.series[0]?.pesoKg).toBe(20)
})
