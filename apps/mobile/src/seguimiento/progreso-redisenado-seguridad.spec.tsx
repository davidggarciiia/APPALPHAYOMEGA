import { fireEvent, render, screen } from "@testing-library/react-native"
import {
  CONFIGURACION_SEGUIMIENTO_INICIAL,
  type MedioFoto,
  type SolicitudFotos,
} from "@alpha-omega/shared"
import type { ApiSeguimiento } from "./api"
import type { ApiMedios } from "./medios-api"
import { ProgresoRedisenado } from "./progreso-redisenado"

jest.mock("expo-router", () => {
  const React = jest.requireActual<typeof import("react")>("react")
  return { useFocusEffect: (efecto: () => void) => React.useEffect(efecto, [efecto]) }
})

const pendiente = <T,>(): Promise<T> => new Promise(() => undefined)
const clienteA = "10000000-0000-4000-8000-000000000001"
const clienteB = "10000000-0000-4000-8000-000000000002"
const foto: MedioFoto = {
  id: "30000000-0000-4000-8000-000000000001",
  clienteId: clienteA,
  autor: { id: clienteA, nombre: "Cliente A" },
  origen: "cliente",
  vista: "frente",
  etiqueta: null,
  fechaToma: "2026-10-20",
  estado: "disponible",
  tipoMime: "image/jpeg",
  bytes: 1234,
  valoracionId: null,
  solicitudId: "20000000-0000-4000-8000-000000000001",
  creadoEn: "2026-10-20T09:00:00.000Z",
  confirmadoEn: "2026-10-20T09:01:00.000Z",
}
const solicitud = (estado: SolicitudFotos["estado"]): SolicitudFotos => ({
  id: "20000000-0000-4000-8000-000000000001",
  clienteId: clienteA,
  autor: { id: "10000000-0000-4000-8000-000000000003", nombre: "Entrenador" },
  vistas: ["frente", "espalda"],
  fechaLimite: null,
  mensaje: "Información privada del cliente A",
  estado,
  creadaEn: "2026-10-19T10:00:00.000Z",
  recibidaEn: estado === "recibida" ? "2026-10-20T09:01:00.000Z" : null,
  revisadaEn: null,
  medios: estado === "recibida" ? [foto] : [],
})
const seguimiento = {
  configuracion: async (clienteId: string) =>
    clienteId === clienteA
      ? { ...CONFIGURACION_SEGUIMIENTO_INICIAL, indicadores: ["peso"] }
      : pendiente(),
  dias: async (clienteId: string) => (clienteId === clienteA ? { dias: [] } : pendiente()),
  medidas: async (clienteId: string) =>
    clienteId === clienteA ? { medidas: [], fechaNacimiento: null } : pendiente(),
  fuerza: async (clienteId: string) => (clienteId === clienteA ? { ejercicios: [] } : pendiente()),
  pruebas: async (clienteId: string) => (clienteId === clienteA ? { pruebas: [] } : pendiente()),
} as unknown as ApiSeguimiento

it("permite terminar una solicitud recibida mientras falte una de sus vistas", async () => {
  const medios = {
    fotosDeCliente: async () => ({ fotos: [] }),
    solicitudes: async () => ({ solicitudes: [solicitud("recibida")] }),
  } as unknown as ApiMedios
  await render(
    <ProgresoRedisenado clienteId={clienteA} seguimiento={seguimiento} medios={medios} />,
  )
  await fireEvent.press(await screen.findByRole("button", { name: /^Fotos pendientes/ }))
  expect(await screen.findByText("Recibida · faltan 1 vista")).toBeOnTheScreen()
  expect(
    screen.getByRole("button", { name: "Elegir foto de Espalda desde la galería" }),
  ).toBeOnTheScreen()
})

