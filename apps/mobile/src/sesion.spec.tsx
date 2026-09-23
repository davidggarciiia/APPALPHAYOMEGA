import { Platform, Text, Pressable } from "react-native"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react-native"
import { ProveedorDeSesion, useSesion } from "./sesion"
import { ErrorDeRed, ErrorDeSesion, iniciarSesion, refrescarSesion } from "./lib/api"
import { borrarTokenRefresco, guardarTokenRefresco, leerTokenRefresco } from "./lib/almacen-seguro"
import { leerIdentidadLocal, leerLimpieza } from "./lib/sesion-local"
import { hayCambiosLocales } from "./entrenamiento/documento-local"
import { almacenDispositivo } from "./entrenamiento/almacen-dispositivo"

jest.mock("./lib/direccion-api", () => ({ direccionDeLaApi: () => "http://localhost:3000" }))
jest.mock("./lib/api", () => ({
  ...jest.requireActual("./lib/api"),
  refrescarSesion: jest.fn(),
  iniciarSesion: jest.fn(),
  cerrarSesionEnServidor: jest.fn(async () => undefined),
}))
jest.mock("./lib/almacen-seguro", () => ({
  leerTokenRefresco: jest.fn(),
  borrarTokenRefresco: jest.fn(async () => undefined),
  guardarTokenRefresco: jest.fn(async () => undefined),
}))
jest.mock("./lib/sesion-local", () => ({
  marcarLimpieza: jest.fn(async () => undefined),
  leerLimpieza: jest.fn(async () => null),
  terminarLimpieza: jest.fn(async () => undefined),
  leerCuentaLocal: jest.fn(async () => "10000000-0000-4000-8000-000000000000"),
  leerIdentidadLocal: jest.fn(),
  guardarIdentidadLocal: jest.fn(async () => undefined),
  borrarIdentidadLocal: jest.fn(async () => undefined),
}))
jest.mock("./entrenamiento/documento-local", () => ({ hayCambiosLocales: jest.fn() }))
jest.mock("./entrenamiento/almacen-dispositivo", () => ({
  almacenDispositivo: { habilitar: jest.fn(), limpiar: jest.fn(async () => undefined) },
}))

const local = {
  id: "10000000-0000-4000-8000-000000000000",
  nombre: "Cliente",
  rol: "cliente" as const,
}
function Visor(): React.JSX.Element {
  const { estado, salir } = useSesion()
  return (
    <>
      <Text>{estado.fase}</Text>
      <Pressable accessibilityRole="button" onPress={() => void salir()}>
        <Text>Salir</Text>
      </Pressable>
    </>
  )
}
function VisorEntrada(): React.JSX.Element {
  const { entrar } = useSesion()
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => void entrar({ email: "otro@example.test", contrasena: "clave-de-prueba" })}
    >
      <Text>Entrar</Text>
    </Pressable>
  )
}
beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(leerTokenRefresco).mockResolvedValue("refresco")
  jest.mocked(leerIdentidadLocal).mockResolvedValue(local)
  jest.mocked(hayCambiosLocales).mockResolvedValue(false)
  jest.mocked(leerLimpieza).mockResolvedValue(null)
})

it("al reiniciar termina una limpieza pendiente antes de renovar o habilitar acceso", async () => {
  jest.mocked(leerLimpieza).mockResolvedValue({ cuenta: local.id })
  await render(
    <ProveedorDeSesion>
      <Visor />
    </ProveedorDeSesion>,
  )
  await screen.findByText("fuera")
  expect(refrescarSesion).not.toHaveBeenCalled()
  expect(almacenDispositivo.limpiar).toHaveBeenCalledWith(local.id)
})
it("un fallo de red restaura acceso local de cliente y conserva la credencial", async () => {
  jest.mocked(refrescarSesion).mockRejectedValue(new ErrorDeRed("Sin red"))
  await render(
    <ProveedorDeSesion>
      <Visor />
    </ProveedorDeSesion>,
  )
  await screen.findByText("local")
  expect(borrarTokenRefresco).not.toHaveBeenCalled()
})
it("un 401 confirmado no concede acceso local", async () => {
  jest.mocked(refrescarSesion).mockRejectedValue(new ErrorDeSesion("Revocada"))
  await render(
    <ProveedorDeSesion>
      <Visor />
    </ProveedorDeSesion>,
  )
  await screen.findByText("fuera")
  expect(borrarTokenRefresco).toHaveBeenCalled()
  expect(almacenDispositivo.limpiar).toHaveBeenCalledWith(local.id)
})
it("permite cancelar la salida con cambios pendientes y limpia la cuenta al confirmar", async () => {
  jest.mocked(refrescarSesion).mockResolvedValue({
    usuario: { ...local, email: "cliente@example.test", apellidos: null, estado: "activo" },
    tokenAcceso: "acceso",
    tokenRefresco: "nuevo",
  })
  jest.mocked(hayCambiosLocales).mockResolvedValue(true)
  await render(
    <ProveedorDeSesion>
      <Visor />
    </ProveedorDeSesion>,
  )
  await screen.findByText("dentro")
  await fireEvent.press(screen.getByRole("button", { name: "Salir" }))
  await fireEvent.press(await screen.findByRole("button", { name: "Seguir entrenando" }))
  expect(almacenDispositivo.limpiar).not.toHaveBeenCalled()
  await fireEvent.press(screen.getByRole("button", { name: "Salir" }))
  await fireEvent.press(await screen.findByRole("button", { name: "Descartar y cerrar sesión" }))
  await screen.findByText("fuera")
  expect(almacenDispositivo.limpiar).toHaveBeenCalledWith(local.id)
})

