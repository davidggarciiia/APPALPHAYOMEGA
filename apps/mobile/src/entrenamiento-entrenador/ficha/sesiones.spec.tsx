import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { StyleSheet } from "react-native"
import type { ComentarioSesion, ListadoResultados } from "@alpha-omega/shared"
import type { ApiEntrenamiento } from "../../entrenamiento/api"
import { SesionesDelCliente } from "./sesiones"

jest.mock("../../componentes/iconos", () => ({ Icono: () => null }))
const resultados: ListadoResultados["resultados"] = ["A", "B"].map((nombre) => ({
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
    prescripcion: { nombre, ejercicios: [] },
    revisionPrescripcion: 0,
    enviadoEn: "2026-10-01T10:00:00.000Z",
    notas: null,
    series: [],
  },
}))

it("distingue por día y mes los comentarios escritos el mismo día de semanas distintas", async () => {
  const api = {
    comentarios: async () => ({
      comentarios: ["01", "22"].map((dia) => ({
        id: `comentario-${dia}`,
        sesionId: "A",
        ejercicioPrescritoId: null,
        ejercicio: null,
        texto: `Comentario del ${dia}`,
        autor: { id: "cliente", nombre: "Lara", rol: "cliente" },
        creadoEn: `2026-10-${dia}T10:00:00.000Z`,
      })),
    }),
  } as unknown as ApiEntrenamiento
  await render(
    <SesionesDelCliente
      resultados={resultados}
      molestias={[]}
      api={api}
      cuentaId="entrenador"
      nuevoId={() => "operacion"}
    />,
  )
  expect(screen.getByText(/Lara,.*1 oct/)).toBeOnTheScreen()
  expect(screen.getByText(/Lara,.*22 oct/)).toBeOnTheScreen()
})

it.each(["Sesión anterior", "Sesión siguiente"])(
  "%s tiene una caja propia de al menos 44 × 44 sin depender del margen exterior",
  async (nombre) => {
    const api = { comentarios: async () => ({ comentarios: [] }) } as unknown as ApiEntrenamiento
    await render(
      <SesionesDelCliente
        resultados={resultados}
        molestias={[]}
        api={api}
        cuentaId="entrenador"
        nuevoId={() => "operacion"}
      />,
    )
    const flecha = screen.getByRole("button", { name: nombre })
    const estilo = StyleSheet.flatten(flecha.props.style)
    expect(estilo.width).toBeGreaterThanOrEqual(44)
    expect(estilo.height).toBeGreaterThanOrEqual(44)
  },
)

it("marca revisada solo al pulsar y conserva la confirmación de cada sesión", async () => {
  const revisar = jest.fn(async () => ({}))
  const api = {
    comentarios: async () => ({ comentarios: [] }),
    revisar,
  } as unknown as ApiEntrenamiento
  await render(
    <SesionesDelCliente
      resultados={resultados}
      molestias={[]}
      api={api}
      cuentaId="entrenador"
      nuevoId={() => "operacion"}
    />,
  )
  expect(revisar).not.toHaveBeenCalled()
  await fireEvent.press(screen.getByRole("button", { name: "Marcar como revisada" }))
  expect(revisar).toHaveBeenCalledWith("A")
  expect(screen.getByText("Revisada")).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole("button", { name: "Sesión anterior" }))
  expect(screen.getByRole("button", { name: "Marcar como revisada" })).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole("button", { name: "Sesión siguiente" }))
  expect(screen.getByText("Revisada")).toBeOnTheScreen()
})

