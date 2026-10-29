import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { AccessibilityInfo } from "react-native"
import type { EstadoConsentimiento } from "@alpha-omega/shared"

import DisposicionRaiz from "../app/_layout"
import videoLento from "../assets/video/logo-carga-lenta.mp4"
import { iniciarSesion, refrescarSesion } from "./lib/api"
import { leerTokenRefresco } from "./lib/almacen-seguro"
import { crearApiConsentimiento } from "./consentimiento"

const mockReplace = jest.fn()
const mockTocarInicio = jest.fn()
let mockEnfoqueListo = true
const mockCrearJugador = jest.fn((fuente: unknown) => {
  const oyentes = new Map<string, () => void>()
  return {
    fuente,
    play: () => undefined,
    addListener: (evento: string, oyente: () => void) => {
      oyentes.set(evento, oyente)
      return { remove: () => oyentes.delete(evento) }
    },
    emitir: (evento: string) => oyentes.get(evento)?.(),
  }
})

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
  const { Text, Pressable, View } =
    jest.requireActual<typeof import("react-native")>("react-native")
  return {
    DarkTheme: { colors: {} },
    ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
    useRouter: () => ({ replace: mockReplace }),
    usePathname: () => "/",
    useSegments: () => ["login"],
    useFocusEffect: (efecto: () => void) =>
      React.useEffect(() => {
        if (mockEnfoqueListo) return efecto()
      }, [efecto]),
    Stack: ({
      screenLayout,
    }: {
      screenLayout: (props: { children: React.ReactNode }) => React.ReactNode
    }) => {
      const { useSesion } = jest.requireActual<typeof import("./sesion")>("./sesion")
      const { estado, entrar, salir } = useSesion()
      const children =
        estado.fase === "dentro"
          ? React.createElement(
              View,
              {},
              React.createElement(
                Pressable,
                { accessibilityRole: "button", onPress: mockTocarInicio },
                React.createElement(Text, {}, "Empezar entreno"),
              ),
              React.createElement(
                Pressable,
                { onPress: salir },
                React.createElement(Text, {}, "Salir"),
              ),
            )
          : React.createElement(
              Pressable,
              { onPress: () => entrar({ email: "entrenador@prueba.local", contrasena: "clave" }) },
              React.createElement(Text, {}, "ENTRAR"),
            )
      return screenLayout({ children })
    },
  }
})
jest.mock("./componentes/armazon", () => ({
  Armazon: ({ children }: { children: React.ReactNode }) => children,
}))
jest.mock("./notificaciones/cargar", () => ({
  cargarNotificaciones: jest.fn(async () => []),
}))
jest.mock("./consentimiento", () => ({
  ...jest.requireActual("./consentimiento"),
  crearApiConsentimiento: jest.fn(),
}))
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
  mockEnfoqueListo = true
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

it.each([false, true])(
  "el cliente espera al consentimiento para navegar y el Inicio recibe toques sin capa (movimiento reducido: %s)",
  async (reducido) => {
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(reducido)
    jest.mocked(iniciarSesion).mockResolvedValue({
      ...sesion,
      usuario: { ...sesion.usuario, rol: "cliente" },
    })
    let comprobar = (_estado: EstadoConsentimiento): void => undefined
    jest.mocked(crearApiConsentimiento).mockReturnValue({
      estado: () => new Promise((resolve) => (comprobar = resolve)),
      aceptar: jest.fn(),
      retirar: jest.fn(),
    })
    const vista = await render(<DisposicionRaiz />)
    if (reducido) await avanzar(600)
    else await act(() => mockCrearJugador.mock.results[0]!.value.emitir("playToEnd"))
    await avanzar(300)
    expect(screen.queryByTestId("pantalla-de-carga")).toBeNull()

    mockEnfoqueListo = false
    await fireEvent.press(screen.getByText("ENTRAR"))
    expect(screen.getByLabelText("Comprobando tu consentimiento")).toBeOnTheScreen()
    expect(mockReplace).not.toHaveBeenCalled()
    expect(screen.queryByTestId("pantalla-de-carga")).toBeNull()

    await act(() =>
      comprobar({
        vigente: true,
        aceptadoEn: "2026-10-29T10:00:00.000Z",
        retiradoEn: null,
        version: "2026-09-24-borrador",
        versionVigente: "2026-09-24-borrador",
      }),
    )
    expect(mockReplace).not.toHaveBeenCalled()
    mockEnfoqueListo = true
    await vista.rerender(<DisposicionRaiz />)
    expect(mockReplace).toHaveBeenCalledWith("/")
    for (const ms of [500, 700, 1300, 1500, 2000]) {
      await avanzar(ms)
      expect(screen.queryByTestId("pantalla-de-carga")).toBeNull()
      expect(screen.queryByRole("button", { name: "Saltar introducción" })).toBeNull()
      await fireEvent.press(screen.getByRole("button", { name: "Empezar entreno" }))
    }
    expect(mockTocarInicio).toHaveBeenCalledTimes(5)
    expect(mockCrearJugador).toHaveBeenCalledTimes(reducido ? 0 : 1)
    await fireEvent.press(screen.getByText("Salir"))
    expect(screen.getByText("ENTRAR")).toBeOnTheScreen()
    expect(screen.queryByTestId("pantalla-de-carga")).toBeNull()
  },
)

it("una nueva apertura vuelve a reproducir la intro de arranque en frío", async () => {
  const vista = await render(<DisposicionRaiz />)
  await fireEvent.press(screen.getByRole("button", { name: "Saltar introducción" }))
  await avanzar(300)
  await vista.unmount()

  await render(<DisposicionRaiz />)
  expect(screen.getByTestId("video-arranque")).toBeOnTheScreen()
  expect(mockCrearJugador).toHaveBeenCalledTimes(2)
})
