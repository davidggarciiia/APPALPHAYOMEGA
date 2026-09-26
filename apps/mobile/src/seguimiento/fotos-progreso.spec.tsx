import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native"
import {
  MedioFotoSchema,
  type AccesoMedio,
  type IntencionSubida,
  type MedioFoto,
  type SolicitarSubida,
} from "@alpha-omega/shared"

import { ErrorDePeticion, ErrorDeRed } from "../lib/http"
import { FotosProgreso } from "./fotos-progreso"
import type { ApiMedios } from "./medios-api"
import { liberarFoto, obtenerFoto } from "./preparar-foto"

jest.mock("./preparar-foto", () => ({ obtenerFoto: jest.fn(), liberarFoto: jest.fn() }))
jest.mock("expo-router", () => ({
  useFocusEffect: (efecto: () => void | (() => void)) => {
    const { useEffect } = jest.requireActual<typeof import("react")>("react")
    useEffect(efecto, [efecto])
  },
}))

// Datos sintéticos: ninguna foto, persona ni enlace es real.
const HOY = "2026-09-26"
const CLIENTE = "10000000-0000-4000-8000-000000000000"
const CLIENTA = { id: CLIENTE, nombre: "Clienta Demo" }
const ENTRENADORA = { id: "70000000-0000-4000-8000-000000000001", nombre: "Entrenadora Demo" }
let contador = 0
const nuevoId = (): string => `30000000-0000-4000-8000-${String(++contador).padStart(12, "0")}`
const id = (n: number): string => `20000000-0000-4000-8000-${String(n).padStart(12, "0")}`

function foto(n: number, datos: Partial<MedioFoto>): MedioFoto {
  return MedioFotoSchema.parse({
    id: id(n),
    clienteId: CLIENTE,
    autor: CLIENTA,
    origen: "cliente",
    vista: "frente",
    etiqueta: null,
    fechaToma: "2026-07-04",
    estado: "disponible",
    tipoMime: "image/jpeg",
    bytes: 120_000,
    valoracionId: null,
    solicitudId: null,
    creadoEn: "2026-07-04T09:00:00.000Z",
    confirmadoEn: "2026-07-04T09:01:00.000Z",
    ...datos,
  })
}

const PREPARADA = {
  uri: "file:///cache/ImageManipulator/progreso.jpg",
  tipoMime: "image/jpeg" as const,
  bytes: 4321,
  ancho: 1200,
  alto: 1600,
}
const SUBIDA = {
  url: "https://almacen.test/subida/progreso",
  metodo: "PUT" as const,
  cabeceras: { "Content-Type": "image/jpeg" },
  caducaEn: "2099-01-01T00:00:00.000Z",
}

function apiFalsa(fotos: MedioFoto[] = []) {
  return {
    fotosDeCliente: jest.fn(async (_clienteId: string) => ({ fotos })),
    acceso: jest.fn(async (medioId: string): Promise<AccesoMedio> => ({
      medioId,
      lectura: {
        url: `https://almacen.test/lectura/${medioId}`,
        metodo: "GET",
        cabeceras: {},
        caducaEn: "2099-01-01T00:00:00.000Z",
      },
    })),
    borrar: jest.fn<ApiMedios["borrar"]>(),
    solicitarSubida: jest.fn(async (datos: SolicitarSubida): Promise<IntencionSubida> => ({
      medio: foto(90, {
        vista: datos.vista,
        fechaToma: datos.fechaToma,
        estado: "pendiente",
        confirmadoEn: null,
      }),
      subida: SUBIDA,
    })),
    confirmar: jest.fn(async (medioId: string) =>
      foto(90, { id: medioId, vista: "espalda", fechaToma: HOY }),
    ),
  } satisfies Pick<
    ApiMedios,
    "fotosDeCliente" | "acceso" | "borrar" | "solicitarSubida" | "confirmar"
  >
}

/** Lectura de la copia local y PUT al almacén; `put` decide cada respuesta. */
function almacen(put: () => Promise<Response> | Response = () => ({ ok: true }) as Response) {
  return jest.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
    if (url === PREPARADA.uri) return { blob: async () => new Blob(["foto sintética"]) } as Response
    if (url === SUBIDA.url) return put()
    throw new Error(`URL inesperada: ${String(url)}`)
  })
}

async function pantalla(
  api: ReturnType<typeof apiFalsa>,
  modo: "cliente" | "entrenador" = "cliente",
) {
  const vista = await render(
    <FotosProgreso clienteId={CLIENTE} api={api} modo={modo} nuevoId={nuevoId} hoy={HOY} />,
  )
  await waitFor(() => expect(api.fotosDeCliente).toHaveBeenCalledWith(CLIENTE))
  return vista
}

