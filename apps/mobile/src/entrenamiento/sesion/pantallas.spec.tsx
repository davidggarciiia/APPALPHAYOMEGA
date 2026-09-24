import { describe, expect, it, jest } from "@jest/globals"
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native"
import type { Cierre, Checkin, RegistrarMolestia } from "@alpha-omega/shared"

import { CheckIn } from "./check-in"
import { CierreDeSesion } from "./cierre"
import { RegistrarMolestiaPantalla } from "./molestia"

describe("CheckIn", () => {
  it("no empieza hasta responder las dos preguntas", async () => {
    const empezar = jest.fn<(c: Checkin) => void>()
    await render(<CheckIn nombre="Empuje" empezar={empezar} volver={() => undefined} />)

    await fireEvent.press(screen.getByRole("button", { name: "Empezar" }))
    expect(empezar).not.toHaveBeenCalled()
    expect(screen.getByText("Responde las dos preguntas para empezar.")).toBeTruthy()

    await fireEvent.press(screen.getByRole("radio", { name: "4" }))
    await fireEvent.press(screen.getByRole("radio", { name: "Agujetas" }))
    await fireEvent.press(screen.getByRole("button", { name: "Empezar" }))
    expect(empezar).toHaveBeenCalledWith({ sensacion: 4, molestia: "agujetas" })
  })

  it("con dolor recuerda no entrenar la zona", async () => {
    await render(<CheckIn nombre="Empuje" empezar={() => undefined} volver={() => undefined} />)
    await fireEvent.press(screen.getByRole("radio", { name: "Dolor" }))
    expect(screen.getByText(/no entrenes esa zona/)).toBeTruthy()
  })
})

describe("RegistrarMolestiaPantalla", () => {
  const lugar = { ejercicioPrescritoId: "e-1", ejercicio: "Press banca", serie: 2 }

  it("avisa con la zona, la intensidad y lo que nota, y confirma", async () => {
    const avisar = jest.fn<(d: RegistrarMolestia) => Promise<unknown>>(async () => ({}))
    await render(
      <RegistrarMolestiaPantalla
        lugar={lugar}
        reloj="12:04"
        uuid={() => "30000000-0000-4000-8000-000000000001"}
        avisar={avisar}
        volver={() => undefined}
      />,
    )
    expect(screen.getByText("Press banca · serie 2")).toBeTruthy()

    await fireEvent.press(screen.getByRole("radio", { name: "Hombro" }))
    await fireEvent(
      screen.getByRole("adjustable", { name: "Intensidad de la molestia" }),
      "accessibilityAction",
      {
        nativeEvent: { actionName: "increment" },
      },
    )
    await fireEvent.press(screen.getByRole("checkbox", { name: "Pinchazo o irradia" }))
    await fireEvent.press(screen.getByRole("button", { name: "Avisar a tu entrenador" }))

    await waitFor(() => expect(screen.getByText(/Aviso enviado/)).toBeTruthy())
    expect(avisar).toHaveBeenCalledWith({
      operacionId: "30000000-0000-4000-8000-000000000001",
      ejercicioPrescritoId: "e-1",
      serie: 2,
      zona: "hombro",
      intensidad: 1,
      sintomas: ["pinchazo"],
      nota: null,
    })
  })

  it("sin zona no envía", async () => {
    const avisar = jest.fn<(d: RegistrarMolestia) => Promise<unknown>>(async () => ({}))
    await render(
      <RegistrarMolestiaPantalla
        lugar={lugar}
        reloj={null}
        uuid={() => "30000000-0000-4000-8000-000000000001"}
        avisar={avisar}
        volver={() => undefined}
      />,
    )
    await fireEvent.press(screen.getByRole("button", { name: "Avisar a tu entrenador" }))
    expect(screen.getByText("Elige la zona.")).toBeTruthy()
    expect(avisar).not.toHaveBeenCalled()
  })

  it("pregunta antes de descartar lo marcado", async () => {
    const volver = jest.fn()
    await render(
      <RegistrarMolestiaPantalla
        lugar={lugar}
        reloj={null}
        uuid={() => "30000000-0000-4000-8000-000000000001"}
        avisar={async () => ({})}
        volver={volver}
      />,
    )
    await fireEvent.press(screen.getByRole("radio", { name: "Codo" }))
    await fireEvent.press(screen.getByRole("button", { name: "Volver a la sesión" }))
    expect(volver).not.toHaveBeenCalled()
    await fireEvent.press(screen.getByRole("button", { name: "Descartar" }))
    expect(volver).toHaveBeenCalled()
  })
})

describe("CierreDeSesion", () => {
  it("envía el esfuerzo, la energía, si hubo algo incómodo y la nota", async () => {
    const enviar = jest.fn<(c: Cierre, notas: string) => void>()
    await render(
      <CierreDeSesion
        subtitulo="Empuje · 1 h 38 min"
        proxima={[
          { ejercicioId: "a", nombre: "Press banca", texto: "67,5 kg", tipo: "sube" },
          { ejercicioId: "b", nombre: "Fondos", texto: "En revisión", tipo: "revision" },
        ]}
        notas=""
        enviando={false}
        error=""
        enviar={enviar}
        volver={() => undefined}
      />,
    )
    expect(screen.getByText("Empuje · 1 h 38 min")).toBeTruthy()
    expect(screen.getByText("67,5 kg")).toBeTruthy()

    await fireEvent.press(screen.getByRole("button", { name: "Enviar a tu entrenador" }))
    expect(enviar).not.toHaveBeenCalled()

    await fireEvent.press(screen.getByRole("radio", { name: "3" }))
    await fireEvent.press(screen.getByRole("radio", { name: "Algo incómodo" }))
    await fireEvent.press(screen.getByRole("button", { name: "Añadir nota" }))
    await fireEvent.changeText(screen.getByLabelText("Nota para tu entrenador"), "Hombro cargado")
    await fireEvent.press(screen.getByRole("button", { name: "Enviar a tu entrenador" }))
    expect(enviar).toHaveBeenCalledWith(
      { esfuerzo: 5, energia: 3, incomodo: true },
      "Hombro cargado",
    )
  })
})