it("un error de revisión permite reintentar y no confirma la sesión antes de tiempo", async () => {
  const revisar = jest.fn().mockRejectedValueOnce(new Error("sin red")).mockResolvedValueOnce({})
  const api = {
    comentarios: async () => ({ comentarios: [] }),
    revisar,
  } as unknown as ApiEntrenamiento
  await render(
    <SesionesDelCliente
      resultados={resultados}
      molestias={[]}
      api={api}
      cuentaId="entrenador"
      nuevoId={() => "operacion"}
    />,
  )
  await fireEvent.press(screen.getByRole("button", { name: "Marcar como revisada" }))
  expect(screen.getByRole("alert")).toBeOnTheScreen()
  expect(screen.queryByText("Revisada")).toBeNull()
  await fireEvent.press(screen.getByRole("button", { name: "Marcar como revisada" }))
  expect(revisar).toHaveBeenCalledTimes(2)
  expect(screen.getByText("Revisada")).toBeOnTheScreen()
  expect(screen.queryByRole("alert")).toBeNull()
})

it("una doble pulsación revisa A una vez y su respuesta tardía no marca B", async () => {
  let resolver!: (valor: object) => void
  const revisar = jest.fn(
    () =>
      new Promise((resolve) => {
        resolver = resolve
      }),
  )
  const api = {
    comentarios: async () => ({ comentarios: [] }),
    revisar,
  } as unknown as ApiEntrenamiento
  await render(
    <SesionesDelCliente
      resultados={resultados}
      molestias={[]}
      api={api}
      cuentaId="entrenador"
      nuevoId={() => "operacion"}
    />,
  )
  const boton = screen.getByRole("button", { name: "Marcar como revisada" })
  await fireEvent.press(boton)
  await fireEvent.press(boton)
  expect(revisar).toHaveBeenCalledTimes(1)
  await fireEvent.press(screen.getByRole("button", { name: "Sesión anterior" }))
  await act(async () => resolver({}))
  expect(screen.getByRole("header", { name: /^B ·/ })).toBeOnTheScreen()
  expect(screen.queryByText("Revisada")).toBeNull()
  expect(screen.getByRole("button", { name: "Marcar como revisada" })).toBeEnabled()
  await fireEvent.press(screen.getByRole("button", { name: "Sesión siguiente" }))
  expect(screen.getByText("Revisada")).toBeOnTheScreen()
})

it("un resultado nuevo al principio conserva la sesión y el borrador que se está comentando", async () => {
  const comentar = jest.fn(async () => ({
    id: "comentario-B",
    sesionId: "B",
    ejercicioPrescritoId: null,
    ejercicio: null,
    texto: "Borrador B",
    autor: { id: "entrenador", nombre: "Entrenador", rol: "entrenador" },
    creadoEn: "2026-10-01T10:00:00.000Z",
  }))
  const api = {
    comentarios: async () => ({ comentarios: [] }),
    comentar,
  } as unknown as ApiEntrenamiento
  const vista = (lista: ListadoResultados["resultados"]): React.JSX.Element => (
    <SesionesDelCliente
      resultados={lista}
      molestias={[]}
      api={api}
      cuentaId="entrenador"
      nuevoId={() => "operacion"}
    />
  )
  await render(vista(resultados))
  await fireEvent.press(screen.getByRole("button", { name: "Sesión anterior" }))
  await fireEvent.changeText(screen.getByLabelText("Comentario sobre la sesión"), "Borrador B")
  const nueva = {
    ...resultados[0]!,
    agenda: { ...resultados[0]!.agenda, id: "C" },
    resultado: {
      ...resultados[0]!.resultado,
      sesionId: "C",
      prescripcion: { nombre: "C", ejercicios: [] },
    },
  }
  await screen.rerender(vista([nueva, ...resultados]))
  expect(screen.getByRole("header", { name: /^B ·/ })).toBeOnTheScreen()
  expect(screen.getByDisplayValue("Borrador B")).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole("button", { name: "Enviar comentario" }))
  expect(comentar).toHaveBeenCalledWith("B", expect.objectContaining({ texto: "Borrador B" }))
})

