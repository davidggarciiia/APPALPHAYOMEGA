import { randomUUID } from "node:crypto"
import { RegistroControl } from "./registro-control"
import { crearAlmacenLocal, type Cifrado, type PersistenciaCifrada } from "./almacen-local"
import { crearApiEntrenamiento } from "./api"
import { crearPeticionAutenticada } from "../lib/peticion-autenticada"
import { DocumentoSesionSchema, claveSesion, hayCambiosLocales } from "./documento-local"
import type { Borrador, SesionCliente, ResultadoEntrenamiento } from "@alpha-omega/shared"
import { iniciarTramo } from "./sesion/tiempo"
import { registroParaEnviar } from "./registro-modelo"
import { ErrorDePeticion } from "../lib/http"

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
  const persistencia: PersistenciaCifrada = {
    leer: async (_c, k) => filas.get(k) ?? null,
    escribir: async (_c, k, v) => {
      filas.set(k, v)
    },
    borrar: async (_c, k) => {
      filas.delete(k)
    },
    listar: async () => [...filas.keys()],
    limpiar: async () => filas.clear(),
  }
  const cifrado: Cifrado = {
    cifrar: async (_c, _k, t) => t,
    descifrar: async (_c, _k, t) => t,
    olvidar: async () => undefined,
  }
  const almacen = crearAlmacenLocal(persistencia, cifrado)
  const api = crearApiEntrenamiento(crearPeticionAutenticada(() => "acceso"))
  jest.spyOn(api, "leerCliente").mockResolvedValue(sesion)
  const control = new RegistroControl(cuenta, id, api, almacen, randomUUID, () => undefined)
  return { control, api, almacen, persistencia, cifrado }
}

it("un fallo de disco al reabrir no se confunde con red y una caída posterior sí se reconoce", async () => {
  const { control, api, almacen, persistencia } = preparar()
  await control.abrir()
  control.cerrar()
  const anterior = await persistencia.leer(cuenta, claveSesion(id))
  const reabierta = new RegistroControl(cuenta, id, api, almacen, randomUUID, () => undefined)
  jest.spyOn(persistencia, "escribir").mockRejectedValueOnce(new Error("Disco lleno"))
  await reabierta.abrir()
  expect(reabierta.errorLocal).toBe(true)
  expect(reabierta.sinRed).toBe(false)
  expect(reabierta.documento?.sesion.prescripcion.nombre).toBe("Fuerza")
  expect(await persistencia.leer(cuenta, claveSesion(id))).toBe(anterior)
  jest.mocked(api.leerCliente).mockRejectedValueOnce(new Error("Sin red"))
  await reabierta.abrir()
  expect(reabierta.sinRed).toBe(true)
})

it("un fallo de disco tras confirmar el borrador remoto no marca falta de conexión", async () => {
  const { control, api, persistencia } = preparar()
  await control.abrir()
  await control.editar({ ...control.documento!.edicion, notas: "guardada en servidor" })
  jest.spyOn(api, "guardar").mockImplementation(async (_id, peticion) => {
    jest.spyOn(persistencia, "escribir").mockRejectedValueOnce(new Error("Disco lleno"))
    return {
      revision: 1,
      revisionPrescripcion: peticion.revisionPrescripcion,
      registro: peticion.registro,
      actualizadoEn: "2026-10-04T10:00:00.000Z",
    }
  })
  await expect(control.sincronizar()).rejects.toThrow()
  expect(control.errorLocal).toBe(true)
  expect(control.sinRed).toBe(false)
  expect(control.documento?.edicion.notas).toBe("guardada en servidor")
})

