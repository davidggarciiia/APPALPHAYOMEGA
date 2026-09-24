import { randomUUID } from "node:crypto"
import { RegistroControl } from "./registro-control"
import { crearAlmacenLocal } from "./almacen-local"
import { crearApiEntrenamiento } from "./api"
import { crearPeticionAutenticada } from "../lib/peticion-autenticada"
import { DocumentoSesionSchema, claveSesion, hayCambiosLocales } from "./documento-local"
import type { Borrador, SesionCliente, ResultadoEntrenamiento } from "@alpha-omega/shared"
import { iniciarTramo } from "./sesion/tiempo"
import { registroParaEnviar } from "./registro-modelo"

jest.mock("../lib/direccion-api", () => ({ direccionDeLaApi: () => "http://localhost:3000" }))
const cuenta = randomUUID(),
  id = randomUUID(),
  serieId = randomUUID()
const sesion: SesionCliente = {
  agenda: {
    id,
    clienteId: cuenta,
    fechaOriginal: "2026-09-14",
    fechaActual: "2026-09-14",
    estado: "abierta",
    revision: 0,
  },
  prescripcion: {
    nombre: "Fuerza",
    ejercicios: [
      {
        id: randomUUID(),
        ejercicioId: randomUUID(),
        nombre: "Remo",
        indicaciones: null,
        series: [{ id: serieId, tipoMedicion: "repeticiones", pesoKg: 20, repeticiones: 10 }],
      },
    ],
  },
  revisionPrescripcion: 0,
  permiteAjuste: true,
  enviadoEn: null,
  borrador: null,
}
const resultado: ResultadoEntrenamiento = {
  sesionId: id,
  prescripcion: sesion.prescripcion,
  revisionPrescripcion: 0,
  enviadoEn: new Date().toISOString(),
  notas: null,
  series: [
    {
      serieId,
      hecha: true,
      valores: { tipoMedicion: "repeticiones", pesoKg: 20, repeticiones: 10 },
    },
  ],
}
function preparar() {
  const filas = new Map<string, string>()
  const almacen = crearAlmacenLocal(
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
  const api = crearApiEntrenamiento(crearPeticionAutenticada(() => "acceso"))
  jest.spyOn(api, "leerCliente").mockResolvedValue(sesion)
  const control = new RegistroControl(cuenta, id, api, almacen, randomUUID, () => undefined)
  return { control, api, almacen }
}

it("repite un envío sin respuesta con la misma operación al reabrir", async () => {
  const { control, api, almacen } = preparar()
  await control.abrir()
  await control.editar({ notas: "", series: [{ serieId, peso: "20", valor: "10", hecha: true }] })
  jest.spyOn(api, "guardar").mockImplementation(async (_id, datos) => ({
    revision: 1,
    revisionPrescripcion: 0,
    registro: datos.registro,
    actualizadoEn: new Date().toISOString(),
  }))
  const enviar = jest
    .spyOn(api, "enviar")
    .mockRejectedValueOnce(new Error("respuesta perdida"))
    .mockResolvedValue(resultado)
  await expect(control.enviar()).rejects.toThrow("respuesta perdida")
  control.cerrar()
  const nueva = new RegistroControl(cuenta, id, api, almacen, randomUUID, () => undefined)
  await nueva.abrir()
  await nueva.enviar()
  expect(enviar.mock.calls[1]).toEqual(enviar.mock.calls[0])
  expect(nueva.documento?.resultado).toEqual(resultado)
  expect(nueva.documento?.envioPendiente).toBeNull()
  expect(await hayCambiosLocales(almacen, cuenta)).toBe(false)
})

it("conserva la copia no enviada cuando otro dispositivo cierra la sesión", async () => {
  const { control, api, almacen } = preparar()
  await control.abrir()
  await control.editar({
    notas: "solo en A",
    series: [{ serieId, peso: "25", valor: "12", hecha: true }],
  })
  jest.mocked(api.leerCliente).mockResolvedValue({
    ...sesion,
    enviadoEn: resultado.enviadoEn,
    agenda: { ...sesion.agenda, estado: "cerrada", revision: 1 },
  })
  jest.spyOn(api, "resultado").mockResolvedValue(resultado)
  await control.actualizar()
  expect(control.documento?.resultado).toEqual(resultado)
  expect(control.documento?.respaldo?.edicion.notas).toBe("solo en A")
  expect(await hayCambiosLocales(almacen, cuenta)).toBe(true)
  await control.descartarCopia()
  expect(await hayCambiosLocales(almacen, cuenta)).toBe(false)
})
it("un guardado lento no sustituye una edición posterior", async () => {
  const { control, api } = preparar()
  await control.abrir()
  await control.editar({
    notas: "primera",
    series: [{ serieId, peso: "20,5", valor: "10", hecha: true }],
  })
  let resolver!: (b: Borrador) => void
  const guardar = jest.spyOn(api, "guardar").mockImplementation(
    () =>
      new Promise((resolve) => {
        resolver = resolve
      }),
  )
  const pendiente = control.sincronizar()
  while (!guardar.mock.calls.length) await new Promise((resolve) => setTimeout(resolve, 1))
  await control.editar({ ...control.documento!.edicion, notas: "segunda" })
  resolver({
    revision: 1,
    revisionPrescripcion: 0,
    registro: guardar.mock.calls[0]![1].registro,
    actualizadoEn: new Date().toISOString(),
  })
  await pendiente
  expect(control.documento?.edicion.notas).toBe("segunda")
  expect(control.documento?.secuencia).toBeGreaterThan(control.documento!.sincronizada)
})

it("la lectura tras sincronizar conserva el tramo activo del cronómetro", async () => {
  const { control, api } = preparar()
  await control.abrir()
  const instante = "2026-09-24T10:00:00.000Z"
  await control.editar(iniciarTramo(control.documento!.edicion, instante))
  let borrador: Borrador | null = null
  jest.spyOn(api, "guardar").mockImplementation(async (_id, datos) => {
    borrador = {
      revision: 1,
      revisionPrescripcion: 0,
      registro: datos.registro,
      actualizadoEn: instante,
    }
    return borrador
  })
  await control.sincronizar()
  jest.mocked(api.leerCliente).mockImplementation(async () => ({ ...sesion, borrador }))

  await control.actualizar()

  expect(control.documento?.edicion.tramoActivoDesde).toBe(instante)
  expect(control.documento?.edicion.tiempoActivoSegundos).toBe(0)
})

it("descarta una lectura que llega detrás de una versión más nueva", async () => {
  const { control, api } = preparar()
  await control.abrir()
  let primera!: (s: SesionCliente) => void, segunda!: (s: SesionCliente) => void
  jest
    .mocked(api.leerCliente)
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          primera = resolve
        }),
    )
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          segunda = resolve
        }),
    )
  const a = control.actualizar(),
    b = control.actualizar()
  segunda({ ...sesion, agenda: { ...sesion.agenda, revision: 2, fechaActual: "2026-09-16" } })
  await b
  primera({ ...sesion, agenda: { ...sesion.agenda, revision: 1, fechaActual: "2026-09-15" } })
  await a
  expect(control.documento?.sesion.agenda.revision).toBe(2)
})

