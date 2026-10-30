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

function foto(n: number, vista: "frente" | "espalda", fechaToma: string) {
  return MedioFotoSchema.parse({
    id: `40000000-0000-4000-8000-00000000000${n}`,
    clienteId: CLIENTE,
    autor: { id: "70000000-0000-4000-8000-000000000001", nombre: "Entrenadora" },
    origen: "profesional",
    vista,
    etiqueta: null,
    fechaToma,
    estado: "disponible",
    tipoMime: "image/jpeg",
    bytes: 120_000,
    valoracionId: null,
    solicitudId: null,
    creadoEn: `${fechaToma}T09:00:00.000Z`,
    confirmadoEn: `${fechaToma}T09:01:00.000Z`,
  })
}

it("el peso es protagonista: antes → ahora en grande y su diferencia según el objetivo", async () => {
  await render(
    vista(fuentes({ configuracion: { objetivoPeso: { direccion: "bajar", rangoKg: null } } })),
  )
  const peso = await screen.findByRole("button", {
    name: "Peso en ayunas: de 111,6 kg a 104,2 kg, −7,4 kg",
  })
  expect(within(peso).getByText("111,6")).toBeOnTheScreen()
  expect(within(peso).getByText("104,2")).toBeOnTheScreen()
  expect(within(peso).getByText("−7,4 kg")).toBeOnTheScreen()
})

it("cada bloque compara antes y ahora, en orden fijo y sin pestañas", async () => {
  await render(vista(fuentes()))
  await screen.findByRole("header", { name: "Fuerza" })
  expect(screen.getAllByRole("header").map((h) => h.props.children)).toEqual([
    "Medidas",
    "Composición",
    "Fuerza",
    "Pruebas",
  ])
  expect(screen.queryByRole("tab")).toBeNull()
  expect(
    screen.getByRole("button", { name: "Grasa corporal: de 30 % a 27,5 %, −2,5 %" }),
  ).toBeOnTheScreen()
  expect(
    screen.getByRole("button", { name: "Press banca: de 80 kg a 95 kg, +15 kg" }),
  ).toBeOnTheScreen()
  expect(
    screen.getByRole("button", { name: "Salto vertical: de 30 cm a 34 cm, +4 cm" }),
  ).toBeOnTheScreen()
})

it("tocar un dato abre su evolución con la gráfica y el historial del más reciente al más antiguo", async () => {
  await render(vista(fuentes()))
  await fireEvent.press(await screen.findByRole("button", { name: /^Salto vertical:/ }))
  expect(await screen.findByRole("header", { name: "Salto vertical" })).toBeOnTheScreen()
  expect(screen.getByRole("image", { name: /^Salto vertical: de 30 cm/ })).toBeOnTheScreen()
  const filas = screen.getAllByText(/^\d+ cm$/).map((t) => t.props.children)
  expect(filas.slice(-2)).toEqual(["34 cm", "30 cm"])
})

it("un ejercicio abre su progresión serie a serie", async () => {
  await render(vista(fuentes()))
  await fireEvent.press(await screen.findByRole("button", { name: /^Press banca:/ }))
  expect(await screen.findByText("80 kg × 5")).toBeOnTheScreen()
  expect(screen.getByText("95 kg × 5")).toBeOnTheScreen()
})

it("respeta los indicadores: sin fuerza ni pruebas activadas no salen", async () => {
  await render(vista(fuentes({ configuracion: { indicadores: ["peso"] } })))
  await screen.findByRole("header", { name: "Medidas" })
  expect(screen.queryByRole("header", { name: "Fuerza" })).toBeNull()
  expect(screen.queryByRole("header", { name: "Pruebas" })).toBeNull()
})

it("con solo el peso, Medidas conserva «Añadir» sin una tarjeta vacía", async () => {
  await render(vista(fuentes({ series: [PESO], ejercicios: [] })))
  expect(await screen.findByRole("button", { name: "Añadir a medidas" })).toBeOnTheScreen()
  expect(screen.queryByText("Aún sin medidas.")).toBeNull()
})

it("sin ningún dato lo dice una vez y deja añadir medidas", async () => {
  await render(vista(fuentes({ series: [], ejercicios: [] })))
  expect(
    await screen.findByText(
      "Tu entrenador registrará tu punto de partida en la primera valoración.",
    ),
  ).toBeOnTheScreen()
  expect(screen.queryByText(/Aún no tienes valoraciones publicadas/)).toBeNull()
  expect(screen.queryByText("No tienes fotos pendientes de enviar.")).toBeNull()
  expect(screen.queryByText("Sin programar")).toBeNull()
  expect(screen.getByRole("button", { name: "Añadir a medidas" })).toBeOnTheScreen()
})

it("las pruebas pautadas se pueden añadir desde su bloque", async () => {
  await render(
    vista(
      fuentes({
        series: [],
        configuracion: {
          pruebasPrescritas: [
            { id: "30000000-0000-4000-8000-000000000001", nombre: "Salto vertical", unidad: "cm" },
          ],
        },
      }),
    ),
  )
  expect(await screen.findByRole("button", { name: "Añadir a pruebas" })).toBeOnTheScreen()
  expect(screen.getByText("Aún sin resultados.")).toBeOnTheScreen()
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

it("arriba, la primera y la última foto de frente; un toque abre todas para comparar", async () => {
  const f = fuentes({
    fotos: [
      foto(1, "frente", "2026-10-27"),
      foto(2, "espalda", "2026-08-01"),
      foto(3, "frente", "2026-08-03"),
    ],
  })
  await render(vista(f))
  const fotos = await screen.findByRole("button", { name: "Fotos: antes, 3 ago; ahora, 27 oct" })
  expect(within(fotos).getByText("Antes")).toBeOnTheScreen()
  expect(within(fotos).getByText("Ahora")).toBeOnTheScreen()
  expect(f.medios.acceso).toHaveBeenCalledWith(foto(3, "frente", "2026-08-03").id)
  expect(f.medios.acceso).toHaveBeenCalledWith(foto(1, "frente", "2026-10-27").id)
  await fireEvent.press(fotos)
  expect(await screen.findByRole("header", { name: "Tus fotos" })).toBeOnTheScreen()
})

it("sin pareja de fotos ofrece verlas; si fallan, lo dice sin ocultar el resto", async () => {
  await render(vista(fuentes({ fotos: [foto(1, "frente", "2026-10-27")] })))
  expect(await screen.findByRole("button", { name: "Ver tus fotos" })).toBeOnTheScreen()
  expect(screen.queryByRole("button", { name: /^Fotos: antes/ })).toBeNull()

  const f = fuentes()
  f.medios.fotosDeCliente.mockRejectedValueOnce(new Error("sin red"))
  await render(vista(f))
  expect(await screen.findByText("No se pudieron cargar las fotos.")).toBeOnTheScreen()
  expect(screen.getByRole("header", { name: "Fuerza" })).toBeOnTheScreen()
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
  expect(await screen.findByRole("header", { name: "Fuerza" })).toBeOnTheScreen()
})
