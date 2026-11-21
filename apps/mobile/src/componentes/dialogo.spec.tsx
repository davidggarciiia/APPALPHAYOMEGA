import { render, screen, within } from "@testing-library/react-native"
import { Text } from "react-native"

import { Dialogo } from "./dialogo"

it("pone título, contenido y botones en una zona desplazable que no pierde los toques", async () => {
  await render(
    <Dialogo
      visible
      titulo="Añadir medida"
      texto="Las de hoy."
      confirmar="Guardar"
      cancelar="Cancelar"
      alConfirmar={jest.fn()}
      alCancelar={jest.fn()}
    >
      <Text>Campo de ejemplo</Text>
    </Dialogo>,
  )
  const desplazable = screen.getByTestId("dialogo-desplazable")
  // Con teclado abierto o letra grande, todo se alcanza deslizando; un toque en un
  // botón con el teclado abierto no se gasta en cerrarlo.
  expect(desplazable.props.keyboardShouldPersistTaps).toBe("handled")
  expect(within(desplazable).getByRole("header", { name: "Añadir medida" })).toBeOnTheScreen()
  expect(within(desplazable).getByText("Campo de ejemplo")).toBeOnTheScreen()
  expect(within(desplazable).getByRole("button", { name: "Guardar" })).toBeOnTheScreen()
  expect(within(desplazable).getByRole("button", { name: "Cancelar" })).toBeOnTheScreen()
})
