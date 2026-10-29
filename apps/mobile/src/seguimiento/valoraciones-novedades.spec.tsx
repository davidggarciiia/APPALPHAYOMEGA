import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native"
import type { AvisoSeguimiento, ListadoAvisosSeguimiento } from "@alpha-omega/shared"

import { AvisosSeguimiento } from "./valoraciones-novedades"

let mockEnFoco = true
jest.mock("expo-router", () => ({
  useFocusEffect: (efecto: () => void) =>
    jest
      .requireActual<typeof import("react")>("react")
      .useEffect(() => (mockEnFoco ? efecto() : undefined), [efecto, mockEnFoco]),
}))

beforeEach(() => {
  mockEnFoco = true
})

// Datos sintéticos.
const CLIENTE = "10000000-0000-4000-8000-000000000000"
const ENTRENADORA = { id: "20000000-0000-4000-8000-000000000000", nombre: "Ana García" }
const CLIENTA = { id: CLIENTE, nombre: "Lucía Pérez" }
let contador = 0
function aviso(cambios: Partial<AvisoSeguimiento> = {}): AvisoSeguimiento {
  contador += 1
  const id = `30000000-0000-4000-8000-${String(contador).padStart(12, "0")}`
  return {
    id,
    tipo: "valoracionPublicada",
    clienteId: CLIENTE,
    autor: ENTRENADORA,
    // 00:30 del jueves 24 en Madrid: la fecha visible es la de la agenda, no la UTC.
    creadoEn: "2026-09-23T22:30:00.000Z",
    destino: { tipo: "valoracion", valoracionId: "40000000-0000-4000-8000-000000000000" },
    vigente: true,
    leidoEn: null,
    ...cambios,
  }
}

/** Servidor falso: guarda la lectura por aviso y la devuelve en cada consulta. */
function servidor(inicial: AvisoSeguimiento[]) {
  let avisos = inicial
  const listado = (): ListadoAvisosSeguimiento => ({
    avisos,
    sinLeer: avisos.filter((a) => a.vigente && a.leidoEn === null).length,
  })
  return {
    avisos: jest.fn(async (_clienteId: string) => listado()),
    leerAvisos: jest.fn(async (_clienteId: string, ids: string[]) => {
      avisos = avisos.map((a) =>
        ids.includes(a.id) && a.leidoEn === null
          ? { ...a, leidoEn: "2026-09-24T12:00:00.000Z" }
          : a,
      )
      return listado()
    }),
  }
}

function pintar(
  api: ReturnType<typeof servidor>,
  modo: "cliente" | "entrenador" = "cliente",
  abrir = jest.fn(),
  alLeer?: (listado: ListadoAvisosSeguimiento) => void,
) {
  return render(
    <AvisosSeguimiento clienteId={CLIENTE} api={api} modo={modo} abrir={abrir} alLeer={alLeer} />,
  )
}

it("deja el grupo vacío en Notificaciones cuando no hay avisos", async () => {
  const api = servidor([])
  await pintar(api)
  await waitFor(() => expect(api.avisos).toHaveBeenCalledWith(CLIENTE))
  expect(screen.queryByText(/Avisos de seguimiento/)).toBeNull()
  expect(screen.queryByRole("alert")).toBeNull()
})

it("muestra la valoración publicada con autor, fecha legible y recuento sin leer", async () => {
  const api = servidor([aviso()])
  await pintar(api)
  expect(await screen.findByText("Ana García publicó tu valoración")).toBeTruthy()
  expect(screen.getByText("jueves, 24 sept")).toBeTruthy()
  expect(screen.getByText("1 aviso sin leer")).toBeTruthy()
  expect(screen.queryByRole("header", { name: "Avisos de seguimiento" })).toBeNull()
  expect(screen.getByText("Nueva")).toBeTruthy()
  expect(
    screen.getByRole("button", {
      name: "Ana García publicó tu valoración, jueves, 24 sept, sin leer",
    }),
  ).toBeTruthy()
})