it("dos pestañas no reemplazan el refresco vigente con una respuesta anterior", async () => {
  const plataformaAnterior = Platform.OS
  Object.defineProperty(Platform, "OS", { value: "web", configurable: true })
  let cola = Promise.resolve()
  Object.defineProperty(globalThis.navigator, "locks", {
    configurable: true,
    value: {
      request: (_nombre: string, _opciones: unknown, accion: () => Promise<unknown>) => {
        const siguiente = cola.then(accion)
        cola = siguiente.then(
          () => undefined,
          () => undefined,
        )
        return siguiente
      },
    },
  })
  try {
    let guardado = "refresco"
    let resolverPrimera: (sesion: Awaited<ReturnType<typeof refrescarSesion>>) => void = () =>
      undefined
    jest.mocked(leerTokenRefresco).mockImplementation(async () => guardado)
    jest
      .mocked(refrescarSesion)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolverPrimera = resolve
          }),
      )
      .mockImplementationOnce(async (token) => {
        expect(token).toBe("refresco-A")
        return {
          usuario: { ...local, email: "cliente@example.test", apellidos: null, estado: "activo" },
          tokenAcceso: "acceso-B",
          tokenRefresco: "refresco-B",
        }
      })
    jest.mocked(guardarTokenRefresco).mockImplementation(async (token) => {
      guardado = token
    })

    await render(
      <>
        <ProveedorDeSesion>
          <Visor />
        </ProveedorDeSesion>
        <ProveedorDeSesion>
          <Visor />
        </ProveedorDeSesion>
      </>,
    )
    await waitFor(() => expect(refrescarSesion).toHaveBeenCalledTimes(1))

    resolverPrimera({
      usuario: { ...local, email: "cliente@example.test", apellidos: null, estado: "activo" },
      tokenAcceso: "acceso-A",
      tokenRefresco: "refresco-A",
    })
    await waitFor(() => expect(refrescarSesion).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(guardarTokenRefresco).toHaveBeenCalledTimes(2))
    expect(guardado).toBe("refresco-B")
  } finally {
    Object.defineProperty(Platform, "OS", { value: plataformaAnterior, configurable: true })
    Reflect.deleteProperty(globalThis.navigator, "locks")
  }
})

it("un cambio de cuenta en otra pestaña invalida el acceso local sin borrar la nueva sesión", async () => {
  const plataformaAnterior = Platform.OS
  Object.defineProperty(Platform, "OS", { value: "web", configurable: true })
  let avisar: ((evento: { key: string; newValue: string | null }) => void) | null = null
  const agregarAnterior = globalThis.addEventListener
  const quitarAnterior = globalThis.removeEventListener
  Object.defineProperty(globalThis, "addEventListener", {
    configurable: true,
    value: (tipo: string, receptor: typeof avisar) => {
      if (tipo === "storage") avisar = receptor
    },
  })
  Object.defineProperty(globalThis, "removeEventListener", {
    configurable: true,
    value: () => undefined,
  })
  Object.defineProperty(globalThis.navigator, "locks", {
    configurable: true,
    value: {
      request: (_nombre: string, _opciones: unknown, accion: () => Promise<unknown>) => accion(),
    },
  })
  jest.mocked(refrescarSesion).mockResolvedValue({
    usuario: { ...local, email: "cliente@example.test", apellidos: null, estado: "activo" },
    tokenAcceso: "acceso",
    tokenRefresco: "nuevo",
  })
  try {
    await render(
      <ProveedorDeSesion>
        <Visor />
      </ProveedorDeSesion>,
    )
    await screen.findByText("dentro")
    expect(avisar).not.toBeNull()
    await act(async () => {
      avisar?.({ key: "alpha_omega_cuenta", newValue: "20000000-0000-4000-8000-000000000000" })
    })
    await screen.findByText("fuera")
    expect(borrarTokenRefresco).not.toHaveBeenCalled()
  } finally {
    cleanup()
    Object.defineProperty(Platform, "OS", { value: plataformaAnterior, configurable: true })
    Reflect.deleteProperty(globalThis.navigator, "locks")
    Object.defineProperty(globalThis, "addEventListener", {
      value: agregarAnterior,
      configurable: true,
    })
    Object.defineProperty(globalThis, "removeEventListener", {
      value: quitarAnterior,
      configurable: true,
    })
  }
})

