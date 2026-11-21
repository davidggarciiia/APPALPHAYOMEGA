import { fireEvent, render, screen } from "@testing-library/react-native"
import { CONFIGURACION_SEGUIMIENTO_INICIAL, SerieEvolucionSchema } from "@alpha-omega/shared"
import type { ApiSeguimiento } from "./api"
import type { ApiValoracionesCliente, ApiEvolucionAvisos } from "./valoraciones-api"
import { ErrorDePermiso } from "../lib/http"
import { ProgresoRedisenado } from "./progreso-redisenado"
import * as graficas from "./grafica"

jest.mock("expo-router", () => {
  const React = jest.requireActual<typeof import("react")>("react")
  return { useFocusEffect: (efecto: () => void) => React.useEffect(efecto, [efecto]) }
})

const api = (): ApiSeguimiento =>
  ({
    configuracion: async () => ({
      ...CONFIGURACION_SEGUIMIENTO_INICIAL,
      indicadores: ["peso", "cintura", "fuerza", "pruebas"],
    }),
    dias: async () => ({ dias: [] }),
    medidas: async () => ({
      medidas: [
        {
          id: "40000000-0000-4000-8000-000000000001",
          fecha: "2026-01-10",
          pesoKg: 80,
          cinturaCm: 95,
          grasaPct: null,
          alturaCm: null,
          creadoEn: "2026-01-10T08:00:00.000Z",
        },
        {
          id: "40000000-0000-4000-8000-000000000002",
          fecha: "2026-09-15",
          pesoKg: 76,
          cinturaCm: 90,
          grasaPct: null,
          alturaCm: null,
          creadoEn: "2026-09-15T08:00:00.000Z",
        },
      ],
      fechaNacimiento: null,
    }),
    fuerza: async () => ({
      ejercicios: [
        {
          ejercicioId: "60000000-0000-4000-8000-000000000001",
          nombre: "Press inclinado",
          puntos: [{ fecha: "2026-09-15", pesoKg: 60, repeticiones: 10, estimado: 80 }],
        },
      ],
    }),
    pruebas: async () => ({
      pruebas: [
        {
          id: "50000000-0000-4000-8000-000000000001",
          pruebaId: null,
          fecha: "2026-09-15",
          nombre: "Plancha",
          valor: 60,
          unidad: "seg",
          creadoEn: "2026-09-15T08:00:00.000Z",
        },
      ],
    }),
  }) as unknown as ApiSeguimiento

it("muestra las secciones disponibles en orden y abre el detalle de una medida", async () => {
  await render(<ProgresoRedisenado clienteId="cliente" seguimiento={api()} />)
  const medidas = await screen.findByRole("header", { name: "Medidas" })
  const fuerza = screen.getByRole("header", { name: "Fuerza" })
  const pruebas = screen.getByRole("header", { name: "Pruebas" })
  const cabeceras = screen.getAllByRole("header")
  expect(cabeceras.indexOf(medidas)).toBeLessThan(cabeceras.indexOf(fuerza))
  expect(cabeceras.indexOf(fuerza)).toBeLessThan(cabeceras.indexOf(pruebas))
  expect(screen.queryAllByRole("tab")).toHaveLength(0)
  await fireEvent.press(screen.getByRole("button", { name: /^Peso,/ }))
  expect(screen.getByRole("header", { name: "Peso" })).toBeOnTheScreen()
})

it("distingue un error de carga de un historial vacío", async () => {
  const seguimiento = api()
  seguimiento.medidas = jest
    .fn()
    .mockRejectedValueOnce(new Error("sin red"))
    .mockResolvedValue({ medidas: [], fechaNacimiento: null })
  await render(<ProgresoRedisenado clienteId="cliente" seguimiento={seguimiento} />)
  expect(
    await screen.findByText("No se pudo cargar tu progreso. Revisa la conexión."),
  ).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole("button", { name: "Reintentar" }))
  expect(await screen.findByRole("header", { name: "Fuerza" })).toBeOnTheScreen()
})

it("en fuerza compara la mejor marca con la primera, no la sesión más reciente", async () => {
  const seguimiento = api()
  seguimiento.fuerza = async () => ({
    ejercicios: [
      {
        ejercicioId: "press",
        nombre: "Press inclinado",
        puntos: [
          { fecha: "2026-01-01", pesoKg: 60, repeticiones: 8, estimado: 76 },
          { fecha: "2026-02-01", pesoKg: 80, repeticiones: 8, estimado: 101 },
          { fecha: "2026-03-01", pesoKg: 70, repeticiones: 8, estimado: 88 },
        ],
      },
    ],
  })
  await render(<ProgresoRedisenado clienteId="cliente" seguimiento={seguimiento} />)
  expect(
    await screen.findByRole("button", {
      name: "Press inclinado, 60 kg por 8 repeticiones a 80 kg por 8 repeticiones, +20 kg, primer registro disponible",
    }),
  ).toBeOnTheScreen()
})

