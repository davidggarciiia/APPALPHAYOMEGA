import {
  limitesDeDefinicion,
  valorAdmisible,
  type CambiarValoracion,
  type DefinicionCorporal,
  type DefinicionPrueba,
  type DocumentoValoracion,
  type ResultadoCorporal,
  type ResultadoPrueba,
  type ValoracionProfesional,
} from "@alpha-omega/shared"

import { leerDecimal } from "./modelo"

/**
 * Edición de un borrador de valoración tal como la ve el formulario: textos con
 * coma decimal que se convierten en resultados del contrato solo al guardar.
 * Un texto vacío es «pendiente», nunca un cero.
 */
export type CampoCorporal = {
  texto: string
  noRealizado: boolean
  motivo: string
  /** Lecturas del plicómetro, en el orden en que se tomaron. Solo pliegues. */
  lecturas: string[]
}

export type CampoPrueba = {
  estado: "pendiente" | "registrado" | "noRealizado"
  /** Por clave de métrica. Vacío = no se recogió. */
  valores: Record<string, string>
  /** Sin elegir hasta que el entrenador lo indique: no se da por completo. */
  protocoloCompleto: boolean | null
  /** AAAA-MM-DD si se hizo otro día; vacío = el día de la visita. */
  fecha: string
  notas: string
  motivo: string
}

export type CampoGrasa = { texto: string; metodo: string; fecha: string }

export type EdicionValoracion = {
  fechaToma: string
  corporales: Record<string, CampoCorporal>
  pruebas: Record<string, CampoPrueba>
  grasa: CampoGrasa
  conclusion: string
  notasInternas: string
  destacados: string[]
}

export const CAMPO_CORPORAL_VACIO: CampoCorporal = {
  texto: "",
  noRealizado: false,
  motivo: "",
  lecturas: [],
}

export const CAMPO_PRUEBA_VACIO: CampoPrueba = {
  estado: "pendiente",
  valores: {},
  protocoloCompleto: null,
  fecha: "",
  notas: "",
  motivo: "",
}

/** «80,5»: el número como se escribe en español. */
export const decimal = (valor: number): string => String(valor).replace(".", ",")

function campoCorporal(r: ResultadoCorporal): CampoCorporal {
  const lecturas = r.estado === "noRealizado" ? [] : (r.lecturas ?? []).map(decimal)
  if (r.estado === "registrado")
    return { ...CAMPO_CORPORAL_VACIO, texto: decimal(r.valor), lecturas }
  if (r.estado === "noRealizado")
    return { ...CAMPO_CORPORAL_VACIO, noRealizado: true, motivo: r.motivo ?? "" }
  return { ...CAMPO_CORPORAL_VACIO, lecturas }
}

function campoPrueba(r: ResultadoPrueba): CampoPrueba {
  if (r.estado === "registrado")
    return {
      ...CAMPO_PRUEBA_VACIO,
      estado: "registrado",
      valores: Object.fromEntries(Object.entries(r.valores).map(([k, v]) => [k, decimal(v)])),
      protocoloCompleto: r.protocoloCompleto,
      fecha: r.fecha ?? "",
      notas: r.notas ?? "",
    }
  if (r.estado === "noRealizado")
    return { ...CAMPO_PRUEBA_VACIO, estado: "noRealizado", motivo: r.motivo ?? "" }
  return { ...CAMPO_PRUEBA_VACIO }
}

/** Lo editable de la visita, tal como lo confirmó el servidor. */
export function edicionDe(valoracion: ValoracionProfesional): EdicionValoracion {
  const borrador = valoracion.borrador!
  const d = borrador.documento
  return {
    fechaToma: borrador.fechaToma,
    corporales: Object.fromEntries(d.corporales.map((r) => [r.definicionId, campoCorporal(r)])),
    pruebas: Object.fromEntries(d.pruebas.map((r) => [r.definicionId, campoPrueba(r)])),
    grasa: d.grasaPorPliegues
      ? {
          texto: decimal(d.grasaPorPliegues.valorPct),
          metodo: d.grasaPorPliegues.metodo,
          fecha: d.grasaPorPliegues.fecha,
        }
      : { texto: "", metodo: "", fecha: "" },
    conclusion: d.conclusion ?? "",
    notasInternas: d.notasInternas ?? "",
    destacados: d.destacados,
  }
}

const esFecha = (texto: string): boolean =>
  /^\d{4}-\d{2}-\d{2}$/.test(texto) && !Number.isNaN(Date.parse(texto))
const textoONulo = (texto: string): string | null => (texto.trim() === "" ? null : texto.trim())

type Fallo = { error: string }

function leerNumero(texto: string, nombre: string): number | null | Fallo {
  const valor = leerDecimal(texto)
  if (valor === null) return null
  if (Number.isNaN(valor)) return { error: `${nombre}: escribe un número, por ejemplo 12,5.` }
  return Math.round(valor * 100) / 100
}

