import {
  EnviarEntrenamientoSchema,
  type Borrador,
  type EnviarEntrenamiento,
  type GuardarBorrador,
  type ListadoEjercicios,
  type ResultadoEntrenamiento,
  type SesionCliente,
} from "@alpha-omega/shared"

import { ErrorDeRed, ErrorDelServidor, ErrorDeSesion } from "../lib/http"

import { tienePendientes, type CopiaLocal, type Entradas } from "./copia-local"
import { aRegistro, entradasDesdeRegistro } from "./valores"

/*
 * El entreno activo de una sesión: la copia local y su sincronización.
 *
 * Orden de las cosas, siempre:
 *   1. Cada cambio se escribe en el móvil. Solo entonces es «Guardado».
 *   2. Después se intenta mandar al servidor, con la revisión que conocemos.
 *
 * Reglas que protegen lo registrado:
 * - Un guardado que salió y no obtuvo respuesta se reenvía IDÉNTICO (mismo id
 *   de operación) antes de mandar nada nuevo: si el servidor ya lo aplicó,
 *   responde lo mismo y no se toma por un conflicto.
 * - La respuesta de un guardado viejo nunca sustituye lo que se ha escrito
 *   después: solo actualiza la revisión.
 * - Ante un 409 no se descarta nada: se guardan las dos versiones y se elige.
 */

export type Dependencias = {
  api: {
    leerSesion: (id: string) => Promise<SesionCliente>
    leerEjerciciosDeSesion: (id: string) => Promise<ListadoEjercicios>
    guardarBorrador: (id: string, cuerpo: GuardarBorrador) => Promise<Borrador>
    enviarEntrenamiento: (
      id: string,
      cuerpo: EnviarEntrenamiento,
    ) => Promise<ResultadoEntrenamiento>
    leerResultado: (id: string) => Promise<ResultadoEntrenamiento>
  }
  almacen: {
    leerCopia: (cuenta: string, sesion: string) => Promise<CopiaLocal | null>
    guardarCopia: (cuenta: string, copia: CopiaLocal) => Promise<void>
    borrarCopia: (cuenta: string, sesion: string) => Promise<void>
  }
  nuevoId: () => string
  ahora: () => Date
  /** Programa una tarea; devuelve cómo cancelarla. */
  programar: (tarea: () => void, milisegundos: number) => () => void
}

export type Escritura = "guardando" | "guardado" | "error"
export type Red = "al-dia" | "pendiente" | "sincronizando" | "sin-conexion"

export type Instantanea = {
  copia: CopiaLocal
  escritura: Escritura
  red: Red
  enviando: boolean
  /** El último intento de envío no se pudo confirmar. */
  errorDeEnvio: string | null
}

/** Espera tras un guardado que no pudo salir. Crece hasta un minuto. */
const ESPERAS_MS = [2_000, 5_000, 15_000, 30_000, 60_000]
/** Se agrupan las pulsaciones seguidas en un solo guardado. */
const AGRUPAR_MS = 800

function copiaNueva(sesion: SesionCliente, ahora: Date): CopiaLocal {
  return {
    v: 1,
    sesionId: sesion.agenda.id,
    sesion,
    ejercicios: null,
    entradas: sesion.borrador === null ? {} : entradasDesdeRegistro(sesion.borrador.registro),
    notas: sesion.borrador?.registro.notas ?? "",
    secuencia: 0,
    sincronizada: 0,
    base: { prescripcion: sesion.revisionPrescripcion, borrador: sesion.borrador?.revision ?? 0 },
    enVuelo: null,
    envio: null,
    conflicto: null,
    respaldo: null,
    resultado: null,
    anulada: false,
    actualizadaEn: ahora.toISOString(),
  }
}

/** Fallos en los que lo sensato es esperar y reintentar, sin tocar nada. */
function esTransitorio(error: unknown): boolean {
  return (
    error instanceof ErrorDeRed ||
    (error instanceof ErrorDelServidor &&
      (error.codigo >= 500 || error.codigo === 429 || error.codigo === 408))
  )
}

