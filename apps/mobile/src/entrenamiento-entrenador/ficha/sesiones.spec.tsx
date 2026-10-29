import { act, fireEvent, render, screen } from "@testing-library/react-native"
import type { ListadoResultados, Molestia } from "@alpha-omega/shared"
import type { ApiEntrenamiento } from "../../entrenamiento/api"

import { SesionesDelCliente } from "./sesiones"

const revisiones = { Empuje: null, Tracción: "2026-10-01T12:00:00Z" }
const api = {
  leerEntrenador: jest.fn(async (id: keyof typeof revisiones) => ({ revisadaEn: revisiones[id] })),
} as unknown as ApiEntrenamiento
const sinAcceso = jest.fn()
jest.mock("expo-router", () => ({
  useFocusEffect: (efecto: () => void) =>
    jest.requireActual<typeof import("react")>("react").useEffect(efecto, [efecto]),
}))

const resultados: ListadoResultados["resultados"] = ["Empuje", "Tracción"].map((nombre) => ({
  agenda: {
    id: nombre,
    clienteId: "cliente",
    fechaOriginal: "2026-10-01",
    fechaActual: "2026-10-01",
    estado: "cerrada",
    revision: 0,
  },
  resultado: {
    sesionId: nombre,
    revisionPrescripcion: 0,
    enviadoEn: "2026-10-01T10:00:00Z",
    notas: null,
    prescripcion: {
      nombre,
      ejercicios: [
        {
          id: "cal",
          ejercicioId: "movilidad",
          nombre: "Movilidad",
          indicaciones: null,
          seccion: "calentamiento",
          series: [{ id: "cal", tipoMedicion: "tiempo", pesoKg: null, segundos: 60 }],
        },
        {
          id: "principal",
          ejercicioId: "remo",
          nombre: "Remo",
          indicaciones: null,
          rir: { min: 3, max: 4 },
          series: ["bien", "rir", "reps", "omitida"].map((id) => ({
            id,
            tipoMedicion: "repeticiones",
            pesoKg: 20,
            repeticiones: 8,
          })),
        },
      ],
    },
    series: [
      {
        serieId: "cal",
        hecha: true,
        valores: { tipoMedicion: "tiempo", pesoKg: null, segundos: 60 },
      },
      {
        serieId: "bien",
        hecha: true,
        valores: { tipoMedicion: "repeticiones", pesoKg: 22.5, repeticiones: 8, rir: 3 },
      },
      {
        serieId: "rir",
        hecha: true,
        valores: { tipoMedicion: "repeticiones", pesoKg: 20, repeticiones: 8, rir: 1 },
      },
      {
        serieId: "reps",
        hecha: true,
        valores: { tipoMedicion: "repeticiones", pesoKg: 20, repeticiones: 6, rir: 3 },
      },
      { serieId: "omitida", hecha: false, omitida: true },
    ],
  },
}))

it("lista tarjetas navegables y filtra las revisiones pendientes sin editar la sesión", async () => {
  const abrir = jest.fn()
  await render(
    <SesionesDelCliente
      resultados={resultados}
      molestias={[]}
      api={api}
      sinAcceso={sinAcceso}
      abrir={abrir}
    />,
  )
  expect(screen.getByRole("button", { name: /^Empuje ·/ })).toBeOnTheScreen()
  expect(screen.getByRole("button", { name: /^Tracción ·/ })).toBeOnTheScreen()
  expect(screen.queryByLabelText("Comentario sobre la sesión")).toBeNull()
  expect(screen.queryByRole("button", { name: "Sesión anterior" })).toBeNull()
  expect(screen.queryByRole("button", { name: "Marcar como revisada" })).toBeNull()
  await fireEvent.press(screen.getByRole("button", { name: "Sin revisar" }))
  expect(screen.queryByRole("button", { name: /^Tracción ·/ })).toBeNull()
  await fireEvent.press(screen.getByRole("button", { name: /^Empuje ·/ }))
  expect(abrir).toHaveBeenCalledWith("Empuje")
  await fireEvent.press(screen.getByRole("button", { name: "Todas" }))
  expect(screen.getByRole("button", { name: /^Tracción ·/ })).toBeOnTheScreen()
})