it("oculta la solicitud y el contenido del cliente anterior al cambiar de cliente", async () => {
  const medios = {
    fotosDeCliente: async (clienteId: string) =>
      clienteId === clienteA ? { fotos: [] } : pendiente(),
    solicitudes: async (clienteId: string) =>
      clienteId === clienteA ? { solicitudes: [solicitud("pendiente")] } : pendiente(),
  } as unknown as ApiMedios
  const vista = await render(
    <ProgresoRedisenado clienteId={clienteA} seguimiento={seguimiento} medios={medios} />,
  )
  await fireEvent.press(await screen.findByRole("button", { name: /^Fotos pendientes/ }))
  expect(await screen.findByText("Información privada del cliente A")).toBeOnTheScreen()
  await vista.rerender(
    <ProgresoRedisenado clienteId={clienteB} seguimiento={seguimiento} medios={medios} />,
  )
  expect(screen.queryByText("Información privada del cliente A")).toBeNull()
  expect(
    screen.queryByRole("button", { name: "Elegir foto de Frente desde la galería" }),
  ).toBeNull()
})

it("mantiene distintas filas de resumen para ejercicios con el mismo nombre", async () => {
  const errores = jest.spyOn(console, "error").mockImplementation(() => undefined)
  const conDuplicados = {
    ...seguimiento,
    fuerza: async () => ({
      ejercicios: [
        {
          ejercicioId: "e1",
          nombre: "Press",
          puntos: [{ fecha: "2026-01-01", pesoKg: 40, repeticiones: 8, estimado: 50 }],
        },
        {
          ejercicioId: "e2",
          nombre: "Press",
          puntos: [{ fecha: "2026-01-01", pesoKg: 60, repeticiones: 8, estimado: 75 }],
        },
      ],
    }),
    configuracion: async () => ({ ...CONFIGURACION_SEGUIMIENTO_INICIAL, indicadores: ["fuerza"] }),
  } as unknown as ApiSeguimiento
  try {
    await render(<ProgresoRedisenado clienteId={clienteA} seguimiento={conDuplicados} />)
    await screen.findByRole("header", { name: "Fuerza" })
    expect(
      screen.getByRole("button", { name: /Press, 40 kg.*primer registro disponible/ }),
    ).toBeOnTheScreen()
    expect(
      screen.getByRole("button", { name: /Press, 60 kg.*primer registro disponible/ }),
    ).toBeOnTheScreen()
    expect(
      errores.mock.calls
        .map((llamada) => llamada.join(" "))
        .filter((texto) => /same key|mismo key/i.test(texto)),
    ).toEqual([])
  } finally {
    errores.mockRestore()
  }
})

it("actualiza la galería cuando el comparador confirma el borrado de una foto", async () => {
  const antigua: MedioFoto = {
    ...foto,
    fechaToma: "2026-10-01",
    creadoEn: "2026-10-01T09:00:00.000Z",
  }
  const reciente: MedioFoto = {
    ...foto,
    id: "30000000-0000-4000-8000-000000000002",
    fechaToma: "2026-10-20",
  }
  const medios = {
    fotosDeCliente: async () => ({ fotos: [antigua, reciente] }),
    solicitudes: async () => ({ solicitudes: [] }),
    acceso: async (medioId: string) => ({
      medioId,
      lectura: {
        url: `https://example.test/${medioId}`,
        metodo: "GET",
        cabeceras: {},
        caducaEn: "2099-01-01T00:00:00.000Z",
      },
    }),
    borrar: jest.fn(async () => ({ ...antigua, estado: "eliminado" as const })),
  } as unknown as ApiMedios
  await render(
    <ProgresoRedisenado clienteId={clienteA} seguimiento={seguimiento} medios={medios} />,
  )
  await fireEvent.press(await screen.findByRole("button", { name: "Ver galería de fotos" }))
  await fireEvent.press(
    await screen.findByRole("button", { name: "Eliminar la foto de Frente, 1 oct 2026" }),
  )
  await fireEvent.press(screen.getByRole("button", { name: "Eliminar" }))
  await screen.findByLabelText("Frente, 1 oct 2026: foto retirada")
  expect(screen.queryByRole("header", { name: "1 oct 2026" })).toBeNull()
  expect(await screen.findByRole("header", { name: "20 oct 2026" })).toBeOnTheScreen()
})

