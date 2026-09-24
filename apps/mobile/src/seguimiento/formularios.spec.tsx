import { beforeEach, describe, it, jest } from "@jest/globals"
import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { randomUUID } from "expo-crypto"
import type {
  ConfiguracionSeguimiento,
  RegistrarMedida,
  RegistrarPrueba,
} from "@alpha-omega/shared"

import { AnadirMedida, AnadirPrueba } from "./formularios"

jest.mock("expo-crypto", () => ({ randomUUID: jest.fn() }))

// Guarda el alConfirmar de la última pintura: dos toques antes de repintar
// llegan con el mismo manejador, que es lo que protege la referencia síncrona.
const mockDialogo: { alConfirmar: () => void } = { alConfirmar: () => undefined }
jest.mock("../entrenamiento/sesion/controles", () => {
  const real = jest.requireActual<typeof import("../entrenamiento/sesion/controles")>(
    "../entrenamiento/sesion/controles",
  )
  const { createElement } = jest.requireActual<typeof import("react")>("react")
  return {
    ...real,
    Dialogo: (props: Parameters<typeof real.Dialogo>[0]) => {
      mockDialogo.alConfirmar = props.alConfirmar
      return createElement(real.Dialogo, props)
    },
  }
})

const uuid = (n: number): string => `11111111-1111-4111-8111-${String(n).padStart(12, "0")}`

const PRUEBAS: ConfiguracionSeguimiento["pruebasPrescritas"] = [
  { id: "50000000-0000-4000-8000-000000000001", nombre: "Flexiones", unidad: "reps" },
  { id: "50000000-0000-4000-8000-000000000002", nombre: "Plancha", unidad: "s" },
]

/** Respuesta del servidor que llega cuando la prueba decide. */
function pendiente(): {
  promesa: Promise<void>
  resolver: () => void
  rechazar: (error: Error) => void
} {
  let resolver!: () => void
  let rechazar!: (error: Error) => void
  const promesa = new Promise<void>((resolve, reject) => {
    resolver = resolve
    rechazar = reject
  })
  return { promesa, resolver, rechazar }
}

const cancelarConAtras = async (): Promise<void> => {
  // El diálogo es un Modal: el botón atrás de Android llega como onRequestClose.
  await fireEvent(screen.root!, "requestClose")
}

beforeEach(() => {
  let n = 0
  jest.mocked(randomUUID).mockImplementation(() => uuid(++n))
})