it("dos pestañas sin red conservan ambas ediciones y el conflicto al reabrir", async () => {
  const { control: a, api, persistencia, cifrado } = preparar()
  await a.abrir()
  const almacenB = crearAlmacenLocal(persistencia, cifrado)
  const b = new RegistroControl(cuenta, id, api, almacenB, randomUUID, () => undefined)
  await b.abrir()
  await a.editar({ ...a.documento!.edicion, notas: "edición A" })
  await expect(b.editar({ ...b.documento!.edicion, notas: "edición B" })).rejects.toThrow(
    /otra edición/i,
  )
  expect(b.conflicto).toBe(true)
  expect(b.documento?.edicion.notas).toBe("edición B")
  expect(b.documento?.respaldo?.edicion.notas).toBe("edición A")
  b.cerrar()
  jest.mocked(api.leerCliente).mockRejectedValue(new Error("sin red"))
  const reabierta = new RegistroControl(
    cuenta,
    id,
    api,
    crearAlmacenLocal(persistencia, cifrado),
    randomUUID,
    () => undefined,
  )
  await reabierta.abrir()
  expect(reabierta.conflicto).toBe(true)
  expect(reabierta.documento?.edicion.notas).toBe("edición B")
  expect(reabierta.documento?.respaldo?.edicion.notas).toBe("edición A")
})

it("inspeccionar cambios al cancelar el cierre no autoriza sobrescribir la edición de otra pestaña", async () => {
  const { control: a, api, almacen, persistencia, cifrado } = preparar()
  await a.abrir()
  const b = new RegistroControl(
    cuenta,
    id,
    api,
    crearAlmacenLocal(persistencia, cifrado),
    randomUUID,
    () => undefined,
  )
  await b.abrir()
  await a.editar({ ...a.documento!.edicion, notas: "A" })
  await expect(b.editar({ ...b.documento!.edicion, notas: "B" })).rejects.toThrow(/otra edición/i)
  expect(await hayCambiosLocales(almacen, cuenta)).toBe(true)
  await expect(a.editar({ ...a.documento!.edicion, notas: "A2" })).rejects.toThrow(/otra edición/i)
  const guardado = await almacen.leer(cuenta, claveSesion(id), DocumentoSesionSchema)
  expect(guardado?.edicion.notas).toBe("A2")
  expect(guardado?.respaldo?.edicion.notas).toBe("B")
  expect(guardado?.respaldosLocales?.map((copia) => copia.edicion.notas)).toContain("A")
})

it("dos cambios locales en cola no borran el respaldo rescatado al detectar otra pestaña", async () => {
  const { control: a, api, persistencia, cifrado } = preparar()
  await a.abrir()
  const almacenB = crearAlmacenLocal(persistencia, cifrado)
  const b = new RegistroControl(cuenta, id, api, almacenB, randomUUID, () => undefined)
  await b.abrir()
  await a.editar({ ...a.documento!.edicion, notas: "A" })
  await Promise.allSettled([
    b.editar({ ...b.documento!.edicion, notas: "B1" }),
    b.editar({ ...b.documento!.edicion, notas: "B2" }),
  ])
  const guardado = await almacenB.leer(cuenta, claveSesion(id), DocumentoSesionSchema)
  expect(guardado?.edicion.notas).toBe("B2")
  expect(guardado?.respaldo?.edicion.notas).toBe("A")
  expect(b.errorLocal).toBe(false)
})

it("un tercer editor conserva también el respaldo que ya había otra pestaña", async () => {
  const { control: a, api, persistencia, cifrado } = preparar()
  await a.abrir()
  const b = new RegistroControl(
    cuenta,
    id,
    api,
    crearAlmacenLocal(persistencia, cifrado),
    randomUUID,
    () => undefined,
  )
  const c = new RegistroControl(
    cuenta,
    id,
    api,
    crearAlmacenLocal(persistencia, cifrado),
    randomUUID,
    () => undefined,
  )
  await b.abrir()
  await c.abrir()
  await a.editar({ ...a.documento!.edicion, notas: "A" })
  await expect(b.editar({ ...b.documento!.edicion, notas: "B" })).rejects.toThrow(/otra edición/i)
  await expect(c.editar({ ...c.documento!.edicion, notas: "C" })).rejects.toThrow(/otra edición/i)
  expect(c.documento?.edicion.notas).toBe("C")
  expect(c.documento?.respaldo?.edicion.notas).toBe("B")
  expect(c.documento?.respaldosLocales?.map((copia) => copia.edicion.notas)).toContain("A")
  await c.continuarEdicionLocal()
  await c.recuperarCopia()
  expect(c.documento?.edicion.notas).toBe("B")
  expect(c.documento?.respaldosLocales?.map((copia) => copia.edicion.notas)).toContain("C")
})

