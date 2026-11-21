import { render, screen, within } from "@testing-library/react-native"
import { CONFIGURACION_SEGUIMIENTO_INICIAL, type MedioFoto } from "@alpha-omega/shared"
import type { ApiSeguimiento } from "./api"
import type { ApiMedios } from "./medios-api"
import type { ApiEvolucionAvisos, ApiValoracionesCliente } from "./valoraciones-api"
import { ProgresoRedisenado } from "./progreso-redisenado"

jest.mock("expo-router", () => {
  const React = jest.requireActual<typeof import("react")>("react")
  return { useFocusEffect: (efecto: () => void) => React.useEffect(efecto, [efecto]) }
})
jest.mock("expo-crypto", () => ({ randomUUID: () => "10000000-0000-4000-8000-000000000001" }))

const cliente = "10000000-0000-4000-8000-000000000001"
const seguimiento = {
  configuracion: async () => ({
    ...CONFIGURACION_SEGUIMIENTO_INICIAL,
    indicadores: ["peso", "cintura", "fuerza", "pruebas"],
  }),
  dias: async () => ({
    dias: [
      {
        fecha: "2026-10-01",
        pesoKg: 80,
        pasos: null,
        suenoMin: null,
        creatina: null,
        suplementos: [],
      },
      {
        fecha: "2026-10-28",
        pesoKg: 76,
        pasos: null,
        suenoMin: null,
        creatina: null,
        suplementos: [],
      },
    ],
  }),
  medidas: async () => ({
    medidas: [
      {
        id: "40000000-0000-4000-8000-000000000001",
        fecha: "2026-01-10",
        pesoKg: null,
        cinturaCm: 95,
        grasaPct: null,
        alturaCm: null,
        creadoEn: "2026-01-10T08:00:00.000Z",
      },
      {
        id: "40000000-0000-4000-8000-000000000002",
        fecha: "2026-09-15",
        pesoKg: null,
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
        nombre: "Press",
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
} as unknown as ApiSeguimiento

const valoraciones = {
  evolucion: async () => ({
    series: [
      {
        clave: "grasa",
        nombre: "Grasa corporal",
        bloque: "bioimpedancia",
        origen: "valoracion",
        clasificada: true,
        metodo: "Bioimpedancia",
        unidad: "%",
        puntos: [
          {
            fecha: "2026-01-10",
            valor: 30,
            valoracionId: "20000000-0000-4000-8000-000000000001",
            publicacionId: "21000000-0000-4000-8000-000000000001",
            corregido: false,
          },
          {
            fecha: "2026-09-15",
            valor: 25,
            valoracionId: "20000000-0000-4000-8000-000000000002",
            publicacionId: "21000000-0000-4000-8000-000000000002",
            corregido: false,
          },
        ],
      },
    ],
  }),
} as unknown as ApiValoracionesCliente & Pick<ApiEvolucionAvisos, "evolucion">

const foto: MedioFoto = {
  id: "30000000-0000-4000-8000-000000000001",
  clienteId: cliente,
  autor: { id: cliente, nombre: "Cliente" },
  origen: "cliente",
  vista: "frente",
  etiqueta: null,
  fechaToma: "2026-01-10",
  estado: "disponible",
  tipoMime: "image/jpeg",
  bytes: 1234,
  valoracionId: null,
  solicitudId: null,
  creadoEn: "2026-01-10T09:00:00.000Z",
  confirmadoEn: "2026-01-10T09:01:00.000Z",
}
const medios = {
  fotosDeCliente: async () => ({
    fotos: [foto, { ...foto, id: "30000000-0000-4000-8000-000000000002", fechaToma: "2026-10-28" }],
  }),
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
} as unknown as ApiMedios

it("sitúa antes y ahora con fotos al inicio y destaca debajo el peso diario", async () => {
  const vista = await render(
    <ProgresoRedisenado
      clienteId={cliente}
      seguimiento={seguimiento}
      valoraciones={valoraciones}
      medios={medios}
    />,
  )
  await screen.findByText(/^antes$/i)
  expect(screen.getByText(/^ahora$/i)).toBeOnTheScreen()
  expect(screen.getByText(/^peso en ayunas$/i)).toBeOnTheScreen()
  const textos = vista.container
    .queryAll((nodo) => nodo.type === "Text")
    .map((nodo) => nodo.children.filter((hijo) => typeof hijo === "string").join(""))
  expect(textos.findIndex((texto) => /^antes$/i.test(texto))).toBeLessThan(
    textos.findIndex((texto) => /^peso en ayunas$/i.test(texto)),
  )
  expect(screen.queryByRole("header", { name: /^resumen$/i })).toBeNull()
})

it("ordena medidas, composición, fuerza y pruebas sin cabecera de resumen plana", async () => {
  await render(
    <ProgresoRedisenado
      clienteId={cliente}
      seguimiento={seguimiento}
      valoraciones={valoraciones}
    />,
  )
  const medidas = await screen.findByRole("header", { name: /^medidas$/i })
  const composicion = screen.getByRole("header", { name: /^composición$/i })
  const fuerza = screen.getByRole("header", { name: /^fuerza$/i })
  const pruebas = screen.getByRole("header", { name: /^pruebas$/i })
  const titulos = screen.getAllByRole("header")
  expect(titulos.indexOf(medidas)).toBeLessThan(titulos.indexOf(composicion))
  expect(titulos.indexOf(composicion)).toBeLessThan(titulos.indexOf(fuerza))
  expect(titulos.indexOf(fuerza)).toBeLessThan(titulos.indexOf(pruebas))
  expect(screen.queryByRole("header", { name: /^resumen$/i })).toBeNull()
})

it("sin fotos conserva el peso diario destacado y no inventa comparaciones", async () => {
  await render(
    <ProgresoRedisenado
      clienteId={cliente}
      seguimiento={seguimiento}
      valoraciones={valoraciones}
    />,
  )
  expect(await screen.findByText(/^peso en ayunas$/i)).toBeOnTheScreen()
  expect(screen.queryByText(/^antes$/i)).toBeNull()
  expect(screen.queryByText(/^ahora$/i)).toBeNull()
})

it("destaca la medida de peso más reciente sin compararla con el registro diario antiguo", async () => {
  const datos = {
    ...seguimiento,
    dias: async () => ({
      dias: [
        {
          fecha: "2026-10-01",
          pesoKg: 76,
          pasos: null,
          suenoMin: null,
          creatina: null,
          suplementos: [],
        },
      ],
    }),
    medidas: async () => ({
      medidas: [
        {
          id: "40000000-0000-4000-8000-000000000001",
          fecha: "2026-10-28",
          pesoKg: 80,
          cinturaCm: null,
          grasaPct: null,
          alturaCm: null,
          creadoEn: "2026-10-28T08:00:00.000Z",
        },
      ],
      fechaNacimiento: null,
    }),
  } as ApiSeguimiento
  const vista = await render(<ProgresoRedisenado clienteId={cliente} seguimiento={datos} />)
  const peso = await screen.findByRole("button", { name: /^Peso, 80 kg/ })
  expect(within(peso).queryByText("76")).toBeNull()
  expect(within(peso).queryByText(/−4 kg/)).toBeNull()
  expect(screen.getByRole("button", { name: /^Peso (diario|en ayunas), 76 kg/ })).toBeOnTheScreen()
  const etiquetas = vista.container
    .queryAll((nodo) => nodo.props.accessibilityRole === "button")
    .map((nodo) => nodo.props.accessibilityLabel as string | undefined)
  expect(etiquetas.findIndex((etiqueta) => etiqueta?.startsWith("Peso, 80 kg"))).toBeLessThan(
    etiquetas.findIndex((etiqueta) => /^Peso (diario|en ayunas), 76 kg/.test(etiqueta ?? "")),
  )
})

it("muestra en la fila de fuerza las repeticiones de ambas marcas", async () => {
  const datos = {
    ...seguimiento,
    fuerza: async () => ({
      ejercicios: [
        {
          ejercicioId: "60000000-0000-4000-8000-000000000001",
          nombre: "Press",
          puntos: [
            { fecha: "2026-01-01", pesoKg: 60, repeticiones: 10, estimado: 80 },
            { fecha: "2026-02-01", pesoKg: 80, repeticiones: 2, estimado: 85.3 },
          ],
        },
      ],
    }),
  } as ApiSeguimiento
  await render(<ProgresoRedisenado clienteId={cliente} seguimiento={datos} />)
  const fila = await screen.findByRole("button", { name: /Press,.*80 kg/ })
  const textos = fila
    .queryAll((nodo) => nodo.type === "Text")
    .map((nodo) => nodo.children.filter((hijo) => typeof hijo === "string").join(""))
    .join(" ")
  expect(textos).toMatch(/60\s*(?:kg\s*)?[×x]\s*10/i)
  expect(textos).toMatch(/80\s*(?:kg\s*)?[×x]\s*2/i)
  expect(
    screen.getByTestId("tramo-fuerza-60000000-0000-4000-8000-000000000001-aumento", {
      includeHiddenElements: true,
    }),
  ).toHaveStyle({ width: "25%" })
})
