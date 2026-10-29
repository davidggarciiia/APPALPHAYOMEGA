import { render, screen } from "@testing-library/react-native"
import { AgendaSemanal } from "./agenda-semanal"
import { fechaLegible, lunesDeSemana } from "./fechas"

jest.mock("expo-router", () => ({
  useFocusEffect: (efecto: () => void) =>
    jest.requireActual<typeof import("react")>("react").useEffect(efecto, [efecto]),
}))
jest.mock("../componentes/iconos", () => ({ Icono: () => null }))

it.each([
  [0, "0 sesiones"],
  [1, "1 sesión"],
  [2, "2 sesiones"],
] as const)("anuncia el día con %i sesiones como «%s»", async (cantidad, texto) => {
  const lunes = lunesDeSemana()
  await render(
    <AgendaSemanal
      semana={lunes}
      listado={{
        total: cantidad,
        sesiones: Array.from({ length: cantidad }, (_, n) => ({
          agenda: {
            id: `sesion-${n}`,
            clienteId: "cliente",
            fechaOriginal: lunes,
            fechaActual: lunes,
            estado: "abierta" as const,
            revision: 0,
          },
          nombre: `Fuerza ${n + 1}`,
          enviadoEn: null,
        })),
      }}
      cambiarSemana={jest.fn()}
      abrir={jest.fn()}
      resumenHoy={false}
    />,
  )
  expect(
    screen.getByRole("button", { name: `${fechaLegible(lunes)} · ${texto}` }),
  ).toBeOnTheScreen()
})