it("representa cada serie de trabajo y comunica RIR bajo, carga y molestia", async () => {
  await render(
    <SesionesDelCliente
      resultados={[resultados[0]!]}
      api={api}
      sinAcceso={sinAcceso}
      molestias={[
        {
          id: "m",
          sesionId: "Empuje",
          ejercicioPrescritoId: "principal",
          estado: "abierta",
        } as Molestia,
      ]}
      abrir={jest.fn()}
    />,
  )
  expect(screen.getAllByTestId(/^serie-resumen-/)).toHaveLength(4)
  expect(screen.getByTestId("serie-resumen-bien")).toHaveStyle({
    width: 14,
    height: 14,
    borderRadius: 4,
  })
  expect(screen.getByTestId("serie-resumen-rir")).toHaveStyle({ borderStyle: "dashed" })
  expect(screen.getByTestId("serie-resumen-reps")).toHaveStyle({ borderStyle: "dashed" })
  expect(screen.getByLabelText("Serie 4, omitida")).toBeOnTheScreen()
  expect(screen.getByText("1 serie con RIR bajo")).toBeOnTheScreen()
  expect(screen.getByText("Cargas que suben")).toBeOnTheScreen()
  expect(screen.getByText("Molestia pendiente")).toBeOnTheScreen()
})

it("mantiene el filtro al recibir nuevas sesiones y ofrece un vacío claro", async () => {
  const vista = (lista: typeof resultados) => (
    <SesionesDelCliente
      resultados={lista}
      molestias={[]}
      api={api}
      sinAcceso={sinAcceso}
      abrir={jest.fn()}
    />
  )
  await render(vista([resultados[1]!]))
  await fireEvent.press(screen.getByRole("button", { name: "Sin revisar" }))
  expect(screen.getByText("Todas las sesiones están revisadas.")).toBeOnTheScreen()
  await screen.rerender(vista(resultados))
  expect(
    screen.getByRole("button", { name: "Sin revisar" }).props.accessibilityState.selected,
  ).toBe(true)
  expect(screen.getByRole("button", { name: /^Empuje ·/ })).toBeOnTheScreen()
  await screen.rerender(vista([]))
  expect(screen.getByText("El cliente aún no ha enviado ninguna sesión.")).toBeOnTheScreen()
})

it("consulta la revisión real sin inventarla desde el resultado y permite reintentar el error", async () => {
  let resolver!: (valor: { revisadaEn: null }) => void
  const leerEntrenador = jest
    .fn()
    .mockRejectedValueOnce(new Error("sin red"))
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolver = resolve
        }),
    )
  await render(
    <SesionesDelCliente
      resultados={[resultados[0]!]}
      molestias={[]}
      api={{ leerEntrenador } as unknown as ApiEntrenamiento}
      sinAcceso={sinAcceso}
      abrir={jest.fn()}
    />,
  )
  expect(screen.getByText("Revisión no disponible")).toBeOnTheScreen()
  expect(screen.getAllByText("Sin revisar")).toHaveLength(1)
  await fireEvent.press(screen.getByRole("button", { name: "Reintentar revisión de Empuje" }))
  expect(screen.getByText("Comprobando revisión")).toBeOnTheScreen()
  await act(async () => resolver({ revisadaEn: null }))
  expect(screen.getAllByText("Sin revisar")).toHaveLength(2)
  expect(leerEntrenador).toHaveBeenCalledTimes(2)
  expect(leerEntrenador).toHaveBeenLastCalledWith("Empuje")
})

it("mantiene un máximo de cuatro lecturas cuando llegan sesiones durante una consulta", async () => {
  const completar: Array<() => void> = []
  const leerEntrenador = jest.fn<Promise<{ revisadaEn: null }>, [string]>(async () => ({
    revisadaEn: null,
  }))
  for (let n = 0; n < 4; n++)
    leerEntrenador.mockImplementationOnce(
      () => new Promise((resolve) => completar.push(() => resolve({ revisadaEn: null }))),
    )
  const datos = { ...api, leerEntrenador } as unknown as ApiEntrenamiento
  const lista = Array.from({ length: 6 }, (_, n) => ({
    ...resultados[0]!,
    agenda: { ...resultados[0]!.agenda, id: String(n) },
  }))
  const vista = (elementos: typeof lista) => (
    <SesionesDelCliente
      resultados={elementos}
      molestias={[]}
      api={datos}
      sinAcceso={sinAcceso}
      abrir={jest.fn()}
    />
  )
  await render(vista(lista))
  expect(leerEntrenador).toHaveBeenCalledTimes(4)
  await screen.rerender(
    vista([...lista, { ...lista[0]!, agenda: { ...lista[0]!.agenda, id: "nueva" } }]),
  )
  expect(leerEntrenador).toHaveBeenCalledTimes(4)
  await act(async () => completar.forEach((resolver) => resolver()))
  expect(leerEntrenador).toHaveBeenCalledTimes(7)
  expect(leerEntrenador.mock.calls.map((llamada) => llamada[0])).toEqual([
    "0",
    "1",
    "2",
    "3",
    "4",
    "5",
    "nueva",
  ])
})
