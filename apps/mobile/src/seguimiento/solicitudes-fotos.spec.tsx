import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native"
import type {
  CrearSolicitudFotos,
  IntencionSubida,
  MedioFoto,
  SolicitarSubida,
  SolicitudFotos,
} from "@alpha-omega/shared"

import { ErrorDePeticion, ErrorDeRed } from "../lib/http"
import type { ApiMedios } from "./medios-api"
import { liberarFoto, obtenerFoto } from "./preparar-foto"
import { SolicitudesFotos } from "./solicitudes-fotos"

jest.mock("./preparar-foto", () => ({ obtenerFoto: jest.fn(), liberarFoto: jest.fn() }))

// Pantallas montadas: `volverALaPantalla` repite el efecto de foco como al
// regresar a ella desde otra pestaña (limpia el anterior y vuelve a leer).
const mockEnfoques = new Set<() => void>()
jest.mock("expo-router", () => ({
  useFocusEffect: (efecto: () => void | (() => void)) => {
    const { useEffect, useState } = jest.requireActual<typeof import("react")>("react")
    const [foco, setFoco] = useState(0)
    useEffect(() => {
      const enfocar = (): void => setFoco((n) => n + 1)
      mockEnfoques.add(enfocar)
      return () => {
        mockEnfoques.delete(enfocar)
      }
    }, [])
    useEffect(efecto, [efecto, foco])
  },
}))

async function volverALaPantalla(): Promise<void> {
  await act(async () => {
    for (const enfocar of mockEnfoques) enfocar()
  })
}

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

it("conserva el contenido exacto de una solicitud sin respuesta antes de permitir otra", async () => {
  const falsa = api()
  falsa.pedirFotos.mockRejectedValueOnce(new ErrorDeRed())
  await render(
    <SolicitudesFotos clienteId={CLIENTE} api={falsa} modo="entrenador" nuevoId={nuevoId} />,
  )
  await screen.findByText("Aún no has pedido fotos.")
  await fireEvent.press(screen.getByRole("button", { name: "Pedir fotos al cliente" }))
  await fireEvent.changeText(
    screen.getByLabelText("Indicación para el cliente (opcional)"),
    "Luz A",
  )
  await fireEvent.press(screen.getByRole("button", { name: "Pedir fotos" }))
  await screen.findByText(/No hemos podido conectar/)
  expect(screen.getByLabelText("Indicación para el cliente (opcional)")).toBeDisabled()
  expect(screen.getByRole("checkbox", { name: "Espalda" })).toBeDisabled()
  await fireEvent.press(screen.getByRole("button", { name: "Pedir fotos" }))
  await waitFor(() => expect(falsa.pedirFotos).toHaveBeenCalledTimes(2))
  expect(falsa.pedirFotos.mock.calls[1]![1]).toEqual(falsa.pedirFotos.mock.calls[0]![1])
  await fireEvent.press(await screen.findByRole("button", { name: "Pedir fotos al cliente" }))
  await fireEvent.changeText(
    screen.getByLabelText("Indicación para el cliente (opcional)"),
    "Luz B",
  )
  await fireEvent.press(screen.getByRole("button", { name: "Pedir fotos" }))
  await waitFor(() => expect(falsa.pedirFotos).toHaveBeenCalledTimes(3))
  expect(falsa.pedirFotos.mock.calls[2]![1].operacionId).not.toBe(
    falsa.pedirFotos.mock.calls[0]![1].operacionId,
  )
})

