import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { AccessibilityInfo } from "react-native"

import DisposicionRaiz from "../app/_layout"
import videoLento from "../assets/video/logo-carga-lenta.mp4"
import { iniciarSesion, refrescarSesion } from "./lib/api"
import { leerTokenRefresco } from "./lib/almacen-seguro"

const mockReplace = jest.fn()
const mockCrearJugador = jest.fn((fuente: unknown) => ({
  fuente,
  play: () => undefined,
  addListener: () => ({ remove: () => undefined }),
}))

jest.mock("expo-video", () => {
  const React = jest.requireActual<typeof import("react")>("react")
  const { View } = jest.requireActual<typeof import("react-native")>("react-native")
  return {
    useVideoPlayer: (fuente: unknown) => React.useState(() => mockCrearJugador(fuente))[0],
    VideoView: () => React.createElement(View, { testID: "video-arranque" }),
  }
})
jest.mock("expo-font", () => ({ useFonts: () => [true, null] }))
jest.mock("expo-status-bar", () => ({ StatusBar: () => null }))
jest.mock("expo-router", () => {
  const React = jest.requireActual<typeof import("react")>("react")
  const { Text, Pressable } = jest.requireActual<typeof import("react-native")>("react-native")
  return {
    DarkTheme: { colors: {} },
    ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
    useRouter: () => ({ replace: mockReplace }),
    useSegments: () => ["login"],
    Stack: () => {
      const { useSesion } = jest.requireActual<typeof import("./sesion")>("./sesion")
      const { estado, entrar, salir } = useSesion()
      return estado.fase === "dentro"
        ? React.createElement(Pressable, { onPress: salir }, React.createElement(Text, {}, "Salir"))
        : React.createElement(
            Pressable,
            { onPress: () => entrar({ email: "entrenador@prueba.local", contrasena: "clave" }) },
            React.createElement(Text, {}, "ENTRAR"),
          )
    },
  }
})
jest.mock("./componentes/armazon", () => ({
  Armazon: ({ children }: { children: React.ReactNode }) => children,
}))
jest.mock("./consentimiento", () => ({ crearApiConsentimiento: jest.fn() }))
jest.mock("./lib/direccion-api", () => ({ direccionDeLaApi: () => "http://localhost:3000" }))
jest.mock("./lib/api", () => ({
  ...jest.requireActual("./lib/api"),
  refrescarSesion: jest.fn(),
  iniciarSesion: jest.fn(),
  cerrarSesionEnServidor: jest.fn(async () => undefined),
}))
jest.mock("./lib/almacen-seguro", () => ({
  leerTokenRefresco: jest.fn(),
  guardarTokenRefresco: jest.fn(async () => undefined),
  borrarTokenRefresco: jest.fn(async () => undefined),
}))
jest.mock("./lib/sesion-local", () => ({
  leerLimpieza: jest.fn(async () => null),
  leerCuentaLocal: jest.fn(async () => null),
  guardarIdentidadLocal: jest.fn(async () => undefined),
  borrarIdentidadLocal: jest.fn(async () => undefined),
  marcarLimpieza: jest.fn(async () => undefined),
  terminarLimpieza: jest.fn(async () => undefined),
}))
jest.mock("./entrenamiento/almacen-dispositivo", () => ({
  almacenDispositivo: { habilitar: jest.fn(), limpiar: jest.fn(async () => undefined) },
}))
jest.mock("./entrenamiento/documento-local", () => ({
  hayCambiosLocales: jest.fn(async () => false),
}))

const sesion = {
  usuario: {
    id: "10000000-0000-4000-8000-000000000000",
    nombre: "Entrenador",
    apellidos: null,
    email: "entrenador@prueba.local",
    rol: "entrenador" as const,
    estado: "activo" as const,
  },
  tokenAcceso: "acceso",
  tokenRefresco: "refresco",
}

async function avanzar(ms: number): Promise<void> {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms)
  })
}

beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false)
  jest.mocked(leerTokenRefresco).mockResolvedValue(null)
  jest.mocked(iniciarSesion).mockResolvedValue(sesion)
})

afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
})

it("reproduce el vídeo lento al abrir y no vuelve a mostrarlo al entrar o salir de la cuenta", async () => {
  await render(<DisposicionRaiz />)
  expect(screen.getByTestId("video-arranque")).toBeOnTheScreen()
  expect(mockCrearJugador).toHaveBeenCalledTimes(1)
  expect(mockCrearJugador).toHaveBeenCalledWith(videoLento)
  await fireEvent.press(screen.getByRole("button", { name: "Saltar introducción" }))
  await avanzar(300)
  expect(screen.queryByTestId("pantalla-de-carga")).toBeNull()

  await fireEvent.press(screen.getByText("ENTRAR"))
  expect(iniciarSesion).toHaveBeenCalledTimes(1)
  expect(mockReplace).toHaveBeenCalledWith("/")
  expect(screen.getByText("Salir")).toBeOnTheScreen()
  expect(screen.queryByTestId("pantalla-de-carga")).toBeNull()
  expect(mockCrearJugador).toHaveBeenCalledTimes(1)

  await fireEvent.press(screen.getByText("Salir"))
  expect(screen.getByText("ENTRAR")).toBeOnTheScreen()
  expect(screen.queryByTestId("pantalla-de-carga")).toBeNull()
  expect(mockCrearJugador).toHaveBeenCalledTimes(1)
})

it("restaurar la cuenta durante el arranque conserva el mismo vídeo en curso", async () => {
  jest.mocked(leerTokenRefresco).mockResolvedValue("refresco")
  let restaurar = (_sesion: typeof sesion): void => undefined
  jest
    .mocked(refrescarSesion)
    .mockImplementation(() => new Promise((resolve) => (restaurar = resolve)))
  await render(<DisposicionRaiz />)
  expect(mockCrearJugador).toHaveBeenCalledTimes(1)

  await act(async () => restaurar(sesion))
  expect(screen.getByText("Salir")).toBeOnTheScreen()
  expect(screen.getByTestId("video-arranque")).toBeOnTheScreen()
  expect(mockCrearJugador).toHaveBeenCalledTimes(1)
})

it("una nueva apertura vuelve a reproducir la intro de arranque en frío", async () => {
  const vista = await render(<DisposicionRaiz />)
  await fireEvent.press(screen.getByRole("button", { name: "Saltar introducción" }))
  await avanzar(300)
  await vista.unmount()

  await render(<DisposicionRaiz />)
  expect(screen.getByTestId("video-arranque")).toBeOnTheScreen()
  expect(mockCrearJugador).toHaveBeenCalledTimes(2)
})
