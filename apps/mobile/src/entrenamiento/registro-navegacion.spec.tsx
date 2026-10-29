import { AppState, Pressable, Text } from "react-native"
import { router, Stack, type Href } from "expo-router"
import { act, fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library"
import type { SesionCliente } from "@alpha-omega/shared"
import { RegistroCliente } from "./registro-cliente"
import type { ApiEntrenamiento } from "./api"

jest.mock("expo-crypto", () => ({
  randomUUID: () => jest.requireActual("node:crypto").randomUUID(),
}))
jest.mock("../componentes/iconos", () => ({ Icono: () => null }))
jest.mock("../lib/direccion-api", () => ({ direccionDeLaApi: () => "http://localhost:3000" }))
const mockSesion = {
  estado: { fase: "fuera" },
  pedir: () => Promise.reject(new Error("Sin catálogo")),
}
jest.mock("../sesion", () => ({ useSesion: () => mockSesion }))
const mockFilas = new Map<string, string>()
let mockFalloDeDisco = false
jest.mock("./almacen-dispositivo", () => {
  const { crearAlmacenLocal } =
    jest.requireActual<typeof import("./almacen-local")>("./almacen-local")
  return {
    almacenDispositivo: crearAlmacenLocal(
      {
        leer: async (_c, k) => mockFilas.get(k) ?? null,
        escribir: async (_c, k, v) => {
          if (mockFalloDeDisco) throw new Error("Disco lleno")
          mockFilas.set(k, v)
        },
        borrar: async (_c, k) => {
          mockFilas.delete(k)
        },
        listar: async () => [...mockFilas.keys()],
        limpiar: async () => mockFilas.clear(),
      },
      {
        cifrar: async (_c, _k, t) => t,
        descifrar: async (_c, _k, t) => t,
        olvidar: async () => undefined,
      },
    ),
  }
})

it("Atrás conserva el entrenamiento cuando falla el disco y permite reintentarlo", async () => {
  const actividad = AppState.currentState
  AppState.currentState = "background"
  const sesion: SesionCliente = {
    agenda: {
      id: "20000000-0000-4000-8000-000000000001",
      clienteId: "10000000-0000-4000-8000-000000000001",
      fechaOriginal: "2026-10-26",
      fechaActual: "2026-10-26",
      estado: "abierta",
      revision: 0,
    },
    prescripcion: {
      nombre: "Fuerza",
      ejercicios: [
        {
          id: "30000000-0000-4000-8000-000000000001",
          ejercicioId: "40000000-0000-4000-8000-000000000001",
          nombre: "Press",
          indicaciones: null,
          series: [
            {
              id: "50000000-0000-4000-8000-000000000001",
              tipoMedicion: "repeticiones",
              repeticiones: 8,
              pesoKg: null,
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
  const api = {
    leerCliente: async () => sesion,
    anteriores: async () => ({ anteriores: [] }),
  } as unknown as ApiEntrenamiento
  const vista = renderRouter(
    {
      _layout: () => <Stack screenOptions={{ headerShown: false, animation: "none" }} />,
      index: () => (
        <Pressable accessibilityRole="button" onPress={() => router.push("/entrenando" as Href)}>
          <Text>Entrenar</Text>
        </Pressable>
      ),
      entrenando: () => (
        <RegistroCliente
          cuenta={sesion.agenda.clienteId}
          id={sesion.agenda.id}
          api={api}
          salir={() => router.back()}
        />
      ),
    },
    { initialUrl: "/" },
  )
  try {
    await vista
    await fireEvent.press(await screen.findByRole("button", { name: "Entrenar" }))
    await screen.findByRole("button", { name: "Terminar" })
    await fireEvent.press(screen.getByRole("button", { name: "Tengo una molestia — Press" }))
    await fireEvent.press(screen.getByRole("radio", { name: "Hombro" }))
    await act(() => router.back())
    expect(vista.getPathname()).toBe("/entrenando")
    await fireEvent.press(await screen.findByRole("button", { name: "Seguir editando" }))
    expect(screen.getByRole("radio", { name: "Hombro", checked: true })).toBeTruthy()
    await fireEvent.press(screen.getByRole("button", { name: "Volver a la sesión" }))
    await fireEvent.press(screen.getByRole("button", { name: "Descartar" }))
    await fireEvent.press(screen.getByRole("button", { name: "Tengo una molestia — Press" }))
    await fireEvent.press(screen.getByRole("radio", { name: "Hombro" }))
    await act(() => router.back())
    await fireEvent.press(await screen.findByRole("button", { name: "Descartar" }))
    await waitFor(() => expect(vista.getPathname()).toBe("/"))
    await fireEvent.press(screen.getByRole("button", { name: "Entrenar" }))
    await screen.findByRole("button", { name: "Terminar" })
    mockFalloDeDisco = true
    await act(() => router.back())
    await screen.findByText(
      "No se pudo guardar la sesión en este dispositivo. Reintenta antes de salir.",
    )
    expect(vista.getPathname()).toBe("/entrenando")
    mockFalloDeDisco = false
    await act(() => router.back())
    await waitFor(() => expect(vista.getPathname()).toBe("/"))
  } finally {
    mockFalloDeDisco = false
    AppState.currentState = actividad
  }
})