const elegirDeGaleria = (vista = "Frente") =>
  screen.getByRole("button", { name: `Elegir foto de ${vista} desde la galería` })

beforeEach(() => {
  jest.mocked(obtenerFoto).mockReset()
  jest.mocked(liberarFoto).mockReset()
  jest.restoreAllMocks()
})

describe("añadir una foto de progreso", () => {
  it("sin fotos lo dice; elegir vista y galería, ver la foto y guardarla la deja en el comparador", async () => {
    jest.mocked(obtenerFoto).mockResolvedValue({ tipo: "lista", foto: PREPARADA })
    const pedir = almacen()
    const api = apiFalsa()
    await pantalla(api)
    expect(
      await screen.findByText("Aún no hay fotos. Añade la primera para ver tu evolución."),
    ).toBeTruthy()

    await fireEvent.press(screen.getByRole("button", { name: "Añadir foto" }))
    expect(screen.getByRole("header", { name: "Nueva foto" })).toBeTruthy()
    expect(screen.getByText("Fecha: hoy, 26 sep")).toBeTruthy()
    // Cuatro vistas, nombradas enteras para el lector.
    expect(
      within(screen.getByLabelText("Vista de la foto"))
        .getAllByRole("radio")
        .map((r) => r.props.accessibilityLabel),
    ).toEqual(["Frente", "Espalda", "Perfil izquierdo", "Perfil derecho"])
    await fireEvent.press(screen.getByRole("radio", { name: "Espalda" }))
    await fireEvent.press(elegirDeGaleria("Espalda"))

    // Seleccionada: se ve antes de guardarla y aún no se ha enviado nada.
    expect(await screen.findByLabelText("Foto elegida: Espalda, 26 sep 2026")).toBeTruthy()
    expect(obtenerFoto).toHaveBeenCalledWith("galeria")
    expect(api.solicitarSubida).not.toHaveBeenCalled()

    await fireEvent.press(screen.getByRole("button", { name: "Guardar la foto" }))
    expect(await screen.findByText("Foto guardada: Espalda, hoy, 26 sep.")).toBeTruthy()
    expect(api.solicitarSubida).toHaveBeenCalledWith({
      operacionId: expect.any(String),
      clienteId: CLIENTE,
      destino: { tipo: "progreso" },
      vista: "espalda",
      etiqueta: null,
      fechaToma: HOY,
      tipoMime: "image/jpeg",
      bytes: PREPARADA.bytes,
    })
    expect(pedir).toHaveBeenCalledWith(SUBIDA.url, expect.objectContaining({ method: "PUT" }))
    expect(api.confirmar).toHaveBeenCalledTimes(1)
    // El servidor ya la tiene: la copia local se suelta.
    expect(liberarFoto).toHaveBeenCalledWith(PREPARADA.uri)
    // Y aparece en el comparador, en su vista, sin volver a pedir la lista.
    expect(await screen.findByLabelText("Espalda, 26 sep 2026")).toBeTruthy()
    expect(api.fotosDeCliente).toHaveBeenCalledTimes(1)
  })

  it("si el envío falla conserva la foto y el reintento repite la misma operación", async () => {
    jest.mocked(obtenerFoto).mockResolvedValue({ tipo: "lista", foto: PREPARADA })
    let intentos = 0
    almacen(() => ({ ok: ++intentos > 1, status: intentos > 1 ? 204 : 503 }) as Response)
    const api = apiFalsa()
    await pantalla(api)
    await fireEvent.press(screen.getByRole("button", { name: "Añadir foto" }))
    await fireEvent.press(elegirDeGaleria())
    await fireEvent.press(await screen.findByRole("button", { name: "Guardar la foto" }))

    expect(await screen.findByText(/No se pudo guardar la foto/)).toBeTruthy()
    expect(liberarFoto).not.toHaveBeenCalled()
    await fireEvent.press(screen.getByRole("button", { name: "Reintentar el envío de la foto" }))

    await waitFor(() => expect(api.confirmar).toHaveBeenCalledTimes(1))
    const [primera, segunda] = api.solicitarSubida.mock.calls
    expect(segunda![0]).toEqual(primera![0])
    expect(obtenerFoto).toHaveBeenCalledTimes(1)
    expect(jest.mocked(liberarFoto).mock.calls).toEqual([[PREPARADA.uri]])
  })

  it("sin consentimiento lo explica y no ofrece reintentar; descartar suelta la copia", async () => {
    jest.mocked(obtenerFoto).mockResolvedValue({ tipo: "lista", foto: PREPARADA })
    almacen()
    const api = apiFalsa()
    api.solicitarSubida.mockRejectedValue(
      new ErrorDePeticion({
        statusCode: 409,
        codigo: "consentimiento_pendiente",
        message: "Antes de guardar datos de salud necesitamos tu consentimiento.",
      }),
    )
    await pantalla(api)
    await fireEvent.press(screen.getByRole("button", { name: "Añadir foto" }))
    await fireEvent.press(elegirDeGaleria())
    await fireEvent.press(await screen.findByRole("button", { name: "Guardar la foto" }))

    expect(
      await screen.findByText("Antes de guardar datos de salud necesitamos tu consentimiento."),
    ).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Reintentar el envío de la foto" })).toBeNull()
    await fireEvent.press(screen.getByRole("button", { name: "Descartar la foto sin guardarla" }))
    expect(liberarFoto).toHaveBeenCalledWith(PREPARADA.uri)
    expect(elegirDeGaleria()).toBeTruthy()
  })

  it("otra fecha se escribe a mano; una fecha futura no abre la cámara ni la galería", async () => {
    jest.mocked(obtenerFoto).mockResolvedValue({ tipo: "lista", foto: PREPARADA })
    almacen()
    const api = apiFalsa()
    await pantalla(api)
    await fireEvent.press(screen.getByRole("button", { name: "Añadir foto" }))
    await fireEvent.press(screen.getByRole("button", { name: "Cambiar la fecha de la foto" }))
    const campo = screen.getByLabelText("Fecha de la foto (AAAA-MM-DD)")

    await fireEvent.changeText(campo, "2026-09-30")
    expect(screen.getByText("Escribe una fecha real, de hoy o anterior.")).toBeTruthy()
    await fireEvent.press(elegirDeGaleria())
    expect(obtenerFoto).not.toHaveBeenCalled()

    await fireEvent.changeText(campo, "2026-09-01")
    await fireEvent.press(elegirDeGaleria())
    await fireEvent.press(await screen.findByRole("button", { name: "Guardar la foto" }))
    await waitFor(() => expect(api.confirmar).toHaveBeenCalled())
    expect(api.solicitarSubida.mock.calls[0]![0].fechaToma).toBe("2026-09-01")
  })

  it("al salir con una foto elegida sin guardar, la copia local se suelta", async () => {
    jest.mocked(obtenerFoto).mockResolvedValue({ tipo: "lista", foto: PREPARADA })
    const api = apiFalsa()
    const vista = await pantalla(api)
    await fireEvent.press(screen.getByRole("button", { name: "Añadir foto" }))
    await fireEvent.press(elegirDeGaleria())
    await screen.findByLabelText("Foto elegida: Frente, 26 sep 2026")
    expect(liberarFoto).not.toHaveBeenCalled()

    await act(async () => vista.unmount())
    expect(liberarFoto).toHaveBeenCalledWith(PREPARADA.uri)
    expect(api.solicitarSubida).not.toHaveBeenCalled()
  })

  it("cancelar la cámara no enseña ningún error; un permiso denegado se explica", async () => {
    const api = apiFalsa()
    await pantalla(api)
    await fireEvent.press(screen.getByRole("button", { name: "Añadir foto" }))
    jest.mocked(obtenerFoto).mockResolvedValueOnce({ tipo: "cancelada" })
    await fireEvent.press(
      screen.getByRole("button", { name: "Hacer foto de Frente con la cámara" }),
    )
    await waitFor(() => expect(obtenerFoto).toHaveBeenCalledWith("camara"))
    expect(screen.queryByRole("alert")).toBeNull()

    jest
      .mocked(obtenerFoto)
      .mockResolvedValueOnce({ tipo: "sinPermiso", mensaje: "Sin permiso para usar la cámara." })
    await fireEvent.press(
      screen.getByRole("button", { name: "Hacer foto de Frente con la cámara" }),
    )
    expect(await screen.findByText("Sin permiso para usar la cámara.")).toBeTruthy()
  })
})

