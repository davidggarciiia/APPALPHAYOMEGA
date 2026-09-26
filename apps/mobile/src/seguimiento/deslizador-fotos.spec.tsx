import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native"
import * as Reanimated from "react-native-reanimated"
import type { AccesoMedio } from "@alpha-omega/shared"

import { DeslizadorFotos } from "./deslizador-fotos"
import type { ApiMedios } from "./medios-api"

const mockReducido = jest.fn(() => false)
jest.mock("../lib/movimiento", () => ({ useMovimientoReducido: () => mockReducido() }))

// Datos sintéticos: ninguna foto ni enlace pertenece a una persona real.
const ANTES = {
  medioId: "30000000-0000-4000-8000-000000000001",
  etiqueta: "Frente, 4 jul 2026",
  rotulo: "4 jul 2026 · Hace 84 días",
}
const DESPUES = {
  medioId: "30000000-0000-4000-8000-000000000002",
  etiqueta: "Frente, 26 sep 2026",
  rotulo: "26 sep 2026 · Hoy",
}

function acceso(): jest.Mock<ApiMedios["acceso"]> {
  return jest.fn(async (medioId: string): Promise<AccesoMedio> => ({
    medioId,
    lectura: {
      url: `https://almacen.test/lectura/${medioId}`,
      metodo: "GET",
      cabeceras: {},
      caducaEn: "2099-01-01T00:00:00.000Z",
    },
  }))
}

const divisor = () => screen.getByRole("adjustable")
const valor = (): unknown => divisor().props.accessibilityValue

/** El marco mide 300 px: sin medida no hay recorte ni cuentas del dedo. */
async function medir(): Promise<void> {
  await fireEvent(screen.getByTestId("deslizador-fotos"), "layout", {
    nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 400 } },
  })
}

describe("deslizar entre antes y después", () => {
  beforeEach(() => {
    mockReducido.mockReturnValue(false)
  })

  it("empieza a la mitad, nombra las dos fotos y dice cuándo se hizo cada una", async () => {
    const api = acceso()
    await render(<DeslizadorFotos antes={ANTES} despues={DESPUES} acceso={api} />)
    await medir()

    expect(divisor().props.accessibilityLabel).toBe(
      "Divisor entre antes, Frente, 4 jul 2026, y después, Frente, 26 sep 2026",
    )
    expect(valor()).toMatchObject({ min: 0, max: 100, now: 50 })
    expect(screen.getByText("Antes: 4 jul 2026 · Hace 84 días")).toBeTruthy()
    expect(screen.getByText("Después: 26 sep 2026 · Hoy")).toBeTruthy()
    await waitFor(() => expect(api).toHaveBeenCalledTimes(2))
    expect(api.mock.calls.map(([id]) => id).sort()).toEqual([ANTES.medioId, DESPUES.medioId])
  })

  it("el dedo pone el divisor donde toca, sin salirse del marco, y al soltar se anuncia", async () => {
    await render(<DeslizadorFotos antes={ANTES} despues={DESPUES} acceso={acceso()} />)
    await medir()
    const tactil = screen.getByTestId("deslizador-tactil")

    await fireEvent(tactil, "responderGrant", { nativeEvent: { locationX: 240 } })
    await fireEvent(tactil, "responderMove", { nativeEvent: { locationX: 270 } })
    // Mientras se arrastra no se vuelve a pintar: el lector se entera al soltar.
    expect(valor()).toMatchObject({ now: 50 })
    await fireEvent(tactil, "responderRelease", { nativeEvent: {} })
    expect(valor()).toMatchObject({ now: 90, text: "90 % de la foto de antes a la vista" })

    await fireEvent(tactil, "responderGrant", { nativeEvent: { locationX: -40 } })
    await fireEvent(tactil, "responderRelease", { nativeEvent: {} })
    expect(valor()).toMatchObject({ now: 0 })
    expect(
      screen.getByRole("button", { name: "Mostrar más de la foto de después" }).props
        .accessibilityState,
    ).toMatchObject({ disabled: true })
  })

  it("los botones y el lector lo mueven en pasos de un 10 % con un desplazamiento corto", async () => {
    const animar = jest.spyOn(Reanimated, "withTiming")
    await render(<DeslizadorFotos antes={ANTES} despues={DESPUES} acceso={acceso()} />)
    await medir()

    await fireEvent.press(screen.getByRole("button", { name: "Mostrar más de la foto de antes" }))
    expect(valor()).toMatchObject({ now: 60 })
    expect(animar).toHaveBeenLastCalledWith(0.6, expect.objectContaining({ duration: 200 }))

    await fireEvent(divisor(), "accessibilityAction", { nativeEvent: { actionName: "decrement" } })
    await fireEvent(divisor(), "accessibilityAction", { nativeEvent: { actionName: "decrement" } })
    expect(valor()).toMatchObject({ now: 40 })
    await fireEvent(divisor(), "accessibilityAction", { nativeEvent: { actionName: "increment" } })
    expect(valor()).toMatchObject({ now: 50 })
    animar.mockRestore()
  })

  it("con movimiento reducido los botones colocan el divisor sin desplazarlo", async () => {
    mockReducido.mockReturnValue(true)
    const animar = jest.spyOn(Reanimated, "withTiming")
    await render(<DeslizadorFotos antes={ANTES} despues={DESPUES} acceso={acceso()} />)
    await medir()

    await fireEvent.press(screen.getByRole("button", { name: "Mostrar más de la foto de después" }))
    expect(valor()).toMatchObject({ now: 40 })
    expect(animar).not.toHaveBeenCalled()
    animar.mockRestore()
  })

  it("si una foto no carga lo dice y vuelve a pedir las dos", async () => {
    const api = acceso()
    api.mockRejectedValueOnce(new Error("sin red"))
    await render(<DeslizadorFotos antes={ANTES} despues={DESPUES} acceso={api} />)
    await medir()

    expect(await screen.findByText("No se ha podido cargar alguna de las fotos.")).toBeTruthy()
    // La foto superpuesta no ofrece su propio botón: el marco entero es el divisor.
    expect(screen.queryByRole("button", { name: /^Reintentar la foto/ })).toBeNull()
    await waitFor(() => expect(api).toHaveBeenCalledTimes(2))

    await fireEvent.press(screen.getByRole("button", { name: "Volver a cargar las dos fotos" }))
    await waitFor(() => expect(api).toHaveBeenCalledTimes(4))
    expect(screen.queryByText("No se ha podido cargar alguna de las fotos.")).toBeNull()
  })
})