it("consultar un plan en caché no cuenta como un borrador pendiente al salir", async () => {
  const { almacen } = preparar()
  await almacen.guardar(cuenta, "plan-2026-09-14", { plan: null })
  expect(await hayCambiosLocales(almacen, cuenta)).toBe(false)
})

it("una publicación de plan pendiente sí avisa antes de borrar su copia al salir", async () => {
  const { almacen } = preparar()
  await almacen.guardar(cuenta, `plan-${cuenta}`, {
    solicitud: {
      operacionId: randomUUID(),
      nombre: "Fuerza",
      semanaInicial: "2026-09-14",
      semanas: 1,
      patron: {
        sesiones: [
          {
            id: randomUUID(),
            nombre: "Fuerza",
            diaSemana: 1,
            ejercicios: sesion.prescripcion.ejercicios.map(({ nombre: _nombre, ...ejercicio }) => {
              void _nombre
              return ejercicio
            }),
          },
        ],
      },
    },
    nombres: {},
  })
  expect(await hayCambiosLocales(almacen, cuenta)).toBe(true)
})

it("confirmar una de las ediciones locales conserva accesible la otra copia", async () => {
  const { control: a, api, persistencia, cifrado } = preparar()
  await a.abrir()
  const b = new RegistroControl(
    cuenta,
    id,
    api,
    crearAlmacenLocal(persistencia, cifrado),
    randomUUID,
    () => undefined,
  )
  await b.abrir()
  const series = [{ serieId, peso: "20", valor: "10", hecha: true }]
  await a.editar({ notas: "A no enviada", series })
  await expect(b.editar({ notas: "B enviada", series })).rejects.toThrow(/otra edición/i)
  await b.continuarEdicionLocal()
  jest.spyOn(api, "guardar").mockImplementation(async (_id, datos) => ({
    revision: 1,
    revisionPrescripcion: 0,
    registro: datos.registro,
    actualizadoEn: new Date().toISOString(),
  }))
  jest.spyOn(api, "enviar").mockResolvedValue(resultado)
  await b.enviar()
  expect(b.documento?.resultado).toEqual(resultado)
  expect(b.documento?.respaldo?.edicion.notas).toBe("A no enviada")
})

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

