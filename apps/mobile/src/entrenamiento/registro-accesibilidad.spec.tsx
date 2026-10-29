import type { SesionCliente } from "@alpha-omega/shared"
import { render, screen } from "@testing-library/react-native"
import { AppState } from "react-native"

import type { ApiEntrenamiento } from "./api"
import { almacenDispositivo } from "./almacen-dispositivo"
import { RegistroCliente } from "./registro-cliente"

jest.mock("expo-router", () => ({
  useFocusEffect: (efecto: () => void) =>
    jest.requireActual<typeof import("react")>("react").useEffect(efecto, [efecto]),
}))
jest.mock("expo-crypto", () => ({
  randomUUID: () => jest.requireActual<typeof import("node:crypto")>("node:crypto").randomUUID(),
}))
const mockFilas = new Map<string, string>()
jest.mock("./almacen-dispositivo", () => {
  const { crearAlmacenLocal } =
    jest.requireActual<typeof import("./almacen-local")>("./almacen-local")
  return {
    almacenDispositivo: crearAlmacenLocal(
      {
        leer: async (_cuenta, clave) => mockFilas.get(clave) ?? null,
        escribir: async (_cuenta, clave, valor) => void mockFilas.set(clave, valor),
        borrar: async (_cuenta, clave) => void mockFilas.delete(clave),
        listar: async () => [...mockFilas.keys()],
        limpiar: async () => mockFilas.clear(),
      },
      {
        cifrar: async (_cuenta, _clave, texto) => texto,
        descifrar: async (_cuenta, _clave, texto) => texto,
        olvidar: async () => undefined,
      },
    ),
  }
})
const mockSesion = {
  estado: { fase: "fuera" },
  pedir: () => Promise.reject(new Error("Sin catálogo en la prueba")),
}
jest.mock("../sesion", () => ({ useSesion: () => mockSesion }))
jest.mock("../lib/direccion-api", () => ({ direccionDeLaApi: () => "http://localhost:3000" }))
jest.mock("../componentes/iconos", () => ({ Icono: () => null }))

const CUENTA = "10000000-0000-4000-8000-000000000001"
const ID = "20000000-0000-4000-8000-000000000001"
const sesion: SesionCliente = {
  agenda: {
    id: ID,
    clienteId: CUENTA,
    fechaOriginal: "2026-09-14",
    fechaActual: "2026-09-14",
    estado: "abierta",
    revision: 0,
  },
  prescripcion: {
    nombre: "Empuje",
    ejercicios: [
      {
        id: "40000000-0000-4000-8000-000000000001",
        ejercicioId: "50000000-0000-4000-8000-000000000001",
        nombre: "Press banca",
        indicaciones: null,
        tipoCarga: "conCargaExterna",
        modoRir: "cadaSerie",
        rir: { min: 2, max: 3 },
        series: [
          {
            id: "30000000-0000-4000-8000-000000000001",
            tipoMedicion: "repeticiones",
            pesoKg: 40,
            repeticiones: 8,
          },
        ],
      },
    ],
  },
  revisionPrescripcion: 0,
  permiteAjuste: true,
  enviadoEn: null,
  borrador: null,
}

afterEach(() => {
  AppState.currentState = "active"
})

it("abre la sesión sin controles de rol button dentro de otro button", async () => {
  await almacenDispositivo.limpiar(CUENTA)
  almacenDispositivo.habilitar(CUENTA)
  AppState.currentState = "background"
  const api = {
    leerCliente: async () => sesion,
    anteriores: async () => ({ anteriores: [] }),
    comentarios: async () => ({ comentarios: [] }),
    molestias: async () => ({ molestias: [] }),
  } as unknown as ApiEntrenamiento

  await render(<RegistroCliente cuenta={CUENTA} id={ID} api={api} />)
  expect(
    await screen.findByRole("button", { name: "Peso — Press banca, serie 1: 40" }),
  ).toBeTruthy()

  const anidados: string[] = []
  for (const boton of screen.getAllByRole("button")) {
    for (let padre = boton.parent; padre; padre = padre.parent) {
      if (
        typeof padre.type === "string" &&
        (padre.props.role ?? padre.props.accessibilityRole) === "button"
      )
        anidados.push(
          `${boton.props.accessibilityLabel} dentro de ${padre.props.accessibilityLabel}`,
        )
    }
  }
  expect(anidados).toEqual([])
})