it("recupera solo series compatibles y conserva las nuevas visibles y vacías", async () => {
  const { control, api, almacen } = preparar()
  await control.abrir()
  await control.editar({
    notas: "mi copia",
    inicio: "2026-09-24T10:00:00.000Z",
    tiempoActivoSegundos: 125,
    checkin: { sensacion: 4, molestia: "nada" },
    series: [{ serieId, peso: "20", valor: "10", hecha: true }],
  })
  const nueva = { id: randomUUID(), tipoMedicion: "tiempo" as const, pesoKg: null, segundos: 30 }
  const ejercicio = sesion.prescripcion.ejercicios[0]!
  jest.mocked(api.leerCliente).mockResolvedValue({
    ...sesion,
    revisionPrescripcion: 1,
    prescripcion: {
      ...sesion.prescripcion,
      ejercicios: [{ ...ejercicio, series: [...ejercicio.series, nueva] }],
    },
  })
  await control.recuperarServidor()
  expect(await hayCambiosLocales(almacen, cuenta)).toBe(true)
  await control.recuperarCopia()
  expect(control.documento?.edicion.series).toEqual([
    { serieId, peso: "20", valor: "10", hecha: true },
    { serieId: nueva.id, peso: "", valor: "", hecha: false },
  ])
  expect(control.documento?.edicion).toMatchObject({
    inicio: "2026-09-24T10:00:00.000Z",
    tiempoActivoSegundos: 125,
    checkin: { sensacion: 4, molestia: "nada" },
  })
})
it("recupera offline y reutiliza la operación cuya respuesta se perdió", async () => {
  const { control, api, almacen } = preparar()
  await control.abrir()
  await control.editar({ notas: "", series: [{ serieId, peso: "20", valor: "10", hecha: true }] })
  const guardar = jest.spyOn(api, "guardar").mockRejectedValue(new Error("sin red"))
  await expect(control.sincronizar()).rejects.toThrow("sin red")
  const primera = guardar.mock.calls[0]![1]
  control.cerrar()
  jest.mocked(api.leerCliente).mockRejectedValue(new Error("sin red"))
  const nueva = new RegistroControl(cuenta, id, api, almacen, randomUUID, () => undefined)
  await nueva.abrir()
  expect(nueva.documento?.edicion.series[0]?.valor).toBe("10")
  await expect(nueva.sincronizar()).rejects.toThrow("sin red")
  expect(guardar.mock.calls.at(-1)?.[1]).toEqual(primera)
  expect(
    (await almacen.leer(cuenta, claveSesion(id), DocumentoSesionSchema))?.pendiente?.peticion,
  ).toEqual(primera)
})

