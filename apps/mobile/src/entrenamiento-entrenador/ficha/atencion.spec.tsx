import { fireEvent, render, screen } from "@testing-library/react-native"
import type { Molestia } from "@alpha-omega/shared"

import { DialogoResponder } from "./atencion"

jest.mock("../../componentes/iconos", () => ({ Icono: () => null }))

const molestia = (id: string): Molestia =>
  ({
    id,
    nivel: "ambar",
    zona: "otra",
    intensidad: 5,
    sintomas: [],
    ejercicio: null,
    serie: null,
    nota: null,
    estado: "abierta",
  }) as unknown as Molestia

const CAMPO = "Respuesta para el cliente"

/**
 * Lo que se escribe para una molestia es una indicación de salud: no puede
 * aparecer ya escrito, y mandarse, en la respuesta a otra molestia.
 */
it("cancelar vacía lo escrito: la respuesta a una molestia no pasa a la siguiente", async () => {
  const cerrar = jest.fn()
  const responder = jest.fn(async () => undefined)
  const dialogo = (m: Molestia | null): React.JSX.Element => (
    <DialogoResponder molestia={m} cerrar={cerrar} responder={responder} />
  )
  await render(dialogo(molestia("a")))
  await fireEvent.changeText(screen.getByLabelText(CAMPO), "baja a 22 kg")
  await fireEvent.press(screen.getByRole("button", { name: "Cancelar" }))
  expect(cerrar).toHaveBeenCalledTimes(1)

  await screen.rerender(dialogo(null))
  await screen.rerender(dialogo(molestia("b")))
  expect(screen.getByLabelText(CAMPO).props.value).toBe("")
  expect(responder).not.toHaveBeenCalled()
})

it("un error de envío se conserva para reintentar, pero se limpia al cancelar", async () => {
  const responder = jest.fn(async () => {
    throw new Error("sin red")
  })
  await render(
    <DialogoResponder molestia={molestia("a")} cerrar={jest.fn()} responder={responder} />,
  )
  await fireEvent.changeText(screen.getByLabelText(CAMPO), "descansa 3 días")
  await fireEvent.press(screen.getByRole("button", { name: "Enviar respuesta" }))
  expect(await screen.findByRole("alert")).toBeOnTheScreen()
  expect(screen.getByLabelText(CAMPO).props.value).toBe("descansa 3 días")
  await fireEvent.press(screen.getByRole("button", { name: "Cancelar" }))
  expect(screen.queryByRole("alert")).toBeNull()
})