it("permite registrar una medida y una prueba pautada", async () => {
  const seguimiento = api()
  seguimiento.configuracion = async () => ({
    ...CONFIGURACION_SEGUIMIENTO_INICIAL,
    indicadores: ["peso", "pruebas"],
    pruebasPrescritas: [
      { id: "20000000-0000-4000-8000-000000000001", nombre: "Plancha", unidad: "seg" },
    ],
  })
  await render(<ProgresoRedisenado clienteId="cliente" seguimiento={seguimiento} />)
  await fireEvent.press(await screen.findByRole("button", { name: "Añadir medida" }))
  expect(screen.getByLabelText("Peso (kg)")).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole("button", { name: "Cancelar" }))
  await fireEvent.press(screen.getByRole("button", { name: "Añadir prueba" }))
  expect(screen.getByRole("button", { name: "Plancha · seg" })).toBeOnTheScreen()
})

it("oculta indicadores no autorizados aunque existan datos", async () => {
  const seguimiento = api()
  seguimiento.configuracion = async () => ({
    ...CONFIGURACION_SEGUIMIENTO_INICIAL,
    indicadores: ["peso"],
  })
  await render(<ProgresoRedisenado clienteId="cliente" seguimiento={seguimiento} />)
  expect(await screen.findByRole("button", { name: /^Peso, 80 a 76 kg, −4 kg/ })).toBeOnTheScreen()
  expect(screen.queryByText("Cintura")).toBeNull()
  expect(screen.queryByText("Press inclinado")).toBeNull()
  expect(screen.queryByText("Plancha")).toBeNull()
})

it("muestra el vacío único cuando no hay datos ni cargas pendientes", async () => {
  const seguimiento = api()
  seguimiento.medidas = async () => ({ medidas: [], fechaNacimiento: null })
  seguimiento.fuerza = async () => ({ ejercicios: [] })
  seguimiento.pruebas = async () => ({ pruebas: [] })
  await render(<ProgresoRedisenado clienteId="cliente" seguimiento={seguimiento} />)
  expect(
    await screen.findByText(
      "Tu entrenador registrará tu punto de partida en la primera valoración",
    ),
  ).toBeOnTheScreen()
})

it("enseña medidas mientras una consulta adicional sigue pendiente", async () => {
  const valoraciones = {
    evolucion: () => new Promise(() => {}),
  } as unknown as ApiValoracionesCliente & Pick<ApiEvolucionAvisos, "evolucion">
  await render(
    <ProgresoRedisenado clienteId="cliente" seguimiento={api()} valoraciones={valoraciones} />,
  )
  expect(await screen.findByRole("button", { name: /^Peso, 80 a 76 kg, −4 kg/ })).toBeOnTheScreen()
})

it("conserva la precisión de incrementos de fuerza pequeños", async () => {
  const seguimiento = api()
  seguimiento.fuerza = async () => ({
    ejercicios: [
      {
        ejercicioId: "press",
        nombre: "Press",
        puntos: [
          { fecha: "2026-01-01", pesoKg: 60, repeticiones: 8, estimado: 76 },
          { fecha: "2026-02-01", pesoKg: 60.125, repeticiones: 8, estimado: 76.1 },
        ],
      },
    ],
  })
  await render(<ProgresoRedisenado clienteId="cliente" seguimiento={seguimiento} />)
  expect(
    await screen.findByRole("button", {
      name: "Press, 60 kg por 8 repeticiones a 60,125 kg por 8 repeticiones, +0,125 kg, primer registro disponible",
    }),
  ).toBeOnTheScreen()
})

it("muestra el peso diario separado de las medidas y con fecha", async () => {
  const seguimiento = api()
  seguimiento.dias = async () => ({
    dias: [
      {
        fecha: "2026-10-28",
        pesoKg: 75.5,
        pasos: null,
        suenoMin: null,
        creatina: null,
        suplementos: [],
      },
    ],
  })
  await render(<ProgresoRedisenado clienteId="cliente" seguimiento={seguimiento} />)
  expect(
    await screen.findByRole("button", {
      name: "Peso en ayunas, 75,5 kg, registro diario, 28 oct 2026",
    }),
  ).toBeOnTheScreen()
  expect(
    screen.getByRole("button", { name: "Peso, 80 a 76 kg, −4 kg, medida del 15 sep 2026" }),
  ).toBeOnTheScreen()
})

it("conserva el acceso a valoraciones publicadas", async () => {
  const valoraciones = {
    evolucion: async () => ({ series: [] }),
    listarPublicadas: async () => ({ valoraciones: [], total: 0 }),
    proximaRevision: async () => ({ fecha: null, nota: null, cumplidaPorValoracionId: null }),
  } as unknown as ApiValoracionesCliente & Pick<ApiEvolucionAvisos, "evolucion">
  await render(
    <ProgresoRedisenado clienteId="cliente" seguimiento={api()} valoraciones={valoraciones} />,
  )
  await fireEvent.press(await screen.findByRole("button", { name: "Ver valoraciones" }))
  expect(await screen.findByText(/Aún no tienes valoraciones publicadas/)).toBeOnTheScreen()
})