it("muestra la corrección como accionable y la versión sustituida solo como historial", async () => {
  const corregida = aviso({ tipo: "valoracionCorregida", creadoEn: "2026-09-24T10:00:00.000Z" })
  const original = aviso({ vigente: false, creadoEn: "2026-09-20T10:00:00.000Z" })
  const api = servidor([corregida, original])
  const abrir = jest.fn()
  await pintar(api, "cliente", abrir)

  expect(
    await screen.findByRole("button", { name: /Ana García corrigió tu valoración/ }),
  ).toBeTruthy()
  expect(screen.getByText("Sustituida por una corrección")).toBeTruthy()
  expect(screen.queryByRole("button", { name: /publicó tu valoración/ })).toBeNull()
  expect(screen.getByLabelText(/publicó tu valoración.*sustituida por una corrección/)).toBeTruthy()
  // La sustituida no cuenta como pendiente ni se abre.
  expect(screen.getByText("1 aviso sin leer")).toBeTruthy()
  await fireEvent.press(screen.getByText("Ana García publicó tu valoración"))
  expect(api.leerAvisos).not.toHaveBeenCalled()
  expect(abrir).not.toHaveBeenCalled()
})

it("muestra la solicitud de fotos pendiente y la ya enviada sin acción", async () => {
  const pendiente = aviso({
    tipo: "fotosSolicitadas",
    destino: { tipo: "solicitud", solicitudId: "50000000-0000-4000-8000-000000000001" },
  })
  const enviada = aviso({
    tipo: "fotosSolicitadas",
    vigente: false,
    creadoEn: "2026-09-01T10:00:00.000Z",
    destino: { tipo: "solicitud", solicitudId: "50000000-0000-4000-8000-000000000002" },
  })
  const api = servidor([pendiente, enviada])
  await pintar(api)

  expect(
    await screen.findAllByRole("button", { name: /Ana García te pidió fotos, jueves, 24 sept/ }),
  ).toHaveLength(1)
  expect(screen.getByText("Ya enviadas")).toBeTruthy()
  expect(screen.getByLabelText(/te pidió fotos, martes, 1 sept, ya enviadas/)).toBeTruthy()
  // El cliente no ve controles profesionales.
  expect(screen.queryByRole("button", { name: /revis|pedir fotos|publicar|corregir/i })).toBeNull()
})

it("avisa al entrenador de fotos recibidas; abrir el aviso no las revisa", async () => {
  const recibidas = aviso({
    tipo: "fotosRecibidas",
    autor: CLIENTA,
    destino: { tipo: "solicitud", solicitudId: "50000000-0000-4000-8000-000000000003" },
  })
  const revisadas = aviso({
    tipo: "fotosRecibidas",
    autor: CLIENTA,
    vigente: false,
    creadoEn: "2026-09-10T10:00:00.000Z",
    destino: { tipo: "solicitud", solicitudId: "50000000-0000-4000-8000-000000000004" },
  })
  const api = servidor([recibidas, revisadas])
  const abrir = jest.fn()
  await pintar(api, "entrenador", abrir)

  await fireEvent.press(await screen.findByRole("button", { name: /Lucía Pérez envió fotos/ }))
  await waitFor(() => expect(abrir).toHaveBeenCalledWith(recibidas))
  expect(api.leerAvisos).toHaveBeenCalledWith(CLIENTE, [recibidas.id])
  expect(screen.getByText("Ya revisadas")).toBeTruthy()
  expect(screen.queryByRole("button", { name: /revisadas/ })).toBeNull()
})

