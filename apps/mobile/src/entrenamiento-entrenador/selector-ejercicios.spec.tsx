import { act, fireEvent, render, screen } from "@testing-library/react-native"
import type { ListadoEjercicios } from "@alpha-omega/shared"
import {
  catalogoEnMemoria,
  ejercicioDePrueba,
} from "../catalogo-ejercicios/pruebas/catalogo-en-memoria"
import { SelectorEjercicios } from "./selector-ejercicios"

const REMO = ejercicioDePrueba("10000000-0000-4000-8000-000000000001", "Remo", "espalda")
const PRESS = ejercicioDePrueba("10000000-0000-4000-8000-000000000002", "Press", "pecho")

function peticionPendiente() {
  let resolver!: (datos: ListadoEjercicios) => void
  let rechazar!: (error: Error) => void
  const promesa = new Promise<ListadoEjercicios>((resolve, reject) => {
    resolver = resolve
    rechazar = reject
  })
  return { promesa, resolver, rechazar }
}

async function avanzar(ms: number) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms)
  })
}

/** `cantidad` ejercicios «Ejercicio 01», «Ejercicio 02»… repartidos entre pecho y espalda. */
function muchos(cantidad: number) {
  return Array.from({ length: cantidad }, (_, n) =>
    ejercicioDePrueba(
      `10000000-0000-4000-8000-${String(n + 100).padStart(12, "0")}`,
      `Ejercicio ${String(n + 1).padStart(2, "0")}`,
      n % 2 === 0 ? "pecho" : "espalda",
    ),
  )
}

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

it("conserva los ejercicios durante el debounce y la petición de una nueva búsqueda", async () => {
  const pendiente = peticionPendiente()
  const api = catalogoEnMemoria([REMO, PRESS])
  const buscar = jest.spyOn(api, "buscar")
  const elegir = jest.fn()
  await render(<SelectorEjercicios api={api} elegir={elegir} />)
  await avanzar(250)
  buscar.mockReturnValueOnce(pendiente.promesa)

  await fireEvent.changeText(screen.getByLabelText("Buscar ejercicio para añadir"), "p")
  await avanzar(200)
  await fireEvent.changeText(screen.getByLabelText("Buscar ejercicio para añadir"), "press")
  expect(screen.getByRole("button", { name: "Añadir Remo" })).toBeOnTheScreen()
  expect(screen.queryByText("Buscando ejercicios…")).toBeNull()
  await avanzar(249)
  expect(buscar).toHaveBeenCalledTimes(1)
  await avanzar(1)
  expect(buscar).toHaveBeenLastCalledWith({
    buscar: "press",
    estado: "publicado",
    limite: 30,
    desplazamiento: 0,
  })
  await fireEvent.press(screen.getByRole("button", { name: "Añadir Remo" }))
  expect(elegir).toHaveBeenCalledWith(REMO)

  await act(async () => pendiente.resolver({ ejercicios: [PRESS], total: 1 }))
  expect(screen.getByRole("button", { name: "Añadir Press" })).toBeOnTheScreen()
  expect(screen.queryByRole("button", { name: "Añadir Remo" })).toBeNull()
})

it("muestra la carga inicial y espera a la respuesta antes de anunciar una búsqueda vacía", async () => {
  const pendiente = peticionPendiente()
  const api = { ...catalogoEnMemoria(), buscar: jest.fn(() => pendiente.promesa) }
  await render(<SelectorEjercicios api={api} elegir={jest.fn()} />)
  expect(screen.getByText("Buscando ejercicios…")).toBeOnTheScreen()
  expect(screen.queryByText("No hay ejercicios publicados con esa búsqueda.")).toBeNull()
  await avanzar(250)
  expect(screen.getByText("Buscando ejercicios…")).toBeOnTheScreen()

  await act(async () => pendiente.resolver({ ejercicios: [], total: 0 }))
  expect(screen.queryByText("Buscando ejercicios…")).toBeNull()
  expect(screen.getByText("No hay ejercicios publicados con esa búsqueda.")).toBeOnTheScreen()
})

