import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native"
import type {
  ComidaRegistrada,
  DietaPublicada,
  DocumentoDieta,
  LecturaDietaVigente,
  ListadoComidasRegistradas,
} from "@alpha-omega/shared"

import ComidaDeHoy from "../../app/nutricion/comida"
import type { ApiNutricion } from "./api"
import { leerCopia, type CopiaDeDieta } from "./copia-local"

const CLIENTE = "10000000-0000-4000-8000-000000000000"
const DIETA = "30000000-0000-4000-8000-000000000000"
const TIPO = "00000000-0000-4000-8000-000000000001"
const COMIDA = "00000000-0000-4000-8000-000000000002"
const DULCE = "00000000-0000-4000-8000-000000000011"
const SALADA = "00000000-0000-4000-8000-000000000012"
const mockReemplazar = jest.fn()

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: "00000000-0000-4000-8000-000000000002" }),
  useRouter: () => ({ back: jest.fn(), replace: mockReemplazar, canGoBack: () => true }),
  useFocusEffect: (efecto: () => void) =>
    jest.requireActual<typeof import("react")>("react").useEffect(efecto, [efecto]),
}))
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: jest.requireActual<typeof import("react-native")>("react-native").View,
}))
jest.mock("../componentes/iconos", () => ({ Icono: () => null }))
jest.mock("../sesion", () => ({
  useSesion: () => ({
    estado: {
      fase: "dentro",
      usuario: { id: "10000000-0000-4000-8000-000000000000", rol: "cliente" },
    },
  }),
}))
jest.mock("../entrenamiento/almacen-dispositivo", () => ({ almacenDispositivo: {} }))
jest.mock("./copia-local", () => ({ leerCopia: jest.fn() }))

const mockApi = {
  vigente: jest.fn<() => Promise<LecturaDietaVigente>>(),
  comidas: jest.fn<() => Promise<ListadoComidasRegistradas>>(),
  registrarComida: jest.fn<ApiNutricion["registrarComida"]>(),
  quitarComida: jest.fn<ApiNutricion["quitarComida"]>(),
}
jest.mock("./api", () => ({ useNutricion: () => mockApi }))
const copia = jest.mocked(leerCopia)

