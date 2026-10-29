import { fireEvent, render, screen } from "@testing-library/react-native"
import type { SesionProgramada } from "@alpha-omega/shared"
import { FechaSesion } from "./fecha-sesion"
import { fechaLegible, sumarDias } from "./fechas"

const agenda: SesionProgramada = {
  id: "sesion",
  clienteId: "cliente",
  fechaOriginal: "2026-10-26",
  fechaActual: "2026-10-26",
  estado: "abierta",
  revision: 2,
}
const martes = sumarDias(agenda.fechaOriginal, 1)

it.each([false, true])(
  "marca y deshabilita la fecha actual de la sesión (enHoja=%s)",
  async (enHoja) => {
    const mover = jest.fn()
    await render(
      <FechaSesion
        agenda={{ ...agenda, fechaActual: martes }}
        api={{ mover, cambios: jest.fn() }}
        actualizado={jest.fn()}
        iniciarAbierta
        enHoja={enHoja}
      />,
    )
    const actual = screen.getByRole("button", { name: `${fechaLegible(martes)} (actual)` })
    expect(actual).toBeDisabled()
    expect(screen.getByRole("button", { name: fechaLegible(agenda.fechaOriginal) })).toBeEnabled()
    await fireEvent.press(actual)
    expect(mover).not.toHaveBeenCalled()
  },
)

it("distingue un día cambiado del fallo al refrescar y reintenta solo la actualización", async () => {
  const movida = { ...agenda, fechaActual: martes, revision: 3 }
  const mover = jest.fn().mockResolvedValue(movida)
  const actualizado = jest
    .fn()
    .mockRejectedValueOnce(new Error("Sin conexión"))
    .mockResolvedValue(undefined)
  const onTerminar = jest.fn()
  await render(
    <FechaSesion
      agenda={agenda}
      api={{ mover, cambios: jest.fn() }}
      actualizado={actualizado}
      onTerminar={onTerminar}
      iniciarAbierta
      enHoja
    />,
  )

  await fireEvent.press(screen.getByRole("button", { name: fechaLegible(martes) }))
  expect(await screen.findByText("Día cambiado; no se pudo refrescar la semana.")).toBeOnTheScreen()
  expect(
    screen.queryByText("No se pudo cambiar el día. Actualiza la sesión antes de reintentar."),
  ).toBeNull()
  expect(actualizado).toHaveBeenCalledTimes(1)
  expect(actualizado).toHaveBeenCalledWith(movida)
  expect(onTerminar).not.toHaveBeenCalled()
  expect(screen.queryByRole("button", { name: fechaLegible(martes) })).toBeNull()

  await fireEvent.press(screen.getByRole("button", { name: "Reintentar actualización" }))
  expect(actualizado).toHaveBeenCalledTimes(2)
  expect(actualizado).toHaveBeenLastCalledWith(movida)
  expect(mover).toHaveBeenCalledTimes(1)
  expect(onTerminar).toHaveBeenCalledTimes(1)
  expect(screen.queryByText("Día cambiado; no se pudo refrescar la semana.")).toBeNull()
})
