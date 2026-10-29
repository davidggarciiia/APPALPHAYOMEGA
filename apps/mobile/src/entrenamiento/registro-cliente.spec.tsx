import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals"
import { AppState } from "react-native"
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native"
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
import { desdePrescripcion, registroParaEnviar } from "./registro-modelo"
import * as tablaSeries from "./tabla-series"
import * as molestiaSesion from "./sesion/molestia"
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
let mockFalloDeDisco = false
jest.mock("./almacen-dispositivo", () => {
  const { crearAlmacenLocal } =
    jest.requireActual<typeof import("./almacen-local")>("./almacen-local")
  return {
    almacenDispositivo: crearAlmacenLocal(
      {
        leer: async (_c, k) => mockFilas.get(k) ?? null,
        escribir: async (_c, k, v) => {
          if (mockFalloDeDisco) throw new Error("Disco lleno")
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
  checkin: envio.registro.checkin ?? null,
  inicio: envio.registro.inicio ?? null,
  tiempoActivoSegundos: envio.registro.tiempoActivoSegundos,
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

async function anotarNota(texto = "Me cansé"): Promise<void> {
  await fireEvent.press(await screen.findByRole("button", { name: "Añadir nota" }))
  await fireEvent.changeText(screen.getByLabelText("Nota para tu entrenador"), texto)
  await waitFor(() =>
    expect(screen.getByTestId("estado-guardado").props.children).toContain("Guardado"),
  )
}

function copiaGuardada() {
  return JSON.parse(mockFilas.get(claveSesion(ID))!).datos
}

describe("RegistroCliente · sesión y envío en un toque", () => {
  beforeEach(async () => {
    mockFalloDeDisco = false
    await almacenDispositivo.limpiar(CUENTA)
    almacenDispositivo.habilitar(CUENTA)
    AppState.currentState = "background"
  })
  afterEach(() => {
    mockFalloDeDisco = false
    AppState.currentState = "active"
  })

  it("abre directamente la sesión e inicia el reloj sin inventar check-in ni cierre", async () => {
    const { api, comoApi } = crearApi()
    api.leerCliente.mockResolvedValue({ ...sesion, borrador: null })
    await render(<RegistroCliente cuenta={CUENTA} id={ID} api={comoApi} />)
    expect(await screen.findByRole("button", { name: "Terminar" })).toBeTruthy()
    expect(screen.queryByText("¿Cómo llegas?")).toBeNull()
    await waitFor(() => expect(copiaGuardada().edicion.tramoActivoDesde).toBeTruthy())
    expect(copiaGuardada().edicion.checkin).toBeNull()
    expect(copiaGuardada().edicion.cierre).toBeNull()
  })

  it("el reloj avanza sin repintar la tabla ni interrumpir el ajuste", async () => {
    jest.useFakeTimers()
    const tabla = jest.spyOn(tablaSeries, "TablaSeries")
    try {
      const { comoApi } = crearApi()
      const copia = nuevoDocumento(sesion)
      copia.edicion.inicio = new Date().toISOString()
      copia.edicion.tiempoActivoSegundos = 0
      copia.edicion.tramoActivoDesde = copia.edicion.inicio
      copia.descansoHasta = new Date(Date.now() + 90000).toISOString()
      copia.descansoTotal = 90
      await almacenDispositivo.guardar(CUENTA, claveSesion(ID), copia)
      const vista = await render(<RegistroCliente cuenta={CUENTA} id={ID} api={comoApi} />)
      await screen.findByRole("timer", { name: "Tiempo de sesión: 0 minutos 0 segundos" })
      await fireEvent.press(screen.getByRole("button", { name: /^Peso — Press banca/ }))
      await fireEvent.press(screen.getByRole("button", { name: "Aumentar" }))
      tabla.mockClear()
      await act(async () => jest.advanceTimersByTime(1000))
      expect(
        screen.getByRole("timer", { name: "Tiempo de sesión: 0 minutos 1 segundos" }),
      ).toBeTruthy()
      expect(screen.getByLabelText("Quedan 89 segundos de descanso")).toBeTruthy()
      expect(screen.getByRole("button", { name: "Escribir KG: 42,5" })).toBeTruthy()
      expect(tabla).not.toHaveBeenCalled()
      await vista.unmount()
    } finally {
      tabla.mockRestore()
      jest.useRealTimers()
    }
  })

  it("el reloj no repinta el formulario de molestia", async () => {
    jest.useFakeTimers()
    const formulario = jest.spyOn(molestiaSesion, "RegistrarMolestiaPantalla")
    try {
      const { comoApi } = crearApi()
      const copia = nuevoDocumento(sesion)
      copia.edicion.inicio = new Date().toISOString()
      copia.edicion.tiempoActivoSegundos = 0
      copia.edicion.tramoActivoDesde = copia.edicion.inicio
      await almacenDispositivo.guardar(CUENTA, claveSesion(ID), copia)
      const vista = await render(<RegistroCliente cuenta={CUENTA} id={ID} api={comoApi} />)
      await fireEvent.press(
        await screen.findByRole("button", { name: "Tengo una molestia — Press banca" }),
      )
      formulario.mockClear()
      await act(async () => jest.advanceTimersByTime(1000))
      expect(screen.getByRole("header", { name: /MOLESTIA/i })).toBeTruthy()
      expect(formulario).not.toHaveBeenCalled()
      await vista.unmount()
    } finally {
      formulario.mockRestore()
      jest.useRealTimers()
    }
  })

  it("muestra todos los ejercicios y sus series, con el contexto de molestia propio", async () => {
    const { api, comoApi } = crearApi()
    const segundo = {
      ...sesion.prescripcion.ejercicios[0]!,
      id: "40000000-0000-4000-8000-000000000002",
      nombre: "Remo",
      series: [
        {
          id: "30000000-0000-4000-8000-000000000002",
          tipoMedicion: "repeticiones" as const,
          pesoKg: 20,
          repeticiones: 10,
        },
      ],
    }
    api.leerCliente.mockResolvedValue({
      ...sesion,
      prescripcion: {
        ...sesion.prescripcion,
        ejercicios: [...sesion.prescripcion.ejercicios, segundo],
      },
      borrador: null,
    })
    await render(<RegistroCliente cuenta={CUENTA} id={ID} api={comoApi} />)
    expect(
      await screen.findByRole("checkbox", { name: "Hecha — Press banca, serie 1" }),
    ).toBeTruthy()
    expect(screen.getByRole("checkbox", { name: "Hecha — Remo, serie 1" })).toBeTruthy()
    await fireEvent.press(screen.getByRole("button", { name: "Tengo una molestia — Remo" }))
    expect(screen.getByRole("header", { name: /MOLESTIA/i })).toBeTruthy()
    expect(screen.getByText("Remo · serie 1")).toBeTruthy()
  })

  it("oculta el estado de guardado sin anunciar cada pulsación al lector", async () => {
    const { comoApi } = crearApi()
    await render(<RegistroCliente cuenta={CUENTA} id={ID} api={comoApi} />)
    const estado = await screen.findByTestId("estado-guardado")
    expect(estado.props.accessibilityLiveRegion).toBe("none")
    expect(estado.props.style).toEqual(expect.objectContaining({ height: 0, opacity: 0 }))
  })

  it("un fallo al leer la copia local conserva los datos y no pide conexión", async () => {
    const { api, comoApi } = crearApi()
    mockFilas.set(claveSesion(ID), "copia local ilegible")
    await render(<RegistroCliente cuenta={CUENTA} id={ID} api={comoApi} />)
    expect(
      await screen.findByText(
        "No se pudo leer la copia guardada en este dispositivo. La copia se conserva; reintenta para recuperarla.",
      ),
    ).toBeTruthy()
    expect(screen.queryByText(/Necesitas conexión/)).toBeNull()
    expect(api.leerCliente).not.toHaveBeenCalled()
    expect(mockFilas.get(claveSesion(ID))).toBe("copia local ilegible")
  })

  it("reintentar un guardado local fallido indica el problema del dispositivo", async () => {
    const { api, comoApi } = crearApi()
    await almacenDispositivo.guardar(CUENTA, claveSesion(ID), nuevoDocumento(sesion))
    const anterior = mockFilas.get(claveSesion(ID))
    api.leerCliente.mockResolvedValue({ ...sesion, agenda: { ...sesion.agenda, revision: 1 } })
    mockFalloDeDisco = true
    await render(<RegistroCliente cuenta={CUENTA} id={ID} api={comoApi} />)
    await fireEvent.press(await screen.findByRole("button", { name: "Reintentar guardado local" }))
    expect(
      await screen.findByText(
        "No se pudo guardar la sesión en este dispositivo. Reintenta antes de salir.",
      ),
    ).toBeTruthy()
    expect(mockFilas.get(claveSesion(ID))).toBe(anterior)
    expect(api.guardar).not.toHaveBeenCalled()
  })

  it("salir guarda y sale en un toque; un fallo de disco conserva nota y permite reintentar", async () => {
    const { comoApi } = crearApi()
    const salir = jest.fn()
    await render(<RegistroCliente cuenta={CUENTA} id={ID} api={comoApi} salir={salir} />)
    await anotarNota("No perder")
    mockFalloDeDisco = true
    await fireEvent.press(screen.getByRole("button", { name: "Salir de la sesión" }))
    expect(await screen.findByText(/No se pudo guardar la sesión en este dispositivo/)).toBeTruthy()
    expect(salir).not.toHaveBeenCalled()
    expect(screen.getByDisplayValue("No perder")).toBeTruthy()
    mockFalloDeDisco = false
    await fireEvent.press(screen.getByRole("button", { name: "Salir de la sesión" }))
    await waitFor(() => expect(salir).toHaveBeenCalledTimes(1))
  })

  it("sin red conserva el envío; reabrir y reintentar entrega exactamente lo comprometido", async () => {
    const { api, comoApi } = crearApi()
    api.guardar.mockRejectedValue(new ErrorDeRed("Sin conexión"))
    const vista = await render(<RegistroCliente cuenta={CUENTA} id={ID} api={comoApi} />)
    await anotarNota()
    await fireEvent.press(screen.getByRole("button", { name: "Terminar" }))
    expect(await screen.findByText("GUARDADO")).toBeTruthy()
    expect(api.enviar).not.toHaveBeenCalled()
    expect(screen.queryByRole("checkbox")).toBeNull()
    const original = copiaGuardada().intencionEnvio
    expect(original.registro.cierre).toBeNull()
    expect(original.registro.notas).toBe("Me cansé")
    await vista.unmount()
    await render(<RegistroCliente cuenta={CUENTA} id={ID} api={comoApi} />)
    expect(await screen.findByText("GUARDADO")).toBeTruthy()
    api.guardar.mockImplementation(borradorGuardado)
    api.enviar.mockRejectedValueOnce(new ErrorDeRed("Sin conexión"))
    await fireEvent.press(screen.getByRole("button", { name: "Reintentar ahora" }))
    await waitFor(() => expect(api.enviar).toHaveBeenCalledTimes(1))
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Reintentar ahora" }).props.accessibilityState.busy,
      ).toBeFalsy(),
    )
    api.enviar.mockImplementation(async (_id, envio) => resultado(envio))
    await fireEvent.press(screen.getByRole("button", { name: "Reintentar ahora" }))
    expect(await screen.findByText("ENVIADO")).toBeTruthy()
    expect(api.enviar.mock.calls[1]![1]).toEqual(api.enviar.mock.calls[0]![1])
    expect(api.enviar.mock.calls[1]![1].operacionId).toBe(original.operacionId)
  })

  it("la nota se guarda en la lista y se recupera sin cuestionario ni envío", async () => {
    const { api, comoApi } = crearApi()
    const vista = await render(<RegistroCliente cuenta={CUENTA} id={ID} api={comoApi} />)
    await anotarNota("No perder nota")
    await vista.unmount()
    await render(<RegistroCliente cuenta={CUENTA} id={ID} api={comoApi} />)
    expect(await screen.findByDisplayValue("No perder nota")).toBeTruthy()
    expect(copiaGuardada().edicion.cierre).toBeNull()
    expect(api.enviar).not.toHaveBeenCalled()
  })

  it("una respuesta lenta bloquea la edición y preserva el contenido del envío", async () => {
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
    await anotarNota()
    await fireEvent.press(screen.getByRole("button", { name: "Terminar" }))
    await screen.findByText("GUARDADO")
    expect(screen.queryByRole("checkbox")).toBeNull()
    expect(screen.queryByDisplayValue(/./)).toBeNull()
    responder()
    expect(await screen.findByText("ENVIADO")).toBeTruthy()
    expect(api.enviar).toHaveBeenCalledTimes(1)
    expect(api.enviar.mock.calls[0]![1].registro.cierre).toBeNull()
    expect(api.enviar.mock.calls[0]![1].registro.notas).toBe("Me cansé")
  })

  it("Terminar envía directamente sin cierre y Listo vuelve a Hoy", async () => {
    const { api, comoApi } = crearApi()
    const salir = jest.fn()
    api.leerCliente.mockResolvedValue({
      ...sesion,
      borrador: { ...sesion.borrador!, registro: { ...sesion.borrador!.registro, checkin: null } },
    })
    api.guardar.mockImplementation(borradorGuardado)
    api.enviar.mockImplementation(async (_id, envio) => resultado(envio))
    await render(<RegistroCliente cuenta={CUENTA} id={ID} api={comoApi} salir={salir} />)
    await fireEvent.press(await screen.findByRole("button", { name: "Terminar" }))
    expect(await screen.findByText("ENVIADO")).toBeTruthy()
    expect(screen.queryByText("¿Cómo ha ido?")).toBeNull()
    expect(api.enviar.mock.calls[0]![1].registro).toMatchObject({ checkin: null, cierre: null })
    await fireEvent.press(screen.getByRole("button", { name: "Listo" }))
    expect(salir).toHaveBeenCalledTimes(1)
  })

  it("no envía los valores anteriores si el ajuste manual es inválido", async () => {
    const { api, comoApi } = crearApi()
    await render(<RegistroCliente cuenta={CUENTA} id={ID} api={comoApi} />)
    await fireEvent.press(await screen.findByRole("button", { name: /^Peso — Press banca/ }))
    await fireEvent.press(screen.getByRole("button", { name: "Escribir KG: 40" }))
    await fireEvent.changeText(screen.getByLabelText("Valor manual KG"), "1,2,3")
    const terminar = screen.getByRole("button", { name: "Terminar" })
    expect(terminar.props.accessibilityState.disabled).toBe(true)
    await fireEvent.press(terminar)
    expect(api.enviar).not.toHaveBeenCalled()
    expect(screen.getByLabelText("Valor manual KG").props.value).toBe("1,2,3")
    await fireEvent.changeText(screen.getByLabelText("Valor manual KG"), "42,5")
    expect(screen.getByRole("button", { name: "Terminar" }).props.accessibilityState.disabled).toBe(
      false,
    )
  })

  it("no afirma GUARDADO si falla persistir la intención de envío", async () => {
    const { api, comoApi } = crearApi()
    await render(<RegistroCliente cuenta={CUENTA} id={ID} api={comoApi} />)
    await screen.findByRole("button", { name: "Terminar" })
    mockFalloDeDisco = true
    await fireEvent.press(screen.getByRole("button", { name: "Terminar" }))
    expect(
      await screen.findByText(
        "No se pudo guardar la sesión en este dispositivo. Reintenta antes de salir.",
      ),
    ).toBeTruthy()
    expect(screen.queryByText("GUARDADO")).toBeNull()
    expect(api.enviar).not.toHaveBeenCalled()
  })

  it("un envío pendiente anterior conserva cierre y UUID sin inventar ni reemplazar datos", async () => {
    const documento = nuevoDocumento(sesion)
    const operacionId = "60000000-0000-4000-8000-000000000001"
    const registro = {
      ...registroParaEnviar(sesion.prescripcion, documento.edicion),
      cierre: { esfuerzo: 8, energia: 2, incomodo: true },
    }
    await almacenDispositivo.guardar(CUENTA, claveSesion(ID), {
      ...documento,
      intencionEnvio: { operacionId, revisionPrescripcion: 0, registro },
    })
    const { api, comoApi } = crearApi()
    api.enviar.mockImplementation(async (_id, envio) => resultado(envio))
    await render(<RegistroCliente cuenta={CUENTA} id={ID} api={comoApi} />)
    expect(await screen.findByText("GUARDADO")).toBeTruthy()
    expect(screen.queryAllByRole("radio")).toHaveLength(0)
    await fireEvent.press(screen.getByRole("button", { name: "Reintentar ahora" }))
    expect(await screen.findByText("ENVIADO")).toBeTruthy()
    expect(api.enviar.mock.calls[0]![1]).toMatchObject({ operacionId, registro })
  })

  it("un envío pendiente sin cierre se reintenta tal cual con null", async () => {
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
    await fireEvent.press(await screen.findByRole("button", { name: "Reintentar ahora" }))
    expect(await screen.findByText("ENVIADO")).toBeTruthy()
    expect(api.enviar.mock.calls[0]![1]).toMatchObject({
      operacionId,
      registro: { cierre: null, notas: null },
    })
  })

  it("cuenta solo las series de trabajo en progreso y confirmación", async () => {
    const { api, comoApi } = crearApi()
    const calentamiento = "30000000-0000-4000-8000-000000000002"
    const pauta = {
      ...sesion.prescripcion,
      ejercicios: [
        {
          ...sesion.prescripcion.ejercicios[0]!,
          id: "40000000-0000-4000-8000-000000000002",
          nombre: "Movilidad",
          seccion: "calentamiento" as const,
          series: [
            { id: calentamiento, tipoMedicion: "tiempo" as const, pesoKg: null, segundos: 60 },
          ],
        },
        ...sesion.prescripcion.ejercicios,
      ],
    }
    api.leerCliente.mockResolvedValue({
      ...sesion,
      prescripcion: pauta,
      borrador: {
        ...sesion.borrador!,
        registro: {
          ...sesion.borrador!.registro,
          series: [
            {
              serieId: calentamiento,
              tipoMedicion: "tiempo",
              pesoKg: null,
              segundos: 60,
              hecha: true,
            },
            ...sesion.borrador!.registro.series,
          ],
        },
      },
    })
    api.guardar.mockImplementation(borradorGuardado)
    api.enviar.mockImplementation(async (_id, envio) => ({
      ...resultado(envio),
      prescripcion: pauta,
    }))
    await render(<RegistroCliente cuenta={CUENTA} id={ID} api={comoApi} />)
    expect(await screen.findByRole("progressbar", { value: { now: 1, max: 1 } })).toBeTruthy()
    await fireEvent.press(screen.getByRole("button", { name: "Terminar" }))
    expect(await screen.findByLabelText(/1 de 1 series/)).toBeTruthy()
  })

  it("la copia no enviada identifica cada ejercicio y conserva sus unidades", async () => {
    const { comoApi } = crearApi()
    const copia = nuevoDocumento(sesion)
    copia.resultado = resultado({
      operacionId: ID,
      revisionPrescripcion: 0,
      revisionBorrador: 1,
      registro: registroParaEnviar(sesion.prescripcion, copia.edicion),
    })
    const pauta: SesionCliente["prescripcion"] = {
      nombre: "Cardio",
      ejercicios: [
        {
          ...sesion.prescripcion.ejercicios[0]!,
          nombre: "Carrera",
          series: [{ id: SERIE, tipoMedicion: "tiempo", segundos: 60, pesoKg: null }],
        },
        {
          ...sesion.prescripcion.ejercicios[0]!,
          id: "40000000-0000-4000-8000-000000000002",
          nombre: "Paseo del granjero",
          series: [
            {
              id: "30000000-0000-4000-8000-000000000002",
              tipoMedicion: "distancia",
              metros: 40,
              pesoKg: 12.5,
            },
          ],
        },
      ],
    }
    const edicion = desdePrescripcion(pauta)
    edicion.series = edicion.series.map((s, i) => ({
      ...s,
      valor: i === 0 ? "30" : "20",
      peso: i === 0 ? "" : "12,5",
    }))
    copia.respaldo = { prescripcion: pauta, edicion }
    await almacenDispositivo.guardar(CUENTA, claveSesion(ID), copia)
    await render(<RegistroCliente cuenta={CUENTA} id={ID} api={comoApi} />)
    expect(await screen.findByText("Copia · Carrera · serie 1: 30 s")).toBeTruthy()
    expect(screen.getByText("Copia · Paseo del granjero · serie 1: 20 m · 12,5 kg")).toBeTruthy()
  })

  it("ajusta y salta el descanso persistiendo ambos campos de vista", async () => {
    const { comoApi } = crearApi()
    const copia = nuevoDocumento(sesion)
    copia.descansoHasta = new Date(Date.now() + 90000).toISOString()
    copia.descansoTotal = 90
    await almacenDispositivo.guardar(CUENTA, claveSesion(ID), copia)
    await render(<RegistroCliente cuenta={CUENTA} id={ID} api={comoApi} />)
    await fireEvent.press(
      await screen.findByRole("button", { name: "Añadir 15 segundos de descanso" }),
    )
    await waitFor(() => expect(copiaGuardada().descansoTotal).toBe(105))
    await fireEvent.press(screen.getByRole("button", { name: "Restar 15 segundos de descanso" }))
    await waitFor(() => expect(copiaGuardada().descansoTotal).toBe(90))
    await fireEvent.press(screen.getByRole("button", { name: "Saltar descanso" }))
    await waitFor(() =>
      expect(copiaGuardada()).toMatchObject({ descansoHasta: null, descansoTotal: null }),
    )
  })

  it("Terminar avisa si no hay series hechas y confirma solo las pendientes", async () => {
    const { api, comoApi } = crearApi()
    api.leerCliente.mockResolvedValue({ ...sesion, borrador: null })
    api.guardar.mockImplementation(borradorGuardado)
    api.enviar.mockImplementation(async (_id, envio) => resultado(envio))
    await render(<RegistroCliente cuenta={CUENTA} id={ID} api={comoApi} />)
    await fireEvent.press(await screen.findByRole("button", { name: "Terminar" }))
    expect(screen.getByText("Marca al menos una serie")).toBeTruthy()
    expect(api.enviar).not.toHaveBeenCalled()
  })

  it("marcar toma las sugerencias y deshacer conserva un ajuste posterior de peso", async () => {
    const { api, comoApi } = crearApi()
    api.leerCliente.mockResolvedValue({ ...sesion, borrador: null })
    await render(<RegistroCliente cuenta={CUENTA} id={ID} api={comoApi} />)
    await fireEvent.press(
      await screen.findByRole("checkbox", { name: "Hecha — Press banca, serie 1" }),
    )
    await waitFor(() =>
      expect(copiaGuardada().edicion.series[0]).toMatchObject({
        hecha: true,
        peso: "40",
        valor: "8",
      }),
    )
    await fireEvent.press(screen.getByRole("button", { name: /^Peso — Press banca/ }))
    await fireEvent.press(screen.getByRole("button", { name: "Aumentar" }))
    await fireEvent.press(screen.getByRole("button", { name: "Listo" }))
    await fireEvent.press(
      await screen.findByRole("button", { name: "Deshacer" }, { timeout: 2500 }),
    )
    await waitFor(() =>
      expect(copiaGuardada().edicion.series[0]).toMatchObject({
        hecha: false,
        peso: "42,5",
        valor: "8",
      }),
    )
  })

  it("con series pendientes pide confirmar antes de enviar en un toque", async () => {
    const { api, comoApi } = crearApi()
    const segundoId = "30000000-0000-4000-8000-000000000002"
    api.leerCliente.mockResolvedValue({
      ...sesion,
      prescripcion: {
        ...sesion.prescripcion,
        ejercicios: [
          {
            ...sesion.prescripcion.ejercicios[0]!,
            series: [
              ...sesion.prescripcion.ejercicios[0]!.series,
              { id: segundoId, tipoMedicion: "repeticiones", pesoKg: 40, repeticiones: 8 },
            ],
          },
        ],
      },
    })
    api.guardar.mockImplementation(borradorGuardado)
    api.enviar.mockImplementation(async (_id, envio) => resultado(envio))
    await render(<RegistroCliente cuenta={CUENTA} id={ID} api={comoApi} />)
    await fireEvent.press(await screen.findByRole("button", { name: "Terminar" }))
    expect(screen.getByText("¿Terminar ya?")).toBeTruthy()
    expect(screen.getByText("Quedan 1 series sin hacer.")).toBeTruthy()
    expect(api.enviar).not.toHaveBeenCalled()
    await fireEvent.press(screen.getByRole("button", { name: "Terminar y enviar" }))
    expect(await screen.findByText("ENVIADO")).toBeTruthy()
    expect(api.enviar.mock.calls[0]![1].registro.cierre).toBeNull()
  })

  it("la cabecera fija es la única acción Terminar, también al acabar la última serie", async () => {
    const { comoApi } = crearApi()
    await render(<RegistroCliente cuenta={CUENTA} id={ID} api={comoApi} />)
    expect(await screen.findByRole("button", { name: "Terminar" })).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Terminar entreno" })).toBeNull()
  })

  it("mientras falten series mantiene Terminar en la cabecera", async () => {
    const { api, comoApi } = crearApi()
    api.leerCliente.mockResolvedValue({ ...sesion, borrador: null })
    await render(<RegistroCliente cuenta={CUENTA} id={ID} api={comoApi} />)
    expect(await screen.findByRole("button", { name: "Terminar" })).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Terminar entreno" })).toBeNull()
  })

  it("el peso obligatorio se valida junto a la tabla y no marca la serie", async () => {
    const { api, comoApi } = crearApi()
    api.leerCliente.mockResolvedValue({
      ...sesion,
      prescripcion: {
        ...sesion.prescripcion,
        ejercicios: [
          {
            ...sesion.prescripcion.ejercicios[0]!,
            tipoCarga: "conCargaExterna",
            calibrar: true,
            series: [{ id: SERIE, tipoMedicion: "repeticiones", pesoKg: null, repeticiones: 8 }],
          },
        ],
      },
      borrador: null,
    })
    await render(<RegistroCliente cuenta={CUENTA} id={ID} api={comoApi} />)
    await fireEvent.press(await screen.findByRole("checkbox", { name: /Hecha — Press banca/ }))
    const tabla = within(screen.getByTestId("series-del-ejercicio"))
    expect(tabla.getByRole("alert")).toBeTruthy()
    expect(tabla.getByText("Falta el peso")).toBeTruthy()
    expect(
      screen.getByRole("checkbox", { name: /Hecha — Press banca/ }).props.accessibilityState
        .checked,
    ).toBe(false)
  })
})
