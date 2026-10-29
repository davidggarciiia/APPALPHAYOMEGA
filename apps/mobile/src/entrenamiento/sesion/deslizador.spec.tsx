import { fireEvent, render, screen } from "@testing-library/react-native"

import { Deslizador } from "./controles"

const toque = (pageX: number, pageY: number, locationX = pageX) => ({
  nativeEvent: { pageX, pageY, locationX },
})

async function preparar() {
  const cambiar = jest.fn()
  await render(<Deslizador valor={5} cambiar={cambiar} maximo={10} etiqueta="Esfuerzo" />)
  await fireEvent(screen.getByRole("adjustable"), "layout", {
    nativeEvent: { layout: { width: 100 } },
  })
  return { cambiar, deslizador: screen.getByRole("adjustable", { name: "Esfuerzo" }) }
}

it("deja el gesto vertical al scroll y no cambia el valor al levantar el dedo", async () => {
  const { cambiar, deslizador } = await preparar()
  await fireEvent(deslizador, "touchStart", toque(70, 20))
  expect(deslizador.props.onStartShouldSetResponder?.(toque(70, 20)) ?? false).toBe(false)
  expect(deslizador.props.onMoveShouldSetResponder(toque(72, 60))).toBe(false)
  await fireEvent(deslizador, "touchEnd", toque(72, 60))
  expect(cambiar).not.toHaveBeenCalled()
})

it("reclama el arrastre horizontal y no lo repite como toque al terminar cerca del inicio", async () => {
  const { cambiar, deslizador } = await preparar()
  await fireEvent(deslizador, "touchStart", toque(20, 20))
  expect(deslizador.props.onMoveShouldSetResponder(toque(60, 22))).toBe(true)
  await fireEvent(deslizador, "responderGrant", toque(60, 22))
  await fireEvent(deslizador, "responderMove", toque(80, 24))
  await fireEvent(deslizador, "responderMove", toque(22, 20))
  await fireEvent(deslizador, "touchEnd", toque(22, 20))
  expect(cambiar.mock.calls).toEqual([[6], [8], [2]])
})

it("un toque ajusta el valor una sola vez sin reclamar el gesto al empezar", async () => {
  const { cambiar, deslizador } = await preparar()
  await fireEvent(deslizador, "touchStart", toque(70, 20))
  await fireEvent(deslizador, "touchEnd", toque(70, 20))
  expect(cambiar.mock.calls).toEqual([[7]])
})

it("un gesto cancelado no se convierte después en un toque", async () => {
  const { cambiar, deslizador } = await preparar()
  await fireEvent(deslizador, "touchStart", toque(70, 20))
  await fireEvent(deslizador, "touchCancel", toque(70, 20))
  await fireEvent(deslizador, "touchEnd", toque(70, 20))
  expect(cambiar).not.toHaveBeenCalled()
})

it("mantiene las acciones accesibles para subir y bajar", async () => {
  const { cambiar, deslizador } = await preparar()
  await fireEvent(deslizador, "accessibilityAction", { nativeEvent: { actionName: "increment" } })
  await fireEvent(deslizador, "accessibilityAction", { nativeEvent: { actionName: "decrement" } })
  expect(cambiar.mock.calls).toEqual([[6], [4]])
})

it("el tirador permanece dentro de la pista en el máximo y el lector no lo rebasa", async () => {
  const cambiar = jest.fn()
  await render(<Deslizador valor={10} cambiar={cambiar} maximo={10} etiqueta="Intensidad" />)
  const deslizador = screen.getByRole("adjustable")
  await fireEvent(deslizador, "layout", { nativeEvent: { layout: { width: 100 } } })
  const tirador = deslizador.queryAll((elemento) => elemento.props.pointerEvents === "none")[1]!
  expect(tirador).toHaveStyle({ left: 92 })
  await fireEvent(deslizador, "accessibilityAction", { nativeEvent: { actionName: "increment" } })
  expect(cambiar).toHaveBeenCalledWith(10)
})