export class SesionEnCurso {
  private instantanea: Instantanea
  private readonly oyentes = new Set<() => void>()
  private escrituras: Promise<void> = Promise.resolve()
  private escriturasPendientes = 0
  private sincronizando = false
  private otraVuelta = false
  private intentosFallidos = 0
  private cancelarProgramada: (() => void) | null = null
  private cerrada = false

  private constructor(
    private readonly cuenta: string,
    copia: CopiaLocal,
    private readonly deps: Dependencias,
  ) {
    this.instantanea = {
      copia,
      escritura: "guardado",
      red: tienePendientes(copia) ? "pendiente" : "al-dia",
      enviando: false,
      errorDeEnvio: null,
    }
  }

  /**
   * Abre la sesión: lo del móvil primero y, si hay red, lo fusiona con el
   * servidor. La primera descarga sí necesita conexión.
   */
  static async abrir(cuenta: string, sesionId: string, deps: Dependencias): Promise<SesionEnCurso> {
    const local = await deps.almacen.leerCopia(cuenta, sesionId)
    let servidor: SesionCliente | null = null
    try {
      servidor = await deps.api.leerSesion(sesionId)
    } catch (error) {
      if (error instanceof ErrorDelServidor && error.codigo === 404 && local !== null) {
        const anulada = { ...local, anulada: true }
        await deps.almacen.guardarCopia(cuenta, anulada)
        return new SesionEnCurso(cuenta, anulada, deps)
      }
      if (local === null || !esTransitorio(error)) {
        throw error
      }
    }

    const copia = servidor === null ? local : await SesionEnCurso.fusionar(local, servidor, deps)
    if (copia === null) {
      throw new ErrorDeRed("Sin copia local")
    }
    if (copia.ejercicios === null && servidor !== null) {
      try {
        copia.ejercicios = (await deps.api.leerEjerciciosDeSesion(sesionId)).ejercicios
      } catch {
        // Las fichas son un extra: sin ellas se registra igual.
      }
    }
    await deps.almacen.guardarCopia(cuenta, copia)
    const enCurso = new SesionEnCurso(cuenta, copia, deps)
    if (tienePendientes(copia)) {
      void enCurso.sincronizar()
    }
    return enCurso
  }

  /** Une lo que dice el servidor con lo que hay en el móvil, sin perder ediciones. */
  private static async fusionar(
    local: CopiaLocal | null,
    servidor: SesionCliente,
    deps: Dependencias,
  ): Promise<CopiaLocal> {
    const ahora = deps.ahora()
    if (servidor.enviadoEn !== null) {
      const resultado = await deps.api.leerResultado(servidor.agenda.id)
      const base = local ?? copiaNueva(servidor, ahora)
      return {
        ...base,
        sesion: servidor,
        resultado,
        enVuelo: null,
        envio: null,
        conflicto: null,
        sincronizada: base.secuencia,
        actualizadaEn: ahora.toISOString(),
      }
    }
    if (local === null || local.resultado !== null) {
      return copiaNueva(servidor, ahora)
    }
    const conCambios = local.secuencia > local.sincronizada || local.enVuelo !== null
    if (servidor.revisionPrescripcion !== local.base.prescripcion) {
      if (!conCambios) {
        return { ...copiaNueva(servidor, ahora), ejercicios: null }
      }
      return {
        ...local,
        conflicto: {
          codigo: "prescripcion_cambiada",
          mensaje: "Tu entrenador ha cambiado esta sesión",
          servidor,
        },
        enVuelo: null,
        actualizadaEn: ahora.toISOString(),
      }
    }
    const revisionServidor = servidor.borrador?.revision ?? 0
    if (!conCambios && revisionServidor > local.base.borrador && servidor.borrador !== null) {
      // Otro dispositivo guardó algo más nuevo y aquí no hay nada pendiente.
      return {
        ...local,
        sesion: servidor,
        entradas: entradasDesdeRegistro(servidor.borrador.registro),
        notas: servidor.borrador.registro.notas ?? "",
        base: { prescripcion: servidor.revisionPrescripcion, borrador: revisionServidor },
        actualizadaEn: ahora.toISOString(),
      }
    }
    // Lo local manda; de la sesión se actualizan fechas y estado.
    return { ...local, sesion: { ...local.sesion, agenda: servidor.agenda } }
  }

