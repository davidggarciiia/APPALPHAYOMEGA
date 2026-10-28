import { act, fireEvent, render, screen } from "@testing-library/react-native"
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
