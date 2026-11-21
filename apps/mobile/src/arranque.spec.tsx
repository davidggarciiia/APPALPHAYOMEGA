import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { AccessibilityInfo } from "react-native"
import type { EstadoConsentimiento } from "@alpha-omega/shared"

import DisposicionRaiz, { ErrorBoundary } from "../app/_layout"
import videoLento from "../assets/video/logo-carga-lenta.mp4"
import { ErrorDeRed, iniciarSesion, refrescarSesion } from "./lib/api"
import { leerTokenRefresco } from "./lib/almacen-seguro"
import { leerIdentidadLocal } from "./lib/sesion-local"
import { crearApiConsentimiento } from "./consentimiento"
import { reiniciarDestino } from "./componentes/destino-tras-login"

const mockReplace = jest.fn()
const mockTocarInicio = jest.fn()
let mockEnfoqueListo = true
let mockSegmentos = ["login"]
let mockRuta = "/"
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
    usePathname: () => mockRuta,
    useSegments: () => mockSegmentos,
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
      const children = ["activar", "recuperar", "restablecer"].includes(mockSegmentos[0] ?? "")
        ? React.createElement(Text, {}, `Enlace de cuenta: ${mockSegmentos[0]}`)
        : estado.fase === "dentro"
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
  leerIdentidadLocal: jest.fn(async () => null),
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
  mockSegmentos = ["login"]
  mockRuta = "/"
  reiniciarDestino()
  jest.useFakeTimers()
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false)
  jest.mocked(leerTokenRefresco).mockResolvedValue(null)
  jest.mocked(leerIdentidadLocal).mockResolvedValue(null)
  jest.mocked(refrescarSesion).mockResolvedValue(sesion)
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

describe.each(["activar", "recuperar", "restablecer"])("enlace público %s", (ruta) => {
  it("conserva el enlace al restaurar una sesión abierta", async () => {
    mockSegmentos = [ruta]
    jest.mocked(leerTokenRefresco).mockResolvedValue("refresco")
    await render(<DisposicionRaiz />)
    expect(screen.getByText(`Enlace de cuenta: ${ruta}`)).toBeOnTheScreen()
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it("permite usar el enlace aunque el cliente aún no haya dado consentimiento", async () => {
    mockSegmentos = [ruta]
    jest.mocked(leerTokenRefresco).mockResolvedValue("refresco")
    jest.mocked(refrescarSesion).mockResolvedValue({
      ...sesion,
      usuario: { ...sesion.usuario, rol: "cliente" },
    })
    const estadoConsentimiento = jest.fn(() => new Promise<EstadoConsentimiento>(() => undefined))
    jest.mocked(crearApiConsentimiento).mockReturnValue({
      estado: estadoConsentimiento,
      aceptar: jest.fn(),
      retirar: jest.fn(),
    })
    await render(<DisposicionRaiz />)
    expect(screen.getByText(`Enlace de cuenta: ${ruta}`)).toBeOnTheScreen()
    expect(estadoConsentimiento).not.toHaveBeenCalled()
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it("no sustituye el enlace por el plan al restaurar una copia local", async () => {
    mockSegmentos = [ruta]
    jest.mocked(leerTokenRefresco).mockResolvedValue("refresco")
    jest.mocked(refrescarSesion).mockRejectedValue(new ErrorDeRed("Sin red"))
    jest.mocked(leerIdentidadLocal).mockResolvedValue({
      id: sesion.usuario.id,
      nombre: "Cliente",
      rol: "cliente",
    })
    await render(<DisposicionRaiz />)
    expect(screen.getByText(`Enlace de cuenta: ${ruta}`)).toBeOnTheScreen()
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it("mantiene el formulario público si falla la renovación y no hay copia local", async () => {
    mockSegmentos = [ruta]
    jest.mocked(leerTokenRefresco).mockResolvedValue("refresco")
    jest.mocked(refrescarSesion).mockRejectedValue(new ErrorDeRed("Sin red"))
    await render(<DisposicionRaiz />)
    expect(screen.getByText(`Enlace de cuenta: ${ruta}`)).toBeOnTheScreen()
    expect(screen.queryByText("No hemos podido conectar con el servidor.")).toBeNull()
    expect(mockReplace).not.toHaveBeenCalled()
  })
})

it("un fallo de pantalla muestra «Algo ha fallado» y permite reintentar", async () => {
  const reintentar = jest.fn(async () => undefined)
  await render(<ErrorBoundary error={new Error("fallo de prueba")} retry={reintentar} />)
  expect(screen.getByRole("header", { name: "Algo ha fallado" })).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole("button", { name: "Reintentar" }))
  expect(reintentar).toHaveBeenCalledTimes(1)
})

describe("destino tras el login", () => {
  async function entrarDesdeEnlace(ruta: string): Promise<void> {
    mockSegmentos = ruta.split("/").filter(Boolean)
    mockRuta = ruta
    await render(<DisposicionRaiz />)
    await fireEvent.press(screen.getByRole("button", { name: "Saltar introducción" }))
    await avanzar(300)
    expect(mockReplace).toHaveBeenCalledWith("/login")
    mockReplace.mockClear()
    mockSegmentos = ["login"]
    mockRuta = "/login"
    await fireEvent.press(screen.getByText("ENTRAR"))
  }

  it("lleva a la ruta protegida a la que apuntaba el enlace en frío", async () => {
    await entrarDesdeEnlace("/entrenador/cliente/abc/plan")
    expect(mockReplace).toHaveBeenCalledWith("/entrenador/cliente/abc/plan")
    expect(mockReplace).not.toHaveBeenCalledWith("/")
  })

  it("sin destino guardado entra en la raíz", async () => {
    await entrarDesdeEnlace("/")
    expect(mockReplace).toHaveBeenCalledWith("/")
  })

  it("tras cerrar sesión a propósito no hereda la pantalla de la cuenta anterior", async () => {
    mockSegmentos = ["login"]
    await render(<DisposicionRaiz />)
    await fireEvent.press(screen.getByRole("button", { name: "Saltar introducción" }))
    await avanzar(300)
    await fireEvent.press(screen.getByText("ENTRAR"))
    mockSegmentos = ["progreso"]
    mockRuta = "/progreso"
    await fireEvent.press(screen.getByText("Salir"))
    expect(mockReplace).toHaveBeenLastCalledWith("/login")
    mockReplace.mockClear()
    mockSegmentos = ["login"]
    mockRuta = "/login"
    await fireEvent.press(screen.getByText("ENTRAR"))
    expect(mockReplace).toHaveBeenCalledWith("/")
    expect(mockReplace).not.toHaveBeenCalledWith("/progreso")
  })
})
