import { describe, expect, it, jest } from "@jest/globals"
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native"
import { EjercicioSchema, type Ejercicio, type EjercicioPrescrito } from "@alpha-omega/shared"

import type { AccesoAFiguras } from "../catalogo-ejercicios/figura-ejercicio"
import { ErrorDeRed } from "../lib/api"
import { crearAlmacenLocal } from "./almacen-local"
import { hayCambiosLocales } from "./documento-local"
import { leerFicha } from "./ficha-local"
import { TablaSeries } from "./tabla-series"
import { VerTecnica } from "./ver-tecnica"

jest.mock("expo-router", () => ({
  useFocusEffect: (efecto: () => void) =>
    jest.requireActual<typeof import("react")>("react").useEffect(efecto, [efecto]),
}))
jest.mock("../sesion", () => ({ useSesion: jest.fn() }))
jest.mock("../lib/direccion-api", () => ({ direccionDeLaApi: () => "http://localhost:3000" }))

const CUENTA = "10000000-0000-4000-8000-000000000000"
const EJERCICIO = "3f2b8c1e-4d5a-4f6b-8a9c-0d1e2f3a4b01"
const ACCESO: AccesoAFiguras = {
  base: "http://localhost:3000",
  token: "token",
  renovar: async () => undefined,
}

function ficha(figura: Ejercicio["figura"]): Ejercicio {
  return EjercicioSchema.parse({
    id: EJERCICIO,
    nombre: "Sentadilla trasera",
    grupoPrincipal: "cuadriceps",
    gruposSecundarios: ["gluteos"],
    instrucciones: "Pies a la anchura de los hombros y baja con la espalda neutra.",
    estado: "retirado",
    figura,
    video: null,
  })
}
const CON_FIGURA = ficha({
  medioId: "vital-0054",
  version: "1",
  origen: "licenciado",
  licencia: "Vital Animations EULA 2026.1 · paquete gratuito",
  sinConexion: true,
})

function almacen() {
  const filas = new Map<string, string>()
  return crearAlmacenLocal(
    {
      leer: async (_c, k) => filas.get(k) ?? null,
      escribir: async (_c, k, v) => {
        filas.set(k, v)
      },
      borrar: async (_c, k) => {
        filas.delete(k)
      },
      listar: async () => [...filas.keys()],
      limpiar: async () => filas.clear(),
    },
    {
      cifrar: async (_c, _k, t) => t,
      descifrar: async (_c, _k, t) => t,
      olvidar: async () => undefined,
    },
  )
}

async function pintar(
  leer: (id: string) => Promise<Ejercicio>,
  local = almacen(),
  cerrar = jest.fn(),
) {
  await render(
    <VerTecnica
      cuenta={CUENTA}
      ejercicioId={EJERCICIO}
      nombre="Sentadilla"
      leer={leer}
      almacen={local}
      acceso={ACCESO}
      cerrar={cerrar}
    />,
  )
  return { local, cerrar }
}

describe("Ver la técnica durante el entrenamiento", () => {
  it("enseña la animación y las instrucciones, también de un ejercicio retirado, y guarda la ficha", async () => {
    const { local } = await pintar(async () => CON_FIGURA)

    expect(
      await screen.findByRole("image", { name: "Animación de la técnica: Sentadilla trasera" }),
    ).toBeTruthy()
    expect(screen.getByText(/Pies a la anchura de los hombros/)).toBeTruthy()
    await waitFor(async () => {
      expect(await leerFicha(local, CUENTA, EJERCICIO)).toEqual(CON_FIGURA)
    })
    // La ficha guardada no es un cambio pendiente: no bloquea cerrar sesión.
    expect(await hayCambiosLocales(local, CUENTA)).toBe(false)
  })

  it("sin red usa la ficha guardada y lo dice", async () => {
    const local = almacen()
    await pintar(async () => CON_FIGURA, local)
    await screen.findByText(/Pies a la anchura/)
    await waitFor(async () => {
      expect(await leerFicha(local, CUENTA, EJERCICIO)).not.toBeNull()
    })

    await pintar(() => Promise.reject(new ErrorDeRed("sin red")), local)

    expect(await screen.findByText(/Sin conexión: mostramos la ficha guardada/)).toBeTruthy()
  })

  it("sin red ni copia avisa y deja reintentar", async () => {
    const leer = jest
      .fn<(id: string) => Promise<Ejercicio>>()
      .mockRejectedValueOnce(new ErrorDeRed("sin red"))
      .mockResolvedValue(ficha(null))
    await pintar(leer)

    expect(await screen.findByText(/La primera vez necesitas conexión/)).toBeTruthy()
    await fireEvent.press(screen.getByRole("button", { name: "Reintentar" }))

    expect(await screen.findByText("Este ejercicio todavía no tiene animación.")).toBeTruthy()
    expect(screen.queryByRole("image")).toBeNull()
  })

  it("volver cierra la técnica sin tocar el entrenamiento", async () => {
    const { cerrar } = await pintar(async () => ficha(null))
    await screen.findByText(/Pies a la anchura/)

    await fireEvent.press(screen.getByRole("button", { name: "Volver al entrenamiento" }))

    expect(cerrar).toHaveBeenCalledTimes(1)
  })
})

describe("La tabla de series", () => {
  const EJERCICIO_PRESCRITO: EjercicioPrescrito = {
    id: "3f2b8c1e-4d5a-4f6b-8a9c-0d1e2f3a4b02",
    ejercicioId: EJERCICIO,
    nombre: "Sentadilla",
    indicaciones: null,
    series: [
      {
        id: "3f2b8c1e-4d5a-4f6b-8a9c-0d1e2f3a4b03",
        tipoMedicion: "repeticiones",
        repeticiones: 8,
        pesoKg: 60,
      },
    ],
  }

  it("deja ver la técnica aunque el registro esté bloqueado", async () => {
    const verTecnica = jest.fn()
    await render(
      <TablaSeries
        ejercicio={EJERCICIO_PRESCRITO}
        series={[
          { serieId: "3f2b8c1e-4d5a-4f6b-8a9c-0d1e2f3a4b03", peso: "", valor: "", hecha: false },
        ]}
        bloqueado
        cambiar={jest.fn<() => void>()}
        verTecnica={verTecnica}
      />,
    )

    await fireEvent.press(screen.getByRole("button", { name: "Ver técnica — Sentadilla" }))

    expect(verTecnica).toHaveBeenCalledTimes(1)
  })
})
