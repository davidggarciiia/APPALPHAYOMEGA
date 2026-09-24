import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals"
import { AppState } from "react-native"
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native"
import type {
  Borrador,
  EnviarEntrenamiento,
  GuardarBorrador,
  ResultadoEntrenamiento,
  SesionCliente,
} from "@alpha-omega/shared"

import type { ApiEntrenamiento } from "./api"
import { almacenDispositivo } from "./almacen-dispositivo"
import { claveSesion, nuevoDocumento } from "./documento-local"
import { RegistroCliente } from "./registro-cliente"
import { registroParaEnviar } from "./registro-modelo"
import { ErrorDeRed } from "../lib/http"

jest.mock("expo-router", () => ({
  useFocusEffect: (efecto: () => void) =>
    jest.requireActual<typeof import("react")>("react").useEffect(efecto, [efecto]),
}))
jest.mock("expo-crypto", () => ({
  randomUUID: () => jest.requireActual<typeof import("node:crypto")>("node:crypto").randomUUID(),
}))
// Copia local en memoria: sin cifrado del dispositivo ni SQLite.
const mockFilas = new Map<string, string>()
jest.mock("./almacen-dispositivo", () => {
  const { crearAlmacenLocal } =
    jest.requireActual<typeof import("./almacen-local")>("./almacen-local")
  return {
    almacenDispositivo: crearAlmacenLocal(
      {
        leer: async (_c, k) => mockFilas.get(k) ?? null,
        escribir: async (_c, k, v) => {
          mockFilas.set(k, v)
        },
        borrar: async (_c, k) => {
          mockFilas.delete(k)
        },
        listar: async () => [...mockFilas.keys()],
        limpiar: async () => mockFilas.clear(),
      },
      {
        cifrar: async (_c, _k, t) => t,
        descifrar: async (_c, _k, t) => t,
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
const SERIE = "30000000-0000-4000-8000-000000000001"
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
        series: [{ id: SERIE, tipoMedicion: "repeticiones", pesoKg: 40, repeticiones: 8 }],
      },
    ],
  },
  revisionPrescripcion: 0,
  permiteAjuste: true,
  enviadoEn: null,
  borrador: {
    revision: 1,
    revisionPrescripcion: 0,
    actualizadoEn: "2026-09-14T10:00:00.000Z",
    registro: {
      notas: null,
      checkin: { sensacion: 4, molestia: "nada" },
      inicio: "2026-09-14T09:00:00.000Z",
      cierre: null,
      series: [
        { serieId: SERIE, tipoMedicion: "repeticiones", pesoKg: 40, repeticiones: 8, hecha: true },
      ],
    },
  },
}
const resultado = (envio: EnviarEntrenamiento): ResultadoEntrenamiento => ({
  sesionId: ID,
  prescripcion: sesion.prescripcion,
  revisionPrescripcion: 0,
  enviadoEn: "2026-09-14T11:00:00.000Z",
  notas: envio.registro.notas,
  cierre: envio.registro.cierre ?? null,
  series: [
    {
      serieId: SERIE,
      hecha: true,
      valores: { tipoMedicion: "repeticiones", pesoKg: 40, repeticiones: 8 },
    },
  ],
})
const borradorGuardado = async (_id: string, datos: GuardarBorrador): Promise<Borrador> => ({
  revision: 2,
  revisionPrescripcion: 0,
  registro: datos.registro,
  actualizadoEn: "2026-09-14T10:30:00.000Z",
})

function crearApi() {
  const api = {
    leerCliente: jest.fn(async () => sesion),
    anteriores: jest.fn(async () => ({ anteriores: [] })),
    guardar: jest.fn<ApiEntrenamiento["guardar"]>(),
    enviar: jest.fn<ApiEntrenamiento["enviar"]>(),
    resultado: jest.fn<ApiEntrenamiento["resultado"]>(),
    comentarios: jest.fn(async () => ({ comentarios: [] })),
    molestias: jest.fn(async () => ({ molestias: [] })),
    avisarMolestia: jest.fn(),
  }
  return { api, comoApi: api as unknown as ApiEntrenamiento }
}

async function abrirCierre(): Promise<void> {
  await fireEvent.press(await screen.findByRole("button", { name: "Terminar" }))
  await fireEvent.press(screen.getByRole("button", { name: "Terminar sesión" }))
  expect(await screen.findByText("¿Cómo ha ido?")).toBeTruthy()
}

async function responderCierre(): Promise<void> {
  const deslizador = screen.getByRole("adjustable", { name: "Cuánto te ha costado, de 0 a 10" })
  for (let i = 0; i < 3; i++)
    await fireEvent(deslizador, "accessibilityAction", {
      nativeEvent: { actionName: "increment" },
    })
  await fireEvent.press(screen.getByRole("radio", { name: "2" }))
  await fireEvent.press(screen.getByRole("radio", { name: "Algo incómodo" }))
  await fireEvent.press(screen.getByRole("button", { name: "Añadir nota" }))
  await fireEvent.changeText(screen.getByLabelText("Nota para tu entrenador"), "Me cansé")
  await fireEvent.press(screen.getByRole("button", { name: "Enviar a tu entrenador" }))
}

/** Lo visible coincide con la intención guardada y no queda nada editable. */
function muestraElCierreComprometido(): void {
  expect(screen.getByText("8 de 10")).toBeTruthy()
  expect(screen.getByText("2 de 5")).toBeTruthy()
  expect(screen.getByText("Algo incómodo")).toBeTruthy()
  expect(screen.getByText("Me cansé")).toBeTruthy()
  expect(screen.queryAllByRole("radio")).toHaveLength(0)
  expect(screen.queryByRole("adjustable")).toBeNull()
  expect(screen.queryByDisplayValue(/./)).toBeNull()
}

describe("RegistroCliente · cierre comprometido", () => {
  beforeEach(() => {
    mockFilas.clear()
    // La comprobación automática cada 5 s solo actúa con la app activa: así cada
    // reintento de la prueba es explícito y el número de envíos, exacto.
    AppState.currentState = "background"
  })
  afterEach(() => {
    AppState.currentState = "active"
  })

  it("sin red conserva el cierre enviado; al volver y reintentar se entrega lo que se ve", async () => {
    const { api, comoApi } = crearApi()
    api.guardar.mockRejectedValue(new ErrorDeRed("Sin conexión"))
    await render(<RegistroCliente cuenta={CUENTA} id={ID} api={comoApi} />)
    await abrirCierre()
    await responderCierre()

    const reintento = (): ReturnType<typeof screen.getByRole> =>
      screen.getByRole("button", { name: "Reintentar envío pendiente" })
    expect(await screen.findByRole("button", { name: "Reintentar envío pendiente" })).toBeTruthy()
    expect(api.enviar).not.toHaveBeenCalled()
    muestraElCierreComprometido()

    // Cerrar y volver a abrir el resumen no cambia lo comprometido.
    await fireEvent.press(screen.getByRole("button", { name: "Volver a la sesión" }))
    expect(screen.getByText(/Pendiente de envío/)).toBeTruthy()
    await abrirCierre()
    muestraElCierreComprometido()

    // Se guarda el borrador, pero la respuesta del envío se pierde.
    api.guardar.mockImplementation(borradorGuardado)
    api.enviar.mockRejectedValueOnce(new ErrorDeRed("Sin conexión"))
    await fireEvent.press(reintento())
    await waitFor(() => expect(api.enviar).toHaveBeenCalledTimes(1))
    await waitFor(() =>
      screen.getByRole("button", { name: "Reintentar envío pendiente", busy: false }),
    )
    muestraElCierreComprometido()

    // Desde la sesión se reintenta el mismo envío.
    await fireEvent.press(screen.getByRole("button", { name: "Volver a la sesión" }))
    expect(screen.getByText(/Pendiente de envío/)).toBeTruthy()
    api.enviar.mockImplementation(async (_id, envio) => resultado(envio))
    await fireEvent.press(reintento())
    expect(await screen.findByText("Enviado al entrenador")).toBeTruthy()

    expect(api.enviar).toHaveBeenCalledTimes(2)
    const [[, original], [, repetido]] = api.enviar.mock.calls as [
      Parameters<ApiEntrenamiento["enviar"]>,
      Parameters<ApiEntrenamiento["enviar"]>,
    ]
    expect(repetido).toEqual(original)
    expect(original.registro.cierre).toEqual({ esfuerzo: 8, energia: 2, incomodo: true })
    expect(original.registro.notas).toBe("Me cansé")
  })

  it("con una respuesta lenta muestra lo que se está enviando y no deja cambiarlo", async () => {
    const { api, comoApi } = crearApi()
    let responder!: () => void
    const lenta = new Promise<void>((resolve) => {
      responder = resolve
    })
    api.guardar.mockImplementation(async (id, datos) => {
      await lenta
      return borradorGuardado(id, datos)
    })
    api.enviar.mockImplementation(async (_id, envio) => resultado(envio))
    await render(<RegistroCliente cuenta={CUENTA} id={ID} api={comoApi} />)
    await abrirCierre()
    await responderCierre()

    expect(await screen.findByText("8 de 10")).toBeTruthy()
    muestraElCierreComprometido()
    expect(screen.queryByRole("button", { name: "Enviar a tu entrenador" })).toBeNull()

    responder()
    expect(await screen.findByText("Enviado al entrenador")).toBeTruthy()
    expect(api.enviar).toHaveBeenCalledTimes(1)
    const [, envio] = api.enviar.mock.calls[0]!
    expect(envio.registro.cierre).toEqual({ esfuerzo: 8, energia: 2, incomodo: true })
    expect(envio.registro.notas).toBe("Me cansé")
  })

  it("un envío pendiente sin cierre se reintenta tal cual, sin inventar respuestas", async () => {
    const documento = nuevoDocumento(sesion)
    const operacionId = "60000000-0000-4000-8000-000000000001"
    await almacenDispositivo.guardar(CUENTA, claveSesion(ID), {
      ...documento,
      intencionEnvio: {
        operacionId,
        revisionPrescripcion: 0,
        registro: registroParaEnviar(sesion.prescripcion, documento.edicion),
      },
    })
    const { api, comoApi } = crearApi()
    api.enviar.mockImplementation(async (_id, envio) => resultado(envio))
    await render(<RegistroCliente cuenta={CUENTA} id={ID} api={comoApi} />)
    await abrirCierre()

    expect(screen.getByText("Sin feedback registrado")).toBeTruthy()
    expect(screen.queryByText(/de 10/)).toBeNull()
    expect(screen.queryAllByRole("radio")).toHaveLength(0)
    expect(screen.queryByDisplayValue(/./)).toBeNull()

    await fireEvent.press(screen.getByRole("button", { name: "Reintentar envío pendiente" }))
    expect(await screen.findByText("Enviado al entrenador")).toBeTruthy()
    const [, envio] = api.enviar.mock.calls[0]!
    expect(envio.operacionId).toBe(operacionId)
    expect(envio.registro.cierre ?? null).toBeNull()
    expect(envio.registro.notas).toBeNull()
  })
})