it("enseña el grupo de cada ejercicio en su fila", async () => {
  await render(<SelectorEjercicios api={catalogoEnMemoria([REMO])} elegir={jest.fn()} />)
  await avanzar(250)
  const fila = screen.getByRole("button", { name: "Añadir Remo" })
  expect(fila.props.accessibilityHint).toBe("Grupo: Espalda")
  // El grupo se lee en la fila y no solo en el filtro.
  expect(screen.getAllByText("Espalda")).toHaveLength(2)
})

it("filtra por grupo muscular con los once grupos y lo pide al servidor", async () => {
  const api = catalogoEnMemoria([REMO, PRESS])
  const buscar = jest.spyOn(api, "buscar")
  await render(<SelectorEjercicios api={api} elegir={jest.fn()} />)
  await avanzar(250)
  expect(screen.getAllByRole("button", { name: /^Filtrar por / })).toHaveLength(11)
  expect(screen.getByRole("button", { name: "Quitar el filtro de grupo" })).toBeSelected()

  await fireEvent.press(screen.getByRole("button", { name: "Filtrar por Espalda" }))
  await avanzar(250)
  expect(buscar).toHaveBeenLastCalledWith({
    buscar: "",
    grupo: "espalda",
    estado: "publicado",
    limite: 30,
    desplazamiento: 0,
  })
  expect(screen.getByRole("button", { name: "Filtrar por Espalda" })).toBeSelected()
  expect(screen.getByRole("button", { name: "Añadir Remo" })).toBeOnTheScreen()
  expect(screen.queryByRole("button", { name: "Añadir Press" })).toBeNull()

  await fireEvent.press(screen.getByRole("button", { name: "Quitar el filtro de grupo" }))
  await avanzar(250)
  expect(screen.getByRole("button", { name: "Añadir Press" })).toBeOnTheScreen()
})

it("dice qué grupo no tiene resultados", async () => {
  await render(<SelectorEjercicios api={catalogoEnMemoria([PRESS])} elegir={jest.fn()} />)
  await avanzar(250)
  await fireEvent.press(screen.getByRole("button", { name: "Filtrar por Espalda" }))
  await avanzar(250)
  expect(
    screen.getByText("No hay ejercicios publicados de espalda con esa búsqueda."),
  ).toBeOnTheScreen()
})

it("suma páginas con «Cargar más ejercicios» sin perder las anteriores", async () => {
  const api = catalogoEnMemoria(muchos(35))
  const buscar = jest.spyOn(api, "buscar")
  await render(<SelectorEjercicios api={api} elegir={jest.fn()} />)
  await avanzar(250)
  expect(screen.getByText("Mostrando 30 de 35.")).toBeOnTheScreen()
  expect(screen.getByRole("button", { name: "Añadir Ejercicio 30" })).toBeOnTheScreen()
  expect(screen.queryByRole("button", { name: "Añadir Ejercicio 31" })).toBeNull()

  await fireEvent.press(screen.getByRole("button", { name: "Cargar más ejercicios" }))
  await avanzar(0)
  expect(buscar).toHaveBeenLastCalledWith({
    buscar: "",
    estado: "publicado",
    limite: 30,
    desplazamiento: 30,
  })
  expect(screen.getByRole("button", { name: "Añadir Ejercicio 01" })).toBeOnTheScreen()
  expect(screen.getByRole("button", { name: "Añadir Ejercicio 35" })).toBeOnTheScreen()
  expect(screen.queryByRole("button", { name: "Cargar más ejercicios" })).toBeNull()
})