it("marca leído antes de abrir y la lectura persiste al volver", async () => {
  const publicada = aviso()
  const api = servidor([publicada])
  const abrir = jest.fn()
  const alLeer = jest.fn()
  const vista = await pintar(api, "cliente", abrir, alLeer)

  await fireEvent.press(await screen.findByRole("button", { name: /publicó tu valoración/ }))
  await waitFor(() => expect(abrir).toHaveBeenCalledWith(publicada))
  expect(api.leerAvisos).toHaveBeenCalledWith(CLIENTE, [publicada.id])
  expect(api.leerAvisos.mock.invocationCallOrder[0]).toBeLessThan(
    abrir.mock.invocationCallOrder[0]!,
  )
  expect(alLeer).toHaveBeenCalledWith({
    avisos: [{ ...publicada, leidoEn: "2026-09-24T12:00:00.000Z" }],
    sinLeer: 0,
  })
  expect(alLeer.mock.invocationCallOrder[0]).toBeLessThan(abrir.mock.invocationCallOrder[0]!)
  expect(screen.queryByText("Nueva")).toBeNull()
  expect(screen.queryByText(/sin leer/)).toBeNull()

  // Volver o iniciar sesión otra vez: la lectura viene del servidor.
  await vista.unmount()
  await pintar(api, "cliente", abrir)
  expect(
    await screen.findByRole("button", {
      name: "Ana García publicó tu valoración, jueves, 24 sept",
    }),
  ).toBeTruthy()
  expect(screen.queryByText("Nueva")).toBeNull()
  // Abrir un aviso ya leído no vuelve a guardar la lectura.
  await fireEvent.press(screen.getByRole("button", { name: /publicó tu valoración/ }))
  await waitFor(() => expect(abrir).toHaveBeenCalledTimes(2))
  expect(api.leerAvisos).toHaveBeenCalledTimes(1)
})

it("si no se guarda la lectura abre igualmente, conserva el aviso sin leer y permite reintentar", async () => {
  const publicada = aviso()
  const api = servidor([publicada])
  api.leerAvisos.mockRejectedValueOnce(new Error("sin red"))
  const abrir = jest.fn()
  await pintar(api, "cliente", abrir)

  await fireEvent.press(await screen.findByRole("button", { name: /publicó tu valoración/ }))
  await waitFor(() => expect(abrir).toHaveBeenCalledWith(publicada))
  expect(await screen.findByRole("alert")).toHaveTextContent(/No se pudo guardar/)
  expect(screen.getByText("Nueva")).toBeTruthy()
  expect(screen.getByText("1 aviso sin leer")).toBeTruthy()

  await fireEvent.press(
    screen.getByRole("button", { name: "Reintentar guardar la lectura de los avisos" }),
  )
  await waitFor(() => expect(screen.queryByText("Nueva")).toBeNull())
  expect(api.leerAvisos).toHaveBeenLastCalledWith(CLIENTE, [publicada.id])
  expect(screen.queryByRole("alert")).toBeNull()
  expect(abrir).toHaveBeenCalledTimes(1)
})

it("si falla la carga lo explica y permite reintentar", async () => {
  const api = servidor([aviso({ tipo: "fotosSolicitadas" })])
  api.avisos.mockRejectedValueOnce(new Error("sin red"))
  await pintar(api)

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "No se pudieron cargar los avisos de seguimiento.",
  )
  await fireEvent.press(
    screen.getByRole("button", { name: "Reintentar cargar los avisos de seguimiento" }),
  )
  expect(await screen.findByText("Ana García te pidió fotos")).toBeTruthy()
  expect(api.avisos).toHaveBeenCalledTimes(2)
  expect(screen.queryByRole("alert")).toBeNull()
})

it("enseña los avisos de ocho en ocho", async () => {
  const lista = Array.from({ length: 9 }, (_, i) =>
    aviso({ creadoEn: `2026-09-${String(20 - i).padStart(2, "0")}T10:00:00.000Z` }),
  )
  await pintar(servidor(lista))
  expect(await screen.findAllByRole("button", { name: /publicó tu valoración/ })).toHaveLength(8)
  await fireEvent.press(screen.getByRole("button", { name: "Ver más avisos" }))
  expect(screen.getAllByRole("button", { name: /publicó tu valoración/ })).toHaveLength(9)
  expect(screen.queryByRole("button", { name: "Ver más avisos" })).toBeNull()
})

function diferida<T>() {
  let resolver!: (valor: T) => void
  let rechazar!: (error: Error) => void
  const promesa = new Promise<T>((resolve, reject) => {
    resolver = resolve
    rechazar = reject
  })
  return { promesa, resolver, rechazar }
}

