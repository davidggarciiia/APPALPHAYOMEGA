import { EnviarEntrenamientoSchema, type ResultadoEntrenamiento } from "@alpha-omega/shared"
import type { ApiEntrenamiento } from "./api"
import { ConflictoDeEdicionLocal, ErrorDeCopiaLocal, type AlmacenLocal } from "./almacen-local"
import {
  DocumentoSesionSchema,
  claveSesion,
  nuevoDocumento,
  type DocumentoSesion,
} from "./documento-local"
import {
  desdePrescripcion,
  edicionRecuperada,
  registroParaEnviar,
  type EdicionRegistro,
} from "./registro-modelo"
import { pausarTramo } from "./sesion/tiempo"
import { ErrorDelServidor } from "../lib/http"

type VistaSesion = Pick<DocumentoSesion, "ejercicioElegidoId" | "descansoHasta" | "descansoTotal">
type CopiaLocal = NonNullable<DocumentoSesion["respaldo"]>

function copiasUnicas(copias: CopiaLocal[], excluir: CopiaLocal[]): CopiaLocal[] {
  const vistas = new Set(excluir.map((copia) => JSON.stringify(copia)))
  return copias.filter((copia) => {
    const firma = JSON.stringify(copia)
    if (vistas.has(firma)) return false
    vistas.add(firma)
    return true
  })
}
const copiaDe = (documento: DocumentoSesion): CopiaLocal => ({
  edicion: documento.edicion,
  prescripcion: documento.sesion.prescripcion,
})

/** Una instancia por pantalla; al cerrarla ninguna respuesta puede escribir detrás de la siguiente. */
export class RegistroControl {
  documento: DocumentoSesion | null = null
  guardando = 0
  errorLocal = false
  conflicto = false
  sinRed = false
  private vigente = true
  private enCurso: Promise<void> | null = null
  private enviando = false
  private lectura = 0
  private versionLocal: unknown | null = null
  private colaLocal: Promise<void> = Promise.resolve()
  constructor(
    private cuenta: string,
    private id: string,
    private api: ApiEntrenamiento,
    private almacen: AlmacenLocal,
    private uuid: () => string,
    private cambio: () => void,
  ) {}

