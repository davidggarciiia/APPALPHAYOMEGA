import { afterEach, beforeEach, it, jest } from "@jest/globals"
import { AccessibilityInfo, AppState } from "react-native"
import { fireEvent, render, screen } from "@testing-library/react-native"
import type { SesionCliente } from "@alpha-omega/shared"
import type { ApiEntrenamiento } from "./api"
import { almacenDispositivo } from "./almacen-dispositivo"
import { RegistroCliente } from "./registro-cliente"

jest.mock("expo-router", () => ({
  useFocusEffect: (efecto: () => void) =>
    jest.requireActual<typeof import("react")>("react").useEffect(efecto, [efecto]),
}))
jest.mock("expo-crypto", () => ({
  randomUUID: () => jest.requireActual<typeof import("node:crypto")>("node:crypto").randomUUID(),
}))
const mockFilas = new Map<string, string>()
jest.mock("./almacen-dispositivo", () => {
  const { crearAlmacenLocal } =
    jest.requireActual<typeof import("./almacen-local")>("./almacen-local")
  return {
    almacenDispositivo: crearAlmacenLocal(
      {
        leer: async (_c, k) => mockFilas.get(k) ?? null,
        escribir: async (_c, k, v) => {
          mockFilas.set(k, v)
        },
        borrar: async (_c, k) => {
          mockFilas.delete(k)
        },
        listar: async () => [...mockFilas.keys()],
        limpiar: async () => {
          mockFilas.clear()
        },
      },
      {
        cifrar: async (_c, _k, t) => t,
        descifrar: async (_c, _k, t) => t,
        olvidar: async () => undefined,
      },
    ),
  }
})
const mockSesion = {
  estado: { fase: "fuera" },
  pedir: () => Promise.reject(new Error("Sin catálogo")),
}
jest.mock("../sesion", () => ({ useSesion: () => mockSesion }))
jest.mock("../lib/direccion-api", () => ({ direccionDeLaApi: () => "http://localhost:3000" }))
jest.mock("../componentes/iconos", () => ({ Icono: () => null }))

const CUENTA = "10000000-0000-4000-8000-000000000001"
const ID = "20000000-0000-4000-8000-000000000001"
const sesion: SesionCliente = {
  agenda: {
    id: ID,
    clienteId: CUENTA,
    fechaOriginal: "2026-09-14",
    fechaActual: "2026-09-14",
    estado: "abierta",
    revision: 0,
  },
  prescripcion: {
    nombre: "Empuje",
    ejercicios: [
      {
        id: "40000000-0000-4000-8000-000000000001",
        ejercicioId: "50000000-0000-4000-8000-000000000001",
        nombre: "Movilidad",
        indicaciones: null,
        seccion: "calentamiento",
        series: [
          {
            id: "30000000-0000-4000-8000-000000000001",
            tipoMedicion: "repeticiones",
            pesoKg: null,
            repeticiones: 8,
          },
        ],
      },
      {
        id: "40000000-0000-4000-8000-000000000002",
        ejercicioId: "50000000-0000-4000-8000-000000000002",
        nombre: "Press banca",
        indicaciones: null,
        seccion: "principal",
        series: [
          {
            id: "30000000-0000-4000-8000-000000000002",
            tipoMedicion: "repeticiones",
            pesoKg: 40,
            repeticiones: 8,
          },
        ],
      },
    ],
  },
  revisionPrescripcion: 0,
  permiteAjuste: true,
  enviadoEn: null,
  borrador: null,
}

beforeEach(async () => {
  await almacenDispositivo.limpiar(CUENTA)
  almacenDispositivo.habilitar(CUENTA)
  AppState.currentState = "background"
})
afterEach(() => {
  AppState.currentState = "active"
  jest.restoreAllMocks()
})

it("anuncia el bloque nuevo al avanzar y al regresar", async () => {
  const anunciar = jest
    .spyOn(AccessibilityInfo, "announceForAccessibility")
    .mockImplementation(() => undefined)
  const api = {
    leerCliente: async () => sesion,
    anteriores: async () => ({ anteriores: [] }),
    resultados: async () => ({ resultados: [] }),
    comentarios: async () => ({ comentarios: [] }),
    molestias: async () => ({ molestias: [] }),
  } as unknown as ApiEntrenamiento
  await render(<RegistroCliente cuenta={CUENTA} id={ID} api={api} />)
  await fireEvent.press(await screen.findByRole("button", { name: "Siguiente" }))
  expect(anunciar).toHaveBeenLastCalledWith("Bloque 2 de 2, Principal")
  await fireEvent.press(screen.getByRole("button", { name: "Anterior" }))
  expect(anunciar).toHaveBeenLastCalledWith("Bloque 1 de 2, Calentamiento")
})