describe("galería por fechas", () => {
  const fotos = [
    foto(1, { fechaToma: "2026-07-04" }),
    foto(2, { fechaToma: "2026-07-04", vista: "espalda" }),
    foto(3, { fechaToma: "2026-09-24", vista: "perfilIzquierdo" }),
    foto(4, { fechaToma: "2026-09-24" }),
    foto(5, { fechaToma: "2026-08-01", estado: "eliminado" }),
  ]

  /** La galería mide 330 px: tres miniaturas por fila. */
  const medirGaleria = async (): Promise<void> => {
    await fireEvent(screen.getByTestId("galeria-fotos"), "layout", {
      nativeEvent: { layout: { x: 0, y: 0, width: 330, height: 800 } },
    })
  }

  it("agrupa por día, el más reciente primero, con los días transcurridos", async () => {
    const api = apiFalsa(fotos)
    await pantalla(api)
    await fireEvent.press(await screen.findByRole("radio", { name: "Por fechas" }))
    await medirGaleria()

    expect(screen.getByRole("header", { name: "24 sep 2026 · Hace 2 días" })).toBeTruthy()
    expect(screen.getByRole("header", { name: "4 jul 2026 · Hace 84 días" })).toBeTruthy()
    // La retirada no está en la galería.
    expect(screen.queryByRole("header", { name: /^1 ago 2026/ })).toBeNull()
    // Del día más reciente al más antiguo y, dentro del día, en el orden de las vistas.
    expect(
      screen
        .getAllByRole("button", { name: /en el comparador$/ })
        .map((b) => b.props.accessibilityLabel),
    ).toEqual([
      "Abrir Frente, 24 sep 2026 en el comparador",
      "Abrir Perfil izquierdo, 24 sep 2026 en el comparador",
      "Abrir Frente, 4 jul 2026 en el comparador",
      "Abrir Espalda, 4 jul 2026 en el comparador",
    ])
  })

  it("tocar una miniatura la abre en el comparador, en su vista", async () => {
    const api = apiFalsa(fotos)
    await pantalla(api)
    await fireEvent.press(await screen.findByRole("radio", { name: "Por fechas" }))
    await medirGaleria()
    await fireEvent.press(
      screen.getByRole("button", { name: "Abrir Espalda, 4 jul 2026 en el comparador" }),
    )
    expect(screen.getByRole("radio", { name: "Comparar" }).props.accessibilityState).toMatchObject({
      checked: true,
    })
    expect(await screen.findByLabelText("Espalda, 4 jul 2026")).toBeTruthy()
    expect(screen.getByRole("radio", { name: "Espalda" }).props.accessibilityState).toMatchObject({
      checked: true,
    })
  })

  it("abre las fechas por tandas", async () => {
    const muchas = Array.from({ length: 8 }, (_, n) =>
      foto(10 + n, { fechaToma: `2026-09-${String(10 + n).padStart(2, "0")}` }),
    )
    const api = apiFalsa(muchas)
    await pantalla(api)
    await fireEvent.press(await screen.findByRole("radio", { name: "Por fechas" }))
    expect(screen.queryByRole("header", { name: /^11 sep 2026/ })).toBeNull()
    await fireEvent.press(screen.getByRole("button", { name: "Ver fotos de fechas anteriores" }))
    expect(screen.getByRole("header", { name: /^11 sep 2026/ })).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Ver fotos de fechas anteriores" })).toBeNull()
  })
})

