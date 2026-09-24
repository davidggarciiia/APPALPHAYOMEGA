import { fireEvent, render, screen, waitFor } from "@testing-library/react-native"
import { Text } from "react-native"
import {
  TEXTO_CONSENTIMIENTO,
  VERSION_CONSENTIMIENTO,
  type EstadoConsentimiento,
} from "@alpha-omega/shared"

import { ErrorDeRed } from "./lib/http"
import {
  PuertaConsentimiento,
  TarjetaConsentimiento,
  type ApiConsentimiento,
} from "./consentimiento"

jest.mock("./componentes/iconos", () => ({ Icono: () => null }))

const pendiente: EstadoConsentimiento = {
  version: null,
  aceptadoEn: null,
  retiradoEn: null,
  vigente: false,
  versionVigente: VERSION_CONSENTIMIENTO,
}
const aceptado: EstadoConsentimiento = {
  version: VERSION_CONSENTIMIENTO,
  aceptadoEn: "2026-09-24T10:00:00.000Z",
  retiradoEn: null,
  vigente: true,
  versionVigente: VERSION_CONSENTIMIENTO,
}

function api(inicial = pendiente) {
  return {
    estado: jest.fn(async () => inicial),
    aceptar: jest.fn(async () => aceptado),
    retirar: jest.fn(async () => ({
      ...aceptado,
      vigente: false,
      retiradoEn: "2026-09-25T09:00:00.000Z",
    })),
  } satisfies ApiConsentimiento
}

async function pintar(falsa: ApiConsentimiento, salir = jest.fn()) {
  await render(
    <PuertaConsentimiento api={falsa} salir={salir}>
      <Text>Inicio de la app</Text>
    </PuertaConsentimiento>,
  )
  return salir
}

it("sin consentimiento vigente muestra el texto y exige marcarlo explícitamente", async () => {
  const falsa = api()
  await pintar(falsa)
  expect(await screen.findByText(TEXTO_CONSENTIMIENTO.titulo)).toBeTruthy()
  expect(screen.queryByText("Inicio de la app")).toBeNull()
  const casilla = screen.getByRole("checkbox", { name: TEXTO_CONSENTIMIENTO.aceptar })
  expect(casilla).not.toBeChecked()
  await fireEvent.press(screen.getByRole("button", { name: "Continuar" }))
  expect(falsa.aceptar).not.toHaveBeenCalled()
  await fireEvent.press(casilla)
  await fireEvent.press(screen.getByRole("button", { name: "Continuar" }))
  expect(await screen.findByText("Inicio de la app")).toBeTruthy()
  expect(falsa.aceptar).toHaveBeenCalledTimes(1)
})

it("con consentimiento vigente entra directamente", async () => {
  await pintar(api(aceptado))
  expect(await screen.findByText("Inicio de la app")).toBeTruthy()
})

it("un fallo al guardar conserva la pantalla y permite reintentar", async () => {
  const falsa = api()
  falsa.aceptar.mockRejectedValueOnce(new ErrorDeRed())
  await pintar(falsa)
  await fireEvent.press(await screen.findByRole("checkbox", { name: TEXTO_CONSENTIMIENTO.aceptar }))
  await fireEvent.press(screen.getByRole("button", { name: "Continuar" }))
  expect(await screen.findByText(/No hemos podido conectar/)).toBeTruthy()
  expect(screen.queryByText("Inicio de la app")).toBeNull()
  await fireEvent.press(screen.getByRole("button", { name: "Continuar" }))
  expect(await screen.findByText("Inicio de la app")).toBeTruthy()
})

it("sin conexión para comprobarlo no bloquea: el servidor lo exige al guardar", async () => {
  const falsa = api()
  falsa.estado.mockRejectedValueOnce(new ErrorDeRed())
  await pintar(falsa)
  expect(await screen.findByText("Inicio de la app")).toBeTruthy()
})

it("se puede no aceptar y cerrar sesión", async () => {
  const salir = await pintar(api())
  await fireEvent.press(await screen.findByRole("button", { name: "Ahora no, cerrar sesión" }))
  await waitFor(() => expect(salir).toHaveBeenCalled())
})

it("desde el perfil se retira con confirmación y la app vuelve a pedirlo", async () => {
  const falsa = api(aceptado)
  await render(
    <PuertaConsentimiento api={falsa} salir={jest.fn()}>
      <TarjetaConsentimiento />
    </PuertaConsentimiento>,
  )
  expect(
    await screen.findByText("Diste tu consentimiento el 24 de septiembre de 2026."),
  ).toBeTruthy()
  await fireEvent.press(screen.getByRole("button", { name: "Retirar consentimiento" }))
  expect(screen.getByText(/Lo guardado hasta ahora no se borra/)).toBeTruthy()
  await fireEvent.press(screen.getByRole("button", { name: "Mantenerlo" }))
  expect(falsa.retirar).not.toHaveBeenCalled()
  await fireEvent.press(screen.getByRole("button", { name: "Retirar consentimiento" }))
  await fireEvent.press(screen.getByRole("button", { name: "Sí, retirar mi consentimiento" }))
  expect(
    await screen.findByRole("checkbox", { name: TEXTO_CONSENTIMIENTO.aceptar }),
  ).not.toBeChecked()
  expect(falsa.retirar).toHaveBeenCalledTimes(1)
})

it("fuera de la puerta la tarjeta no se muestra", async () => {
  await render(<TarjetaConsentimiento />)
  expect(screen.queryByText(TEXTO_CONSENTIMIENTO.titulo)).toBeNull()
})
