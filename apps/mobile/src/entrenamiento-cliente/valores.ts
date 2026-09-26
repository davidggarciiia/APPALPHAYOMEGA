import type { Prescripcion, Registro, SeriePrescrita, SerieRegistrada } from "@alpha-omega/shared"

import type { EntradaSerie, Entradas } from "./copia-local"

/*
 * De lo que escribe la persona a lo que se registra.
 *
 * Reglas de SPEC-entrenamiento.md, «Registro por serie»:
 * - un campo vacío no es cero, y el objetivo tenue no es un valor;
 * - el peso admite decimales con coma o punto, y cero;
 * - repeticiones y segundos son enteros positivos;
 * - marcar «Hecha» exige reps o tiempo y, si la serie prescribe carga, el peso.
 */

const PESO_MAXIMO_KG = 1000
const REPETICIONES_MAXIMAS = 10000
const SEGUNDOS_MAXIMOS = 86400

export type Lectura = { ok: true; valor: number | null } | { ok: false; error: string }

/** «42,5» y «42.5» son 42,5. Vacío es «sin peso», no cero. */
export function leerPeso(texto: string): Lectura {
  const limpio = texto.trim().replace(",", ".")
  if (limpio === "") {
    return { ok: true, valor: null }
  }
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(limpio)) {
    return { ok: false, error: "Escribe el peso en kg, con hasta dos decimales" }
  }
  const valor = Number(limpio)
  if (valor > PESO_MAXIMO_KG) {
    return { ok: false, error: `El peso no puede pasar de ${String(PESO_MAXIMO_KG)} kg` }
  }
  return { ok: true, valor }
}

/** Repeticiones o segundos: entero positivo. Vacío es «sin registrar». */
export function leerEntero(texto: string, tipo: SeriePrescrita["tipoMedicion"]): Lectura {
  const limpio = texto.trim()
  if (limpio === "") {
    return { ok: true, valor: null }
  }
  const unidad = tipo === "repeticiones" ? "repeticiones" : "segundos"
  if (!/^\d+$/.test(limpio)) {
    return { ok: false, error: `Escribe las ${unidad} como un número entero` }
  }
  const valor = Number(limpio)
  const maximo = tipo === "repeticiones" ? REPETICIONES_MAXIMAS : SEGUNDOS_MAXIMOS
  if (valor < 1 || valor > maximo) {
    return { ok: false, error: `Las ${unidad} tienen que estar entre 1 y ${String(maximo)}` }
  }
  return { ok: true, valor }
}

export const ENTRADA_VACIA: EntradaSerie = { peso: "", valor: "", hecha: false }

/**
 * Por qué no se puede marcar esta serie como hecha, o `null` si sí se puede.
 */
export function motivoParaNoMarcar(serie: SeriePrescrita, entrada: EntradaSerie): string | null {
  const peso = leerPeso(entrada.peso)
  if (!peso.ok) {
    return peso.error
  }
  const valor = leerEntero(entrada.valor, serie.tipoMedicion)
  if (!valor.ok) {
    return valor.error
  }
  if (valor.valor === null) {
    return serie.tipoMedicion === "repeticiones"
      ? "Escribe las repeticiones que has hecho"
      : "Escribe los segundos que has hecho"
  }
  if (serie.pesoKg !== null && peso.valor === null) {
    return "Escribe el peso que has usado (puede ser 0)"
  }
  return null
}

/**
 * La serie tal como se guarda en el borrador.
 *
 * Un texto inválido se guarda como vacío, y una serie cuyos valores dejaron de
 * ser válidos después de marcarla cuenta como no hecha: el servidor nunca recibe
 * una serie «hecha» sin sus datos.
 */
export function serieRegistrada(serie: SeriePrescrita, entrada: EntradaSerie): SerieRegistrada {
  const peso = leerPeso(entrada.peso)
  const valor = leerEntero(entrada.valor, serie.tipoMedicion)
  const pesoKg = peso.ok ? peso.valor : null
  const numero = valor.ok ? valor.valor : null
  const hecha = entrada.hecha && motivoParaNoMarcar(serie, entrada) === null
  return serie.tipoMedicion === "repeticiones"
    ? { serieId: serie.id, tipoMedicion: "repeticiones", pesoKg, repeticiones: numero, hecha }
    : { serieId: serie.id, tipoMedicion: "tiempo", pesoKg, segundos: numero, hecha }
}

export function seriesDe(prescripcion: Prescripcion): SeriePrescrita[] {
  return prescripcion.ejercicios.flatMap((ejercicio) => ejercicio.series)
}

/** El registro completo de la sesión: una entrada por serie tocada. */
export function aRegistro(prescripcion: Prescripcion, entradas: Entradas, notas: string): Registro {
  const series = seriesDe(prescripcion).flatMap((serie) => {
    const entrada = entradas[serie.id]
    return entrada === undefined ? [] : [serieRegistrada(serie, entrada)]
  })
  const texto = notas.trim()
  return { series, notas: texto === "" ? null : texto }
}

/** Para enseñar un número guardado como lo escribiría una persona en España. */
export function formatearNumero(valor: number | null): string {
  return valor === null ? "" : String(valor).replace(".", ",")
}

/** Las entradas de pantalla a partir de un borrador del servidor. */
export function entradasDesdeRegistro(registro: Registro): Entradas {
  const entradas: Entradas = {}
  for (const serie of registro.series) {
    entradas[serie.serieId] = {
      peso: formatearNumero(serie.pesoKg),
      valor: formatearNumero(
        serie.tipoMedicion === "repeticiones" ? serie.repeticiones : serie.segundos,
      ),
      hecha: serie.hecha,
    }
  }
  return entradas
}

export type Recuento = { hechas: number; total: number }

export function recuento(prescripcion: Prescripcion, entradas: Entradas): Recuento {
  const series = seriesDe(prescripcion)
  const hechas = series.filter((serie) => {
    const entrada = entradas[serie.id]
    return entrada !== undefined && serieRegistrada(serie, entrada).hecha
  }).length
  return { hechas, total: series.length }
}