  suscribir(oyente: () => void): () => void {
    this.oyentes.add(oyente)
    return () => {
      this.oyentes.delete(oyente)
    }
  }

  leer(): Instantanea {
    return this.instantanea
  }

  private publicar(cambios: Partial<Instantanea>): void {
    this.instantanea = { ...this.instantanea, ...cambios }
    for (const oyente of this.oyentes) {
      oyente()
    }
  }

  private get copia(): CopiaLocal {
    return this.instantanea.copia
  }

  /** Persiste la copia; los cambios de estado de red no esperan a esto. */
  private persistir(copia: CopiaLocal): Promise<void> {
    this.escriturasPendientes++
    this.publicar({ copia, escritura: "guardando" })
    const escritura = this.escrituras.then(() => this.deps.almacen.guardarCopia(this.cuenta, copia))
    this.escrituras = escritura.then(
      () => {
        this.escriturasPendientes--
        if (this.escriturasPendientes === 0 && this.instantanea.escritura !== "error") {
          this.publicar({ escritura: "guardado" })
        }
      },
      () => {
        this.escriturasPendientes--
        // Una escritura local fallida nunca se presenta como éxito.
        this.publicar({ escritura: "error" })
      },
    )
    return escritura
  }

  /** Una edición de la persona: se guarda en el móvil y se programa la sincronización. */
  async editar(
    cambio: (entradas: Entradas, notas: string) => { entradas: Entradas; notas: string },
  ): Promise<void> {
    const copia = this.copia
    if (
      copia.resultado !== null ||
      copia.envio !== null ||
      copia.anulada ||
      this.instantanea.enviando
    ) {
      return
    }
    const nuevo = cambio(copia.entradas, copia.notas)
    const siguiente: CopiaLocal = {
      ...copia,
      entradas: nuevo.entradas,
      notas: nuevo.notas,
      secuencia: copia.secuencia + 1,
      actualizadaEn: this.deps.ahora().toISOString(),
    }
    this.publicar({ red: copia.conflicto === null ? "pendiente" : this.instantanea.red })
    await this.persistir(siguiente)
    this.programarSincronizacion(AGRUPAR_MS)
  }

  private programarSincronizacion(espera: number): void {
    this.cancelarProgramada?.()
    this.cancelarProgramada = this.deps.programar(() => {
      this.cancelarProgramada = null
      void this.sincronizar()
    }, espera)
  }

  /** Manda lo pendiente al servidor, en orden y de uno en uno. */
  async sincronizar(): Promise<void> {
    if (this.sincronizando) {
      this.otraVuelta = true
      return
    }
    this.sincronizando = true
    try {
      do {
        this.otraVuelta = false
        await this.unaVuelta()
      } while (this.otraVuelta && !this.cerrada)
    } finally {
      this.sincronizando = false
    }
  }