it.each(["resolver", "rechazar"] as const)(
  "no abre tras desmontar mientras la lectura está pendiente (%s)",
  async (resultado) => {
    const publicada = aviso()
    const api = servidor([publicada])
    const pendiente = diferida<ListadoAvisosSeguimiento>()
    api.leerAvisos.mockReturnValueOnce(pendiente.promesa)
    const abrir = jest.fn()
    const alLeer = jest.fn()
    const vista = await pintar(api, "cliente", abrir, alLeer)
    await fireEvent.press(await screen.findByRole("button", { name: /publicó tu valoración/ }))
    await vista.unmount()
    await act(async () => {
      if (resultado === "resolver")
        pendiente.resolver({
          avisos: [{ ...publicada, leidoEn: "2026-09-24T12:00:00.000Z" }],
          sinLeer: 0,
        })
      else pendiente.rechazar(new Error("sin red"))
    })
    expect(abrir).not.toHaveBeenCalled()
    expect(alLeer).not.toHaveBeenCalled()
  },
)

it.each(["resolver", "rechazar"] as const)(
  "descarta la lectura de una visita anterior tras perder y recuperar el foco (%s)",
  async (resultado) => {
    const publicada = aviso()
    const api = servidor([publicada])
    const pendiente = diferida<ListadoAvisosSeguimiento>()
    api.leerAvisos.mockReturnValueOnce(pendiente.promesa)
    const abrir = jest.fn()
    const vista = await pintar(api, "cliente", abrir)
    const componente = () => (
      <AvisosSeguimiento clienteId={CLIENTE} api={api} modo="cliente" abrir={abrir} />
    )
    await fireEvent.press(await screen.findByRole("button", { name: /publicó tu valoración/ }))
    mockEnFoco = false
    await vista.rerender(componente())
    mockEnFoco = true
    await vista.rerender(componente())
    await act(async () => {
      if (resultado === "resolver")
        pendiente.resolver({
          avisos: [{ ...publicada, leidoEn: "2026-09-24T12:00:00.000Z" }],
          sinLeer: 0,
        })
      else pendiente.rechazar(new Error("sin red"))
    })
    expect(abrir).not.toHaveBeenCalled()
    expect(screen.getByText("Nueva")).toBeOnTheScreen()
    expect(screen.queryByRole("alert")).toBeNull()
    const boton = screen.getByRole("button", { name: /publicó tu valoración/ })
    expect(boton).toBeEnabled()
    await fireEvent.press(boton)
    await waitFor(() => expect(abrir).toHaveBeenCalledTimes(1))
  },
)

it.each(["resolver", "rechazar"] as const)(
  "cambiar de cliente libera la apertura y descarta la lectura anterior (%s)",
  async (resultado) => {
    const publicada = aviso()
    const otroId = "10000000-0000-4000-8000-000000000001"
    const otra = aviso({ clienteId: otroId, autor: { ...ENTRENADORA, nombre: "Beatriz Ruiz" } })
    const api = servidor([publicada])
    api.avisos.mockImplementation(async (id) => ({
      avisos: id === CLIENTE ? [publicada] : [otra],
      sinLeer: 1,
    }))
    const pendiente = diferida<ListadoAvisosSeguimiento>()
    api.leerAvisos.mockReturnValueOnce(pendiente.promesa)
    const abrir = jest.fn()
    const alLeer = jest.fn()
    const vista = await pintar(api, "cliente", abrir, alLeer)
    await fireEvent.press(
      await screen.findByRole("button", { name: /Ana García publicó tu valoración/ }),
    )
    await vista.rerender(
      <AvisosSeguimiento
        clienteId={otroId}
        api={api}
        modo="cliente"
        abrir={abrir}
        alLeer={alLeer}
      />,
    )
    expect(
      await screen.findByRole("button", { name: /Beatriz Ruiz publicó tu valoración/ }),
    ).toBeEnabled()
    await act(async () => {
      if (resultado === "resolver")
        pendiente.resolver({
          avisos: [{ ...publicada, leidoEn: "2026-09-24T12:00:00.000Z" }],
          sinLeer: 0,
        })
      else pendiente.rechazar(new Error("sin red"))
    })
    expect(abrir).not.toHaveBeenCalled()
    expect(alLeer).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: /Beatriz Ruiz publicó tu valoración/ })).toBeEnabled()
    expect(screen.getByText("Nueva")).toBeOnTheScreen()
    expect(screen.queryByRole("alert")).toBeNull()
  },
)
