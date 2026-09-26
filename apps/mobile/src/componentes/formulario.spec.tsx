import { render, screen, userEvent } from "@testing-library/react-native"

import { BotonPrincipal, Campo } from "./formulario"

describe("Campo", () => {
  it("anuncia el error a los lectores de pantalla, no solo lo pinta en rojo", async () => {
    await render(<Campo etiqueta="Correo" error="Escribe un correo válido" />)

    expect(screen.getByRole("alert")).toHaveTextContent("Escribe un correo válido")
    expect(screen.getByLabelText("Correo")).toHaveProp("aria-invalid", true)
  })

  it("sin error no hay alerta ni el campo se marca como inválido", async () => {
    await render(<Campo etiqueta="Correo" />)

    expect(screen.queryByRole("alert")).not.toBeOnTheScreen()
    expect(screen.getByLabelText("Correo")).toHaveProp("aria-invalid", false)
  })
})

describe("BotonPrincipal", () => {
  it("al pulsarlo ejecuta la acción", async () => {
    const alPulsar = jest.fn()
    const usuario = userEvent.setup()
    await render(<BotonPrincipal texto="Entrar" onPress={alPulsar} />)

    await usuario.press(screen.getByRole("button", { name: "Entrar" }))

    expect(alPulsar).toHaveBeenCalledTimes(1)
  })

  it("mientras envía no admite un segundo toque y conserva su nombre accesible", async () => {
    const alPulsar = jest.fn()
    const usuario = userEvent.setup()
    await render(<BotonPrincipal texto="Entrar" onPress={alPulsar} ocupado />)

    // El texto visible pasa a "...", pero el lector de pantalla sigue oyendo
    // "Entrar": por eso se busca por el nombre accesible y no por el texto.
    const boton = screen.getByRole("button", { name: "Entrar" })
    expect(boton).toBeDisabled()
    expect(boton).toBeBusy()

    await usuario.press(boton)

    expect(alPulsar).not.toHaveBeenCalled()
  })
})