it("explica la falta de permiso sin ofrecer un reintento inútil", async () => {
  const seguimiento = api()
  seguimiento.configuracion = async () => {
    throw new ErrorDePermiso()
  }
  await render(<ProgresoRedisenado clienteId="cliente" seguimiento={seguimiento} />)
  expect(await screen.findByText("No tienes permiso para acceder a estos datos.")).toBeOnTheScreen()
  expect(screen.queryByRole("button", { name: "Reintentar" })).toBeNull()
})

it("la evolución corporal no expone peso ni pruebas desactivadas", async () => {
  const seguimiento = api()
  seguimiento.configuracion = async () => ({
    ...CONFIGURACION_SEGUIMIENTO_INICIAL,
    indicadores: [],
  })
  const punto = (valor: number) => ({
    fecha: "2026-09-15",
    valor,
    publicacionId: "21000000-0000-4000-8000-000000000001",
    valoracionId: "20000000-0000-4000-8000-000000000001",
    corregido: false,
  })
  const serie = (
    clave: string,
    nombre: string,
    bloque: "bioimpedancia" | "medidas" | "pruebas",
    unidad: string,
    valor: number,
  ) =>
    SerieEvolucionSchema.parse({
      clave,
      nombre,
      bloque,
      unidad,
      origen: "valoracion",
      metodo: null,
      clasificada: true,
      puntos: [punto(valor)],
    })
  const valoraciones = {
    evolucion: async () => ({
      series: [
        serie("grasa", "Grasa corporal", "bioimpedancia", "%", 20),
        serie("peso", "Peso privado", "medidas", "kg", 80),
        serie("prueba", "Flexiones privadas", "pruebas", "reps", 30),
      ],
    }),
  } as unknown as ApiValoracionesCliente & Pick<ApiEvolucionAvisos, "evolucion">
  await render(
    <ProgresoRedisenado
      clienteId="cliente"
      seguimiento={seguimiento}
      valoraciones={valoraciones}
    />,
  )
  await fireEvent.press(await screen.findByRole("button", { name: /^Grasa corporal,/ }))
  expect(await screen.findByTestId("serie Grasa corporal")).toBeOnTheScreen()
  expect(screen.queryByText("Peso privado")).toBeNull()
  expect(screen.queryByText("Flexiones privadas")).toBeNull()
})

it("la gráfica de fuerza muestra la carga real en kg y la identifica", async () => {
  const seguimiento = api()
  seguimiento.fuerza = async () => ({
    ejercicios: [
      {
        ejercicioId: "press",
        nombre: "Press inclinado",
        puntos: [
          { fecha: "2026-01-01", pesoKg: 60, repeticiones: 8, estimado: 76 },
          { fecha: "2026-02-01", pesoKg: 80, repeticiones: 8, estimado: 101 },
        ],
      },
    ],
  })
  const grafica = jest.spyOn(graficas, "Grafica")
  try {
    await render(<ProgresoRedisenado clienteId="cliente" seguimiento={seguimiento} />)
    await fireEvent.press(
      await screen.findByRole("button", {
        name: "Press inclinado, 60 kg por 8 repeticiones a 80 kg por 8 repeticiones, +20 kg, primer registro disponible",
      }),
    )
    expect(grafica.mock.calls.map(([props]) => props)).toContainEqual(
      expect.objectContaining({
        puntos: [
          { fecha: "2026-01-01", valor: 60 },
          { fecha: "2026-02-01", valor: 80 },
        ],
        unidad: "kg",
        descripcion:
          "Evolución de Press inclinado: carga en kg. Primero: 60 kg el 1 ene 2026. Último: 80 kg el 1 feb 2026. Cambio: +20 kg.",
      }),
    )
    expect(
      screen.getByRole("image", {
        name: "Evolución de Press inclinado: carga en kg. Primero: 60 kg el 1 ene 2026. Último: 80 kg el 1 feb 2026. Cambio: +20 kg.",
      }),
    ).toBeOnTheScreen()
  } finally {
    grafica.mockRestore()
  }
})

it.each([
  { activos: ["peso"] as const, visible: "Peso (kg)", oculto: "Cintura (cm)" },
  { activos: ["cintura"] as const, visible: "Cintura (cm)", oculto: "Peso (kg)" },
])("el formulario solo ofrece medidas activas: $visible", async ({ activos, visible, oculto }) => {
  const seguimiento = api()
  seguimiento.configuracion = async () => ({
    ...CONFIGURACION_SEGUIMIENTO_INICIAL,
    indicadores: [...activos],
  })
  await render(<ProgresoRedisenado clienteId="cliente" seguimiento={seguimiento} />)
  await fireEvent.press(await screen.findByRole("button", { name: "Añadir medida" }))
  expect(screen.getByLabelText(visible)).toBeOnTheScreen()
  expect(screen.queryByLabelText(oculto)).toBeNull()
})
