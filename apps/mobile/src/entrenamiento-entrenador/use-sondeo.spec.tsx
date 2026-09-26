import { act, renderHook } from "@testing-library/react-native"

import { ErrorDeRed } from "../lib/transporte"

import { INTERVALO_DE_SONDEO_MS, useSondeo } from "./use-sondeo"

let mockEnfocada = true
jest.mock("expo-router", () => ({ useIsFocused: () => mockEnfocada }))

/** Una promesa que se resuelve desde fuera, para ordenar respuestas a mano. */
function pendiente<T>(): { promesa: Promise<T>; resolver: (valor: T) => void } {
  let resolver: (valor: T) => void = () => undefined
  const promesa = new Promise<T>((r) => {
    resolver = r
  })
  return { promesa, resolver }
}

async function avanzar(ms: number): Promise<void> {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms)
  })
}

beforeEach(() => {
  jest.useFakeTimers()
  mockEnfocada = true
})
afterEach(() => {
  jest.useRealTimers()
})

describe("el sondeo del entrenador", () => {
  it("lee al entrar y vuelve a leer cada 5 s", async () => {
    let lecturas = 0
    const cargar = jest.fn(async () => ++lecturas)
    const { result } = await renderHook(() => useSondeo("semana", cargar, "fallo"))
    await avanzar(0)
    expect(result.current.estado).toEqual({ fase: "lista", datos: 1, falta: null })

    await avanzar(INTERVALO_DE_SONDEO_MS)
    expect(result.current.estado).toMatchObject({ datos: 2 })
    await avanzar(INTERVALO_DE_SONDEO_MS)
    expect(cargar).toHaveBeenCalledTimes(3)
  })

  it("no lanza otra lectura mientras la anterior sigue en el aire", async () => {
    const lenta = pendiente<number>()
    const cargar = jest.fn(() => lenta.promesa)
    await renderHook(() => useSondeo("semana", cargar, "fallo"))
    await avanzar(INTERVALO_DE_SONDEO_MS * 4)
    expect(cargar).toHaveBeenCalledTimes(1)
  })

  it("tira la respuesta de una consulta anterior", async () => {
    const vieja = pendiente<string>()
    const nueva = pendiente<string>()
    const cargar = jest.fn((semana: string) => (semana === "vieja" ? vieja.promesa : nueva.promesa))
    const { result, rerender } = await renderHook(
      ({ semana }: { semana: string }) => useSondeo(semana, () => cargar(semana), "fallo"),
      { initialProps: { semana: "vieja" } },
    )
    await rerender({ semana: "nueva" })
    expect(result.current.estado).toEqual({ fase: "cargando" })

    await act(async () => {
      nueva.resolver("de la nueva")
      await Promise.resolve()
    })
    await act(async () => {
      vieja.resolver("de la vieja")
      await Promise.resolve()
    })
    expect(result.current.estado).toMatchObject({ datos: "de la nueva" })
  })

  it("una lectura que salió antes de una escritura no pisa lo escrito", async () => {
    const enElAire = pendiente<string>()
    let primera = true
    const cargar = jest.fn(async () => {
      if (primera) {
        primera = false
        return "inicial"
      }
      return enElAire.promesa
    })
    const { result } = await renderHook(() => useSondeo("sesion", cargar, "fallo"))
    await avanzar(0)
    await avanzar(INTERVALO_DE_SONDEO_MS)
    await act(async () => {
      result.current.sustituir("tras ajustar")
      await Promise.resolve()
    })
    await act(async () => {
      enElAire.resolver("antes de ajustar")
      await Promise.resolve()
    })
    expect(result.current.estado).toMatchObject({ datos: "tras ajustar" })
  })

  it("un fallo con datos en pantalla los conserva y avisa aparte", async () => {
    let fallar = false
    const cargar = jest.fn(async () => {
      if (fallar) throw new ErrorDeRed("sin red")
      return "datos"
    })
    const { result } = await renderHook(() => useSondeo("semana", cargar, "fallo"))
    await avanzar(0)
    fallar = true
    await avanzar(INTERVALO_DE_SONDEO_MS)
    expect(result.current.estado).toMatchObject({
      fase: "lista",
      datos: "datos",
      falta: { reintentable: true },
    })
    fallar = false
    await avanzar(INTERVALO_DE_SONDEO_MS)
    expect(result.current.estado).toEqual({ fase: "lista", datos: "datos", falta: null })
  })

  it("fuera de la pantalla no pregunta, y al volver lee al momento", async () => {
    const cargar = jest.fn(async () => "datos")
    const { rerender } = await renderHook(() => useSondeo("semana", cargar, "fallo"))
    await avanzar(0)
    mockEnfocada = false
    await rerender({})
    await avanzar(INTERVALO_DE_SONDEO_MS * 3)
    expect(cargar).toHaveBeenCalledTimes(1)
    mockEnfocada = true
    await rerender({})
    await avanzar(0)
    expect(cargar).toHaveBeenCalledTimes(2)
  })
})
