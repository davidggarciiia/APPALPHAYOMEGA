import { fireEvent, render, screen, waitFor } from "@testing-library/react-native"
import type {
  CrearSolicitudFotos,
  IntencionSubida,
  MedioFoto,
  SolicitarSubida,
  SolicitudFotos,
} from "@alpha-omega/shared"

import { ErrorDeRed } from "../lib/http"
import type { ApiMedios } from "./medios-api"
import { liberarFoto, obtenerFoto } from "./preparar-foto"
import { SolicitudesFotos } from "./solicitudes-fotos"

jest.mock("./preparar-foto", () => ({ obtenerFoto: jest.fn(), liberarFoto: jest.fn() }))

jest.mock("expo-router", () => ({
  useFocusEffect: (efecto: () => void) =>
    jest.requireActual<typeof import("react")>("react").useEffect(efecto, [efecto]),
}))

const CLIENTE = "10000000-0000-4000-8000-000000000000"
const VISITA = "20000000-0000-4000-8000-000000000000"
let contador = 0
const nuevoId = () => `30000000-0000-4000-8000-${String(++contador).padStart(12, "0")}`

// Datos sintéticos.
const medio: MedioFoto = {
  id: "40000000-0000-4000-8000-000000000001",
  clienteId: CLIENTE,
  autor: { id: CLIENTE, nombre: "Cliente" },
  origen: "cliente",
  vista: "frente",
  etiqueta: null,
  fechaToma: "2026-09-25",
  estado: "disponible",
  tipoMime: "image/jpeg",
  bytes: 1000,
  valoracionId: null,
  solicitudId: "50000000-0000-4000-8000-000000000001",
  creadoEn: "2026-09-25T10:00:00.000Z",
  confirmadoEn: "2026-09-25T10:00:05.000Z",
}
function solicitud(cambios: Partial<SolicitudFotos> = {}): SolicitudFotos {
  return {
    id: "50000000-0000-4000-8000-000000000001",
    clienteId: CLIENTE,
    autor: { id: "60000000-0000-4000-8000-000000000001", nombre: "Entrenador" },
    vistas: ["frente", "espalda"],
    fechaLimite: "2026-10-01",
    mensaje: "Con la misma luz",
    estado: "pendiente",
    creadaEn: "2026-09-24T10:00:00.000Z",
    recibidaEn: null,
    revisadaEn: null,
    medios: [],
    ...cambios,
  }
}

function api(lista: SolicitudFotos[] = []) {
  return {
    solicitudes: jest.fn(async () => ({ solicitudes: lista })),
    solicitarSubida: jest.fn(async (_datos: SolicitarSubida): Promise<IntencionSubida> => ({
      medio: { ...medio, estado: "pendiente" },
      subida: null,
    })),
    confirmar: jest.fn(async () => medio),
    vincularFoto: jest.fn(async () => ({ ...medio, valoracionId: VISITA })),
    pedirFotos: jest.fn(async (_c: string, d: CrearSolicitudFotos) =>
      solicitud({ vistas: d.vistas }),
    ),
    revisarSolicitud: jest.fn(async () => solicitud({ estado: "revisada" })),
  } satisfies Pick<
    ApiMedios,
    | "solicitudes"
    | "pedirFotos"
    | "revisarSolicitud"
    | "vincularFoto"
    | "solicitarSubida"
    | "confirmar"
  >
}

