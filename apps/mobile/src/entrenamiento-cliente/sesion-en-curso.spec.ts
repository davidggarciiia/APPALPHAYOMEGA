import {
  PrescripcionSchema,
  type Borrador,
  type EnviarEntrenamiento,
  type GuardarBorrador,
  type ResultadoEntrenamiento,
  type SesionCliente,
} from "@alpha-omega/shared"

import { ErrorDeRed, ErrorDelServidor } from "../lib/transporte"

import type { CopiaLocal } from "./copia-local"
import { SesionEnCurso, type Dependencias } from "./sesion-en-curso"

const id = (n: number): string => `1111111${String(n)}-1111-4111-8111-111111111111`
const SESION = id(9)
const SERIE = id(1)
const prescripcion = PrescripcionSchema.parse({
  nombre: "Torso",
  ejercicios: [
    {
      id: id(2),
      ejercicioId: id(3),
      nombre: "Press",
      indicaciones: null,
      series: [{ id: SERIE, tipoMedicion: "repeticiones", pesoKg: 40, repeticiones: 10 }],
    },
  ],
})

function sesionDelServidor(cambios: Partial<SesionCliente> = {}): SesionCliente {
  return {
    agenda: {
      id: SESION,
      clienteId: id(8),
      fechaOriginal: "2026-09-14",
      fechaActual: "2026-09-14",
      estado: "abierta",
      revision: 0,
    },
    prescripcion,
    revisionPrescripcion: 0,
    permiteAjuste: true,
    enviadoEn: null,
    borrador: null,
    ...cambios,
  }
}

type Pendiente<T> = { resolver: (valor: T) => void; rechazar: (error: unknown) => void }

/** Dobles controlables: cada petición queda en el aire hasta que el test decide. */
function preparar(inicial: SesionCliente = sesionDelServidor()) {
  let contador = 0
  const disco = new Map<string, CopiaLocal>()
  const guardados: GuardarBorrador[] = []
  const envios: EnviarEntrenamiento[] = []
  const enEspera: Array<Pendiente<Borrador>> = []
  const enviosEnEspera: Array<Pendiente<ResultadoEntrenamiento>> = []
  let servidor = inicial
  const deps: Dependencias = {
    api: {
      leerSesion: jest.fn(async () => servidor),
      leerEjerciciosDeSesion: jest.fn(async () => ({ ejercicios: [], total: 0 })),
      guardarBorrador: jest.fn((_id: string, cuerpo: GuardarBorrador) => {
        guardados.push(cuerpo)
        return new Promise<Borrador>((resolver, rechazar) => enEspera.push({ resolver, rechazar }))
      }),
      enviarEntrenamiento: jest.fn((_id: string, cuerpo: EnviarEntrenamiento) => {
        envios.push(cuerpo)
        return new Promise<ResultadoEntrenamiento>((resolver, rechazar) =>
          enviosEnEspera.push({ resolver, rechazar }),
        )
      }),
      leerResultado: jest.fn(async () => resultado(1)),
    },
    almacen: {
      leerCopia: jest.fn(async (_c: string, s: string) => disco.get(s) ?? null),
      guardarCopia: jest.fn(async (_c: string, copia: CopiaLocal) => {
        disco.set(copia.sesionId, structuredClone(copia))
      }),
      borrarCopia: jest.fn(async (_c: string, s: string) => {
        disco.delete(s)
      }),
    },
    nuevoId: () => id(0).replace("11111110", `0000000${String(++contador)}`.slice(-8)),
    ahora: () => new Date("2026-09-14T10:00:00Z"),
    programar: () => () => undefined,
  }
  return {
    deps,
    disco,
    guardados,
    envios,
    enEspera,
    enviosEnEspera,
    cambiarServidor: (nueva: SesionCliente) => {
      servidor = nueva
    },
  }
}

function resultado(hechas: number): ResultadoEntrenamiento {
  return {
    sesionId: SESION,
    prescripcion,
    revisionPrescripcion: 0,
    enviadoEn: "2026-09-14T10:00:00.000Z",
    notas: null,
    series: [
      hechas > 0
        ? {
            serieId: SERIE,
            hecha: true,
            valores: { tipoMedicion: "repeticiones", pesoKg: 40, repeticiones: 8 },
          }
        : { serieId: SERIE, hecha: false },
    ],
  }
}

function borrador(revision: number, repeticiones: number): Borrador {
  return {
    revision,
    revisionPrescripcion: 0,
    actualizadoEn: "2026-09-14T10:00:00.000Z",
    registro: {
      notas: null,
      series: [
        { serieId: SERIE, tipoMedicion: "repeticiones", pesoKg: 40, repeticiones, hecha: true },
      ],
    },
  }
}

