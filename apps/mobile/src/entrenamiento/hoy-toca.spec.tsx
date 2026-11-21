import { fireEvent, render, screen } from "@testing-library/react-native"
import type { ResumenSesion } from "@alpha-omega/shared"

import { fechaLegible } from "./fechas"
import { TarjetaHoy } from "./hoy-toca"
import { tipo } from "../tema"

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
  it("usa el mismo tamaño para nombres cortos y largos", async () => {
    const vista = await render(
      <TarjetaHoy
        sesion={{ ...resumen, nombre: "Empuje" }}
        sinSesion="Descanso"
        hoy={HOY}
        abrir={jest.fn()}
      />,
    )
    expect(screen.getByText("Empuje")).toHaveStyle({
      fontSize: tipo.tituloPantalla.fontSize,
      lineHeight: tipo.tituloPantalla.lineHeight,
    })
    await vista.rerender(
      <TarjetaHoy
        sesion={{ ...resumen, nombre: "Torso completo y core final" }}
        sinSesion="Descanso"
        hoy={HOY}
        abrir={jest.fn()}
      />,
    )
    expect(screen.getByText("Torso completo y core final")).toHaveStyle({
      fontSize: tipo.tituloPantalla.fontSize,
      lineHeight: tipo.tituloPantalla.lineHeight,
    })
  })

  it("presenta solo el nombre y empezar, sin subtítulos ni medios", async () => {
    const abrir = jest.fn()
    await render(<TarjetaHoy sesion={resumen} sinSesion="Descanso" hoy={HOY} abrir={abrir} />)

    expect(screen.queryByText(fechaLegible(HOY))).toBeNull()
    expect(screen.queryByText(/100–115 min/)).toBeNull()
    expect(screen.queryAllByRole("image")).toHaveLength(0)
    expect(screen.container.queryAll((nodo) => nodo.type === "Image")).toHaveLength(0)
    expect(screen.getByText(resumen.nombre)).toBeTruthy()
    expect(screen.queryByText("Hoy toca:")).toBeNull()
    expect(screen.getByRole("header", { name: resumen.nombre })).toHaveStyle(tipo.tituloPantalla)
    expect(screen.getByText("Empezar")).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole("button", { name: "Empezar Empuje y pierna" }))
    expect(abrir).toHaveBeenCalledWith(agenda.id)
  })

  it("conserva la acción sin repetir la fecha ni mostrar una foto de sustitución", async () => {
    await render(<TarjetaHoy sesion={resumen} sinSesion="Descanso" hoy={HOY} abrir={jest.fn()} />)

    expect(screen.container.queryAll((nodo) => nodo.type === "Image")).toHaveLength(0)
    expect(screen.queryByText(fechaLegible(HOY))).toBeNull()
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
    expect(screen.getByRole("header", { name: resumen.nombre })).toBeTruthy()
  })

  it("permite continuar sin repetir estado ni reprogramación como subtítulos", async () => {
    const abrir = jest.fn()
    await render(
      <TarjetaHoy
        sesion={{ ...resumen, agenda: { ...agenda, fechaOriginal: "2026-09-23" } }}
        empezada
        sinSesion="Descanso"
        hoy={HOY}
        abrir={abrir}
      />,
    )
    expect(screen.queryByText("En curso:")).toBeNull()
    expect(screen.queryByText(/Movido desde/)).toBeNull()
    await fireEvent.press(screen.getByRole("button", { name: "Continuar Empuje y pierna" }))
    expect(abrir).toHaveBeenCalledWith(agenda.id)
  })
})
