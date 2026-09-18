import { randomUUID } from "node:crypto"
import { RegistroControl } from "./registro-control"
import { crearAlmacenLocal } from "./almacen-local"
import { crearApiEntrenamiento } from "./api"
import { crearPeticionAutenticada } from "../lib/peticion-autenticada"
import { DocumentoSesionSchema, claveSesion, hayCambiosLocales } from "./documento-local"
import type { Borrador, SesionCliente, ResultadoEntrenamiento } from "@alpha-omega/shared"

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
  jest
    .spyOn(api, "guardar")
    .mockImplementation(async (_id, datos) => ({
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
  jest
    .mocked(api.leerCliente)
    .mockResolvedValue({
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
