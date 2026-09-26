import {
  PatronRutinaSchema,
  type EjercicioEnRutina,
  type PatronRutina,
  type Prescripcion,
  type RutinaGuardada,
  type SeriePrescrita,
  type SesionEnRutina,
} from "@alpha-omega/shared"

import { formatearNumero, leerEntero, leerPeso } from "../entrenamiento-cliente/valores"

/*
 * Lo que el entrenador está escribiendo en el editor de planes, rutinas y
 * ajustes de sesión. Los números van como texto, igual que en los campos: así
 * «42,5» o un campo a medio escribir no se pierden ni se redondean. Solo al
 * guardar se leen y se validan con los esquemas del servidor.
 *
 * Todo son funciones puras que devuelven una copia; los ids nuevos los da quien
 * llama (`nuevoId`), para poder probarlas sin azar.
 */

export type SerieEnEdicion = {
  id: string
  tipoMedicion: SeriePrescrita["tipoMedicion"]
  peso: string
  valor: string
}

export type EjercicioEnEdicion = {
  id: string
  ejercicioId: string
  nombre: string
  indicaciones: string
  series: SerieEnEdicion[]
}

export type SesionEnEdicion = {
  id: string
  nombre: string
  diaSemana: number
  ejercicios: EjercicioEnEdicion[]
}

export type NuevoId = () => string

export const DIAS_DE_LA_SEMANA = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
] as const

/** «Lun Torso · Mié Pierna · Sáb Full body» */
export function resumenDeRutina(rutina: Pick<RutinaGuardada, "patron">): string {
  return rutina.patron.sesiones
    .map((s) => `${(DIAS_DE_LA_SEMANA[s.diaSemana - 1] ?? "").slice(0, 3)} ${s.nombre}`)
    .join(" · ")
}

export function sesionNueva(nuevoId: NuevoId, diaSemana: number, nombre = ""): SesionEnEdicion {
  return { id: nuevoId(), nombre, diaSemana, ejercicios: [] }
}

/** Un ejercicio recién añadido: 3 series de 10 sin carga, para ajustar. */
export function ejercicioNuevo(
  nuevoId: NuevoId,
  ejercicio: { id: string; nombre: string },
): EjercicioEnEdicion {
  return {
    id: nuevoId(),
    ejercicioId: ejercicio.id,
    nombre: ejercicio.nombre,
    indicaciones: "",
    series: [0, 1, 2].map(() => ({
      id: nuevoId(),
      tipoMedicion: "repeticiones" as const,
      peso: "",
      valor: "10",
    })),
  }
}

function cambiarEjercicio(
  sesion: SesionEnEdicion,
  ejercicioId: string,
  cambio: (ejercicio: EjercicioEnEdicion) => EjercicioEnEdicion,
): SesionEnEdicion {
  return {
    ...sesion,
    ejercicios: sesion.ejercicios.map((e) => (e.id === ejercicioId ? cambio(e) : e)),
  }
}

export function anadirEjercicio(
  sesion: SesionEnEdicion,
  ejercicio: EjercicioEnEdicion,
): SesionEnEdicion {
  return { ...sesion, ejercicios: [...sesion.ejercicios, ejercicio] }
}

export function quitarEjercicio(sesion: SesionEnEdicion, ejercicioId: string): SesionEnEdicion {
  return { ...sesion, ejercicios: sesion.ejercicios.filter((e) => e.id !== ejercicioId) }
}

/** Sube (-1) o baja (+1) un ejercicio. En los extremos no hace nada. */
export function moverEjercicio(
  sesion: SesionEnEdicion,
  ejercicioId: string,
  sentido: -1 | 1,
): SesionEnEdicion {
  const desde = sesion.ejercicios.findIndex((e) => e.id === ejercicioId)
  const hasta = desde + sentido
  if (desde === -1 || hasta < 0 || hasta >= sesion.ejercicios.length) {
    return sesion
  }
  const ejercicios = [...sesion.ejercicios]
  const [movido] = ejercicios.splice(desde, 1)
  if (movido !== undefined) ejercicios.splice(hasta, 0, movido)
  return { ...sesion, ejercicios }
}