describe("Cambio de unidad y copias anteriores (D01)", () => {
  const hecha = { serieId, peso: "20", valor: "10", hecha: true, rir: 2 }
  const enSegundos: SesionCliente = {
    ...sesion,
    revisionPrescripcion: 1,
    prescripcion: {
      ...sesion.prescripcion,
      ejercicios: sesion.prescripcion.ejercicios.map((ejercicio) => ({
        ...ejercicio,
        series: [{ id: serieId, tipoMedicion: "tiempo", pesoKg: 20, segundos: 30 }],
      })),
    },
  }

  // D01.g: con los metros en el contrato público, la copia local ya puede guardar esta pauta.
  const enMetros: SesionCliente = {
    ...sesion,
    revisionPrescripcion: 1,
    prescripcion: {
      ...sesion.prescripcion,
      ejercicios: sesion.prescripcion.ejercicios.map((ejercicio) => ({
        ...ejercicio,
        tipoCarga: "conCargaExterna",
        series: [{ id: serieId, tipoMedicion: "distancia", pesoKg: 32, metros: 20 }],
      })),
    },
  }

  it.each([
    [
      "segundos",
      enSegundos,
      { serieId, tipoMedicion: "tiempo", pesoKg: null, segundos: null, hecha: false },
    ],
    [
      "metros",
      enMetros,
      { serieId, tipoMedicion: "distancia", pesoKg: null, metros: null, hecha: false },
    ],
  ] as const)(
    "cambiar la unidad a %s deja pendiente lo hecho y conserva el respaldo original",
    async (_unidad, nueva, pendiente) => {
      const { control, api, almacen } = preparar()
      await control.abrir()
      const original = { notas: "mi copia", series: [hecha] }
      await control.editar(original)
      jest.mocked(api.leerCliente).mockResolvedValue(nueva)
      await control.recuperarServidor()
      await control.recuperarCopia()

      expect(control.documento?.edicion.series).toEqual([
        { serieId, peso: "", valor: "", hecha: false },
      ])
      expect(control.documento?.edicion.notas).toBe("mi copia")
      expect(control.documento?.respaldo).toEqual({
        edicion: original,
        prescripcion: sesion.prescripcion,
      })
      // Las 10 repeticiones no se envían como 10 segundos ni como 10 m.
      expect(registroParaEnviar(nueva.prescripcion, control.documento!.edicion).series).toEqual([
        pendiente,
      ])

      control.cerrar()
      const reabierta = new RegistroControl(cuenta, id, api, almacen, randomUUID, () => undefined)
      await reabierta.abrir()
      expect(reabierta.documento?.sesion.prescripcion).toEqual(nueva.prescripcion)
      expect(reabierta.documento?.edicion.series[0]).toMatchObject({ valor: "", hecha: false })
      expect(reabierta.documento?.respaldo?.edicion).toEqual(original)
      expect(await hayCambiosLocales(almacen, cuenta)).toBe(true)
    },
  )

  it("una sesión en metros se recupera sin conexión y reenvía la misma operación", async () => {
    const { control, api, almacen } = preparar()
    jest.mocked(api.leerCliente).mockResolvedValue(enMetros)
    await control.abrir()
    const edicion = { serieId, peso: "34", valor: "18", hecha: true }
    await control.editar({ notas: "", series: [edicion] })
    jest.spyOn(api, "guardar").mockImplementation(async (_id, datos) => ({
      revision: 1,
      revisionPrescripcion: 1,
      registro: datos.registro,
      actualizadoEn: new Date().toISOString(),
    }))
    const enviado: ResultadoEntrenamiento = {
      ...resultado,
      prescripcion: enMetros.prescripcion,
      revisionPrescripcion: 1,
      series: [
        { serieId, hecha: true, valores: { tipoMedicion: "distancia", pesoKg: 34, metros: 18 } },
      ],
    }
    const enviar = jest
      .spyOn(api, "enviar")
      .mockRejectedValueOnce(new Error("respuesta perdida"))
      .mockResolvedValue(enviado)
    await expect(control.enviar()).rejects.toThrow("respuesta perdida")
    control.cerrar()

    // Sin conexión, la copia del dispositivo conserva metros y kilos en su unidad.
    jest.mocked(api.leerCliente).mockRejectedValue(new Error("sin red"))
    const nueva = new RegistroControl(cuenta, id, api, almacen, randomUUID, () => undefined)
    await nueva.abrir()
    const guardado = await almacen.leer(cuenta, claveSesion(id), DocumentoSesionSchema)
    expect(guardado?.sesion.prescripcion).toEqual(enMetros.prescripcion)
    expect(nueva.documento?.edicion.series).toEqual([edicion])
    await nueva.enviar()
    expect(enviar.mock.calls[1]).toEqual(enviar.mock.calls[0])
    expect(enviar.mock.calls[0]![1].registro.series).toEqual([
      { serieId, tipoMedicion: "distancia", pesoKg: 34, metros: 18, hecha: true },
    ])
    expect(nueva.documento?.resultado).toEqual(enviado)
    expect(nueva.documento?.envioPendiente).toBeNull()
    expect(await hayCambiosLocales(almacen, cuenta)).toBe(false)
  })

  it("un borrador del servidor en otra unidad no se reinterpreta al abrir", async () => {
    const { control, api } = preparar()
    jest.mocked(api.leerCliente).mockResolvedValue({
      ...enSegundos,
      borrador: {
        revision: 1,
        revisionPrescripcion: 0,
        actualizadoEn: "2026-09-24T10:00:00.000Z",
        registro: {
          notas: null,
          series: [
            { serieId, tipoMedicion: "repeticiones", pesoKg: 20, repeticiones: 10, hecha: true },
          ],
        },
      },
    })
    await control.abrir()
    expect(control.documento?.edicion.series).toEqual([
      { serieId, peso: "", valor: "", hecha: false },
    ])
  })

  it("una copia guardada antes de la distancia se sigue leyendo y enviando igual", async () => {
    const { control, almacen } = preparar()
    // Formato anterior: sin RIR, sin tiempo activo, sin vista ni intención de envío.
    await almacen.guardar(cuenta, claveSesion(id), {
      sesion,
      edicion: {
        notas: "copia antigua",
        series: [{ serieId, peso: "20", valor: "10", hecha: true }],
      },
      secuencia: 1,
      sincronizada: 0,
      revisionBorrador: 0,
      pendiente: null,
      envioPendiente: null,
      respaldo: null,
      resultado: null,
    })
    await control.abrir()
    expect(control.documento?.edicion.notas).toBe("copia antigua")
    expect(registroParaEnviar(sesion.prescripcion, control.documento!.edicion).series).toEqual([
      { serieId, tipoMedicion: "repeticiones", pesoKg: 20, repeticiones: 10, hecha: true },
    ])
  })
})

