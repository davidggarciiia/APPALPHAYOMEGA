import type { PropsWithChildren } from "react"
import type { StyleProp, ViewStyle } from "react-native"
import { AppState } from "react-native"
import { render, screen } from "@testing-library/react-native"
import type { SesionEntrenador } from "@alpha-omega/shared"

import { Armazon } from "../componentes/armazon"
import type { ApiEntrenamiento } from "../entrenamiento/api"
import { DetalleEntrenador } from "./detalle"

jest.mock("expo-router", () => ({
  usePathname: () => "/entrenamiento/sesion",
  useRouter: () => ({ back: jest.fn(), canGoBack: () => true }),
  useFocusEffect: (efecto: () => void) => {
    jest.requireActual<typeof import("react")>("react").useEffect(efecto, [efecto])
  },
}))
jest.mock("../sesion", () => ({
  useSesion: () => ({
    estado: { fase: "dentro", usuario: { nombre: "Carlos", rol: "entrenador" } },
  }),
}))
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({
    edges = ["top", "bottom", "left", "right"],
    style,
    ...props
  }: PropsWithChildren<{ edges?: string[]; style?: StyleProp<ViewStyle> }>) => {
    const React = jest.requireActual<typeof import("react")>("react")
    const { View } = jest.requireActual<typeof import("react-native")>("react-native")
    return React.createElement(View, {
      ...props,
      testID: "zona-segura",
      style: [
        style,
        {
          paddingTop: edges.includes("top") ? 24 : 0,
          paddingBottom: edges.includes("bottom") ? 16 : 0,
        },
      ],
    })
  },
}))

it("reserva una sola vez los insets del móvil entre armazón y revisión", async () => {
  Object.defineProperty(AppState, "currentState", { configurable: true, value: "active" })
  const sesion: SesionEntrenador = {
    agenda: {
      id: "sesion",
      clienteId: "cliente",
      fechaOriginal: "2026-10-29",
      fechaActual: "2026-10-29",
      estado: "abierta",
      revision: 0,
    },
    prescripcion: { nombre: "Empuje", ejercicios: [] },
    revisionPrescripcion: 0,
    permiteAjuste: false,
    enviadoEn: null,
  }
  const api = { leerEntrenador: async () => sesion } as unknown as ApiEntrenamiento
  await render(
    <Armazon>
      <DetalleEntrenador id="sesion" api={api} nombreCliente="David" />
    </Armazon>,
  )
  await screen.findByText("Aún no ha terminado el entrenamiento")
  const { StyleSheet } = jest.requireActual<typeof import("react-native")>("react-native")
  const zonas = screen.getAllByTestId("zona-segura")
  const total = (lado: "paddingTop" | "paddingBottom"): number =>
    zonas.reduce((suma, zona) => suma + (StyleSheet.flatten(zona.props.style)[lado] ?? 0), 0)
  expect(total("paddingTop")).toBe(24)
  expect(total("paddingBottom")).toBe(16)
  expect(screen.getAllByRole("button", { name: "Volver" })).toHaveLength(1)
})