export function cambiarIndicaciones(
  sesion: SesionEnEdicion,
  ejercicioId: string,
  indicaciones: string,
): SesionEnEdicion {
  return cambiarEjercicio(sesion, ejercicioId, (e) => ({ ...e, indicaciones }))
}

/** Otra serie igual que la última, que es lo que se quiere casi siempre. */
export function anadirSerie(
  sesion: SesionEnEdicion,
  ejercicioId: string,
  nuevoId: NuevoId,
): SesionEnEdicion {
  return cambiarEjercicio(sesion, ejercicioId, (e) => {
    const ultima = e.series[e.series.length - 1]
    const serie: SerieEnEdicion =
      ultima === undefined
        ? { id: nuevoId(), tipoMedicion: "repeticiones", peso: "", valor: "10" }
        : { ...ultima, id: nuevoId() }
    return { ...e, series: [...e.series, serie] }
  })
}

export function quitarSerie(
  sesion: SesionEnEdicion,
  ejercicioId: string,
  serieId: string,
): SesionEnEdicion {
  return cambiarEjercicio(sesion, ejercicioId, (e) => ({
    ...e,
    series: e.series.filter((s) => s.id !== serieId),
  }))
}

export function cambiarSerie(
  sesion: SesionEnEdicion,
  ejercicioId: string,
  serieId: string,
  cambio: Partial<Omit<SerieEnEdicion, "id">>,
): SesionEnEdicion {
  return cambiarEjercicio(sesion, ejercicioId, (e) => ({
    ...e,
    series: e.series.map((s) => (s.id === serieId ? { ...s, ...cambio } : s)),
  }))
}

/**
 * Repetición o tiempo para todas las series del ejercicio: un ejercicio se
 * mide de una forma, y cambiarlo serie a serie sería un error esperando pasar.
 */
export function cambiarMedicion(
  sesion: SesionEnEdicion,
  ejercicioId: string,
  tipoMedicion: SeriePrescrita["tipoMedicion"],
): SesionEnEdicion {
  return cambiarEjercicio(sesion, ejercicioId, (e) => ({
    ...e,
    series: e.series.map((s) =>
      s.tipoMedicion === tipoMedicion
        ? s
        : { ...s, tipoMedicion, valor: tipoMedicion === "tiempo" ? "30" : "10" },
    ),
  }))
}

function serieEnEdicion(serie: SeriePrescrita, id: string): SerieEnEdicion {
  return {
    id,
    tipoMedicion: serie.tipoMedicion,
    peso: formatearNumero(serie.pesoKg),
    valor: String(serie.tipoMedicion === "repeticiones" ? serie.repeticiones : serie.segundos),
  }
}

/**
 * Una rutina guardada, lista para editar como plan nuevo. Con `nuevoId` se
 * copian con ids nuevos (cargar una rutina en un plan: copias independientes);
 * sin él se conservan (editar la propia rutina).
 */
export function desdePatron(
  patron: PatronRutina,
  nombres: ReadonlyMap<string, string>,
  nuevoId?: NuevoId,
): SesionEnEdicion[] {
  const id = (actual: string): string => (nuevoId === undefined ? actual : nuevoId())
  return patron.sesiones.map((sesion) => ({
    id: id(sesion.id),
    nombre: sesion.nombre,
    diaSemana: sesion.diaSemana,
    ejercicios: sesion.ejercicios.map((ejercicio) => ({
      id: id(ejercicio.id),
      ejercicioId: ejercicio.ejercicioId,
      nombre: nombres.get(ejercicio.ejercicioId) ?? "Ejercicio",
      indicaciones: ejercicio.indicaciones ?? "",
      series: ejercicio.series.map((serie) => serieEnEdicion(serie, id(serie.id))),
    })),
  }))
}

/** La prescripción de una sesión ya asignada, para ajustarla. Conserva los ids. */
export function desdePrescripcion(prescripcion: Prescripcion, diaSemana: number): SesionEnEdicion {
  return {
    id: "ajuste",
    nombre: prescripcion.nombre,
    diaSemana,
    ejercicios: prescripcion.ejercicios.map((ejercicio) => ({
      id: ejercicio.id,
      ejercicioId: ejercicio.ejercicioId,
      nombre: ejercicio.nombre,
      indicaciones: ejercicio.indicaciones ?? "",
      series: ejercicio.series.map((serie) => serieEnEdicion(serie, serie.id)),
    })),
  }
}