it("permite corregir una solicitud rechazada por validación antes de crearla", async () => {
  const falsa = api()
  falsa.pedirFotos.mockRejectedValueOnce(
    new ErrorDePeticion({
      statusCode: 400,
      codigo: "solicitud_invalida",
      message: "Fecha inválida",
    }),
  )
  await render(
    <SolicitudesFotos clienteId={CLIENTE} api={falsa} modo="entrenador" nuevoId={nuevoId} />,
  )
  await screen.findByText("Aún no has pedido fotos.")
  await fireEvent.press(screen.getByRole("button", { name: "Pedir fotos al cliente" }))
  await fireEvent.press(screen.getByRole("button", { name: "Pedir fotos" }))
  await waitFor(() => expect(falsa.pedirFotos).toHaveBeenCalled())
  expect(screen.getByLabelText("Indicación para el cliente (opcional)")).toBeEnabled()
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

/**
 * RI07b · Ciclo de vida de la copia local. La foto preparada solo existe en el
 * móvil hasta que el servidor confirma el medio: se conserva mientras permita
 * reintentar y se suelta al confirmarse, descartarse o salir de la pantalla,
 * nunca mientras un envío la está usando.
 */
describe("copia local de la foto (RI07b)", () => {
  const SUBIDA = {
    url: "https://storage.example/foto-ri07b",
    metodo: "PUT" as const,
    cabeceras: { "Content-Type": "image/jpeg" },
    caducaEn: "2026-09-24T12:15:00.000Z",
  }
  const enviando = { ...medio, estado: "pendiente" as const }

  it("una subida colgada caduca, conserva la foto y reintenta con la misma operación", async () => {
    const foto = fotoSintetica("timeout")
    jest.mocked(obtenerFoto).mockResolvedValueOnce({ tipo: "lista", foto })
    let intentos = 0
    jest.spyOn(globalThis, "fetch").mockImplementation(async (url, opciones) => {
      if (String(url).startsWith("file:///"))
        return { blob: async () => new Blob(["foto"]) } as Response
      if (++intentos > 1) return correcta
      return new Promise<Response>((_resolver, rechazar) =>
        opciones?.signal?.addEventListener("abort", () => rechazar(new Error("Cancelada")), {
          once: true,
        }),
      )
    })
    const falsa = api([solicitud()])
    falsa.solicitarSubida.mockResolvedValue({ medio: enviando, subida: SUBIDA })
    await pantallaCliente(falsa)
    jest.useFakeTimers()
    try {
      await fireEvent.press(elegirDeGaleria("Frente"))
      await act(async () => {
        await jest.advanceTimersByTimeAsync(30_001)
      })
      await fireEvent.press(
        await screen.findByRole("button", { name: "Reintentar envío de la foto de Frente" }),
      )
      await waitFor(() => expect(falsa.confirmar).toHaveBeenCalledTimes(1))
      expect(falsa.solicitarSubida.mock.calls[1]![0]).toEqual(
        falsa.solicitarSubida.mock.calls[0]![0],
      )
      expect(obtenerFoto).toHaveBeenCalledTimes(1)
    } finally {
      jest.useRealTimers()
    }
  })

  it("salir aborta el PUT pendiente y libera la copia sin confirmar la foto", async () => {
    const foto = fotoSintetica("cancelada")
    jest.mocked(obtenerFoto).mockResolvedValueOnce({ tipo: "lista", foto })
    let senal: AbortSignal | null | undefined
    jest.spyOn(globalThis, "fetch").mockImplementation(async (url, opciones) => {
      if (String(url).startsWith("file:///"))
        return { blob: async () => new Blob(["foto"]) } as Response
      senal = opciones?.signal
      return new Promise<Response>((_resolver, rechazar) =>
        senal?.addEventListener("abort", () => rechazar(new Error("Cancelada")), { once: true }),
      )
    })
    const falsa = api([solicitud()])
    falsa.solicitarSubida.mockResolvedValue({ medio: enviando, subida: SUBIDA })
    const vista = await pantallaCliente(falsa)
    await fireEvent.press(elegirDeGaleria("Frente"))
    await waitFor(() => expect(senal).toBeDefined())
    await vista.unmount()
    expect(senal?.aborted).toBe(true)
    await waitFor(() => expect(liberarFoto).toHaveBeenCalledWith(foto.uri))
    expect(falsa.confirmar).not.toHaveBeenCalled()
  })

  function fotoSintetica(nombre: string) {
    return {
      uri: `file:///cache/ImageManipulator/${nombre}.jpg`,
      tipoMime: "image/jpeg" as const,
      bytes: 1000 + nombre.length,
      ancho: 800,
      alto: 1200,
    }
  }

  function diferida<T>() {
    let resolver!: (valor: T) => void
    const promesa = new Promise<T>((res) => {
      resolver = res
    })
    return { promesa, resolver }
  }

  const correcta = { ok: true, status: 204 } as Response
  const caida = { ok: false, status: 503 } as Response

  /** Lectura de la copia local y PUT al almacén; `put` decide cada respuesta. */
  function almacen(put: () => Promise<Response> | Response) {
    return jest.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (typeof url === "string" && url.startsWith("file:///"))
        return { blob: async () => new Blob(["foto sintética"]) } as Response
      if (url === SUBIDA.url) return put()
      throw new Error(`URL inesperada: ${String(url)}`)
    })
  }

  async function pantallaCliente(falsa: ReturnType<typeof api>) {
    const vista = await render(
      <SolicitudesFotos clienteId={CLIENTE} api={falsa} modo="cliente" nuevoId={nuevoId} />,
    )
    await screen.findByText("Frente · Espalda")
    return vista
  }

  const elegirDeGaleria = (vista: string) =>
    screen.getByRole("button", { name: `Elegir foto de ${vista} desde la galería` })

  /**
   * Dos toques antes de que React vuelva a pintar: el `onPress` del botón (se
   * busca como lo hace `fireEvent`) se llama dos veces dentro del mismo `act`.
   */
  async function dosToquesSeguidos(boton: ReturnType<typeof screen.getByRole>): Promise<void> {
    let fibra = boton.unstable_fiber?.return ?? null
    let pulsar: unknown
    while (fibra && typeof fibra.type !== "string" && typeof pulsar !== "function") {
      pulsar = (fibra.memoizedProps as { onPress?: unknown } | null)?.onPress
      fibra = fibra.return
    }
    if (typeof pulsar !== "function") throw new Error("El botón no tiene onPress")
    await act(async () => {
      pulsar()
      pulsar()
    })
  }

  beforeEach(() => {
    jest.mocked(obtenerFoto).mockReset()
    jest.mocked(liberarFoto).mockReset()
  })

  it("con éxito, la copia se conserva durante la subida y se suelta al confirmarse", async () => {
    const foto = fotoSintetica("exito")
    jest.mocked(obtenerFoto).mockResolvedValueOnce({ tipo: "lista", foto })
    const put = diferida<Response>()
    almacen(() => put.promesa)
    const falsa = api([solicitud()])
    falsa.solicitarSubida.mockResolvedValue({ medio: enviando, subida: SUBIDA })
    await pantallaCliente(falsa)

    await fireEvent.press(elegirDeGaleria("Frente"))
    expect(await screen.findByText("Subiendo foto…")).toBeTruthy()
    expect(liberarFoto).not.toHaveBeenCalled()

    await act(async () => put.resolver(correcta))
    await waitFor(() => expect(liberarFoto).toHaveBeenCalledTimes(1))
    expect(liberarFoto).toHaveBeenCalledWith(foto.uri)
    expect(falsa.confirmar).toHaveBeenCalledTimes(1)
    expect(screen.getByText(/Frente · enviada el/)).toBeTruthy()
  })

  it("dos pulsaciones seguidas en reintentar hacen un solo envío y no sueltan la copia en uso", async () => {
    const foto = fotoSintetica("doble-pulsacion")
    jest.mocked(obtenerFoto).mockResolvedValueOnce({ tipo: "lista", foto })
    const segundo = diferida<Response>()
    let puts = 0
    almacen(() => (++puts === 1 ? caida : segundo.promesa))
    const falsa = api([solicitud()])
    falsa.solicitarSubida.mockResolvedValue({ medio: enviando, subida: SUBIDA })
    await pantallaCliente(falsa)

    await fireEvent.press(elegirDeGaleria("Frente"))
    const reintentar = await screen.findByRole("button", {
      name: "Reintentar envío de la foto de Frente",
    })
    // Fallar no suelta la copia: es la que se vuelve a enviar.
    expect(liberarFoto).not.toHaveBeenCalled()

    await dosToquesSeguidos(reintentar)
    await waitFor(() => expect(falsa.solicitarSubida).toHaveBeenCalledTimes(2))
    expect(liberarFoto).not.toHaveBeenCalled()

    await act(async () => segundo.resolver(correcta))
    await waitFor(() => expect(falsa.confirmar).toHaveBeenCalledTimes(1))
    expect(falsa.solicitarSubida).toHaveBeenCalledTimes(2)
    const [primera, reintento] = falsa.solicitarSubida.mock.calls
    expect(reintento![0]).toEqual(primera![0])
    expect(obtenerFoto).toHaveBeenCalledTimes(1)
    expect(jest.mocked(liberarFoto).mock.calls).toEqual([[foto.uri]])
  })

  it("elegir otra imagen tras un fallo suelta la anterior y envía la nueva con otra operación", async () => {
    const primera = fotoSintetica("primera")
    const otra = fotoSintetica("otra-imagen")
    jest
      .mocked(obtenerFoto)
      .mockResolvedValueOnce({ tipo: "lista", foto: primera })
      .mockResolvedValueOnce({ tipo: "lista", foto: otra })
    let puts = 0
    almacen(() => (++puts === 1 ? caida : correcta))
    const falsa = api([solicitud()])
    falsa.solicitarSubida.mockResolvedValue({ medio: enviando, subida: SUBIDA })
    await pantallaCliente(falsa)

    await fireEvent.press(elegirDeGaleria("Frente"))
    await fireEvent.press(
      await screen.findByRole("button", { name: "Descartar la foto de Frente sin enviarla" }),
    )
    // Descartada: su copia sale del móvil y la lista se vuelve a pedir al
    // servidor por si el envío llegó a confirmarse sin respuesta.
    expect(jest.mocked(liberarFoto).mock.calls).toEqual([[primera.uri]])
    await waitFor(() => expect(falsa.solicitudes).toHaveBeenCalledTimes(2))
    expect(screen.queryByRole("button", { name: /Reintentar envío/ })).toBeNull()

    await fireEvent.press(await screen.findByRole("button", { name: /Elegir foto de Frente/ }))
    await waitFor(() => expect(falsa.confirmar).toHaveBeenCalledTimes(1))
    const [intento, nuevo] = falsa.solicitarSubida.mock.calls
    expect(nuevo![0].operacionId).not.toBe(intento![0].operacionId)
    expect(nuevo![0].bytes).toBe(otra.bytes)
    expect(jest.mocked(liberarFoto).mock.calls).toEqual([[primera.uri], [otra.uri]])
  })

  it("mientras una foto espera reintento, las demás vistas no ofrecen un botón sin efecto", async () => {
    jest
      .mocked(obtenerFoto)
      .mockResolvedValueOnce({ tipo: "lista", foto: fotoSintetica("en-espera") })
    almacen(() => caida)
    const falsa = api([solicitud()])
    falsa.solicitarSubida.mockResolvedValue({ medio: enviando, subida: SUBIDA })
    await pantallaCliente(falsa)

    await fireEvent.press(elegirDeGaleria("Frente"))
    await screen.findByRole("button", { name: "Reintentar envío de la foto de Frente" })

    expect(elegirDeGaleria("Espalda")).toBeDisabled()
    expect(
      screen.getByRole("button", { name: "Hacer foto de Espalda con la cámara" }),
    ).toBeDisabled()
    await fireEvent.press(elegirDeGaleria("Espalda"))
    expect(obtenerFoto).toHaveBeenCalledTimes(1)
  })

  it("cancelar el selector no envía ni suelta nada y deja elegir otra vez", async () => {
    jest.mocked(obtenerFoto).mockResolvedValueOnce({ tipo: "cancelada" })
    const falsa = api([solicitud()])
    await pantallaCliente(falsa)

    await fireEvent.press(elegirDeGaleria("Frente"))

    await waitFor(() => expect(elegirDeGaleria("Frente")).toBeEnabled())
    expect(falsa.solicitarSubida).not.toHaveBeenCalled()
    expect(liberarFoto).not.toHaveBeenCalled()
    expect(screen.queryByRole("alert")).toBeNull()
  })

  it("una preparación que termina después de salir suelta su copia y no la envía", async () => {
    const foto = fotoSintetica("tardia")
    const preparacion = diferida<Awaited<ReturnType<typeof obtenerFoto>>>()
    jest.mocked(obtenerFoto).mockReturnValueOnce(preparacion.promesa)
    const falsa = api([solicitud()])
    const vista = await pantallaCliente(falsa)

    await fireEvent.press(elegirDeGaleria("Frente"))
    await vista.unmount()
    await act(async () => preparacion.resolver({ tipo: "lista", foto }))

    await waitFor(() => expect(liberarFoto).toHaveBeenCalledWith(foto.uri))
    expect(liberarFoto).toHaveBeenCalledTimes(1)
    expect(falsa.solicitarSubida).not.toHaveBeenCalled()
  })

  it.each([
    { caso: "termina bien", respuesta: correcta, confirmaciones: 0 },
    { caso: "falla", respuesta: caida, confirmaciones: 0 },
  ])(
    "salir durante la subida no borra la copia en uso; se suelta cuando el envío $caso",
    async ({ respuesta, confirmaciones }) => {
      const foto = fotoSintetica("salida-durante-subida")
      jest.mocked(obtenerFoto).mockResolvedValueOnce({ tipo: "lista", foto })
      const put = diferida<Response>()
      almacen(() => put.promesa)
      const falsa = api([solicitud()])
      falsa.solicitarSubida.mockResolvedValue({ medio: enviando, subida: SUBIDA })
      const vista = await pantallaCliente(falsa)

      await fireEvent.press(elegirDeGaleria("Frente"))
      await screen.findByText("Subiendo foto…")
      await vista.unmount()
      expect(liberarFoto).not.toHaveBeenCalled()

      await act(async () => put.resolver(respuesta))
      await waitFor(() => expect(liberarFoto).toHaveBeenCalledTimes(1))
      expect(liberarFoto).toHaveBeenCalledWith(foto.uri)
      expect(falsa.confirmar).toHaveBeenCalledTimes(confirmaciones)
    },
  )

  it("salir con una foto a la espera de reintento la suelta", async () => {
    const foto = fotoSintetica("sin-reintentar")
    jest.mocked(obtenerFoto).mockResolvedValueOnce({ tipo: "lista", foto })
    almacen(() => caida)
    const falsa = api([solicitud()])
    falsa.solicitarSubida.mockResolvedValue({ medio: enviando, subida: SUBIDA })
    const vista = await pantallaCliente(falsa)

    await fireEvent.press(elegirDeGaleria("Frente"))
    await screen.findByRole("button", { name: "Reintentar envío de la foto de Frente" })
    expect(liberarFoto).not.toHaveBeenCalled()
    await vista.unmount()

    expect(jest.mocked(liberarFoto).mock.calls).toEqual([[foto.uri]])
  })

  it("varias vistas de una solicitud se envían cada una con su operación y su copia", async () => {
    const frente = fotoSintetica("vista-frente")
    const espalda = fotoSintetica("vista-espalda")
    jest
      .mocked(obtenerFoto)
      .mockResolvedValueOnce({ tipo: "lista", foto: frente })
      .mockResolvedValueOnce({ tipo: "lista", foto: espalda })
    const falsa = api([solicitud()])
    const ids = {
      frente: "40000000-0000-4000-8000-000000000011",
      espalda: "40000000-0000-4000-8000-000000000012",
    }
    falsa.solicitarSubida.mockImplementation(async (datos) => {
      const vista = datos.vista === "frente" ? "frente" : "espalda"
      return { medio: { ...enviando, id: ids[vista], vista }, subida: null }
    })
    falsa.confirmar
      .mockResolvedValueOnce({ ...medio, id: ids.frente, vista: "frente" })
      .mockResolvedValueOnce({ ...medio, id: ids.espalda, vista: "espalda" })
    await pantallaCliente(falsa)

    await fireEvent.press(elegirDeGaleria("Frente"))
    await screen.findByText(/Frente · enviada el/)
    await fireEvent.press(elegirDeGaleria("Espalda"))
    await screen.findByText(/Espalda · enviada el/)

    const [uno, dos] = falsa.solicitarSubida.mock.calls
    expect(uno![0]).toMatchObject({ vista: "frente", bytes: frente.bytes })
    expect(dos![0]).toMatchObject({ vista: "espalda", bytes: espalda.bytes })
    expect(dos![0].operacionId).not.toBe(uno![0].operacionId)
    expect(falsa.confirmar).toHaveBeenNthCalledWith(1, ids.frente)
    expect(falsa.confirmar).toHaveBeenNthCalledWith(2, ids.espalda)
    expect(jest.mocked(liberarFoto).mock.calls).toEqual([[frente.uri], [espalda.uri]])
    // Confirmadas en el servidor: ya no se ofrece volver a enviarlas.
    expect(screen.getByText("Recibida, sin revisar")).toBeTruthy()
    expect(screen.queryByRole("button", { name: /Elegir foto de|Hacer foto de/ })).toBeNull()
  })

  it("si el móvil no deja borrar la copia, se vuelve a intentar al salir de la pantalla", async () => {
    const foto = fotoSintetica("borrado-fallido")
    jest.mocked(obtenerFoto).mockResolvedValueOnce({ tipo: "lista", foto })
    jest.mocked(liberarFoto).mockReturnValueOnce("fallo")
    const falsa = api([solicitud()])
    const vista = await pantallaCliente(falsa)

    await fireEvent.press(elegirDeGaleria("Frente"))
    await screen.findByText(/Frente · enviada el/)
    expect(jest.mocked(liberarFoto).mock.calls).toEqual([[foto.uri]])

    await vista.unmount()
    expect(jest.mocked(liberarFoto).mock.calls).toEqual([[foto.uri], [foto.uri]])
  })

  /**
   * Una foto a la espera de reintento cuya solicitud deja de admitirla (el
   * entrenador la revisa, ya no aparece o esa vista ya consta como recibida)
   * no puede quedarse bloqueando la pantalla sin botones ni explicación.
   */
  describe("una foto que falló y ya no se puede reintentar", () => {
    const OTRA = "50000000-0000-4000-8000-000000000002"
    const recibida = solicitud({
      estado: "recibida",
      recibidaEn: "2026-09-25T10:00:05.000Z",
      medios: [medio],
    })
    const revisada: SolicitudFotos = {
      ...recibida,
      estado: "revisada",
      revisadaEn: "2026-09-26T09:00:00.000Z",
    }
    // El entrenador vuelve a pedir la vista que falta.
    const nueva = solicitud({
      id: OTRA,
      vistas: ["espalda"],
      mensaje: null,
      creadaEn: "2026-09-26T09:05:00.000Z",
    })
    const espaldaEnviando = { ...enviando, vista: "espalda" as const }

    it.each([
      {
        caso: "el entrenador la revisa",
        lista: [revisada, nueva],
        aviso: /ya revisó esa solicitud/,
      },
      { caso: "la solicitud deja de aparecer", lista: [nueva], aviso: /ya no está pendiente/ },
    ])(
      "si $caso, al volver se suelta la copia y las demás vistas quedan libres",
      async ({ lista, aviso }) => {
        const foto = fotoSintetica("solicitud-cerrada")
        jest
          .mocked(obtenerFoto)
          .mockResolvedValueOnce({ tipo: "lista", foto })
          .mockResolvedValueOnce({ tipo: "cancelada" })
        almacen(() => caida)
        const falsa = api([recibida])
        falsa.solicitarSubida.mockResolvedValue({ medio: espaldaEnviando, subida: SUBIDA })
        await pantallaCliente(falsa)

        await fireEvent.press(elegirDeGaleria("Espalda"))
        await screen.findByRole("button", { name: "Reintentar envío de la foto de Espalda" })
        expect(liberarFoto).not.toHaveBeenCalled()

        falsa.solicitudes.mockResolvedValueOnce({ solicitudes: lista })
        await volverALaPantalla()
        await screen.findByText("Espalda")

        expect(jest.mocked(liberarFoto).mock.calls).toEqual([[foto.uri]])
        expect(
          screen.queryByRole("button", { name: /Reintentar envío|Descartar la foto/ }),
        ).toBeNull()
        expect(
          screen.getByRole("button", { name: "Hacer foto de Espalda con la cámara" }),
        ).toBeEnabled()
        expect(elegirDeGaleria("Espalda")).toBeEnabled()
        expect(screen.getByRole("alert")).toHaveTextContent(aviso)
        expect(screen.getByRole("alert")).toHaveTextContent(/foto de Espalda sin enviar/)
        await fireEvent.press(elegirDeGaleria("Espalda"))
        expect(obtenerFoto).toHaveBeenCalledTimes(2)
        expect(falsa.solicitarSubida).toHaveBeenCalledTimes(1)
      },
    )

    it("si esa vista ya consta como recibida (respuesta perdida), se suelta sin pedir reintento", async () => {
      const foto = fotoSintetica("respuesta-perdida")
      jest.mocked(obtenerFoto).mockResolvedValueOnce({ tipo: "lista", foto })
      almacen(() => correcta)
      const falsa = api([solicitud()])
      falsa.solicitarSubida.mockResolvedValue({ medio: enviando, subida: SUBIDA })
      // El servidor confirma, pero la respuesta no llega al móvil.
      falsa.confirmar.mockRejectedValueOnce(new ErrorDeRed())
      await pantallaCliente(falsa)

      await fireEvent.press(elegirDeGaleria("Frente"))
      await screen.findByRole("button", { name: "Reintentar envío de la foto de Frente" })

      falsa.solicitudes.mockResolvedValueOnce({ solicitudes: [recibida] })
      await volverALaPantalla()
      await screen.findByText(/Frente · enviada el/)

      expect(jest.mocked(liberarFoto).mock.calls).toEqual([[foto.uri]])
      expect(
        screen.queryByRole("button", { name: /Reintentar envío|Descartar la foto/ }),
      ).toBeNull()
      expect(elegirDeGaleria("Espalda")).toBeEnabled()
      expect(screen.getByRole("alert")).toHaveTextContent(/Frente ya consta como enviada/)
      expect(falsa.confirmar).toHaveBeenCalledTimes(1)
    })

    it("si se revisa mientras la foto se sube y el envío falla, no queda una foto sin salida", async () => {
      const foto = fotoSintetica("revisada-durante-subida")
      jest.mocked(obtenerFoto).mockResolvedValueOnce({ tipo: "lista", foto })
      const put = diferida<Response>()
      almacen(() => put.promesa)
      const falsa = api([recibida])
      falsa.solicitarSubida.mockResolvedValue({ medio: espaldaEnviando, subida: SUBIDA })
      await pantallaCliente(falsa)

      await fireEvent.press(elegirDeGaleria("Espalda"))
      await screen.findByText("Subiendo foto…")
      falsa.solicitudes.mockResolvedValueOnce({ solicitudes: [revisada, nueva] })
      await volverALaPantalla()
      await screen.findByText("Espalda")
      // La subida sigue usando su copia: la relectura no la toca.
      expect(liberarFoto).not.toHaveBeenCalled()

      await act(async () => put.resolver(caida))

      await waitFor(() => expect(elegirDeGaleria("Espalda")).toBeEnabled())
      expect(jest.mocked(liberarFoto).mock.calls).toEqual([[foto.uri]])
      expect(
        screen.queryByRole("button", { name: /Reintentar envío|Descartar la foto/ }),
      ).toBeNull()
      expect(screen.getByRole("alert")).toHaveTextContent(/ya revisó esa solicitud/)
    })

    it("mientras su solicitud sigue abierta, la relectura conserva la foto para reintentar", async () => {
      const foto = fotoSintetica("sigue-abierta")
      jest.mocked(obtenerFoto).mockResolvedValueOnce({ tipo: "lista", foto })
      almacen(() => caida)
      const falsa = api([recibida])
      falsa.solicitarSubida.mockResolvedValue({ medio: espaldaEnviando, subida: SUBIDA })
      await pantallaCliente(falsa)

      await fireEvent.press(elegirDeGaleria("Espalda"))
      await screen.findByRole("button", { name: "Reintentar envío de la foto de Espalda" })
      await volverALaPantalla()
      await waitFor(() => expect(falsa.solicitudes).toHaveBeenCalledTimes(2))

      expect(
        screen.getByRole("button", { name: "Reintentar envío de la foto de Espalda" }),
      ).toBeTruthy()
      // La explicación de los botones de reintento no desaparece al releer.
      expect(screen.getByRole("alert")).toHaveTextContent(/conservamos mientras sigas/)
      expect(liberarFoto).not.toHaveBeenCalled()
    })
  })
})
