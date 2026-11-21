import { render, screen } from "@testing-library/react-native"

import Inicio from "../app/index"
import { useSesion } from "./sesion"
import { useEntrenamiento } from "./entrenamiento/use-entrenamiento"

jest.mock("expo-router", () => {
  const React = jest.requireActual<typeof import("react")>("react")
  return {
    useRouter: () => ({ push: jest.fn() }),
    useFocusEffect: (efecto: () => void | (() => void)) => React.useEffect(efecto, [efecto]),
  }
})
jest.mock("./sesion", () => ({ useSesion: jest.fn() }))
jest.mock("./entrenamiento/use-entrenamiento", () => ({ useEntrenamiento: jest.fn() }))
jest.mock("./seguimiento/use-seguimiento", () => ({ useSeguimiento: () => ({}) }))
jest.mock("./nutricion/api", () => ({ useNutricion: () => ({}) }))
jest.mock("./entrenamiento/semana", () => ({ SemanaEntrenamiento: () => null }))
jest.mock("./nutricion/hoy-inicio", () => ({ HoyInicio: () => null }))
jest.mock("./inicio-entrenador/inicio-entrenador", () => ({ InicioEntrenador: () => null }))

it.each(["comprobando", "fuera", "local"])(
  "muestra una espera accesible mientras Inicio sale de la fase %s, sin cargar datos privados",
  async (fase) => {
    const plan = jest.fn()
    jest
      .mocked(useEntrenamiento)
      .mockReturnValue({ plan } as unknown as ReturnType<typeof useEntrenamiento>)
    jest.mocked(useSesion).mockReturnValue({
      estado: { fase },
      pedir: jest.fn(),
      salir: jest.fn(),
    } as unknown as ReturnType<typeof useSesion>)
    await render(<Inicio />)
    expect(screen.getByLabelText("Abriendo pantalla")).toBeOnTheScreen()
    expect(screen.queryByText("Mi perfil")).toBeNull()
    expect(plan).not.toHaveBeenCalled()
  },
)
