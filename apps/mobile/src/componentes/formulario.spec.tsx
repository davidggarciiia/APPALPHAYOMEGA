import { fireEvent, render, screen } from "@testing-library/react-native"

import { BotonPrincipal, Campo } from "./formulario"

describe("Componentes de formulario", () => {
  it("el campo lleva su etiqueta accesible y anuncia el error", async () => {
    await render(<Campo etiqueta="Peso" error="Escribe un número" value="" />)
    expect(screen.getByText("PESO")).toBeTruthy()
    expect(screen.getByLabelText("Peso")).toBeTruthy()
    expect(screen.getByRole("alert")).toHaveTextContent("Escribe un número")
  })

  it("el botón ocupado no se puede pulsar otra vez", async () => {
    const pulsar = jest.fn()
    await render(<BotonPrincipal texto="ENVIAR" onPress={pulsar} ocupado />)
    fireEvent.press(screen.getByRole("button"))
    expect(pulsar).not.toHaveBeenCalled()
  })
})