const escribir =
  (valor: string) =>
  (entradas: Record<string, { peso: string; valor: string; hecha: boolean }>, notas: string) => ({
    entradas: { ...entradas, [SERIE]: { peso: "40", valor, hecha: true } },
    notas,
  })

/** Deja correr las promesas encadenadas. */
async function vaciar(): Promise<void> {
  for (let i = 0; i < 20; i++) {
    await Promise.resolve()
  }
}

describe("Entreno activo: guardado local y sincronización", () => {
  it("guarda en el móvil y manda el borrador con la revisión conocida", async () => {
    const d = preparar()
    const sesion = await SesionEnCurso.abrir("ana", SESION, d.deps)
    await sesion.editar(escribir("8"))
    expect(d.disco.get(SESION)?.entradas[SERIE]?.valor).toBe("8")
    expect(sesion.leer().escritura).toBe("guardado")

    void sesion.sincronizar()
    await vaciar()
    expect(d.guardados[0]).toMatchObject({ revisionBorrador: 0, revisionPrescripcion: 0 })
    d.enEspera[0]?.resolver(borrador(1, 8))
    await vaciar()
    expect(sesion.leer().copia).toMatchObject({
      base: { borrador: 1 },
      enVuelo: null,
      sincronizada: 1,
    })
    expect(sesion.leer().red).toBe("al-dia")
  })

  it("una respuesta vieja no pisa lo escrito después y luego se manda lo nuevo", async () => {
    const d = preparar()
    const sesion = await SesionEnCurso.abrir("ana", SESION, d.deps)
    await sesion.editar(escribir("8"))
    void sesion.sincronizar()
    await vaciar()
    await sesion.editar(escribir("9"))
    d.enEspera[0]?.resolver(borrador(1, 8))
    await vaciar()
    expect(sesion.leer().copia.entradas[SERIE]?.valor).toBe("9")
    expect(d.guardados[1]).toMatchObject({ revisionBorrador: 1 })
    expect(d.guardados[1]?.registro.series[0]).toMatchObject({ repeticiones: 9 })
  })

  it("un guardado sin respuesta se reenvía idéntico antes que el contenido nuevo", async () => {
    const d = preparar()
    const sesion = await SesionEnCurso.abrir("ana", SESION, d.deps)
    await sesion.editar(escribir("8"))
    void sesion.sincronizar()
    await vaciar()
    d.enEspera[0]?.rechazar(new ErrorDeRed("sin cobertura"))
    await vaciar()
    expect(sesion.leer().red).toBe("sin-conexion")
    expect(d.disco.get(SESION)?.enVuelo).not.toBeNull()

    // La app se cierra y se vuelve a abrir.
    const reabierta = await SesionEnCurso.abrir("ana", SESION, d.deps)
    await reabierta.editar(escribir("10"))
    void reabierta.sincronizar()
    await vaciar()
    expect(d.guardados[1]).toEqual(d.guardados[0])
    d.enEspera[1]?.resolver(borrador(1, 8))
    await vaciar()
    expect(d.guardados[2]).toMatchObject({ revisionBorrador: 1 })
    expect(d.guardados[2]?.operacionId).not.toBe(d.guardados[0]?.operacionId)
    expect(d.guardados[2]?.registro.series[0]).toMatchObject({ repeticiones: 10 })
  })

  it("ante un 409 conserva las dos versiones y deja elegir", async () => {
    const d = preparar()
    const sesion = await SesionEnCurso.abrir("ana", SESION, d.deps)
    await sesion.editar(escribir("8"))
    void sesion.sincronizar()
    await vaciar()
    d.cambiarServidor(sesionDelServidor({ borrador: borrador(3, 12) }))
    d.enEspera[0]?.rechazar(
      new ErrorDelServidor(409, {
        codigo: "borrador_cambiado",
        mensaje: "Hay una versión más reciente",
      }),
    )
    await vaciar()
    expect(sesion.leer().copia.conflicto).toMatchObject({ codigo: "borrador_cambiado" })
    expect(sesion.leer().copia.entradas[SERIE]?.valor).toBe("8")

    await sesion.resolverConflicto("servidor")
    expect(sesion.leer().copia.entradas[SERIE]?.valor).toBe("12")
    expect(sesion.leer().copia.respaldo?.entradas[SERIE]?.valor).toBe("8")
    expect(sesion.leer().copia.base.borrador).toBe(3)
  })

  it("quedarse con la suya vuelve a mandarla sobre la revisión del servidor", async () => {
    const d = preparar()
    const sesion = await SesionEnCurso.abrir("ana", SESION, d.deps)
    await sesion.editar(escribir("8"))
    void sesion.sincronizar()
    await vaciar()
    d.cambiarServidor(sesionDelServidor({ borrador: borrador(3, 12) }))
    d.enEspera[0]?.rechazar(new ErrorDelServidor(409, { codigo: "borrador_cambiado" }))
    await vaciar()
    await sesion.resolverConflicto("mia")
    await vaciar()
    expect(d.guardados[1]).toMatchObject({ revisionBorrador: 3 })
    expect(d.guardados[1]?.registro.series[0]).toMatchObject({ repeticiones: 8 })
  })

  it("una sesión anulada por el entrenador se conserva en el móvil y lo dice", async () => {
    const d = preparar()
    const sesion = await SesionEnCurso.abrir("ana", SESION, d.deps)
    await sesion.editar(escribir("8"))
    void sesion.sincronizar()
    await vaciar()
    d.enEspera[0]?.rechazar(new ErrorDelServidor(404, null))
    await vaciar()
    expect(sesion.leer().copia).toMatchObject({ anulada: true })
    expect(sesion.leer().copia.entradas[SERIE]?.valor).toBe("8")
  })

  it("recupera en otro dispositivo el borrador más nuevo del servidor", async () => {
    const d = preparar(sesionDelServidor({ borrador: borrador(2, 7) }))
    const sesion = await SesionEnCurso.abrir("ana", SESION, d.deps)
    expect(sesion.leer().copia.entradas[SERIE]).toEqual({ peso: "40", valor: "7", hecha: true })
    expect(sesion.leer().copia.base.borrador).toBe(2)
  })

  it("sin red abre lo que ya se descargó; sin copia necesita conexión", async () => {
    const d = preparar()
    await SesionEnCurso.abrir("ana", SESION, d.deps)
    ;(d.deps.api.leerSesion as jest.Mock).mockRejectedValue(new ErrorDeRed("sin red"))
    const sinRed = await SesionEnCurso.abrir("ana", SESION, d.deps)
    expect(sinRed.leer().copia.sesionId).toBe(SESION)
    await expect(SesionEnCurso.abrir("ana", id(7), d.deps)).rejects.toBeInstanceOf(ErrorDeRed)
  })
})