  cerrar(): void {
    this.vigente = false
  }
  private exigir(): DocumentoSesion {
    if (!this.vigente || !this.documento) throw new Error("La sesión no está abierta")
    return this.documento
  }
  private async persistir(): Promise<void> {
    const datos = this.exigir()
    this.guardando++
    this.cambio()
    const guardar = async (): Promise<void> => {
      const superadaPorConflicto =
        this.conflicto && this.documento?.conflictoLocal && datos !== this.documento
      try {
        if (superadaPorConflicto) throw new ConflictoDeEdicionLocal()
        await this.almacen.guardar(this.cuenta, claveSesion(this.id), datos, {
          anterior: this.versionLocal,
        })
        this.versionLocal = JSON.parse(JSON.stringify(datos)) as unknown
        this.errorLocal = false
      } catch (error) {
        if (superadaPorConflicto) {
          // Una operación anterior ya rescató la edición más reciente y las
          // copias concurrentes. Una escritura vieja de esta cola no las reemplaza.
          this.errorLocal = false
          throw error
        }
        if (error instanceof ConflictoDeEdicionLocal) {
          this.conflicto = true
          try {
            await this.conservarEdicionesLocales()
            this.errorLocal = false
          } catch (fallo) {
            this.errorLocal = true
            throw fallo instanceof ErrorDeCopiaLocal
              ? fallo
              : new ErrorDeCopiaLocal("guardar", fallo)
          }
        } else {
          this.errorLocal = true
          throw error instanceof ErrorDeCopiaLocal ? error : new ErrorDeCopiaLocal("guardar", error)
        }
        throw error
      } finally {
        this.guardando--
        if (this.vigente) this.cambio()
      }
    }
    const siguiente = this.colaLocal.then(guardar)
    this.colaLocal = siguiente.catch(() => undefined)
    await siguiente
  }
  private async conservarEdicionesLocales(): Promise<void> {
    // Cada intento vuelve a leer la versión a comparar. El candado y el CAS del
    // almacén impiden que una tercera pestaña desaparezca durante la recuperación.
    while (this.vigente) {
      const otra = await this.almacen.leer(this.cuenta, claveSesion(this.id), DocumentoSesionSchema)
      const local = this.exigir()
      const respaldo = otra ? copiaDe(otra) : local.respaldo
      const anteriores = [
        ...(local.respaldosLocales ?? []),
        ...(otra?.respaldosLocales ?? []),
        ...(local.respaldo ? [local.respaldo] : []),
        ...(otra?.respaldo ? [otra.respaldo] : []),
      ]
      this.documento = {
        ...local,
        respaldo,
        conflictoLocal: true,
        respaldosLocales: copiasUnicas(anteriores, [
          copiaDe(local),
          ...(respaldo ? [respaldo] : []),
        ]),
      }
      try {
        await this.almacen.guardar(this.cuenta, claveSesion(this.id), this.documento, {
          anterior: otra,
        })
        this.versionLocal = JSON.parse(JSON.stringify(this.documento)) as unknown
        return
      } catch (error) {
        if (!(error instanceof ConflictoDeEdicionLocal)) throw error
      }
    }
  }
  async abrir(): Promise<void> {
    const local = await this.almacen.leer(this.cuenta, claveSesion(this.id), DocumentoSesionSchema)
    if (!this.vigente) return
    this.versionLocal = local
    if (local) {
      this.documento = local
      this.conflicto = local.conflictoLocal ?? false
      this.cambio()
    }
    try {
      await this.actualizar()
    } catch (error) {
      if (!local) throw error
      this.falloRemoto(error)
    }
  }
  async actualizar(): Promise<void> {
    const lectura = ++this.lectura
    const sesion = await this.api.leerCliente(this.id)
    if (!this.vigente || lectura !== this.lectura) return
    const conocido = this.documento
    if (conocido?.resultado) {
      if (sesion.revisadaEn !== conocido.sesion.revisadaEn) {
        this.documento = {
          ...conocido,
          sesion: { ...conocido.sesion, revisadaEn: sesion.revisadaEn },
        }
        await this.persistir()
      }
      return
    }
    if (
      conocido &&
      (sesion.revisionPrescripcion < conocido.sesion.revisionPrescripcion ||
        sesion.agenda.revision < conocido.sesion.agenda.revision ||
        (!sesion.enviadoEn && (sesion.borrador?.revision ?? 0) < conocido.revisionBorrador))
    )
      return
    this.sinRed = false
    if (sesion.enviadoEn) {
      if (conocido?.envioPendiente) {
        try {
          await this.confirmarResultado(await this.api.enviar(this.id, conocido.envioPendiente))
          return
        } catch (error) {
          if (!(error instanceof ErrorDelServidor) || error.codigo !== 409) throw error
        }
      }
      const resultado = await this.api.resultado(this.id)
      if (lectura !== this.lectura) return
      await this.confirmarResultado(resultado, true)
      return
    }
    const local = this.documento
    if (
      local &&
      (local.secuencia > local.sincronizada ||
        local.pendiente ||
        local.intencionEnvio ||
        local.envioPendiente)
    ) {
      // El replay pendiente resuelve si este incremento remoto es nuestro.
      if (
        !local.pendiente &&
        !local.envioPendiente &&
        (sesion.revisionPrescripcion !== local.sesion.revisionPrescripcion ||
          (sesion.borrador?.revision ?? 0) !== local.revisionBorrador)
      ) {
        this.conflicto = true
      }
      this.documento = { ...local, sesion: { ...local.sesion, agenda: sesion.agenda } }
    } else {
      const nuevo = nuevoDocumento(sesion)
      const mismoBorrador =
        local &&
        local.sesion.revisionPrescripcion === sesion.revisionPrescripcion &&
        local.revisionBorrador === (sesion.borrador?.revision ?? 0)
      this.documento = {
        ...nuevo,
        // El servidor conserva el tiempo acumulado, pero el tramo abierto solo existe
        // en el dispositivo. Una lectura del mismo borrador no debe pausarlo.
        edicion: mismoBorrador
          ? {
              ...nuevo.edicion,
              ...(local.edicion.tiempoActivoSegundos !== undefined && {
                tiempoActivoSegundos: local.edicion.tiempoActivoSegundos,
              }),
              ...(local.edicion.tramoActivoDesde !== undefined && {
                tramoActivoDesde: local.edicion.tramoActivoDesde,
              }),
            }
          : nuevo.edicion,
        respaldo: local?.respaldo ?? null,
        ...(local?.respaldosLocales && { respaldosLocales: local.respaldosLocales }),
        ...(local?.conflictoLocal && { conflictoLocal: true }),
        ejercicioElegidoId: local?.ejercicioElegidoId ?? null,
        descansoHasta: local?.descansoHasta ?? null,
        descansoTotal: local?.descansoTotal ?? null,
      }
    }
    await this.persistir()
  }
  async editar(edicion: EdicionRegistro, vista: Partial<VistaSesion> = {}): Promise<void> {
    const local = this.exigir()
    if (
      local.resultado ||
      local.intencionEnvio ||
      local.envioPendiente ||
      this.enviando ||
      this.conflicto
    )
      throw new Error("Resuelve la operación pendiente antes de editar")
    this.documento = { ...local, ...vista, edicion, secuencia: local.secuencia + 1 }
    await this.persistir()
  }
  async guardarVista(vista: Partial<VistaSesion>): Promise<void> {
    const local = this.exigir()
    this.documento = { ...local, ...vista }
    await this.persistir()
  }
  async pausar(instante: string): Promise<void> {
    const local = this.exigir()
    if (
      !local.edicion.tramoActivoDesde ||
      local.resultado ||
      local.intencionEnvio ||
      local.envioPendiente
    )
      return
    this.documento = {
      ...local,
      edicion: pausarTramo(local.edicion, instante),
      secuencia: local.secuencia + 1,
    }
    await this.persistir()
  }
  async reintentarGuardado(): Promise<void> {
    await this.persistir()
  }
  sincronizar(): Promise<void> {
    this.enCurso ??= this.guardar().finally(() => {
      this.enCurso = null
    })
    return this.enCurso
  }
  private async guardar(): Promise<void> {
    let local = this.exigir()
    if (local.resultado || local.envioPendiente) return
    if (this.conflicto)
      throw new Error("Hay otra versión del entrenamiento. Elige cómo recuperarla.")
    if (this.errorLocal) {
      await this.persistir()
      local = this.exigir()
    }
    if (!local.pendiente && local.secuencia === local.sincronizada) return
    if (!local.pendiente) {
      const registro = registroParaEnviar(local.sesion.prescripcion, local.edicion)
      this.documento = {
        ...local,
        pendiente: {
          secuencia: local.secuencia,
          peticion: {
            operacionId: this.uuid(),
            revisionPrescripcion: local.sesion.revisionPrescripcion,
            revisionBorrador: local.revisionBorrador,
            registro,
          },
        },
      }
      await this.persistir()
      local = this.exigir()
    }
    const pendiente = local.pendiente!
    try {
      const borrador = await this.api.guardar(this.id, pendiente.peticion)
      if (!this.vigente) return
      this.documento = {
        ...this.exigir(),
        pendiente: null,
        revisionBorrador: borrador.revision,
        sincronizada: pendiente.secuencia,
      }
      this.sinRed = false
      await this.persistir()
    } catch (error) {
      this.falloRemoto(error)
      throw error
    }
  }
  private falloRemoto(error: unknown): void {
    if (!this.vigente) return
    if (error instanceof ErrorDeCopiaLocal || error instanceof ConflictoDeEdicionLocal) return
    if (error instanceof ErrorDelServidor && error.codigo === 409) this.conflicto = true
    else this.sinRed = true
    this.cambio()
  }
  async recuperarServidor(): Promise<void> {
    const remoto = await this.api.leerCliente(this.id)
    if (!this.vigente) return
    if (remoto.enviadoEn) {
      await this.actualizar()
      return
    }
    const local = this.exigir()
    this.documento = {
      ...nuevoDocumento(remoto),
      respaldo: copiaDe(local),
      ...(local.respaldosLocales || local.respaldo
        ? {
            respaldosLocales: copiasUnicas(
              [...(local.respaldosLocales ?? []), ...(local.respaldo ? [local.respaldo] : [])],
              [copiaDe(local)],
            ),
          }
        : {}),
    }
    this.conflicto = false
    this.sinRed = false
    await this.persistir()
  }
  async recuperarCopia(): Promise<void> {
    const local = this.exigir()
    if (!local.respaldo) return
    if (local.conflictoLocal) throw new Error("Elige la edición local antes de recuperar una copia")
    if (local.respaldosLocales) {
      this.documento = {
        ...local,
        respaldosLocales: copiasUnicas(
          [...local.respaldosLocales, copiaDe(local)],
          [local.respaldo],
        ),
      }
    }
    // Una serie cuya unidad cambió queda pendiente; el respaldo se conserva.
    await this.editar(edicionRecuperada(local.respaldo, local.sesion.prescripcion))
  }
  async continuarEdicionLocal(): Promise<void> {
    const local = this.exigir()
    if (!local.conflictoLocal) return
    this.documento = { ...local, conflictoLocal: false }
    this.conflicto = false
    await this.persistir()
  }
  async elegirCopiaLocal(indice: number): Promise<void> {
    const local = this.exigir()
    const elegida = local.respaldosLocales?.[indice]
    if (!elegida) return
    this.documento = {
      ...local,
      respaldo: elegida,
      respaldosLocales: [
        ...(local.respaldo ? [local.respaldo] : []),
        ...(local.respaldosLocales ?? []).filter((_, n) => n !== indice),
      ],
    }
    await this.persistir()
  }
  async enviar(): Promise<void> {
    if (this.enviando) return
    this.enviando = true
    try {
      await this.pausar(new Date().toISOString())
      let local = this.exigir()
      if (!local.intencionEnvio && !local.envioPendiente) {
        const registro = registroParaEnviar(local.sesion.prescripcion, local.edicion)
        const peticion = EnviarEntrenamientoSchema.parse({
          operacionId: this.uuid(),
          revisionPrescripcion: local.sesion.revisionPrescripcion,
          revisionBorrador: local.revisionBorrador,
          registro,
        })
        this.documento = {
          ...local,
          intencionEnvio: {
            operacionId: peticion.operacionId,
            revisionPrescripcion: peticion.revisionPrescripcion,
            registro: peticion.registro,
          },
        }
        await this.persistir()
      }
      await this.sincronizar()
      local = this.exigir()
      if (this.conflicto) throw new Error("Recupera la versión del servidor antes de enviar")
      if (!local.envioPendiente) {
        const intencion = local.intencionEnvio!
        const peticion = EnviarEntrenamientoSchema.parse({
          operacionId: intencion.operacionId,
          revisionPrescripcion: intencion.revisionPrescripcion,
          revisionBorrador: local.revisionBorrador,
          registro: intencion.registro,
        })
        this.documento = { ...local, envioPendiente: peticion }
        await this.persistir()
        local = this.exigir()
      }
      await this.confirmarResultado(await this.api.enviar(this.id, local.envioPendiente!))
    } catch (error) {
      if (this.documento?.intencionEnvio || this.documento?.envioPendiente) this.falloRemoto(error)
      throw error
    } finally {
      this.enviando = false
    }
  }
  async descartarCopia(): Promise<void> {
    const local = this.exigir()
    this.documento = {
      ...local,
      respaldo: local.respaldosLocales?.[0] ?? null,
      ...(local.respaldosLocales && { respaldosLocales: local.respaldosLocales.slice(1) }),
    }
    await this.persistir()
  }
  private async confirmarResultado(
    resultado: ResultadoEntrenamiento,
    cierreRemoto = false,
  ): Promise<void> {
    if (!this.vigente) return
    // La confirmación sustituye la edición enviada, pero conserva las copias
    // alternativas que se rescataron de otros editores locales.
    let local = this.documento
    if (!local) {
      local = nuevoDocumento(await this.api.leerCliente(this.id))
      if (!this.vigente) return
    }
    this.documento = {
      ...local,
      resultado,
      pendiente: null,
      intencionEnvio: null,
      envioPendiente: null,
      respaldo: cierreRemoto
        ? local.secuencia > local.sincronizada ||
          local.pendiente ||
          local.intencionEnvio ||
          local.envioPendiente
          ? { edicion: local.edicion, prescripcion: local.sesion.prescripcion }
          : local.respaldo
        : local.respaldosLocales !== undefined
          ? local.respaldo
          : null,
      ...(cierreRemoto && local.respaldosLocales
        ? {
            respaldosLocales: copiasUnicas(
              [...local.respaldosLocales, ...(local.respaldo ? [local.respaldo] : [])],
              [copiaDe(local)],
            ),
          }
        : {}),
      sincronizada: local.secuencia,
      edicion: desdePrescripcion(resultado.prescripcion),
      sesion: {
        ...local.sesion,
        enviadoEn: resultado.enviadoEn,
        borrador: null,
        permiteAjuste: false,
        agenda: { ...local.sesion.agenda, estado: "cerrada" },
      },
    }
    this.conflicto = false
    this.sinRed = false
    await this.persistir()
  }
}