export type Lectura<T> = { ok: true; valor: T } | { ok: false; errores: string[] }

function leerEjercicios(sesion: SesionEnEdicion): Lectura<EjercicioEnRutina[]> {
  const errores: string[] = []
  const titulo = sesion.nombre.trim() === "" ? "La sesión" : `«${sesion.nombre.trim()}»`
  if (sesion.ejercicios.length === 0) {
    errores.push(`${titulo} no tiene ejercicios.`)
  }
  const ejercicios = sesion.ejercicios.map((ejercicio): EjercicioEnRutina => {
    if (ejercicio.series.length === 0) {
      errores.push(`${ejercicio.nombre}, en ${titulo}, no tiene series.`)
    }
    const series = ejercicio.series.map((serie, indice): SeriePrescrita => {
      const donde = `${ejercicio.nombre}, serie ${String(indice + 1)}`
      const peso = leerPeso(serie.peso)
      const valor = leerEntero(serie.valor, serie.tipoMedicion)
      if (!peso.ok) errores.push(`${donde}: ${peso.error}.`)
      if (!valor.ok) errores.push(`${donde}: ${valor.error}.`)
      else if (valor.valor === null) {
        errores.push(
          `${donde}: faltan las ${serie.tipoMedicion === "tiempo" ? "segundos" : "repeticiones"}.`,
        )
      }
      const pesoKg = peso.ok ? peso.valor : null
      const cantidad = valor.ok && valor.valor !== null ? valor.valor : 1
      return serie.tipoMedicion === "repeticiones"
        ? { id: serie.id, tipoMedicion: "repeticiones", pesoKg, repeticiones: cantidad }
        : { id: serie.id, tipoMedicion: "tiempo", pesoKg, segundos: cantidad }
    })
    const indicaciones = ejercicio.indicaciones.trim()
    return {
      id: ejercicio.id,
      ejercicioId: ejercicio.ejercicioId,
      indicaciones: indicaciones === "" ? null : indicaciones,
      series,
    }
  })
  return errores.length > 0 ? { ok: false, errores } : { ok: true, valor: ejercicios }
}

/** Las sesiones del editor como patrón semanal, o la lista de lo que falta. */
export function aPatron(sesiones: SesionEnEdicion[]): Lectura<PatronRutina> {
  const errores: string[] = []
  if (sesiones.length === 0) {
    errores.push("Añade al menos una sesión.")
  }
  const leidas: SesionEnRutina[] = []
  for (const sesion of sesiones) {
    if (sesion.nombre.trim() === "") {
      errores.push(
        `La sesión del ${DIAS_DE_LA_SEMANA[sesion.diaSemana - 1] ?? ""} no tiene nombre.`,
      )
    }
    const ejercicios = leerEjercicios(sesion)
    if (!ejercicios.ok) {
      errores.push(...ejercicios.errores)
      continue
    }
    leidas.push({
      id: sesion.id,
      nombre: sesion.nombre.trim(),
      diaSemana: sesion.diaSemana,
      ejercicios: ejercicios.valor,
    })
  }
  if (errores.length > 0) {
    return { ok: false, errores }
  }
  const patron = PatronRutinaSchema.safeParse({ sesiones: leidas })
  return patron.success
    ? { ok: true, valor: patron.data }
    : { ok: false, errores: patron.error.issues.map((i) => i.message) }
}

/** Una sesión del editor como ajuste de la prescripción (sin revisión). */
export function aAjuste(
  sesion: SesionEnEdicion,
): Lectura<{ nombre: string; ejercicios: EjercicioEnRutina[] }> {
  const errores: string[] = []
  if (sesion.nombre.trim() === "") errores.push("La sesión no tiene nombre.")
  const ejercicios = leerEjercicios(sesion)
  if (!ejercicios.ok) errores.push(...ejercicios.errores)
  if (errores.length > 0 || !ejercicios.ok) {
    return { ok: false, errores }
  }
  return { ok: true, valor: { nombre: sesion.nombre.trim(), ejercicios: ejercicios.valor } }
}