describe("Entreno activo: enviar", () => {
  it("no dice «enviado» hasta que el servidor lo confirma y reintenta con la misma operación", async () => {
    const d = preparar()
    const sesion = await SesionEnCurso.abrir("ana", SESION, d.deps)
    await sesion.editar(escribir("8"))
    const primero = sesion.enviar()
    await vaciar()
    expect(sesion.leer().enviando).toBe(true)
    expect(sesion.leer().copia.resultado).toBeNull()
    d.enviosEnEspera[0]?.rechazar(new ErrorDeRed("se cortó"))
    await expect(primero).rejects.toBeInstanceOf(ErrorDeRed)
    expect(sesion.leer().errorDeEnvio).toMatch(/No hemos podido confirmar/)
    expect(d.disco.get(SESION)?.envio).not.toBeNull()

    const segundo = sesion.enviar()
    await vaciar()
    expect(d.envios[1]).toEqual(d.envios[0])
    d.enviosEnEspera[1]?.resolver(resultado(1))
    await expect(segundo).resolves.toMatchObject({ sesionId: SESION })
    expect(sesion.leer().copia).toMatchObject({ envio: null, enVuelo: null })
    expect(sesion.leer().copia.sesion.agenda.estado).toBe("cerrada")
  })

  it("si otro envío ya se confirmó, recupera ese resultado", async () => {
    const d = preparar()
    const sesion = await SesionEnCurso.abrir("ana", SESION, d.deps)
    await sesion.editar(escribir("8"))
    const envio = sesion.enviar()
    await vaciar()
    d.enviosEnEspera[0]?.rechazar(new ErrorDelServidor(409, { codigo: "sesion_enviada" }))
    await expect(envio).resolves.toMatchObject({ sesionId: SESION })
    expect(sesion.leer().copia.resultado).not.toBeNull()
  })

  it("resuelve antes un guardado en duda para no presentar una revisión vieja", async () => {
    const d = preparar()
    const sesion = await SesionEnCurso.abrir("ana", SESION, d.deps)
    await sesion.editar(escribir("8"))
    void sesion.sincronizar()
    await vaciar()
    d.enEspera[0]?.rechazar(new ErrorDeRed("sin respuesta"))
    await vaciar()
    const envio = sesion.enviar()
    await vaciar()
    expect(d.guardados[1]).toEqual(d.guardados[0])
    d.enEspera[1]?.resolver(borrador(1, 8))
    await vaciar()
    expect(d.envios[0]).toMatchObject({ revisionBorrador: 1 })
    d.enviosEnEspera[0]?.resolver(resultado(1))
    await expect(envio).resolves.toBeTruthy()
  })
})
