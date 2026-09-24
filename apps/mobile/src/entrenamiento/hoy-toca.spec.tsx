import { describe, expect, it, jest } from "@jest/globals"
import { render, screen } from "@testing-library/react-native"
import { EjercicioSchema, SesionClienteSchema, type ResumenSesion } from "@alpha-omega/shared"

import { fechaLegible } from "./fechas"
import { TarjetaHoy, tamanoDelNombre } from "./hoy-toca"

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
const sesion = SesionClienteSchema.parse({
  agenda,
  prescripcion: {
    nombre: "Empuje y pierna",
    duracion: "100–115 min",
    ejercicios: [
      {
        id: u(3),
        ejercicioId: u(4),
        nombre: "Movilidad",
        indicaciones: null,
        seccion: "calentamiento",
        series: [{ id: u(5), tipoMedicion: "tiempo", pesoKg: null, segundos: 60 }],
      },
      {
        id: u(6),
        ejercicioId: u(7),
        nombre: "Sentadilla trasera con barra",
        indicaciones: null,
        series: [{ id: u(8), tipoMedicion: "repeticiones", pesoKg: 80, repeticiones: 6 }],
      },
    ],
  },
  revisionPrescripcion: 0,
  permiteAjuste: false,
  enviadoEn: null,
  borrador: null,
})
const sentadilla = EjercicioSchema.parse({
  id: u(7),
  nombre: "Sentadilla trasera con barra",
  grupoPrincipal: "cuadriceps",
  gruposSecundarios: [],
  instrucciones: "Baja controlando.",
  estado: "publicado",
  figura: {
    medioId: "vital-0054",
    version: "1",
    origen: "licenciado",
    licencia: "Vital",
    sinConexion: true,
  },
  video: null,
})

describe("Hoy toca", () => {
  it("ajusta el tamaño del nombre a su largo", () => {
    expect(tamanoDelNombre("Empuje")).toBe(52)
    expect(tamanoDelNombre("Empuje y pierna")).toBe(40)
    expect(tamanoDelNombre("Torso completo y core final")).toBe(26)
  })

  it("enseña la duración y la animación del primer ejercicio de la parte principal", async () => {
    const leerEjercicio = jest.fn(async (_id: string) => sentadilla)
    await render(
      <TarjetaHoy
        sesion={resumen}
        sinSesion="Descanso"
        hoy={HOY}
        abrir={jest.fn()}
        detalle={{
          leerSesion: async () => sesion,
          leerEjercicio,
          acceso: { base: "http://api", token: "t", renovar: async () => undefined },
        }}
      />,
    )

    expect(
      await screen.findByRole("image", {
        name: "Animación de la técnica: Sentadilla trasera con barra",
      }),
    ).toBeTruthy()
    expect(leerEjercicio).toHaveBeenCalledWith(u(7))
    expect(screen.getByText(`100–115 min · ${fechaLegible(HOY)}`)).toBeTruthy()
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