function dieta(registroComidas?: boolean): DietaPublicada {
  const documento: DocumentoDieta = {
    formato: 1,
    nombre: "Plan sintético",
    tiposDeDia: [
      {
        id: TIPO,
        nombre: "Todos los días",
        objetivo: null,
        comidas: [
          {
            id: COMIDA,
            nombre: "Media mañana",
            hora: "11:00",
            indicacion: null,
            forma: "alternativas",
            grupos: [
              {
                nombre: "Dulces",
                alternativas: [
                  {
                    id: DULCE,
                    titulo: "Tortitas de avena",
                    alimentos: [{ nombre: "Avena", cantidad: "40 g" }],
                    nota: null,
                    macros: null,
                  },
                ],
              },
              {
                nombre: "Saladas",
                alternativas: [
                  {
                    id: SALADA,
                    titulo: "Tostada con pavo",
                    alimentos: [{ nombre: "Pavo", cantidad: "80 g" }],
                    nota: null,
                    macros: null,
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
    semana: Array<string>(7).fill(TIPO),
    indicaciones: [],
    ...(registroComidas === undefined ? {} : { registroComidas }),
  }
  return { id: DIETA, clienteId: CLIENTE, documento, publicadaEn: "2026-09-20T08:00:00.000Z" }
}

const conRed = (d: DietaPublicada, comidas: ComidaRegistrada[] = []): void => {
  mockApi.vigente.mockResolvedValue({ dieta: d, deNutricionista: false })
  mockApi.comidas.mockResolvedValue({ comidas })
}
const sinRed = (d: DietaPublicada): void => {
  mockApi.vigente.mockRejectedValue(new TypeError("Network request failed"))
  mockApi.comidas.mockRejectedValue(new TypeError("Network request failed"))
  const guardada: CopiaDeDieta = { dieta: d, actualizadaEn: "2026-09-23T08:00:00.000Z" }
  copia.mockResolvedValue(guardada)
}

const SOLO_CONSULTA = "Tu profesional ha dejado esta comida solo para consultar."
const salada = (): boolean =>
  screen.getByRole("radio", { name: /^Tostada con pavo/ }).props.accessibilityState.checked === true

beforeEach(() => {
  mockApi.registrarComida.mockImplementation(async (_c, fecha, comidaId, datos) => ({
    fecha,
    comidaId,
    dietaId: datos.dietaId,
    eleccion: datos.eleccion,
    registradaEn: "2026-09-24T10:00:00.000Z",
  }))
  mockApi.quitarComida.mockResolvedValue(undefined)
})

describe("ruta de una comida de hoy", () => {
  it.each(["ausente", "sin copia"] as const)(
    "ofrece volver a Nutrición si la comida está %s",
    async (estado) => {
      if (estado === "ausente") {
        mockApi.vigente.mockResolvedValue({ dieta: null, deNutricionista: false })
        mockApi.comidas.mockResolvedValue({ comidas: [] })
      } else {
        sinRed(dieta())
        copia.mockResolvedValue(null)
      }
      await render(<ComidaDeHoy />)
      await fireEvent.press(await screen.findByRole("button", { name: "Volver a Nutrición" }))
      expect(mockReemplazar).toHaveBeenCalledWith("/nutricion")
      expect(mockApi.registrarComida).not.toHaveBeenCalled()
    },
  )

  it("con red y registro desactivado no la presenta como desconexión", async () => {
    conRed(dieta(false))
    await render(<ComidaDeHoy />)
    expect(await screen.findByText(SOLO_CONSULTA)).toBeTruthy()
    expect(screen.getByText("Tortitas de avena")).toBeTruthy()
    expect(screen.queryByText(/sin conexión/i)).toBeNull()
    expect(screen.queryByRole("button", { name: "Registrar comida" })).toBeNull()
    expect(screen.queryByRole("button", { name: /Reintentar/ })).toBeNull()
    expect(copia).not.toHaveBeenCalled()
    expect(mockApi.registrarComida).not.toHaveBeenCalled()
  })

  it("sin red, con la copia de una dieta sin registro, tampoco ofrece reintentar para guardar", async () => {
    sinRed(dieta(false))
    await render(<ComidaDeHoy />)
    expect(await screen.findByText(SOLO_CONSULTA)).toBeTruthy()
    expect(screen.queryByText(/sin conexión/i)).toBeNull()
    expect(screen.queryByRole("button", { name: "Registrar comida" })).toBeNull()
    expect(screen.queryByRole("button", { name: /Reintentar/ })).toBeNull()
  })

  it("sin red conserva la elección aunque el reintento siga sin conexión", async () => {
    sinRed(dieta())
    await render(<ComidaDeHoy />)
    expect(await screen.findByText(/^Sin conexión/)).toBeTruthy()
    expect(screen.queryByText(SOLO_CONSULTA)).toBeNull()
    expect(screen.queryByRole("button", { name: "Registrar comida" })).toBeNull()
    await fireEvent.press(screen.getByRole("tab", { name: "Saladas" }))
    await fireEvent.press(screen.getByRole("radio", { name: /^Tostada con pavo/ }))
    await fireEvent.press(screen.getByRole("button", { name: "Reintentar conexión" }))
    expect(await screen.findByText(/^Sigues sin conexión/)).toBeTruthy()
    expect(mockApi.vigente).toHaveBeenCalledTimes(2)
    expect(salada()).toBe(true)
    expect(screen.queryByText("Comida registrada")).toBeNull()
    expect(mockApi.registrarComida).not.toHaveBeenCalled()
  })

  it("al recuperar la red registra la elección conservada con la dieta vigente", async () => {
    sinRed(dieta())
    await render(<ComidaDeHoy />)
    await fireEvent.press(await screen.findByRole("tab", { name: "Saladas" }))
    await fireEvent.press(screen.getByRole("radio", { name: /^Tostada con pavo/ }))
    conRed(dieta())
    await fireEvent.press(screen.getByRole("button", { name: "Reintentar conexión" }))
    await fireEvent.press(await screen.findByRole("button", { name: "Registrar comida" }))
    await waitFor(() =>
      expect(mockApi.registrarComida).toHaveBeenCalledWith(CLIENTE, expect.any(String), COMIDA, {
        dietaId: DIETA,
        eleccion: { tipo: "alternativa", alternativaId: SALADA },
      }),
    )
    expect(await screen.findByText("Comida registrada")).toBeTruthy()
    expect(screen.queryByText(/sin conexión/i)).toBeNull()
  })

  it("al recuperar la red muestra lo que el servidor ya tenía registrado", async () => {
    sinRed(dieta())
    await render(<ComidaDeHoy />)
    expect(await screen.findByText(/^Sin conexión/)).toBeTruthy()
    expect(screen.queryByText("Comida registrada")).toBeNull()
    conRed(dieta(), [
      {
        fecha: "2026-09-24",
        comidaId: COMIDA,
        dietaId: DIETA,
        eleccion: { tipo: "alternativa", alternativaId: DULCE },
        registradaEn: "2026-09-24T09:00:00.000Z",
      },
    ])
    await fireEvent.press(screen.getByRole("button", { name: "Reintentar conexión" }))
    expect(await screen.findByText("Comida registrada")).toBeTruthy()
    expect(screen.getAllByText("Tortitas de avena")).toHaveLength(2)
    expect(screen.getByRole("button", { name: "Quitar de hechas" })).toBeTruthy()
  })

  it("con red y registro habilitado corrige y quita la comida con el servidor", async () => {
    conRed(dieta(true), [
      {
        fecha: "2026-09-24",
        comidaId: COMIDA,
        dietaId: DIETA,
        eleccion: { tipo: "alternativa", alternativaId: DULCE },
        registradaEn: "2026-09-24T09:00:00.000Z",
      },
    ])
    await render(<ComidaDeHoy />)
    expect(await screen.findByText("Comida registrada")).toBeTruthy()
    expect(screen.queryByText(SOLO_CONSULTA)).toBeNull()
    expect(screen.queryByText(/sin conexión/i)).toBeNull()
    await fireEvent.press(screen.getByRole("tab", { name: "Saladas" }))
    await fireEvent.press(screen.getByRole("radio", { name: /^Tostada con pavo/ }))
    await fireEvent.press(screen.getByRole("button", { name: "Registrar comida" }))
    await waitFor(() =>
      expect(mockApi.registrarComida).toHaveBeenCalledWith(CLIENTE, expect.any(String), COMIDA, {
        dietaId: DIETA,
        eleccion: { tipo: "alternativa", alternativaId: SALADA },
      }),
    )
    expect(await screen.findAllByText("Tostada con pavo")).toHaveLength(2)
    await fireEvent.press(screen.getByRole("button", { name: "Quitar de hechas" }))
    await waitFor(() => expect(screen.queryByText("Comida registrada")).toBeNull())
    expect(mockApi.quitarComida).toHaveBeenCalledWith(CLIENTE, expect.any(String), COMIDA)
  })
})