it.each(["sinCarga", "conCargaExterna"] as const)(
  "no recupera una serie hecha incompatible con la nueva pauta %s y conserva la copia",
  async (tipoCarga) => {
    const { control, api } = preparar()
    jest.mocked(api.leerCliente).mockResolvedValue({
      ...sesion,
      prescripcion: {
        ...sesion.prescripcion,
        ejercicios: sesion.prescripcion.ejercicios.map((ejercicio) => ({
          ...ejercicio,
          tipoCarga: tipoCarga === "sinCarga" ? "conCargaExterna" : "sinCarga",
          series: ejercicio.series.map((serie) => ({
            ...serie,
            pesoKg: tipoCarga === "sinCarga" ? 20 : null,
          })),
        })),
      },
    })
    await control.abrir()
    const pesoAnterior = tipoCarga === "sinCarga" ? "20" : ""
    await control.editar({
      notas: "mi ejecución anterior",
      series: [{ serieId, peso: pesoAnterior, valor: "10", hecha: true }],
    })
    expect(() =>
      registroParaEnviar(control.documento!.sesion.prescripcion, control.documento!.edicion),
    ).not.toThrow()
    jest.mocked(api.leerCliente).mockResolvedValue({
      ...sesion,
      revisionPrescripcion: 1,
      prescripcion: {
        ...sesion.prescripcion,
        ejercicios: sesion.prescripcion.ejercicios.map((ejercicio) => ({
          ...ejercicio,
          tipoCarga,
          series: ejercicio.series.map((serie) => ({ ...serie, pesoKg: null })),
        })),
      },
    })
    await control.recuperarServidor()
    await control.recuperarCopia()

    expect(control.documento?.edicion.series[0]).toMatchObject({ hecha: false, peso: "" })
    expect(control.documento?.respaldo?.edicion.series[0]).toMatchObject({
      hecha: true,
      peso: pesoAnterior,
    })
    expect(() =>
      registroParaEnviar(control.documento!.sesion.prescripcion, control.documento!.edicion),
    ).not.toThrow()
  },
)