  private async unaVuelta(): Promise<void> {
    for (;;) {
      await this.escrituras
      const copia = this.copia
      if (
        this.cerrada ||
        copia.resultado !== null ||
        copia.anulada ||
        copia.conflicto !== null ||
        // Con un envío anotado no se guarda nada más; antes de anotarlo, el
        // propio envío usa esta vuelta para resolver un guardado en duda.
        copia.envio !== null
      ) {
        return
      }
      let enVuelo = copia.enVuelo
      if (enVuelo === null) {
        if (copia.secuencia <= copia.sincronizada) {
          this.publicar({ red: "al-dia" })
          return
        }
        enVuelo = {
          secuencia: copia.secuencia,
          cuerpo: {
            operacionId: this.deps.nuevoId(),
            revisionPrescripcion: copia.base.prescripcion,
            revisionBorrador: copia.base.borrador,
            registro: aRegistro(copia.sesion.prescripcion, copia.entradas, copia.notas),
          },
        }
        // La operación queda anotada ANTES de salir: si la app muere con la
        // petición en el aire, al volver se reenvía la misma.
        await this.persistir({ ...copia, enVuelo })
      }

      this.publicar({ red: "sincronizando" })
      let respuesta: Borrador
      try {
        respuesta = await this.deps.api.guardarBorrador(copia.sesionId, enVuelo.cuerpo)
      } catch (error) {
        await this.trasFalloDeGuardado(error)
        return
      }
      this.intentosFallidos = 0
      const actual = this.copia
      // Solo se actualiza la revisión: las entradas que haya ahora son más nuevas.
      await this.persistir({
        ...actual,
        base: { prescripcion: respuesta.revisionPrescripcion, borrador: respuesta.revision },
        sincronizada: Math.max(actual.sincronizada, enVuelo.secuencia),
        enVuelo: null,
        sesion: { ...actual.sesion, borrador: respuesta },
      })
    }
  }

  private async trasFalloDeGuardado(error: unknown): Promise<void> {
    if (error instanceof ErrorDeSesion) {
      // La sesión cayó y no se pudo renovar: el proveedor manda al login y lo
      // local se queda intacto para cuando vuelva a entrar la misma cuenta.
      this.publicar({ red: "pendiente" })
      return
    }
    if (esTransitorio(error)) {
      const espera = ESPERAS_MS[Math.min(this.intentosFallidos, ESPERAS_MS.length - 1)] ?? 60_000
      this.intentosFallidos++
      this.publicar({ red: "sin-conexion" })
      this.programarSincronizacion(espera)
      return
    }
    await this.anotarRechazo(error, "enVuelo")
  }

  /** 404, 409 o 400: el servidor dice que no. Se guarda el porqué sin perder nada. */
  private async anotarRechazo(error: unknown, origen: "enVuelo" | "envio"): Promise<void> {
    const copia = this.copia
    const limpia = { ...copia, [origen]: null }
    if (error instanceof ErrorDelServidor && error.codigo === 404) {
      await this.persistir({ ...limpia, anulada: true })
      this.publicar({ red: "al-dia" })
      return
    }
    const codigo =
      error instanceof ErrorDelServidor ? (error.detalle?.codigo ?? String(error.codigo)) : "error"
    if (codigo === "sesion_enviada") {
      try {
        const resultado = await this.deps.api.leerResultado(copia.sesionId)
        await this.persistir({ ...limpia, resultado, sincronizada: copia.secuencia })
        this.publicar({ red: "al-dia" })
        return
      } catch {
        // Si ni eso se puede leer, se trata como un conflicto más.
      }
    }
    let servidor: SesionCliente | null = null
    try {
      servidor = await this.deps.api.leerSesion(copia.sesionId)
    } catch {
      servidor = null
    }
    const mensaje =
      error instanceof ErrorDelServidor && error.mensaje !== null
        ? error.mensaje
        : "El servidor no ha aceptado estos cambios"
    await this.persistir({ ...limpia, conflicto: { codigo, mensaje, servidor } })
    this.publicar({ red: "pendiente" })
  }

  /**
   * Resolver un conflicto.
   * - `servidor`: se adopta la versión del servidor y lo local queda de respaldo.
   * - `mia`: se vuelve a mandar lo local sobre la versión nueva del servidor.
   *   Solo si la prescripción no cambió: no se mezclan objetivos.
   */
  async resolverConflicto(opcion: "servidor" | "mia"): Promise<void> {
    const copia = this.copia
    const conflicto = copia.conflicto
    if (conflicto === null) {
      return
    }
    const servidor = conflicto.servidor ?? (await this.deps.api.leerSesion(copia.sesionId))
    if (opcion === "mia" && servidor.revisionPrescripcion === copia.base.prescripcion) {
      await this.persistir({
        ...copia,
        conflicto: null,
        base: {
          prescripcion: servidor.revisionPrescripcion,
          borrador: servidor.borrador?.revision ?? 0,
        },
        secuencia: copia.secuencia + 1,
      })
      void this.sincronizar()
      return
    }
    const nueva = copiaNueva(servidor, this.deps.ahora())
    await this.persistir({
      ...nueva,
      ejercicios:
        servidor.revisionPrescripcion === copia.base.prescripcion ? copia.ejercicios : null,
      respaldo: { entradas: copia.entradas, notas: copia.notas },
      secuencia: copia.secuencia,
      sincronizada: copia.secuencia,
    })
    this.publicar({ red: "al-dia" })
  }