describe("AnadirMedida · guardado protegido", () => {
  it("no admite cambios ni cancelación mientras guarda", async () => {
    const respuesta = pendiente()
    const registrar = jest.fn((_datos: RegistrarMedida) => respuesta.promesa)
    const cerrar = jest.fn()
    await render(<AnadirMedida visible cerrar={cerrar} registrar={registrar} />)
    await fireEvent.changeText(screen.getByLabelText("Peso (kg)"), "70,5")
    await fireEvent.press(screen.getByRole("button", { name: "Guardar" }))

    const peso = screen.getByLabelText("Peso (kg)")
    expect(peso.props.editable).toBe(false)
    expect(peso.props.accessibilityState).toEqual(expect.objectContaining({ disabled: true }))
    expect(screen.getByLabelText("Cintura (cm)").props.editable).toBe(false)
    await fireEvent.changeText(peso, "80")
    expect(screen.getByLabelText("Peso (kg)").props.value).toBe("70,5")
    expect(screen.getByRole("button", { name: "Guardando…" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Guardando…" })).toBeBusy()
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled()
    await fireEvent.press(screen.getByRole("button", { name: "Cancelar" }))
    await cancelarConAtras()
    expect(cerrar).not.toHaveBeenCalled()

    await act(async () => respuesta.resolver())
    expect(registrar).toHaveBeenCalledTimes(1)
    expect(registrar).toHaveBeenCalledWith(
      expect.objectContaining({ operacionId: uuid(1), pesoKg: 70.5, cinturaCm: null }),
    )
    expect(cerrar).toHaveBeenCalledTimes(1)
    expect(screen.getByLabelText("Peso (kg)").props.value).toBe("")
    expect(screen.getByLabelText("Peso (kg)").props.editable).toBe(true)
  })

  it("dos pulsaciones en el mismo ciclo solo arrancan una escritura", async () => {
    const respuesta = pendiente()
    const registrar = jest.fn((_datos: RegistrarMedida) => respuesta.promesa)
    await render(<AnadirMedida visible cerrar={() => undefined} registrar={registrar} />)
    await fireEvent.changeText(screen.getByLabelText("Peso (kg)"), "70,5")
    const pulsar = mockDialogo.alConfirmar
    await act(async () => {
      pulsar()
      pulsar()
    })
    expect(registrar).toHaveBeenCalledTimes(1)
    await act(async () => respuesta.resolver())
    expect(registrar).toHaveBeenCalledTimes(1)
  })

  it("al fallar desbloquea, conserva lo escrito y el error, y no cierra", async () => {
    const respuesta = pendiente()
    const registrar = jest.fn((_datos: RegistrarMedida) => respuesta.promesa)
    const cerrar = jest.fn()
    await render(<AnadirMedida visible cerrar={cerrar} registrar={registrar} />)
    await fireEvent.changeText(screen.getByLabelText("Peso (kg)"), "70,5")
    await fireEvent.changeText(screen.getByLabelText("Cintura (cm)"), "82")
    await fireEvent.press(screen.getByRole("button", { name: "Guardar" }))
    await act(async () => respuesta.rechazar(new Error("sin respuesta")))

    expect(screen.getByText("No se pudo guardar la medida.")).toBeTruthy()
    expect(screen.getByLabelText("Peso (kg)").props.value).toBe("70,5")
    expect(screen.getByLabelText("Cintura (cm)").props.value).toBe("82")
    expect(screen.getByLabelText("Peso (kg)").props.editable).toBe(true)
    expect(screen.getByRole("button", { name: "Guardar" })).not.toBeDisabled()
    expect(screen.getByRole("button", { name: "Cancelar" })).not.toBeDisabled()
    expect(cerrar).not.toHaveBeenCalled()
    await cancelarConAtras()
    expect(cerrar).toHaveBeenCalledTimes(1)
  })

  it("reintentar lo mismo reutiliza la operación; cambiar el valor crea otra", async () => {
    const registrar = jest
      .fn((_datos: RegistrarMedida) => Promise.resolve())
      .mockRejectedValueOnce(new Error("respuesta perdida"))
      .mockRejectedValueOnce(new Error("respuesta perdida"))
    const cerrar = jest.fn()
    await render(<AnadirMedida visible cerrar={cerrar} registrar={registrar} />)
    await fireEvent.changeText(screen.getByLabelText("Peso (kg)"), "70,5")
    await fireEvent.press(screen.getByRole("button", { name: "Guardar" }))
    await fireEvent.press(screen.getByRole("button", { name: "Guardar" }))
    await fireEvent.changeText(screen.getByLabelText("Peso (kg)"), "80")
    await fireEvent.press(screen.getByRole("button", { name: "Guardar" }))

    const envios = registrar.mock.calls.map(([datos]) => [datos.operacionId, datos.pesoKg])
    expect(envios).toEqual([
      [uuid(1), 70.5],
      [uuid(1), 70.5],
      [uuid(2), 80],
    ])
    expect(cerrar).toHaveBeenCalledTimes(1)
    expect(screen.getByLabelText("Peso (kg)").props.value).toBe("")

    // Tras guardar, la siguiente medida es otra operación aunque repita el valor.
    await fireEvent.changeText(screen.getByLabelText("Peso (kg)"), "80")
    await fireEvent.press(screen.getByRole("button", { name: "Guardar" }))
    expect(registrar.mock.calls[3]![0].operacionId).toBe(uuid(3))
  })
})

describe("AnadirPrueba · guardado protegido", () => {
  it("no deja cambiar la prueba, el resultado ni cancelar mientras guarda", async () => {
    const respuesta = pendiente()
    const registrar = jest.fn((_datos: RegistrarPrueba) => respuesta.promesa)
    const cerrar = jest.fn()
    await render(<AnadirPrueba visible cerrar={cerrar} registrar={registrar} pruebas={PRUEBAS} />)
    await fireEvent.press(screen.getByRole("button", { name: "Flexiones · reps" }))
    await fireEvent.changeText(screen.getByLabelText("Resultado"), "32")
    await fireEvent.press(screen.getByRole("button", { name: "Guardar" }))

    const plancha = screen.getByRole("button", { name: "Plancha · s" })
    expect(plancha).toBeDisabled()
    await fireEvent.press(plancha)
    expect(screen.getByRole("button", { name: "Flexiones · reps" })).toBeSelected()
    expect(screen.getByRole("button", { name: "Plancha · s" })).not.toBeSelected()
    const resultado = screen.getByLabelText("Resultado")
    expect(resultado.props.editable).toBe(false)
    expect(resultado.props.accessibilityState).toEqual(expect.objectContaining({ disabled: true }))
    await fireEvent.changeText(resultado, "40")
    expect(screen.getByLabelText("Resultado").props.value).toBe("32")
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled()
    await fireEvent.press(screen.getByRole("button", { name: "Cancelar" }))
    await cancelarConAtras()
    expect(cerrar).not.toHaveBeenCalled()

    await act(async () => respuesta.resolver())
    expect(registrar).toHaveBeenCalledTimes(1)
    expect(registrar).toHaveBeenCalledWith(
      expect.objectContaining({ operacionId: uuid(1), pruebaId: PRUEBAS[0]!.id, valor: 32 }),
    )
    expect(cerrar).toHaveBeenCalledTimes(1)
    expect(screen.getByLabelText("Resultado").props.value).toBe("")
    expect(screen.getByRole("button", { name: "Flexiones · reps" })).not.toBeSelected()
  })

  it("dos pulsaciones en el mismo ciclo solo arrancan una escritura", async () => {
    const respuesta = pendiente()
    const registrar = jest.fn((_datos: RegistrarPrueba) => respuesta.promesa)
    await render(
      <AnadirPrueba visible cerrar={() => undefined} registrar={registrar} pruebas={PRUEBAS} />,
    )
    await fireEvent.press(screen.getByRole("button", { name: "Flexiones · reps" }))
    await fireEvent.changeText(screen.getByLabelText("Resultado"), "32")
    const pulsar = mockDialogo.alConfirmar
    await act(async () => {
      pulsar()
      pulsar()
    })
    expect(registrar).toHaveBeenCalledTimes(1)
    await act(async () => respuesta.resolver())
  })

  it("tras un fallo conserva la elección y usa otra operación si cambia la prueba", async () => {
    const registrar = jest
      .fn((_datos: RegistrarPrueba) => Promise.resolve())
      .mockRejectedValueOnce(new Error("respuesta perdida"))
      .mockRejectedValueOnce(new Error("respuesta perdida"))
    const cerrar = jest.fn()
    await render(<AnadirPrueba visible cerrar={cerrar} registrar={registrar} pruebas={PRUEBAS} />)
    await fireEvent.press(screen.getByRole("button", { name: "Flexiones · reps" }))
    await fireEvent.changeText(screen.getByLabelText("Resultado"), "32")
    await fireEvent.press(screen.getByRole("button", { name: "Guardar" }))

    expect(screen.getByText("No se pudo guardar la prueba.")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Flexiones · reps" })).toBeSelected()
    expect(screen.getByLabelText("Resultado").props.value).toBe("32")
    expect(screen.getByRole("button", { name: "Plancha · s" })).not.toBeDisabled()
    expect(cerrar).not.toHaveBeenCalled()

    await fireEvent.press(screen.getByRole("button", { name: "Guardar" }))
    await fireEvent.press(screen.getByRole("button", { name: "Plancha · s" }))
    await fireEvent.press(screen.getByRole("button", { name: "Guardar" }))

    const envios = registrar.mock.calls.map(([datos]) => [
      datos.operacionId,
      "pruebaId" in datos ? datos.pruebaId : null,
      datos.valor,
    ])
    expect(envios).toEqual([
      [uuid(1), PRUEBAS[0]!.id, 32],
      [uuid(1), PRUEBAS[0]!.id, 32],
      [uuid(2), PRUEBAS[1]!.id, 32],
    ])
    expect(cerrar).toHaveBeenCalledTimes(1)
  })
})
