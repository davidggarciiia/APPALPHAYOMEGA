import { fireEvent, render, screen } from "@testing-library/react-native"
import type { ListadoResultados, Molestia } from "@alpha-omega/shared"

import { SesionesDelCliente } from "./sesiones"

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

it("abre cualquier sesión enviada sin etiquetas, filtro ni consultas de revisión", async () => {
  const abrir = jest.fn()
  await render(<SesionesDelCliente resultados={resultados} molestias={[]} abrir={abrir} />)
  expect(screen.queryAllByText(/revis/i)).toHaveLength(0)
  expect(screen.queryByRole("button", { name: "Todas" })).toBeNull()
  expect(screen.queryAllByLabelText(/revis/i)).toHaveLength(0)
  expect(screen.queryByLabelText("Comentario sobre la sesión")).toBeNull()
  expect(screen.queryByRole("button", { name: "Sesión anterior" })).toBeNull()
  for (const nombre of ["Empuje", "Tracción"]) {
    await fireEvent.press(screen.getByRole("button", { name: new RegExp(`^${nombre} ·`) }))
    expect(abrir).toHaveBeenLastCalledWith(nombre)
  }
})

it("representa cada serie de trabajo y comunica RIR bajo, carga y molestia", async () => {
  await render(
    <SesionesDelCliente
      resultados={[resultados[0]!]}
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

it("incorpora nuevas sesiones sin filtrar y muestra el vacío solo sin envíos", async () => {
  const vista = (lista: typeof resultados) => (
    <SesionesDelCliente resultados={lista} molestias={[]} abrir={jest.fn()} />
  )
  await render(vista([resultados[1]!]))
  expect(screen.getByRole("button", { name: /^Tracción ·/ })).toBeOnTheScreen()
  await screen.rerender(vista(resultados))
  expect(screen.getAllByRole("button")).toHaveLength(2)
  await screen.rerender(vista([]))
  expect(screen.getByText("El cliente aún no ha enviado ninguna sesión.")).toBeOnTheScreen()
})

it("ignora marcas históricas de revisión y permite abrir ambas sesiones", async () => {
  const abrir = jest.fn()
  const lista = resultados.map((r, i) => ({
    ...r,
    revisadaEn: i === 0 ? null : "2026-10-01T12:00:00Z",
  }))
  await render(<SesionesDelCliente resultados={lista} molestias={[]} abrir={abrir} />)
  expect(screen.queryAllByText(/revis/i)).toHaveLength(0)
  expect(screen.queryAllByLabelText(/revis/i)).toHaveLength(0)
  expect(screen.getAllByRole("button")).toHaveLength(2)
  await fireEvent.press(screen.getByRole("button", { name: /^Tracción ·/ }))
  expect(abrir).toHaveBeenCalledWith("Tracción")
})
