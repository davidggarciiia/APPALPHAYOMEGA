import { render, screen } from "@testing-library/react-native"
import { CONFIGURACION_SEGUIMIENTO_INICIAL } from "@alpha-omega/shared"
import type { ApiSeguimiento } from "./api"
import { ProgresoRedisenado } from "./progreso-redisenado"
import { hoyAgenda } from "../entrenamiento/fechas"

jest.mock("expo-router", () => {
  const React = jest.requireActual<typeof import("react")>("react")
  return { useFocusEffect: (efecto: () => void) => React.useEffect(efecto, [efecto]) }
})

it("mantiene juntas las filas de una tarjeta y permite añadir medidas en su encabezado", async () => {
  const seguimiento = {
    configuracion: async () => ({
      ...CONFIGURACION_SEGUIMIENTO_INICIAL,
      indicadores: ["peso", "cintura"],
    }),
    dias: async () => ({ dias: [] }),
    medidas: async () => ({
      medidas: [
        {
          id: "m",
          fecha: "2026-01-01",
          creadoEn: "2026-01-01T00:00:00.000Z",
          pesoKg: 80,
          cinturaCm: 95,
          grasaPct: null,
          alturaCm: null,
        },
      ],
      fechaNacimiento: null,
    }),
    fuerza: async () => ({ ejercicios: [] }),
    pruebas: async () => ({ pruebas: [] }),
  } as unknown as ApiSeguimiento
  await render(<ProgresoRedisenado clienteId="cliente" seguimiento={seguimiento} />)
  const titulo = await screen.findByRole("header", { name: "Medidas" })
  const cabecera = titulo.parent!
  expect(cabecera).toContainElement(screen.getByRole("button", { name: "Añadir medida" }))
})

it("cierra la tarjeta de medidas antes de las medias semanales de pasos y sueño", async () => {
  const seguimiento = {
    configuracion: async () => ({
      ...CONFIGURACION_SEGUIMIENTO_INICIAL,
      indicadores: ["cintura", "pasos", "sueno"],
    }),
    dias: async () => ({
      dias: [
        {
          fecha: hoyAgenda(),
          pesoKg: null,
          pasos: 7000,
          suenoMin: 480,
          creatina: null,
          suplementos: [],
        },
      ],
    }),
    medidas: async () => ({
      medidas: [
        {
          id: "m",
          fecha: "2026-01-01",
          creadoEn: "2026-01-01T00:00:00.000Z",
          pesoKg: null,
          cinturaCm: 95,
          grasaPct: null,
          alturaCm: null,
        },
      ],
      fechaNacimiento: null,
    }),
    fuerza: async () => ({ ejercicios: [] }),
    pruebas: async () => ({ pruebas: [] }),
  } as unknown as ApiSeguimiento
  await render(<ProgresoRedisenado clienteId="cliente" seguimiento={seguimiento} />)
  const tarjeta = await screen.findByTestId("comparativa-cintura")
  expect(tarjeta).toHaveStyle({
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  })
  expect(screen.getByText("Pasos")).toBeOnTheScreen()
  expect(screen.getByText("Sueño")).toBeOnTheScreen()
})