describe("un 409 del servidor no siempre es un conflicto de versión (P-01)", () => {
  const rechazo = (codigo: "consentimiento_pendiente" | "revision_obsoleta") =>
    new ErrorDePeticion({ statusCode: 409, codigo, message: "rechazado" })
  const editada = async () => {
    const preparado = preparar()
    await preparado.control.abrir()
    await preparado.control.editar({ ...preparado.control.documento!.edicion, notas: "a medias" })
    return preparado
  }

  it("sin consentimiento vigente no se presenta como otra versión ni como falta de red", async () => {
    const { control, api } = await editada()
    jest.spyOn(api, "guardar").mockRejectedValue(rechazo("consentimiento_pendiente"))
    await expect(control.sincronizar()).rejects.toThrow()
    expect(control.sinConsentimiento).toBe(true)
    expect(control.conflicto).toBe(false)
    expect(control.sinRed).toBe(false)
  })

  it("una revisión obsoleta sigue siendo un conflicto de versión", async () => {
    const { control, api } = await editada()
    jest.spyOn(api, "guardar").mockRejectedValue(rechazo("revision_obsoleta"))
    await expect(control.sincronizar()).rejects.toThrow()
    expect(control.conflicto).toBe(true)
    expect(control.sinConsentimiento).toBe(false)
  })

  it("el aviso desaparece cuando el servidor vuelve a aceptar el guardado", async () => {
    const { control, api } = await editada()
    const guardar = jest
      .spyOn(api, "guardar")
      .mockRejectedValueOnce(rechazo("consentimiento_pendiente"))
    await expect(control.sincronizar()).rejects.toThrow()
    expect(control.sinConsentimiento).toBe(true)
    guardar.mockImplementation(async (_id, peticion) => ({
      revision: 1,
      revisionPrescripcion: peticion.revisionPrescripcion,
      registro: peticion.registro,
      actualizadoEn: "2026-10-28T10:00:00.000Z",
    }))
    await control.sincronizar()
    expect(control.sinConsentimiento).toBe(false)
  })
})