it("el inicio de sesión espera a la renovación de otra pestaña", async () => {
  const plataformaAnterior = Platform.OS
  Object.defineProperty(Platform, "OS", { value: "web", configurable: true })
  let cola = Promise.resolve()
  Object.defineProperty(globalThis.navigator, "locks", {
    configurable: true,
    value: {
      request: (_nombre: string, _opciones: unknown, accion: () => Promise<unknown>) => {
        const siguiente = cola.then(accion)
        cola = siguiente.then(
          () => undefined,
          () => undefined,
        )
        return siguiente
      },
    },
  })
  let resolverPrimera: (sesion: Awaited<ReturnType<typeof refrescarSesion>>) => void = () =>
    undefined
  jest.mocked(refrescarSesion).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolverPrimera = resolve
      }),
  )
  jest.mocked(iniciarSesion).mockResolvedValue({
    usuario: {
      ...local,
      id: "20000000-0000-4000-8000-000000000000",
      email: "otro@example.test",
      apellidos: null,
      estado: "activo",
    },
    tokenAcceso: "acceso-otro",
    tokenRefresco: "refresco-otro",
  })
  try {
    await render(
      <>
        <ProveedorDeSesion>
          <Visor />
        </ProveedorDeSesion>
        <ProveedorDeSesion>
          <VisorEntrada />
        </ProveedorDeSesion>
      </>,
    )
    await waitFor(() => expect(refrescarSesion).toHaveBeenCalledTimes(1))
    await fireEvent.press(screen.getByRole("button", { name: "Entrar" }))
    expect(iniciarSesion).not.toHaveBeenCalled()

    resolverPrimera({
      usuario: { ...local, email: "cliente@example.test", apellidos: null, estado: "activo" },
      tokenAcceso: "acceso",
      tokenRefresco: "refresco-nuevo",
    })
    await waitFor(() => expect(iniciarSesion).toHaveBeenCalledTimes(1))
  } finally {
    Object.defineProperty(Platform, "OS", { value: plataformaAnterior, configurable: true })
    Reflect.deleteProperty(globalThis.navigator, "locks")
  }
})

it("el cierre de sesión espera a una renovación en curso antes de borrar la credencial", async () => {
  const plataformaAnterior = Platform.OS
  Object.defineProperty(Platform, "OS", { value: "web", configurable: true })
  let cola = Promise.resolve()
  Object.defineProperty(globalThis.navigator, "locks", {
    configurable: true,
    value: {
      request: (_nombre: string, _opciones: unknown, accion: () => Promise<unknown>) => {
        const siguiente = cola.then(accion)
        cola = siguiente.then(
          () => undefined,
          () => undefined,
        )
        return siguiente
      },
    },
  })
  let guardado: string | null = "refresco"
  jest.mocked(leerTokenRefresco).mockImplementation(async () => guardado)
  jest.mocked(guardarTokenRefresco).mockImplementation(async (token) => {
    guardado = token
  })
  jest.mocked(borrarTokenRefresco).mockImplementation(async () => {
    guardado = null
  })
  let resolverSegunda: (sesion: Awaited<ReturnType<typeof refrescarSesion>>) => void = () =>
    undefined
  jest
    .mocked(refrescarSesion)
    .mockResolvedValueOnce({
      usuario: { ...local, email: "cliente@example.test", apellidos: null, estado: "activo" },
      tokenAcceso: "acceso-A",
      tokenRefresco: "refresco-A",
    })
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolverSegunda = resolve
        }),
    )
  try {
    await render(
      <>
        <ProveedorDeSesion>
          <Visor />
        </ProveedorDeSesion>
        <ProveedorDeSesion>
          <Visor />
        </ProveedorDeSesion>
      </>,
    )
    await screen.findByText("dentro")
    await waitFor(() => expect(refrescarSesion).toHaveBeenCalledTimes(2))
    const salirPrimera = screen.getAllByRole("button", { name: "Salir" })[0]
    if (!salirPrimera) throw new Error("Falta el botón de la primera pestaña")
    await fireEvent.press(salirPrimera)
    expect(borrarTokenRefresco).not.toHaveBeenCalled()

    resolverSegunda({
      usuario: { ...local, email: "cliente@example.test", apellidos: null, estado: "activo" },
      tokenAcceso: "acceso-B",
      tokenRefresco: "refresco-B",
    })
    await waitFor(() => expect(borrarTokenRefresco).toHaveBeenCalledTimes(1))
    expect(guardado).toBeNull()
  } finally {
    Object.defineProperty(Platform, "OS", { value: plataformaAnterior, configurable: true })
    Reflect.deleteProperty(globalThis.navigator, "locks")
  }
})