function corporal(d: DefinicionCorporal, campo: CampoCorporal): ResultadoCorporal | Fallo {
  if (campo.noRealizado)
    return { definicionId: d.id, estado: "noRealizado", motivo: textoONulo(campo.motivo) }
  const { min, max, ceroValido } = limitesDeDefinicion(d)
  const fuera = (v: number) => !valorAdmisible(d, v)
  const rango =
    !ceroValido && min === 0
      ? `mayor que 0 y hasta ${max} ${d.unidad}`
      : `entre ${min} y ${max} ${d.unidad}`
  const lecturas: number[] = []
  for (const texto of campo.lecturas) {
    const valor = leerNumero(texto, `${d.nombre}, lectura`)
    if (valor === null) continue
    if (typeof valor !== "number") return valor
    if (fuera(valor)) return { error: `${d.nombre}: cada lectura ${rango}.` }
    lecturas.push(valor)
  }
  const valor = leerNumero(campo.texto, d.nombre)
  if (valor !== null && typeof valor !== "number") return valor
  if (typeof valor === "number" && fuera(valor))
    return { error: `${d.nombre}: escribe un valor ${rango}.` }
  const conLecturas = lecturas.length > 0 ? { lecturas } : {}
  return valor === null
    ? { definicionId: d.id, estado: "pendiente", ...conLecturas }
    : { definicionId: d.id, estado: "registrado", valor, ...conLecturas }
}

function prueba(d: DefinicionPrueba, campo: CampoPrueba): ResultadoPrueba | Fallo {
  if (campo.estado === "pendiente") return { definicionId: d.id, estado: "pendiente" }
  if (campo.estado === "noRealizado")
    return { definicionId: d.id, estado: "noRealizado", motivo: textoONulo(campo.motivo) }
  const valores: Record<string, number> = {}
  for (const m of d.metricas) {
    const valor = leerNumero(campo.valores[m.clave] ?? "", `${d.nombre}, ${m.nombre}`)
    if (valor === null) {
      if (!m.opcional) return { error: `${d.nombre}: falta ${m.nombre.toLowerCase()}.` }
      continue
    }
    if (typeof valor !== "number") return valor
    valores[m.clave] = valor
  }
  if (campo.protocoloCompleto === null)
    return { error: `${d.nombre}: indica si se completó el protocolo.` }
  if (campo.fecha.trim() !== "" && !esFecha(campo.fecha.trim()))
    return { error: `${d.nombre}: escribe la fecha como AAAA-MM-DD.` }
  return {
    definicionId: d.id,
    estado: "registrado",
    valores,
    protocoloCompleto: campo.protocoloCompleto,
    fecha: textoONulo(campo.fecha),
    notas: textoONulo(campo.notas),
  }
}

/**
 * Convierte la edición en el cambio que se envía, validando unidades y rangos
 * antes de llamar al servidor. Conserva el resultado guardado de cualquier
 * definición que el formulario no muestre.
 */
export function cambioDe(
  valoracion: ValoracionProfesional,
  edicion: EdicionValoracion,
): CambiarValoracion | Fallo {
  if (!esFecha(edicion.fechaToma)) return { error: "Escribe la fecha de toma como AAAA-MM-DD." }
  const borrador = valoracion.borrador!
  const documento: DocumentoValoracion = borrador.documento
  const defsCorporales = new Map(documento.definiciones.corporales.map((d) => [d.id, d]))
  const defsPruebas = new Map(documento.definiciones.pruebas.map((d) => [d.id, d]))

  const corporales: ResultadoCorporal[] = []
  for (const r of documento.corporales) {
    const d = defsCorporales.get(r.definicionId)
    const campo = edicion.corporales[r.definicionId]
    if (!d || !campo) {
      corporales.push(r)
      continue
    }
    const resultado = corporal(d, campo)
    if ("error" in resultado) return resultado
    corporales.push(resultado)
  }
  const pruebas: ResultadoPrueba[] = []
  for (const r of documento.pruebas) {
    const d = defsPruebas.get(r.definicionId)
    const campo = edicion.pruebas[r.definicionId]
    if (!d || !campo) {
      pruebas.push(r)
      continue
    }
    const resultado = prueba(d, campo)
    if ("error" in resultado) return resultado
    pruebas.push(resultado)
  }

  let grasaPorPliegues: DocumentoValoracion["grasaPorPliegues"] = null
  const { grasa } = edicion
  if ([grasa.texto, grasa.metodo, grasa.fecha].some((t) => t.trim() !== "")) {
    const valor = leerNumero(grasa.texto, "Grasa por pliegues")
    if (valor === null || typeof valor !== "number" || valor <= 0 || valor > 100)
      return { error: "Grasa por pliegues: un porcentaje mayor que 0 y hasta 100." }
    if (grasa.metodo.trim() === "")
      return { error: "Grasa por pliegues: indica el método con el que la calculaste." }
    if (!esFecha(grasa.fecha.trim()))
      return { error: "Grasa por pliegues: escribe la fecha como AAAA-MM-DD." }
    grasaPorPliegues = { valorPct: valor, metodo: grasa.metodo.trim(), fecha: grasa.fecha.trim() }
  }

  return {
    borradorId: borrador.id,
    revision: borrador.revision,
    fechaToma: edicion.fechaToma,
    contenido: {
      bloques: documento.bloques,
      corporales,
      pruebas,
      grasaPorPliegues,
      destacados: edicion.destacados,
      conclusion: textoONulo(edicion.conclusion),
      notasInternas: textoONulo(edicion.notasInternas),
    },
  }
}
