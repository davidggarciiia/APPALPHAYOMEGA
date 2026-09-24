import { describe, expect, it, jest } from "@jest/globals"
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native"
import type { Ejercicio } from "@alpha-omega/shared"

import { ErrorDeRed } from "../lib/api"

import type { AccesoAFiguras } from "./figura-ejercicio"
import { FormularioDeEjercicio } from "./formulario-ejercicio"
import { catalogoEnMemoria, ejercicioDePrueba } from "./pruebas/catalogo-en-memoria"
import { SelectorDeFigura } from "./selector-figura"

jest.mock("expo-router", () => ({
  useFocusEffect: (efecto: () => void) =>
    jest.requireActual<typeof import("react")>("react").useEffect(efecto, [efecto]),
}))
jest.mock("../sesion", () => ({ useSesion: jest.fn() }))
jest.mock("../lib/direccion-api", () => ({ direccionDeLaApi: () => "http://localhost:3000" }))

const ACCESO: AccesoAFiguras = {
  base: "http://localhost:3000",
  token: "token",
  renovar: async () => undefined,
}
const SENTADILLA = ejercicioDePrueba(
  "3f2b8c1e-4d5a-4f6b-8a9c-0d1e2f3a4b01",
  "Sentadilla trasera",
  "cuadriceps",
)

async function pintar(ejercicio: Ejercicio = SENTADILLA, api = catalogoEnMemoria([ejercicio])) {
  const onCambio = jest.fn<(ejercicio: Ejercicio) => void>()
  const vista = await render(
    <SelectorDeFigura api={api} acceso={ACCESO} ejercicio={ejercicio} onCambio={onCambio} />,
  )
  return { onCambio, vista, api }
}

describe("Selector de la animación de un ejercicio", () => {
  it("sin figura lo dice, y elegir una la guarda en el momento", async () => {
    const { onCambio } = await pintar()
    expect(screen.getByText(/Sin animación/)).toBeTruthy()

    await fireEvent.press(screen.getByRole("button", { name: "ELEGIR ANIMACIÓN" }))
    await fireEvent.press(
      await screen.findByRole("radio", { name: "Sentadilla trasera con barra" }),
    )

    await waitFor(() => {
      expect(onCambio).toHaveBeenCalledTimes(1)
    })
    expect(onCambio.mock.calls[0]?.[0].figura).toMatchObject({
      medioId: "vital-0054",
      sinConexion: true,
    })
    expect(screen.queryByRole("radio", { name: "Dominadas" })).toBeNull()
  })

  it("marca las animaciones que solo se ven con conexión", async () => {
    await pintar()

    await fireEvent.press(screen.getByRole("button", { name: "ELEGIR ANIMACIÓN" }))

    expect(await screen.findByText("Solo con conexión")).toBeTruthy()
    expect(screen.getByRole("radio", { name: "Dominadas" }).props.accessibilityHint).toBe(
      "Solo con conexión",
    )
  })

  it("busca sin tener en cuenta los acentos y avisa si no hay coincidencias", async () => {
    await pintar()
    await fireEvent.press(screen.getByRole("button", { name: "ELEGIR ANIMACIÓN" }))
    await screen.findByLabelText("Buscar animación")

    await fireEvent.changeText(screen.getByLabelText("Buscar animación"), "dominádas")
    expect(screen.getByRole("radio", { name: "Dominadas" })).toBeTruthy()
    expect(screen.queryByRole("radio", { name: "Sentadilla trasera con barra" })).toBeNull()

    await fireEvent.changeText(screen.getByLabelText("Buscar animación"), "zancada")
    expect(screen.getByText("Ninguna animación coincide con «zancada».")).toBeTruthy()
  })

  it("con figura la enseña con su aviso de conexión y se puede quitar", async () => {
    const api = catalogoEnMemoria([SENTADILLA])
    const conFigura = await api.asignarFigura(SENTADILLA.id, "movekit-pull-ups")
    const { onCambio } = await pintar(conFigura, api)

    expect(
      screen.getByRole("image", { name: "Animación de la técnica: Sentadilla trasera" }),
    ).toBeTruthy()
    expect(screen.getByText("Esta animación solo se ve con conexión.")).toBeTruthy()

    await fireEvent.press(screen.getByRole("button", { name: "QUITAR ANIMACIÓN" }))

    await waitFor(() => {
      expect(onCambio).toHaveBeenCalledTimes(1)
    })
    expect(onCambio.mock.calls[0]?.[0].figura).toBeNull()
  })

  it("si no carga el índice avisa y deja reintentar", async () => {
    const api = catalogoEnMemoria([SENTADILLA])
    const medios = api.medios
    api.medios = jest
      .fn<typeof api.medios>()
      .mockRejectedValueOnce(new ErrorDeRed("sin red"))
      .mockImplementation(medios)
    await pintar(SENTADILLA, api)

    await fireEvent.press(screen.getByRole("button", { name: "ELEGIR ANIMACIÓN" }))
    expect(await screen.findByText(/No hemos podido conectar/)).toBeTruthy()

    await fireEvent.press(screen.getByRole("button", { name: "REINTENTAR" }))
    expect(await screen.findByRole("radio", { name: "Dominadas" })).toBeTruthy()
  })

  it("un servidor sin figuras importadas lo dice en lugar de enseñar una lista vacía", async () => {
    await pintar(SENTADILLA, catalogoEnMemoria([SENTADILLA], undefined, []))

    await fireEvent.press(screen.getByRole("button", { name: "ELEGIR ANIMACIÓN" }))

    expect(await screen.findByText(/todavía no tiene figuras importadas/)).toBeTruthy()
  })
})

describe("La ficha del entrenador", () => {
  it("ofrece la animación al editar y avisa al crear de que se elige después", async () => {
    const api = catalogoEnMemoria([SENTADILLA])
    const vista = await render(
      <FormularioDeEjercicio
        api={api}
        acceso={ACCESO}
        id={SENTADILLA.id}
        onGuardado={jest.fn()}
        onCancelar={jest.fn()}
      />,
    )
    expect(await screen.findByText("ANIMACIÓN DE LA TÉCNICA")).toBeTruthy()

    await vista.unmount()
    await render(
      <FormularioDeEjercicio
        api={api}
        acceso={ACCESO}
        onGuardado={jest.fn()}
        onCancelar={jest.fn()}
      />,
    )
    expect(screen.queryByText("ANIMACIÓN DE LA TÉCNICA")).toBeNull()
    expect(screen.getByText(/se elige después de guardar/)).toBeTruthy()
  })
})