it("tras una respuesta perdida conserva el reintento de A y separa el borrador y la operación de B", async () => {
  const comentar = jest
    .fn<ReturnType<ApiEntrenamiento["comentar"]>, Parameters<ApiEntrenamiento["comentar"]>>()
    .mockRejectedValueOnce(new Error("respuesta perdida"))
    .mockImplementation(async (sesionId, datos) => ({
      id: `comentario-${sesionId}`,
      sesionId,
      ejercicioPrescritoId: null,
      ejercicio: null,
      texto: datos.texto,
      autor: { id: "entrenador", nombre: "Entrenador", rol: "entrenador" },
      creadoEn: "2026-10-01T10:00:00.000Z",
    }))
  const api = {
    comentarios: async () => ({ comentarios: [] }),
    comentar,
  } as unknown as ApiEntrenamiento
  let n = 0
  await render(
    <SesionesDelCliente
      resultados={resultados}
      molestias={[]}
      api={api}
      cuentaId="entrenador"
      nuevoId={() => `10000000-0000-4000-8000-${String(++n).padStart(12, "0")}`}
    />,
  )
  await fireEvent.changeText(screen.getByLabelText("Comentario sobre la sesión"), "Comentario A")
  await fireEvent.press(screen.getByRole("button", { name: "Enviar comentario" }))
  expect(screen.getByLabelText("Comentario sobre la sesión").props.editable).toBe(false)
  await fireEvent.press(screen.getByRole("button", { name: "Sesión anterior" }))
  expect(screen.getByLabelText("Comentario sobre la sesión").props.value).toBe("")
  await fireEvent.changeText(screen.getByLabelText("Comentario sobre la sesión"), "Borrador B")
  await fireEvent.press(screen.getByRole("button", { name: "Enviar comentario" }))
  expect(comentar.mock.calls[1]![1].operacionId).not.toBe(comentar.mock.calls[0]![1].operacionId)
  await fireEvent.press(screen.getByRole("button", { name: "Sesión siguiente" }))
  expect(screen.getByDisplayValue("Comentario A")).toBeTruthy()
  await fireEvent.press(screen.getByRole("button", { name: "Enviar comentario" }))
  expect(comentar.mock.calls[2]).toEqual(comentar.mock.calls[0])
})
it.each(["correcta", "fallida"])(
  "con respuesta %s bloquea cambiar de sesión y editar otro borrador mientras envía",
  async (respuesta) => {
    let resolver!: (valor: ComentarioSesion) => void
    let rechazar!: (error: Error) => void
    const comentar = jest.fn(
      () =>
        new Promise<ComentarioSesion>((resolve, reject) => {
          resolver = resolve
          rechazar = reject
        }),
    )
    const api = {
      comentarios: async () => ({ comentarios: [] }),
      comentar,
    } as unknown as ApiEntrenamiento
    await render(
      <SesionesDelCliente
        resultados={resultados}
        molestias={[]}
        api={api}
        cuentaId="entrenador"
        nuevoId={() => "operacion"}
      />,
    )
    await fireEvent.changeText(screen.getByLabelText("Comentario sobre la sesión"), "Comentario A")
    await fireEvent.press(screen.getByRole("button", { name: "Enviar comentario" }))
    expect(screen.getByRole("button", { name: "Sesión anterior" })).toBeDisabled()
    expect(screen.getByLabelText("Comentario sobre la sesión").props.editable).toBe(false)
    await fireEvent.press(screen.getByRole("button", { name: "Sesión anterior" }))
    expect(screen.getByText(/A ·/)).toBeTruthy()
    await act(async () => {
      if (respuesta === "fallida") rechazar(new Error("sin red"))
      else
        resolver({
          id: "comentario",
          sesionId: "A",
          ejercicioPrescritoId: null,
          ejercicio: null,
          texto: "Comentario A",
          autor: { id: "entrenador", nombre: "Entrenador", rol: "entrenador" },
          creadoEn: "2026-10-01T10:00:00.000Z",
        })
    })
    if (respuesta === "fallida") expect(screen.getByDisplayValue("Comentario A")).toBeTruthy()
    await fireEvent.press(screen.getByRole("button", { name: "Sesión anterior" }))
    await fireEvent.changeText(screen.getByLabelText("Comentario sobre la sesión"), "Borrador B")
    expect(screen.getByDisplayValue("Borrador B")).toBeTruthy()
    expect(comentar).toHaveBeenCalledTimes(1)
  },
)
