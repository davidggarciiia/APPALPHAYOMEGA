import { fireEvent, render, screen } from "@testing-library/react-native"
import type { ResumenSesion } from "@alpha-omega/shared"

import { fechaLegible } from "./fechas"
import { TarjetaHoy, tamanoDelNombre } from "./hoy-toca"
import { tema } from "../tema"

jest.mock("expo-router", () => ({
  useFocusEffect: (efecto: () => void) =>
    jest.requireActual<typeof import("react")>("react").useEffect(efecto, [efecto]),
}))
jest.mock("../sesion", () => ({ useSesion: jest.fn() }))
jest.mock("../lib/direccion-api", () => ({ direccionDeLaApi: () => "http://localhost:3000" }))

const u = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const HOY = "2026-09-24"
const agenda = {
  id: u(1),
  clienteId: u(2),
  fechaOriginal: HOY,
  fechaActual: HOY,
  estado: "abierta" as const,
  revision: 0,
}
const resumen: ResumenSesion = { agenda, nombre: "Empuje y pierna", enviadoEn: null }
describe("Hoy toca", () => {
  it("ajusta el tamaño del nombre a su largo", () => {
    expect(tamanoDelNombre("Empuje")).toBe(52)
    expect(tamanoDelNombre("Empuje y pierna")).toBe(40)
    expect(tamanoDelNombre("Torso completo y core final")).toBe(26)
  })

  it("destaca el nombre, con una etiqueta discreta y sin duración estimada ni medios", async () => {
    const abrir = jest.fn()
    await render(<TarjetaHoy sesion={resumen} sinSesion="Descanso" hoy={HOY} abrir={abrir} />)

    expect(screen.getByText(fechaLegible(HOY))).toBeOnTheScreen()
    expect(screen.queryByText(/100–115 min/)).toBeNull()
    expect(screen.queryAllByRole("image")).toHaveLength(0)
    expect(screen.container.queryAll((nodo) => nodo.type === "Image")).toHaveLength(0)
    expect(screen.getByText(resumen.nombre)).toBeTruthy()
    expect(screen.getByRole("header", { name: "Hoy toca:" })).toBeTruthy()
    expect(screen.getByText("Hoy toca:")).toHaveStyle({ fontSize: 11, color: tema.textoTenue })
    await fireEvent.press(screen.getByRole("button", { name: "Empezar Empuje y pierna" }))
    expect(abrir).toHaveBeenCalledWith(agenda.id)
  })

  it("sin detalle conserva la fecha y la acción sin mostrar una foto de sustitución", async () => {
    await render(<TarjetaHoy sesion={resumen} sinSesion="Descanso" hoy={HOY} abrir={jest.fn()} />)

    expect(screen.container.queryAll((nodo) => nodo.type === "Image")).toHaveLength(0)
    expect(screen.getByText(fechaLegible(HOY))).toBeTruthy()
    expect(screen.getByRole("button", { name: "Empezar Empuje y pierna" })).toBeTruthy()
  })

  it("sin sesión pendiente dice qué toca y no ofrece empezar", async () => {
    await render(<TarjetaHoy sesion={undefined} sinSesion="Descanso" hoy={HOY} abrir={jest.fn()} />)

    expect(screen.getByText("Descanso")).toBeTruthy()
    expect(screen.queryByRole("button")).toBeNull()
  })

  it("una sesión enviada ofrece ver su resumen", async () => {
    await render(
      <TarjetaHoy
        sesion={{
          ...resumen,
          agenda: { ...agenda, estado: "cerrada" },
          enviadoEn: "2026-09-24T12:00:00.000Z",
        }}
        sinSesion="Trabajo completado"
        hoy={HOY}
        abrir={jest.fn()}
      />,
    )
    expect(screen.getByRole("button", { name: "Ver resumen Empuje y pierna" })).toBeTruthy()
    expect(screen.getByRole("header", { name: "Completado:" })).toBeTruthy()
  })
})
