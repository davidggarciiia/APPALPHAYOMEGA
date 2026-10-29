import { fireEvent, render, screen } from "@testing-library/react-native"
import { StyleSheet } from "react-native"
import type { Molestia } from "@alpha-omega/shared"

import { CheckinsYMolestias } from "./checkins"

const abierta = {
  id: "a",
  zona: "hombro",
  intensidad: 5,
  nivel: "ambar",
  sintomas: [],
  estado: "abierta",
  creadaEn: "2026-10-01T10:00:00Z",
  ejercicio: null,
  serie: null,
  nota: null,
} as unknown as Molestia

it("muestra solo molestias con estado y barra de nivel; las atendidas conservan la respuesta", async () => {
  const responder = jest.fn()
  await render(
    <CheckinsYMolestias
      resultados={[]}
      molestias={[
        abierta,
        { ...abierta, id: "b", estado: "atendida", respuesta: "Reduce la carga" },
      ]}
      responder={responder}
    />,
  )
  expect(screen.queryByText("Check-ins")).toBeNull()
  expect(screen.queryByText(/sesiones con check-in/)).toBeNull()
  expect(screen.getAllByText("Hombro · 5 de 10")).toHaveLength(2)
  expect(screen.getByText("Abierta")).toBeOnTheScreen()
  expect(screen.getByText("Atendida")).toBeOnTheScreen()
  expect(screen.getByText("Tu respuesta: Reduce la carga")).toBeOnTheScreen()
  expect(StyleSheet.flatten(screen.getAllByTestId("molestia-nivel")[0]!.props.style).width).toBe(4)
  await fireEvent.press(screen.getByRole("button", { name: /^Responder:/ }))
  expect(responder).toHaveBeenCalledWith(abierta)
})