it.each(["eliminando", "eliminado"] as const)(
  "permite abrir la galería con solo una foto en estado %s sin solicitar su imagen",
  async (estado) => {
    const acceso = jest.fn()
    const borrar = jest.fn(async () => ({ ...foto, estado: "eliminado" as const }))
    const medios = {
      fotosDeCliente: async () => ({ fotos: [{ ...foto, estado }] }),
      solicitudes: async () => ({ solicitudes: [] }),
      acceso,
      borrar,
    } as unknown as ApiMedios
    await render(
      <ProgresoRedisenado clienteId={clienteA} seguimiento={seguimiento} medios={medios} />,
    )
    await fireEvent.press(await screen.findByRole("button", { name: "Ver galería de fotos" }))
    expect(await screen.findByLabelText(/Frente, 20 oct 2026: foto retirada/)).toBeOnTheScreen()
    expect(acceso).not.toHaveBeenCalled()
    if (estado === "eliminando") {
      await fireEvent.press(
        screen.getByRole("button", { name: "Reintentar la retirada de Frente, 20 oct 2026" }),
      )
      expect(borrar).toHaveBeenCalledWith(foto.id)
      await screen.findByLabelText("Frente, 20 oct 2026: foto retirada")
    }
  },
)

it("mantiene la galería al volver después de retirar la última foto", async () => {
  const medios = {
    fotosDeCliente: async () => ({ fotos: [foto] }),
    solicitudes: async () => ({ solicitudes: [] }),
    acceso: async (medioId: string) => ({
      medioId,
      lectura: {
        url: `https://example.test/${medioId}`,
        metodo: "GET",
        cabeceras: {},
        caducaEn: "2099-01-01T00:00:00.000Z",
      },
    }),
    borrar: jest.fn(async () => ({ ...foto, estado: "eliminado" as const })),
  } as unknown as ApiMedios
  await render(
    <ProgresoRedisenado clienteId={clienteA} seguimiento={seguimiento} medios={medios} />,
  )
  await fireEvent.press(await screen.findByRole("button", { name: "Ver galería de fotos" }))
  await fireEvent.press(
    await screen.findByRole("button", { name: "Eliminar la foto de Frente, 20 oct 2026" }),
  )
  await fireEvent.press(screen.getByRole("button", { name: "Eliminar" }))
  await screen.findByLabelText("Frente, 20 oct 2026: foto retirada")
  await fireEvent.press(screen.getByRole("button", { name: "Volver a progreso" }))
  await fireEvent.press(screen.getByRole("button", { name: "Ver galería de fotos" }))
  expect(await screen.findByLabelText("Frente, 20 oct 2026: foto retirada")).toBeOnTheScreen()
})

it("abre la galería en orden cronológico y solo carga inicialmente unas pocas fotos", async () => {
  const fotos = Array.from({ length: 25 }, (_, i): MedioFoto => {
    const dia = String(25 - i).padStart(2, "0")
    return {
      ...foto,
      id: `30000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
      fechaToma: `2026-10-${dia}`,
      creadoEn: `2026-10-${dia}T09:00:00.000Z`,
    }
  })
  const acceso = jest.fn(async (medioId: string) => ({
    medioId,
    lectura: {
      url: `https://example.test/${medioId}`,
      metodo: "GET",
      cabeceras: {},
      caducaEn: "2099-01-01T00:00:00.000Z",
    },
  }))
  const medios = {
    fotosDeCliente: async () => ({ fotos }),
    solicitudes: async () => ({ solicitudes: [] }),
    acceso,
  } as unknown as ApiMedios
  await render(
    <ProgresoRedisenado clienteId={clienteA} seguimiento={seguimiento} medios={medios} />,
  )
  await fireEvent.press(await screen.findByRole("button", { name: "Ver galería de fotos" }))
  expect(await screen.findByRole("header", { name: "1 oct 2026" })).toBeOnTheScreen()
  const dias = screen
    .getAllByRole("header")
    .map((h) => h.props.children)
    .flatMap((texto) => {
      const dia = typeof texto === "string" ? /^(\d{1,2}) oct 2026$/.exec(texto)?.[1] : undefined
      return dia ? [Number(dia)] : []
    })
  const fechas = dias
  expect(dias).toEqual([...dias].sort((a, b) => a - b))
  expect(fechas.length).toBeLessThan(25)
  expect(acceso.mock.calls.length).toBeLessThanOrEqual(8)
})