it("el entrenador pide vistas concretas y un reintento reutiliza la operación", async () => {
  const falsa = api()
  falsa.pedirFotos.mockRejectedValueOnce(new ErrorDeRed())
  await render(
    <SolicitudesFotos clienteId={CLIENTE} api={falsa} modo="entrenador" nuevoId={nuevoId} />,
  )
  expect(await screen.findByText("Aún no has pedido fotos.")).toBeTruthy()
  await fireEvent.press(screen.getByRole("button", { name: "Pedir fotos al cliente" }))
  await fireEvent.press(screen.getByRole("checkbox", { name: "Espalda" }))
  await fireEvent.changeText(screen.getByLabelText("Fecha límite (AAAA-MM-DD, opcional)"), "1 oct")
  await fireEvent.press(screen.getByRole("button", { name: "Pedir fotos" }))
  expect(screen.getByText(/Escribe la fecha límite como AAAA-MM-DD/)).toBeTruthy()
  expect(falsa.pedirFotos).not.toHaveBeenCalled()
  await fireEvent.changeText(
    screen.getByLabelText("Fecha límite (AAAA-MM-DD, opcional)"),
    "2026-10-01",
  )
  await fireEvent.press(screen.getByRole("button", { name: "Pedir fotos" }))
  expect(await screen.findByText(/No hemos podido conectar/)).toBeTruthy()
  await fireEvent.press(screen.getByRole("button", { name: "Pedir fotos" }))
  await waitFor(() => expect(falsa.pedirFotos).toHaveBeenCalledTimes(2))
  const [primera, segunda] = falsa.pedirFotos.mock.calls
  expect(segunda![1]).toEqual({
    operacionId: primera![1].operacionId,
    vistas: ["frente", "espalda"],
    fechaLimite: "2026-10-01",
    mensaje: null,
  })
})

it("recibida no es revisada: el entrenador la revisa y puede incorporar la foto", async () => {
  const falsa = api([solicitud({ estado: "recibida", medios: [medio] })])
  await render(
    <SolicitudesFotos
      clienteId={CLIENTE}
      api={falsa}
      modo="entrenador"
      nuevoId={nuevoId}
      valoracionAbiertaId={VISITA}
    />,
  )
  expect(await screen.findByText("Recibida, sin revisar")).toBeTruthy()
  await fireEvent.press(
    screen.getByRole("button", { name: "Incorporar Frente a la visita en curso" }),
  )
  await waitFor(() => expect(falsa.vincularFoto).toHaveBeenCalledWith(CLIENTE, VISITA, medio.id))
  await fireEvent.press(await screen.findByRole("button", { name: "Marcar como revisada" }))
  await waitFor(() =>
    expect(falsa.revisarSolicitud).toHaveBeenCalledWith(
      CLIENTE,
      "50000000-0000-4000-8000-000000000001",
      expect.any(String),
    ),
  )
})

it("sin visita en curso no ofrece incorporar", async () => {
  const falsa = api([solicitud({ estado: "recibida", medios: [medio] })])
  await render(
    <SolicitudesFotos clienteId={CLIENTE} api={falsa} modo="entrenador" nuevoId={nuevoId} />,
  )
  await screen.findByText("Recibida, sin revisar")
  expect(screen.queryByRole("button", { name: /Incorporar/ })).toBeNull()
})

it("el cliente ve solo lo pendiente, sin acciones profesionales", async () => {
  const falsa = api([
    solicitud(),
    solicitud({ id: "50000000-0000-4000-8000-000000000002", estado: "revisada" }),
  ])
  await render(
    <SolicitudesFotos clienteId={CLIENTE} api={falsa} modo="cliente" nuevoId={nuevoId} />,
  )
  expect(await screen.findByText("Frente · Espalda")).toBeTruthy()
  expect(screen.getByText("Con la misma luz")).toBeTruthy()
  expect(screen.getAllByText("Pendiente")).toHaveLength(1)
  expect(screen.queryByText("Revisada")).toBeNull()
  expect(screen.queryByRole("button", { name: /Pedir fotos|revisada|Incorporar/ })).toBeNull()
})