it("no deja pedir otra página mientras llega la siguiente", async () => {
  const pendiente = peticionPendiente()
  const api = catalogoEnMemoria([REMO], 40)
  const buscar = jest.spyOn(api, "buscar")
  await render(<SelectorEjercicios api={api} elegir={jest.fn()} />)
  await avanzar(250)
  buscar.mockReturnValueOnce(pendiente.promesa)

  await fireEvent.press(screen.getByRole("button", { name: "Cargar más ejercicios" }))
  expect(screen.getByRole("button", { name: "Añadir Remo" })).toBeOnTheScreen()
  expect(screen.getByRole("button", { name: "Cargar más ejercicios" })).toBeDisabled()
  await fireEvent.press(screen.getByRole("button", { name: "Cargar más ejercicios" }))
  expect(buscar).toHaveBeenCalledTimes(2)

  await act(async () => pendiente.resolver({ ejercicios: [PRESS], total: 40 }))
  expect(screen.getByRole("button", { name: "Añadir Press" })).toBeOnTheScreen()
  expect(screen.getByRole("button", { name: "Añadir Remo" })).toBeOnTheScreen()
  expect(screen.getByRole("button", { name: "Cargar más ejercicios" })).toBeEnabled()
})

it("si el servidor no da ejercicios nuevos no se queda pidiendo páginas", async () => {
  const api = catalogoEnMemoria([REMO], 40)
  jest.spyOn(api, "buscar")
  await render(<SelectorEjercicios api={api} elegir={jest.fn()} />)
  await avanzar(250)
  await fireEvent.press(screen.getByRole("button", { name: "Cargar más ejercicios" }))
  await avanzar(0)
  expect(screen.queryByRole("button", { name: "Cargar más ejercicios" })).toBeNull()
})

it("avisa si falla una página y permite reintentarla", async () => {
  const api = catalogoEnMemoria([REMO], 40)
  const buscar = jest.spyOn(api, "buscar")
  await render(<SelectorEjercicios api={api} elegir={jest.fn()} />)
  await avanzar(250)
  buscar.mockRejectedValueOnce(new Error("Sin red"))

  await fireEvent.press(screen.getByRole("button", { name: "Cargar más ejercicios" }))
  await avanzar(0)
  expect(screen.getByRole("alert")).toHaveTextContent("No se pudieron cargar más ejercicios.")
  expect(screen.getByRole("button", { name: "Añadir Remo" })).toBeOnTheScreen()

  buscar.mockResolvedValueOnce({ ejercicios: [PRESS], total: 2 })
  await fireEvent.press(screen.getByRole("button", { name: "Reintentar cargar más" }))
  await avanzar(0)
  expect(screen.getByRole("button", { name: "Añadir Press" })).toBeOnTheScreen()
  expect(screen.queryByRole("alert")).toBeNull()
})

it("ignora una página de otra búsqueda que llega tarde", async () => {
  const antigua = peticionPendiente()
  const api = catalogoEnMemoria([REMO, PRESS], 40)
  const buscar = jest.spyOn(api, "buscar")
  await render(<SelectorEjercicios api={api} elegir={jest.fn()} />)
  await avanzar(250)
  buscar.mockReturnValueOnce(antigua.promesa)
  await fireEvent.press(screen.getByRole("button", { name: "Cargar más ejercicios" }))
  await fireEvent.press(screen.getByRole("button", { name: "Filtrar por Pecho" }))
  await avanzar(250)
  expect(screen.queryByRole("button", { name: "Añadir Remo" })).toBeNull()

  await act(async () =>
    antigua.resolver({
      ejercicios: [ejercicioDePrueba("10000000-0000-4000-8000-000000000009", "Tardío", "espalda")],
      total: 40,
    }),
  )
  expect(screen.queryByRole("button", { name: "Añadir Tardío" })).toBeNull()
  expect(screen.getByRole("button", { name: "Añadir Press" })).toBeOnTheScreen()
})

