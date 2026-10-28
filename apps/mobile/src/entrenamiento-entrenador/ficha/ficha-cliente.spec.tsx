import { fireEvent, render, screen, waitFor } from "@testing-library/react-native"
import type { FichaDeUsuario } from "@alpha-omega/shared"

import type { ApiEntrenamiento } from "../../entrenamiento/api"
import type { ApiNutricion } from "../../nutricion/api"
import type { ApiSeguimiento } from "../../seguimiento/api"
import type { ApiMedios } from "../../seguimiento/medios-api"
import type { ApiValoraciones } from "../../seguimiento/valoraciones-api"
import { FichaCliente } from "./ficha-cliente"

jest.mock("../../seguimiento/editor-valoracion", () => ({
  ValoracionesProfesional: function EditorDePrueba({
    alEditar,
  }: {
    alEditar?: (valor: boolean) => void
  }) {
    const { useEffect, useState } = jest.requireActual<typeof import("react")>("react")
    const { TextInput } = jest.requireActual<typeof import("react-native")>("react-native")
    const [valor, cambiar] = useState("")
    useEffect(() => {
      alEditar?.(true)
      return () => alEditar?.(false)
    }, [alEditar])
    return (
      <TextInput accessibilityLabel="Valoración en edición" value={valor} onChangeText={cambiar} />
    )
  },
}))
jest.mock("../../seguimiento/progreso", () => ({ ProgresoCliente: () => null }))

const mockPush = jest.fn()
jest.mock("expo-router", () => ({
  useFocusEffect: (efecto: () => void) =>
    jest.requireActual<typeof import("react")>("react").useEffect(efecto, [efecto]),
  useRouter: () => ({ push: mockPush }),
}))

const clienteId = "30000000-0000-4000-8000-000000000000"
const sesionId = "20000000-0000-4000-8000-000000000000"

it("cambiar de pestaña conserva el editor de valoraciones abierto", async () => {
  await render(
    <FichaCliente
      clienteId={clienteId}
      cuentaId={clienteId}
      leerFicha={async () => ({ nombre: "Lara", apellidos: "García" }) as FichaDeUsuario}
      api={
        {
          plan: async () => ({ plan: null }),
          resultados: async () => ({ resultados: [] }),
          molestias: async () => ({ molestias: [] }),
          novedades: async () => ({ novedades: [], total: 0, sinLeer: 0 }),
        } as unknown as ApiEntrenamiento
      }
      seguimiento={
        {
          medidas: async () => ({ medidas: [], fechaNacimiento: null }),
          consentimiento: async () => null,
        } as unknown as ApiSeguimiento
      }
      nutricion={{ vigente: async () => null } as unknown as ApiNutricion}
      valoraciones={{} as ApiValoraciones}
      medios={{} as ApiMedios}
      nuevoId={() => clienteId}
      editarPlan={jest.fn()}
      verSemana={jest.fn()}
      abrirNutricion={jest.fn()}
    />,
  )
  await fireEvent.press(await screen.findByRole("tab", { name: "Progreso" }))
  await fireEvent.changeText(screen.getByLabelText("Valoración en edición"), "Datos pendientes")
  await fireEvent.press(screen.getByRole("tab", { name: "Resumen" }))
  expect(screen.getByRole("tab", { name: "Progreso" }).props.accessibilityState.selected).toBe(true)
  await fireEvent.press(screen.getByRole("tab", { name: "Progreso" }))
  expect(screen.getByDisplayValue("Datos pendientes")).toBeTruthy()
})

it("muestra novedades de la ficha y abre el detalle de su sesión", async () => {
  const api = {
    plan: jest.fn(async () => ({ plan: null })),
    resultados: jest.fn(async () => ({ resultados: [] })),
    molestias: jest.fn(async () => ({ molestias: [] })),
    novedades: jest.fn(async () => ({
      novedades: [
        { id: "10000000-0000-4000-8000-000000000001", tipo: "fecha_cambiada" },
        { id: "10000000-0000-4000-8000-000000000002", tipo: "entrenamiento_enviado" },
        { id: "10000000-0000-4000-8000-000000000003", tipo: "molestia" },
      ].map((dato) => ({
        ...dato,
        sesionId,
        clienteId,
        sesionNombre: "Fuerza A",
        autor: { id: clienteId, nombre: "Lara", rol: "cliente" },
        creadaEn: "2026-09-24T10:00:00.000Z",
        leidaEn: null,
      })),
      total: 3,
      sinLeer: 3,
    })),
    leerNovedades: jest.fn(async () => ({ leidas: 1 })),
  } as unknown as ApiEntrenamiento
  const seguimiento = {
    medidas: jest.fn(async () => ({ medidas: [], fechaNacimiento: null })),
    consentimiento: jest.fn(async () => ({
      version: null,
      aceptadoEn: null,
      retiradoEn: null,
      vigente: false,
      versionVigente: "2026-09-24-borrador",
    })),
  } as unknown as ApiSeguimiento
  const nutricion = { vigente: jest.fn(async () => null) } as unknown as ApiNutricion

  await render(
    <FichaCliente
      clienteId={clienteId}
      cuentaId="40000000-0000-4000-8000-000000000000"
      leerFicha={async () => ({ nombre: "Lara", apellidos: "García" }) as FichaDeUsuario}
      api={api}
      seguimiento={seguimiento}
      valoraciones={{} as ApiValoraciones}
      medios={{} as ApiMedios}
      nutricion={nutricion}
      nuevoId={() => "50000000-0000-4000-8000-000000000000"}
      editarPlan={jest.fn()}
      verSemana={jest.fn()}
      abrirNutricion={jest.fn()}
    />,
  )

  await waitFor(() => expect(screen.getByText(/cambió el día de Fuerza A/)).toBeTruthy())
  expect(screen.getByText(/Sin consentimiento de datos de salud/)).toBeTruthy()
  expect(screen.getByRole("button", { name: "Crear plan nuevo" })).toBeOnTheScreen()
  expect(screen.getByText(/envió Fuerza A/)).toBeTruthy()
  expect(screen.getByText(/comunicó una molestia en Fuerza A/)).toBeTruthy()
  await fireEvent.press(screen.getByRole("button", { name: /comunicó una molestia en Fuerza A/ }))
  await waitFor(() =>
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/entrenamiento/[id]",
      params: { id: sesionId },
    }),
  )
  expect(api.leerNovedades).toHaveBeenCalledWith(sesionId, {
    novedadIds: ["10000000-0000-4000-8000-000000000003"],
  })
})