it("el cliente aporta la vista pedida y puede continuar con las vistas que falten", async () => {
  const foto = {
    uri: "file:///cache/foto-preparada.jpg",
    tipoMime: "image/jpeg" as const,
    bytes: 1234,
    ancho: 800,
    alto: 1200,
  }
  jest.mocked(obtenerFoto).mockResolvedValue({ tipo: "lista", foto })
  const media = { ...medio, estado: "pendiente" as const }
  const subida = {
    url: "https://storage.example/foto-sintetica",
    metodo: "PUT" as const,
    cabeceras: { "Content-Type": "image/jpeg" },
    caducaEn: "2026-09-24T12:15:00.000Z",
  }
  const falsa = api([solicitud()])
  falsa.solicitarSubida.mockResolvedValueOnce({ medio: media, subida })
  falsa.confirmar.mockResolvedValueOnce({ ...medio, estado: "disponible" })
  const pedir = jest.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
    if (url === foto.uri) return { blob: async () => new Blob(["foto sintética"]) } as Response
    if (url === subida.url) return { ok: true, status: 204 } as Response
    throw new Error(`URL inesperada: ${String(url)}`)
  })

  await render(
    <SolicitudesFotos clienteId={CLIENTE} api={falsa} modo="cliente" nuevoId={nuevoId} />,
  )
  await screen.findByText("Frente · Espalda")
  await fireEvent.press(
    screen.getByRole("button", { name: "Elegir foto de Frente desde la galería" }),
  )

  await waitFor(() => expect(falsa.confirmar).toHaveBeenCalledWith(medio.id))
  expect(falsa.solicitarSubida).toHaveBeenCalledWith({
    operacionId: expect.any(String),
    clienteId: CLIENTE,
    destino: { tipo: "solicitud", solicitudId: solicitud().id },
    vista: "frente",
    etiqueta: null,
    fechaToma: expect.any(String),
    tipoMime: "image/jpeg",
    bytes: foto.bytes,
  })
  expect(pedir).toHaveBeenCalledTimes(2)
  expect(pedir.mock.calls[1]![1]).toMatchObject({ method: "PUT" })
  expect(liberarFoto).toHaveBeenCalledWith(foto.uri)
  expect(
    screen.getByRole("button", { name: "Elegir foto de Espalda desde la galería" }),
  ).toBeTruthy()
  expect(
    screen.queryByRole("button", { name: "Elegir foto de Frente desde la galería" }),
  ).toBeNull()
})

it("reintenta una subida fallida con la misma foto y la misma operación", async () => {
  const foto = {
    uri: "file:///cache/foto-que-se-reintenta.jpg",
    tipoMime: "image/jpeg" as const,
    bytes: 2345,
    ancho: 800,
    alto: 1200,
  }
  jest.mocked(obtenerFoto).mockResolvedValueOnce({ tipo: "lista", foto })
  const pendiente = { ...medio, estado: "pendiente" as const }
  const subida = {
    url: "https://storage.example/foto-reintentable",
    metodo: "PUT" as const,
    cabeceras: { "Content-Type": "image/jpeg" },
    caducaEn: "2026-09-24T12:15:00.000Z",
  }
  const falsa = api([solicitud()])
  falsa.solicitarSubida.mockResolvedValue({ medio: pendiente, subida })
  falsa.confirmar.mockResolvedValue({ ...medio, estado: "disponible" })
  let intentos = 0
  jest.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
    if (url === foto.uri) return { blob: async () => new Blob(["foto sintética"]) } as Response
    if (url === subida.url)
      return { ok: ++intentos > 1, status: intentos > 1 ? 204 : 503 } as Response
    throw new Error(`URL inesperada: ${String(url)}`)
  })

  await render(
    <SolicitudesFotos clienteId={CLIENTE} api={falsa} modo="cliente" nuevoId={nuevoId} />,
  )
  await screen.findByText("Frente · Espalda")
  await fireEvent.press(
    screen.getByRole("button", { name: "Elegir foto de Frente desde la galería" }),
  )
  expect(await screen.findByRole("alert")).toHaveTextContent(/conservamos mientras sigas/)
  const reintentar = await screen.findByRole("button", {
    name: "Reintentar envío de la foto de Frente",
  })
  await fireEvent.press(reintentar)

  await waitFor(() => expect(falsa.confirmar).toHaveBeenCalledTimes(1))
  expect(falsa.solicitarSubida).toHaveBeenCalledTimes(2)
  expect(falsa.solicitarSubida.mock.calls[0]![0].operacionId).toBe(
    falsa.solicitarSubida.mock.calls[1]![0].operacionId,
  )
  expect(obtenerFoto).toHaveBeenCalledTimes(1)
  expect(liberarFoto).toHaveBeenCalledWith(foto.uri)
})
