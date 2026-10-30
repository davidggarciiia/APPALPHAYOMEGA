import { fireEvent, render, screen, within } from "@testing-library/react-native"
import {
  CONFIGURACION_SEGUIMIENTO_INICIAL,
  MedioFotoSchema,
  type ConfiguracionSeguimiento,
  type ProgresionFuerza,
  type SerieEvolucion,
  type SolicitudFotos,
} from "@alpha-omega/shared"

import type { ApiSeguimiento } from "./api"
import type { ApiMedios } from "./medios-api"
import { MiProgreso } from "./mi-progreso"
import type { ApiEvolucionAvisos, ApiValoracionesCliente } from "./valoraciones-api"

jest.mock("expo-router", () => {
  const React = jest.requireActual<typeof import("react")>("react")
  return { useFocusEffect: (efecto: () => void) => React.useEffect(efecto, [efecto]) }
})
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))
jest.mock("expo-crypto", () => ({ randomUUID: () => "10000000-0000-4000-8000-000000000001" }))

const CLIENTE = "10000000-0000-4000-8000-000000000000"

function serie(
  clave: string,
  nombre: string,
  unidad: string,
  valores: Array<[string, number]>,
  extra: Partial<SerieEvolucion> = {},
): SerieEvolucion {
  return {
    clave,
    nombre,
    unidad,
    bloque: null,
    origen: "autorregistro",
    metodo: null,
    clasificada: false,
    puntos: valores.map(([fecha, valor]) => ({
      fecha,
      valor,
      publicacionId: null,
      valoracionId: null,
      corregido: false,
    })),
    ...extra,
  }
}

const PESO = serie("h:dia:pesoKg", "Peso en ayunas", "kg", [
  ["2026-09-01", 111.6],
  ["2026-10-20", 104.2],
])
const GRASA = serie(
  "c:grasa:1",
  "Grasa corporal",
  "%",
  [
    ["2026-09-01", 30],
    ["2026-10-01", 27.5],
  ],
  { bloque: "bioimpedancia", origen: "valoracion", clasificada: true },
)
const SALTO = serie(
  "p:salto:1:cm",
  "Salto vertical",
  "cm",
  [
    ["2026-09-01", 30],
    ["2026-10-01", 34],
  ],
  { bloque: "pruebas", origen: "valoracion", clasificada: true },
)
const PRESS: ProgresionFuerza["ejercicios"][number] = {
  ejercicioId: "20000000-0000-4000-8000-000000000001",
  nombre: "Press banca",
  puntos: [
    { fecha: "2026-09-01", pesoKg: 80, repeticiones: 5, estimado: 93 },
    { fecha: "2026-10-01", pesoKg: 95, repeticiones: 5, estimado: 111 },
  ],
}

function fuentes({
  configuracion = {},
  series = [PESO, GRASA, SALTO],
  ejercicios = [PRESS],
  fotos = [],
  solicitudes = [],
}: {
  configuracion?: Partial<ConfiguracionSeguimiento>
  series?: SerieEvolucion[]
  ejercicios?: ProgresionFuerza["ejercicios"]
  fotos?: ReturnType<typeof MedioFotoSchema.parse>[]
  solicitudes?: SolicitudFotos[]
} = {}) {
  const seguimiento = {
    configuracion: jest.fn(async () => ({
      ...CONFIGURACION_SEGUIMIENTO_INICIAL,
      ...configuracion,
    })),
    fuerza: jest.fn(async () => ({ ejercicios })),
    registrarMedida: jest.fn(async () => ({})),
    registrarPrueba: jest.fn(async () => ({})),
  }
  const valoraciones = {
    evolucion: jest.fn(async () => ({ series })),
    listarPublicadas: jest.fn(async () => ({ valoraciones: [], total: 0 })),
    leerPublicada: jest.fn(async () => {
      throw new Error("no usado")
    }),
    proximaRevision: jest.fn(async () => ({
      revision: 0,
      pauta: null,
      cumplidaPorId: null,
      actualizadaEn: null,
    })),
  }
  const medios = {
    fotosDeCliente: jest.fn(async () => ({ fotos })),
    solicitudes: jest.fn(async () => ({ solicitudes })),
    acceso: jest.fn(async () => {
      throw new Error("sin acceso en la prueba")
    }),
    borrar: jest.fn(),
  }
  return { seguimiento, valoraciones, medios }
}