describe("el entrenador", () => {
  it("ve y compara las fotos de progreso del cliente, sin añadir ni retirar desde aquí", async () => {
    const api = apiFalsa([
      foto(1, { fechaToma: "2026-07-04" }),
      foto(2, {
        fechaToma: "2026-09-24",
        autor: ENTRENADORA,
        origen: "profesional",
        valoracionId: id(50),
      }),
    ])
    await pantalla(api, "entrenador")
    expect(await screen.findByLabelText("Frente, 4 jul 2026")).toBeTruthy()
    expect(await screen.findByLabelText("Frente, 24 sep 2026")).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Añadir foto" })).toBeNull()
    expect(screen.queryByRole("button", { name: /^Eliminar la foto/ })).toBeNull()
    await fireEvent.press(screen.getByRole("radio", { name: "Deslizar" }))
    expect(screen.getByRole("adjustable")).toBeTruthy()
  })

  it("sin fotos lo dice con sus palabras; si no cargan, ofrece reintentar", async () => {
    const api = apiFalsa()
    api.fotosDeCliente.mockRejectedValueOnce(new ErrorDeRed())
    await pantalla(api, "entrenador")
    expect(await screen.findByText(/No hemos podido conectar/)).toBeTruthy()
    await fireEvent.press(screen.getByRole("button", { name: "Reintentar cargar las fotos" }))
    expect(await screen.findByText("Aún no hay fotos de este cliente.")).toBeTruthy()
  })
})