it.each(["respuesta", "error"] as const)(
  "ignora una %s antigua que llega después de la búsqueda más reciente",
  async (tipo) => {
    const antigua = peticionPendiente()
    const api = catalogoEnMemoria([PRESS])
    const buscar = jest.spyOn(api, "buscar").mockReturnValueOnce(antigua.promesa)
    await render(<SelectorEjercicios api={api} elegir={jest.fn()} />)
    await avanzar(250)
    await fireEvent.changeText(screen.getByLabelText("Buscar ejercicio para añadir"), "press")
    await avanzar(250)
    expect(buscar).toHaveBeenCalledTimes(2)
    expect(screen.getByRole("button", { name: "Añadir Press" })).toBeOnTheScreen()

    await act(async () => {
      if (tipo === "respuesta") antigua.resolver({ ejercicios: [REMO], total: 1 })
      else antigua.rechazar(new Error("Sin red"))
    })
    expect(screen.getByRole("button", { name: "Añadir Press" })).toBeOnTheScreen()
    expect(screen.queryByRole("button", { name: "Añadir Remo" })).toBeNull()
    expect(screen.queryByRole("alert")).toBeNull()
  },
)

it("permite reintentar una carga inicial fallida sin mostrar un catálogo vacío", async () => {
  const api = catalogoEnMemoria([REMO])
  jest.spyOn(api, "buscar").mockRejectedValueOnce(new Error("Sin red"))
  await render(<SelectorEjercicios api={api} elegir={jest.fn()} />)
  await avanzar(250)
  expect(screen.getByRole("alert")).toHaveTextContent("No se pudieron cargar los ejercicios.")
  expect(screen.queryByText("Buscando ejercicios…")).toBeNull()
  expect(screen.queryByText("No hay ejercicios publicados con esa búsqueda.")).toBeNull()

  await fireEvent.press(screen.getByRole("button", { name: "Reintentar" }))
  expect(screen.getByText("Buscando ejercicios…")).toBeOnTheScreen()
  await avanzar(250)
  expect(screen.getByRole("button", { name: "Añadir Remo" })).toBeOnTheScreen()
  expect(screen.queryByRole("alert")).toBeNull()
})

it("sin «alTerminar» no ofrece «Hecho» y cada pulsación avisa al contenedor", async () => {
  const elegir = jest.fn()
  await render(<SelectorEjercicios api={catalogoEnMemoria([REMO])} elegir={elegir} />)
  await avanzar(250)
  await fireEvent.press(screen.getByRole("button", { name: "Añadir Remo" }))
  expect(elegir).toHaveBeenCalledWith(REMO)
  expect(screen.queryByRole("button", { name: "Hecho" })).toBeNull()
})

it("con «alTerminar» se añaden varios sin cerrar, se confirma cada uno y «Hecho» termina", async () => {
  const elegir = jest.fn()
  const alTerminar = jest.fn()
  await render(
    <SelectorEjercicios
      api={catalogoEnMemoria([REMO, PRESS])}
      elegir={elegir}
      alTerminar={alTerminar}
    />,
  )
  await avanzar(250)
  expect(screen.queryByRole("button", { name: "Hecho" })).toBeNull()

  await fireEvent.press(screen.getByRole("button", { name: "Añadir Remo" }))
  expect(screen.getByText("«Remo» añadido. 1 ejercicio añadido.")).toBeOnTheScreen()
  expect(screen.getByText("✓ Añadido")).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole("button", { name: "Añadir Press" }))
  await fireEvent.press(screen.getByRole("button", { name: "Añadir Press" }))
  expect(elegir).toHaveBeenCalledTimes(3)
  expect(screen.getByText("«Press» añadido. 3 ejercicios añadidos.")).toBeOnTheScreen()
  expect(screen.getByText("✓ ×2")).toBeOnTheScreen()
  expect(screen.getByRole("button", { name: "Añadir Press" }).props.accessibilityValue).toEqual({
    text: "Añadido 2",
  })
  // La búsqueda y la lista siguen ahí para seguir añadiendo.
  expect(screen.getByLabelText("Buscar ejercicio para añadir")).toBeOnTheScreen()
  expect(alTerminar).not.toHaveBeenCalled()

  await fireEvent.press(screen.getByRole("button", { name: "Hecho" }))
  expect(alTerminar).toHaveBeenCalledTimes(1)
})