it("conserva la intención de enviar cuando el primer guardado falla sin conexión", async () => {
  const { control, api, almacen } = preparar()
  await control.abrir()
  await control.editar({
    notas: "para el entrenador",
    series: [{ serieId, peso: "20", valor: "10", hecha: true }],
  })
  const guardar = jest
    .spyOn(api, "guardar")
    .mockRejectedValueOnce(new Error("sin red"))
    .mockImplementation(async (_id, datos) => ({
      revision: 1,
      revisionPrescripcion: 0,
      registro: datos.registro,
      actualizadoEn: new Date().toISOString(),
    }))
  const enviar = jest.spyOn(api, "enviar").mockResolvedValue(resultado)

  await expect(control.enviar()).rejects.toThrow("sin red")
  const copia = await almacen.leer(cuenta, claveSesion(id), DocumentoSesionSchema)
  expect(copia).toMatchObject({
    intencionEnvio: {
      operacionId: expect.any(String),
      registro: { notas: "para el entrenador" },
    },
  })
  expect(enviar).not.toHaveBeenCalled()
  expect(await hayCambiosLocales(almacen, cuenta)).toBe(true)

  control.cerrar()
  const nueva = new RegistroControl(cuenta, id, api, almacen, randomUUID, () => undefined)
  await nueva.abrir()
  await nueva.enviar()
  expect(guardar).toHaveBeenCalledTimes(2)
  expect(enviar).toHaveBeenCalledTimes(1)
  expect(enviar.mock.calls[0]?.[1].operacionId).toBe(
    (copia as { intencionEnvio: { operacionId: string } }).intencionEnvio.operacionId,
  )
  expect(nueva.documento?.resultado).toEqual(resultado)
})
it("no bloquea un borrador sin series hechas por una intención inválida", async () => {
  const { control } = preparar()
  await control.abrir()
  await expect(control.enviar()).rejects.toThrow()
  expect(control.documento?.intencionEnvio).toBeNull()
  expect(control.sinRed).toBe(false)
})
it("actualiza la revisión del entrenador después de un envío confirmado", async () => {
  const { control, api } = preparar()
  await control.abrir()
  control.documento = {
    ...control.documento!,
    resultado,
    sesion: { ...sesion, enviadoEn: resultado.enviadoEn },
  }
  jest.mocked(api.leerCliente).mockResolvedValue({
    ...sesion,
    enviadoEn: resultado.enviadoEn,
    revisadaEn: "2026-09-24T12:00:00.000Z",
  })
  await control.actualizar()
  expect(control.documento?.sesion.revisadaEn).toBe("2026-09-24T12:00:00.000Z")
})

it("pausa el tramo al abandonar la pantalla y conserva el tiempo en el dispositivo", async () => {
  const { control, almacen } = preparar()
  await control.abrir()
  const inicio = "2026-09-24T10:00:00.000Z"
  await control.editar(iniciarTramo(control.documento!.edicion, inicio))
  await control.pausar("2026-09-24T10:01:30.000Z")
  expect(control.documento?.edicion).toMatchObject({
    tiempoActivoSegundos: 90,
    tramoActivoDesde: null,
  })
  expect(
    (await almacen.leer(cuenta, claveSesion(id), DocumentoSesionSchema))?.edicion
      .tiempoActivoSegundos,
  ).toBe(90)
})
it("recupera ejercicio elegido y descanso tras reabrir sin alterar el borrador", async () => {
  const { control, api, almacen } = preparar()
  await control.abrir()
  const elegido = sesion.prescripcion.ejercicios[0]!.id
  const hasta = "2026-09-24T10:05:00.000Z"
  await control.guardarVista({
    ejercicioElegidoId: elegido,
    descansoHasta: hasta,
    descansoTotal: 90,
  })
  control.cerrar()
  const nueva = new RegistroControl(cuenta, id, api, almacen, randomUUID, () => undefined)
  await nueva.abrir()
  expect(nueva.documento).toMatchObject({
    ejercicioElegidoId: elegido,
    descansoHasta: hasta,
    descansoTotal: 90,
  })
  expect(nueva.documento?.secuencia).toBe(0)
})
it("corregir o quitar el RIR de una serie hecha persiste al reabrir sin tocar lo demás", async () => {
  const { control, api, almacen } = preparar()
  await control.abrir()
  const hecha = { serieId, peso: "20", valor: "10", hecha: true }
  const conSeries = (rir: number | null) => ({
    ...control.documento!.edicion,
    series: [{ ...hecha, rir }],
  })
  await control.editar(conSeries(1))
  await control.editar(conSeries(3))
  control.cerrar()
  const corregida = new RegistroControl(cuenta, id, api, almacen, randomUUID, () => undefined)
  await corregida.abrir()
  expect(corregida.documento?.edicion.series).toEqual([{ ...hecha, rir: 3 }])

  await corregida.editar(conSeries(null))
  corregida.cerrar()
  const sinAnotar = new RegistroControl(cuenta, id, api, almacen, randomUUID, () => undefined)
  await sinAnotar.abrir()
  expect(sinAnotar.documento?.edicion.series).toEqual([{ ...hecha, rir: null }])
  const [serie] = registroParaEnviar(sesion.prescripcion, sinAnotar.documento!.edicion).series
  expect(serie).toMatchObject({ hecha: true, pesoKg: 20, repeticiones: 10 })
  expect(serie).not.toHaveProperty("rir")
})