const vista = (f: ReturnType<typeof fuentes>) => (
  <MiProgreso
    clienteId={CLIENTE}
    seguimiento={f.seguimiento as unknown as ApiSeguimiento}
    valoraciones={
      f.valoraciones as unknown as ApiValoracionesCliente & Pick<ApiEvolucionAvisos, "evolucion">
    }
    medios={f.medios as unknown as ApiMedios}
  />
)

it("arriba resume lo que ha cambiado desde el inicio, con el sentido del objetivo", async () => {
  await render(
    vista(fuentes({ configuracion: { objetivoPeso: { direccion: "bajar", rangoKg: null } } })),
  )
  expect(await screen.findByRole("header", { name: "Desde el inicio" })).toBeOnTheScreen()
  expect(screen.getByLabelText("Peso en ayunas: de 111,6 kg a 104,2 kg, −7,4 kg")).toBeOnTheScreen()
  expect(screen.getByLabelText("Grasa corporal: de 30 % a 27,5 %, −2,5 %")).toBeOnTheScreen()
  expect(screen.getByLabelText("Press banca: de 80 kg a 95 kg, +15 kg")).toBeOnTheScreen()
})

it("una sección por tipo de dato, en orden fijo y sin pestañas", async () => {
  await render(vista(fuentes()))
  await screen.findByRole("header", { name: "Fuerza" })
  const titulos = screen.getAllByRole("header").map((h) => h.props.children)
  expect(titulos).toEqual([
    "Desde el inicio",
    "Fuerza",
    "Medidas",
    "Composición corporal",
    "Pruebas físicas",
  ])
  expect(screen.queryByRole("tab")).toBeNull()
})

it("tocar una fila abre su evolución con la gráfica y el historial del más reciente al más antiguo", async () => {
  await render(vista(fuentes()))
  await fireEvent.press(
    await screen.findByRole("button", { name: "Salto vertical: 34 cm, +4 cm desde el inicio" }),
  )
  const hoja = await screen.findByRole("header", { name: "Salto vertical" })
  expect(hoja).toBeOnTheScreen()
  expect(screen.getByRole("image", { name: /^Salto vertical: de 30 cm/ })).toBeOnTheScreen()
  const filas = screen.getAllByText(/^\d+ cm$/).map((t) => t.props.children)
  expect(filas.slice(-2)).toEqual(["34 cm", "30 cm"])
})

it("la fuerza muestra la mejor serie y abre su progresión", async () => {
  await render(vista(fuentes()))
  await fireEvent.press(
    await screen.findByRole("button", { name: "Press banca: 95 kg × 5, +15 kg desde el inicio" }),
  )
  expect(await screen.findByText("80 kg × 5")).toBeOnTheScreen()
})

it("respeta los indicadores: sin fuerza ni pruebas activadas no salen", async () => {
  await render(vista(fuentes({ configuracion: { indicadores: ["peso"] } })))
  await screen.findByRole("header", { name: "Medidas" })
  expect(screen.queryByRole("header", { name: "Fuerza" })).toBeNull()
  expect(screen.queryByRole("header", { name: "Pruebas físicas" })).toBeNull()
  expect(screen.queryByText("Press banca")).toBeNull()
})

