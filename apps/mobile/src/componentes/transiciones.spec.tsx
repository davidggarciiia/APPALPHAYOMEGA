import { render, screen } from "@testing-library/react-native"
import { Text } from "react-native"
import { withSpring, withTiming } from "react-native-reanimated"

import { BarraAjuste } from "./barra-ajuste"
import { Dialogo } from "./dialogo"
import { Hoja } from "./hoja"
import { useMovimientoReducido } from "./movimiento"

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}))
jest.mock("react-native/Libraries/Components/Keyboard/KeyboardAvoidingView", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
}))
jest.mock("./movimiento", () => ({
  ...jest.requireActual("./movimiento"),
  useMovimientoReducido: jest.fn(() => true),
}))
jest.mock("react-native-reanimated", () => {
  const base = jest.requireActual("react-native-reanimated/mock")
  return {
    ...base,
    withSpring: jest.fn(base.withSpring),
    withTiming: jest.fn(base.withTiming),
  }
})

it.each(["hoja", "ajuste", "dialogo"] as const)(
  "%s no oculta y vuelve a mostrar el contenido al resolver el ajuste de movimiento",
  async (componente) => {
    const crear = (): React.JSX.Element => {
      if (componente === "hoja")
        return (
          <Hoja visible alCerrar={jest.fn()}>
            <Text>Contenido</Text>
          </Hoja>
        )
      if (componente === "ajuste")
        return <BarraAjuste unidad="kg" valor={60} cambiar={jest.fn()} alListo={jest.fn()} />
      return (
        <Dialogo
          visible
          titulo="Terminar"
          texto="Quedan series"
          confirmar="Enviar"
          cancelar="Seguir"
          alConfirmar={jest.fn()}
          alCancelar={jest.fn()}
        />
      )
    }
    jest.mocked(useMovimientoReducido).mockReturnValue(true)
    const vista = await render(crear())
    jest.mocked(withSpring).mockClear()
    jest.mocked(withTiming).mockClear()
    jest.mocked(useMovimientoReducido).mockReturnValue(false)
    await vista.rerender(crear())
    expect(withSpring).not.toHaveBeenCalled()
    expect(withTiming).not.toHaveBeenCalled()
    expect(
      screen.getByRole("button", {
        name: componente === "hoja" ? "Cerrar" : componente === "ajuste" ? "Listo" : "Enviar",
      }),
    ).toBeOnTheScreen()
  },
)