  /**
   * Enviar el entrenamiento.
   *
   * La operación se anota antes de salir y un reintento la repite idéntica: si
   * la primera llegó y se perdió la respuesta, el servidor devuelve lo mismo.
   * «Enviado» solo aparece cuando el servidor lo ha confirmado.
   */
  async enviar(): Promise<ResultadoEntrenamiento> {
    this.cancelarProgramada?.()
    this.publicar({ enviando: true, errorDeEnvio: null })
    try {
      await this.escrituras
      // Un guardado en duda cambia la revisión que hay que presentar: se resuelve antes.
      if (this.copia.enVuelo !== null) {
        await this.sincronizar()
        if (this.copia.enVuelo !== null) {
          throw new ErrorDeRed("Guardado pendiente sin confirmar")
        }
      }
      const copia = this.copia
      if (copia.conflicto !== null) {
        throw new Error(copia.conflicto.mensaje)
      }
      const cuerpo =
        copia.envio?.cuerpo ??
        EnviarEntrenamientoSchema.parse({
          operacionId: this.deps.nuevoId(),
          revisionPrescripcion: copia.base.prescripcion,
          revisionBorrador: copia.base.borrador,
          registro: aRegistro(copia.sesion.prescripcion, copia.entradas, copia.notas),
        })
      if (copia.envio === null) {
        await this.persistir({ ...copia, envio: { cuerpo } })
      }
      let resultado: ResultadoEntrenamiento
      try {
        resultado = await this.deps.api.enviarEntrenamiento(copia.sesionId, cuerpo)
      } catch (error) {
        if (!esTransitorio(error) && !(error instanceof ErrorDeSesion)) {
          await this.anotarRechazo(error, "envio")
          if (this.copia.resultado !== null) {
            return this.copia.resultado
          }
        }
        throw error
      }
      const actual = this.copia
      await this.persistir({
        ...actual,
        resultado,
        envio: null,
        enVuelo: null,
        sincronizada: actual.secuencia,
        sesion: {
          ...actual.sesion,
          enviadoEn: resultado.enviadoEn,
          agenda: { ...actual.sesion.agenda, estado: "cerrada" },
        },
      })
      this.publicar({ red: "al-dia" })
      return resultado
    } catch (error) {
      this.publicar({
        errorDeEnvio:
          error instanceof ErrorDeRed || esTransitorio(error)
            ? "No hemos podido confirmar el envío. Tu registro sigue guardado en el móvil."
            : error instanceof Error
              ? error.message
              : "No se ha podido enviar",
      })
      throw error
    } finally {
      this.publicar({ enviando: false })
    }
  }

  /** Volver a editar tras un envío sin confirmar. Si en realidad llegó, el próximo guardado lo descubre. */
  async seguirEditando(): Promise<void> {
    if (this.copia.envio === null) {
      return
    }
    await this.persistir({ ...this.copia, envio: null })
    this.publicar({ errorDeEnvio: null })
    void this.sincronizar()
  }

  /** Olvidar una sesión anulada por el entrenador. */
  async descartar(): Promise<void> {
    this.cerrar()
    await this.deps.almacen.borrarCopia(this.cuenta, this.copia.sesionId)
  }

  cerrar(): void {
    this.cerrada = true
    this.cancelarProgramada?.()
    this.cancelarProgramada = null
  }
}