it("sin ningún dato lo dice una vez y deja añadir medidas", async () => {
  const f = fuentes({ series: [], ejercicios: [] })
  await render(vista(f))
  expect(
    await screen.findByText(
      "Tu entrenador registrará tu punto de partida en la primera valoración.",
    ),
  ).toBeOnTheScreen()
  expect(screen.queryByRole("header", { name: "Desde el inicio" })).toBeNull()
  expect(screen.queryByText(/Aún no tienes valoraciones publicadas/)).toBeNull()
  expect(screen.queryByText("No tienes fotos pendientes de enviar.")).toBeNull()
  expect(screen.getByRole("button", { name: "Añadir a medidas" })).toBeOnTheScreen()
})

it("las pruebas pautadas se pueden añadir desde su sección", async () => {
  const f = fuentes({
    configuracion: {
      pruebasPrescritas: [
        { id: "30000000-0000-4000-8000-000000000001", nombre: "Salto vertical", unidad: "cm" },
      ],
    },
  })
  await render(vista(f))
  expect(await screen.findByRole("button", { name: "Añadir a pruebas físicas" })).toBeOnTheScreen()
})

it("las fotos pedidas por el entrenador salen arriba solo si hay alguna", async () => {
  const pedida: SolicitudFotos = {
    id: "50000000-0000-4000-8000-000000000001",
    clienteId: CLIENTE,
    autor: { id: "60000000-0000-4000-8000-000000000001", nombre: "Entrenador" },
    vistas: ["frente"],
    fechaLimite: null,
    mensaje: null,
    estado: "pendiente",
    creadaEn: "2026-10-24T10:00:00.000Z",
    recibidaEn: null,
    revisadaEn: null,
    medios: [],
  }
  await render(vista(fuentes({ solicitudes: [pedida] })))
  expect(
    await screen.findByRole("header", { name: "Fotos que te pide tu entrenador" }),
  ).toBeOnTheScreen()
})

it("con fotos compara antes y ahora; si fallan, lo dice sin ocultar el resto", async () => {
  const foto = MedioFotoSchema.parse({
    id: "40000000-0000-4000-8000-000000000001",
    clienteId: CLIENTE,
    autor: { id: "70000000-0000-4000-8000-000000000001", nombre: "Entrenadora" },
    origen: "profesional",
    vista: "frente",
    etiqueta: null,
    fechaToma: "2026-09-24",
    estado: "disponible",
    tipoMime: "image/jpeg",
    bytes: 120_000,
    valoracionId: null,
    solicitudId: null,
    creadoEn: "2026-09-24T09:00:00.000Z",
    confirmadoEn: "2026-09-24T09:01:00.000Z",
  })
  await render(vista(fuentes({ fotos: [foto] })))
  expect(await screen.findByRole("header", { name: "Fotos" })).toBeOnTheScreen()

  const f = fuentes()
  f.medios.fotosDeCliente.mockRejectedValueOnce(new Error("sin red"))
  await render(vista(f))
  expect(await screen.findByText("No se pudieron cargar las fotos.")).toBeOnTheScreen()
  expect(screen.getByRole("header", { name: "Medidas" })).toBeOnTheScreen()
})

it("muestra un esqueleto mientras carga y reintenta un fallo", async () => {
  const f = fuentes()
  f.valoraciones.evolucion.mockReturnValueOnce(new Promise(() => {}))
  const { unmount } = await render(vista(f))
  expect(screen.getByRole("progressbar", { name: "Cargando progreso" })).toBeOnTheScreen()
  await unmount()

  const g = fuentes()
  g.seguimiento.configuracion.mockRejectedValueOnce(new Error("sin red"))
  await render(vista(g))
  expect(
    await screen.findByText("No se pudo cargar tu progreso. Revisa la conexión."),
  ).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole("button", { name: "Reintentar" }))
  expect(await screen.findByRole("header", { name: "Medidas" })).toBeOnTheScreen()
})

it("ninguna fila usa tamaños de letra que cambien con el espacio", async () => {
  await render(vista(fuentes()))
  const fila = await screen.findByRole("button", { name: /^Peso en ayunas/ })
  for (const texto of within(fila).getAllByText(/.+/))
    expect(texto.props.adjustsFontSizeToFit).toBeUndefined()
})
