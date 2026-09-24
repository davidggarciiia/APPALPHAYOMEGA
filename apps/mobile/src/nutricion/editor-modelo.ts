import {
  DocumentoDietaSchema,
  type Alimento,
  type Comida,
  type DocumentoDieta,
  type Macros,
  type TipoDeDia,
} from "@alpha-omega/shared"

/**
 * Estado del editor de dietas: lo que el profesional escribe, como texto, y su
 * conversión al contrato. Funciones puras y sin React, para probarlas aparte.
 */

export type GeneradorDeIds = () => string

const CLAVES_MACROS = ["kcal", "proteinaG", "hidratosG", "grasaG"] as const
type ClaveMacro = (typeof CLAVES_MACROS)[number]
export type MacrosEditables = Record<ClaveMacro, string>
export type AlimentoEditable = { clave: string; nombre: string; cantidad: string }
export type AlternativaEditable = {
  id: string
  titulo: string
  alimentos: AlimentoEditable[]
  nota: string
  macros: MacrosEditables
}
export type GrupoEditable = { clave: string; nombre: string; alternativas: AlternativaEditable[] }
export type ColumnaEditable = { clave: string; nombre: string; alimentos: AlimentoEditable[] }
export type FormaDeComida = Comida["forma"]
/** Guarda las dos formas: cambiar de una a otra no pierde lo escrito hasta guardar. */
export type ComidaEditable = {
  id: string
  nombre: string
  hora: string
  indicacion: string
  forma: FormaDeComida
  grupos: GrupoEditable[]
  columnas: ColumnaEditable[]
}
export type TipoEditable = {
  id: string
  nombre: string
  objetivo: MacrosEditables
  comidas: ComidaEditable[]
}
export type IndicacionEditable = { clave: string; titulo: string; texto: string }
export type DietaEditable = {
  nombre: string
  tipos: TipoEditable[]
  /** De lunes a domingo; `null` mientras un día no tenga tipo asignado. */
  semana: (string | null)[]
  indicaciones: IndicacionEditable[]
}

export const DIAS_SEMANA = [
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
  "domingo",
] as const

export const macrosVacios = (): MacrosEditables => ({
  kcal: "",
  proteinaG: "",
  hidratosG: "",
  grasaG: "",
})
export const nuevoAlimento = (ids: GeneradorDeIds): AlimentoEditable => ({
  clave: ids(),
  nombre: "",
  cantidad: "",
})
export const nuevaAlternativa = (ids: GeneradorDeIds): AlternativaEditable => ({
  id: ids(),
  titulo: "",
  alimentos: [nuevoAlimento(ids)],
  nota: "",
  macros: macrosVacios(),
})
export const nuevoGrupo = (ids: GeneradorDeIds): GrupoEditable => ({
  clave: ids(),
  nombre: "",
  alternativas: [nuevaAlternativa(ids)],
})
export const nuevaColumna = (ids: GeneradorDeIds, nombre = ""): ColumnaEditable => ({
  clave: ids(),
  nombre,
  alimentos: [nuevoAlimento(ids)],
})
export const nuevaComida = (
  ids: GeneradorDeIds,
  forma: FormaDeComida,
  nombre = "",
): ComidaEditable => ({
  id: ids(),
  nombre,
  hora: "",
  indicacion: "",
  forma,
  grupos: [nuevoGrupo(ids)],
  columnas: ["Hidratos de carbono", "Proteína", "Grasas"].map((nombre) =>
    nuevaColumna(ids, nombre),
  ),
})

/** La siguiente comida habitual ofrece una forma inicial; cada comida puede cambiarse después. */
export function siguienteComida(ids: GeneradorDeIds, comidas: ComidaEditable[]): ComidaEditable {
  const habituales = ["Desayuno", "Media mañana", "Comida", "Merienda", "Cena"]
  const nombre =
    habituales.find(
      (candidata) =>
        !comidas.some((comida) => comida.nombre.toLowerCase() === candidata.toLowerCase()),
    ) ?? ""
  return nuevaComida(
    ids,
    nombre === "Comida" || nombre === "Cena" ? "intercambio" : "alternativas",
    nombre,
  )
}
export const nuevoTipo = (ids: GeneradorDeIds, nombre = ""): TipoEditable => ({
  id: ids(),
  nombre,
  objetivo: macrosVacios(),
  comidas: [],
})

export function nuevaDieta(ids: GeneradorDeIds): DietaEditable {
  const tipo = nuevoTipo(ids, "Todos los días")
  return {
    nombre: "",
    tipos: [tipo],
    semana: Array.from({ length: 7 }, () => tipo.id),
    indicaciones: [],
  }
}

// ---------- Desde el contrato ----------

const texto = (valor: string | null): string => valor ?? ""
const numeroATexto = (valor: number | null): string => (valor === null ? "" : String(valor))
const macrosEditables = (macros: Macros | null): MacrosEditables =>
  macros === null
    ? macrosVacios()
    : {
        kcal: numeroATexto(macros.kcal),
        proteinaG: numeroATexto(macros.proteinaG),
        hidratosG: numeroATexto(macros.hidratosG),
        grasaG: numeroATexto(macros.grasaG),
      }
const alimentosEditables = (alimentos: Alimento[], ids: GeneradorDeIds): AlimentoEditable[] =>
  alimentos.map((a) => ({ clave: ids(), nombre: a.nombre, cantidad: texto(a.cantidad) }))

function comidaEditable(comida: Comida, ids: GeneradorDeIds): ComidaEditable {
  const vacia = nuevaComida(ids, comida.forma)
  return {
    ...vacia,
    id: comida.id,
    nombre: comida.nombre,
    hora: texto(comida.hora),
    indicacion: texto(comida.indicacion),
    ...(comida.forma === "alternativas"
      ? {
          grupos: comida.grupos.map((grupo) => ({
            clave: ids(),
            nombre: texto(grupo.nombre),
            alternativas: grupo.alternativas.map((a) => ({
              id: a.id,
              titulo: a.titulo,
              alimentos: alimentosEditables(a.alimentos, ids),
              nota: texto(a.nota),
              macros: macrosEditables(a.macros),
            })),
          })),
        }
      : {
          columnas: comida.columnas.map((columna) => ({
            clave: ids(),
            nombre: columna.nombre,
            alimentos: alimentosEditables(columna.alimentos, ids),
          })),
        }),
  }
}

export function desdeDocumento(documento: DocumentoDieta, ids: GeneradorDeIds): DietaEditable {
  return {
    nombre: documento.nombre,
    tipos: documento.tiposDeDia.map((tipo: TipoDeDia) => ({
      id: tipo.id,
      nombre: tipo.nombre,
      objetivo: macrosEditables(tipo.objetivo),
      comidas: tipo.comidas.map((comida) => comidaEditable(comida, ids)),
    })),
    semana: [...documento.semana],
    indicaciones: documento.indicaciones.map((i) => ({
      clave: ids(),
      titulo: i.titulo,
      texto: i.texto,
    })),
  }
}

// ---------- Operaciones ----------

/** Copia con identificadores nuevos: el contrato no admite ids repetidos. */
export function copiarAlternativa(
  a: AlternativaEditable,
  ids: GeneradorDeIds,
): AlternativaEditable {
  return { ...a, id: ids(), alimentos: a.alimentos.map((x) => ({ ...x, clave: ids() })) }
}
export function copiarComida(c: ComidaEditable, ids: GeneradorDeIds): ComidaEditable {
  return {
    ...c,
    id: ids(),
    grupos: c.grupos.map((g) => ({
      ...g,
      clave: ids(),
      alternativas: g.alternativas.map((a) => copiarAlternativa(a, ids)),
    })),
    columnas: c.columnas.map((col) => ({
      ...col,
      clave: ids(),
      alimentos: col.alimentos.map((x) => ({ ...x, clave: ids() })),
    })),
  }
}

export function duplicarTipo(d: DietaEditable, tipoId: string, ids: GeneradorDeIds): DietaEditable {
  const original = d.tipos.find((t) => t.id === tipoId)
  if (original === undefined || d.tipos.length >= 7) return d
  const copia: TipoEditable = {
    ...original,
    id: ids(),
    nombre: `${original.nombre} (copia)`.slice(0, 40),
    comidas: original.comidas.map((c) => copiarComida(c, ids)),
  }
  return { ...d, tipos: [...d.tipos, copia] }
}

/** Quitar un tipo deja sin asignar los días que lo usaban: hay que reasignarlos. */
export function quitarTipo(d: DietaEditable, tipoId: string): DietaEditable {
  if (d.tipos.length <= 1) return d
  return {
    ...d,
    tipos: d.tipos.filter((t) => t.id !== tipoId),
    semana: d.semana.map((id) => (id === tipoId ? null : id)),
  }
}

export function cambiarTipo(
  d: DietaEditable,
  tipoId: string,
  cambio: (tipo: TipoEditable) => TipoEditable,
): DietaEditable {
  return { ...d, tipos: d.tipos.map((t) => (t.id === tipoId ? cambio(t) : t)) }
}

export function mover<T>(lista: T[], indice: number, desplazamiento: number): T[] {
  const destino = indice + desplazamiento
  if (destino < 0 || destino >= lista.length) return lista
  const copia = [...lista]
  const [elemento] = copia.splice(indice, 1)
  if (elemento === undefined) return lista
  copia.splice(destino, 0, elemento)
  return copia
}

// ---------- Hacia el contrato ----------

export type Conversion =
  { documento: DocumentoDieta; errores: [] } | { documento: null; errores: string[] }

/** Enteros; admite «2.100» como separador de miles. Nunca convierte lo inválido en 0. */
function entero(valor: string, etiqueta: string, errores: string[]): number | null {
  const limpio = valor.trim().replace(/\s/g, "")
  if (limpio === "") return null
  const sinMiles = /^\d{1,3}(\.\d{3})+$/.test(limpio) ? limpio.replace(/\./g, "") : limpio
  if (!/^\d+$/.test(sinMiles)) {
    errores.push(`${etiqueta}: escribe un número entero, sin decimales.`)
    return null
  }
  return Number(sinMiles)
}

function macros(valor: MacrosEditables, etiqueta: string, errores: string[]): Macros {
  const nombres: Record<ClaveMacro, string> = {
    kcal: "kcal",
    proteinaG: "proteína",
    hidratosG: "hidratos",
    grasaG: "grasas",
  }
  const resultado = {} as Macros
  for (const clave of CLAVES_MACROS) {
    resultado[clave] = entero(valor[clave], `${etiqueta}, ${nombres[clave]}`, errores)
  }
  return resultado
}

const hayNumero = (m: Macros): boolean => Object.values(m).some((v) => v !== null)
const opcional = (valor: string): string | null => (valor.trim() === "" ? null : valor.trim())

/** Las filas de alimento totalmente vacías se ignoran; una cantidad sin nombre es un error. */
function alimentos(lista: AlimentoEditable[], etiqueta: string, errores: string[]): Alimento[] {
  const resultado: Alimento[] = []
  for (const a of lista) {
    if (a.nombre.trim() === "" && a.cantidad.trim() === "") continue
    if (a.nombre.trim() === "") {
      errores.push(`${etiqueta}: hay una cantidad sin alimento.`)
      continue
    }
    resultado.push({ nombre: a.nombre.trim(), cantidad: opcional(a.cantidad) })
  }
  if (resultado.length === 0) errores.push(`${etiqueta}: añade al menos un alimento.`)
  return resultado
}

function comida(c: ComidaEditable, etiquetaTipo: string, errores: string[]): Comida {
  const etiqueta = `${etiquetaTipo} · ${c.nombre.trim() || "comida sin nombre"}`
  if (c.nombre.trim() === "") errores.push(`${etiquetaTipo}: pon nombre a cada comida.`)
  if (c.hora.trim() !== "" && !/^([01]\d|2[0-3]):[0-5]\d$/.test(c.hora.trim())) {
    errores.push(`${etiqueta}: escribe la hora como HH:MM, por ejemplo 08:30.`)
  }
  const base = {
    id: c.id,
    nombre: c.nombre.trim(),
    hora: opcional(c.hora),
    indicacion: opcional(c.indicacion),
  }
  if (c.forma === "intercambio") {
    return {
      ...base,
      forma: "intercambio",
      columnas: c.columnas.map((col) => {
        if (col.nombre.trim() === "") errores.push(`${etiqueta}: pon nombre a cada columna.`)
        return {
          nombre: col.nombre.trim(),
          alimentos: alimentos(
            col.alimentos,
            `${etiqueta} · ${col.nombre.trim() || "columna"}`,
            errores,
          ),
        }
      }),
    }
  }
  return {
    ...base,
    forma: "alternativas",
    grupos: c.grupos.map((g) => ({
      nombre: opcional(g.nombre),
      alternativas: g.alternativas.map((a) => {
        const nombreAlternativa = a.titulo.trim() || "alternativa sin título"
        if (a.titulo.trim() === "") errores.push(`${etiqueta}: pon título a cada alternativa.`)
        const cifras = macros(a.macros, `${etiqueta} · ${nombreAlternativa}`, errores)
        return {
          id: a.id,
          titulo: a.titulo.trim(),
          alimentos: alimentos(a.alimentos, `${etiqueta} · ${nombreAlternativa}`, errores),
          nota: opcional(a.nota),
          macros: hayNumero(cifras) ? cifras : null,
        }
      }),
    })),
  }
}

export function convertir(d: DietaEditable): Conversion {
  const errores: string[] = []
  if (d.nombre.trim() === "") errores.push("Pon un nombre a la dieta.")
  const tiposDeDia = d.tipos.map((t) => {
    const etiqueta = t.nombre.trim() || "Tipo de día sin nombre"
    if (t.nombre.trim() === "") errores.push("Pon nombre a cada tipo de día.")
    const objetivo = macros(t.objetivo, `${etiqueta}, objetivo`, errores)
    if (t.comidas.length === 0 && !hayNumero(objetivo)) {
      errores.push(`${etiqueta}: añade una comida o algún número del objetivo.`)
    }
    return {
      id: t.id,
      nombre: t.nombre.trim(),
      objetivo: hayNumero(objetivo) ? objetivo : null,
      comidas: t.comidas.map((c) => comida(c, etiqueta, errores)),
    }
  })
  d.semana.forEach((id, n) => {
    if (id === null || !d.tipos.some((t) => t.id === id)) {
      errores.push(`Asigna un tipo de día al ${DIAS_SEMANA[n]}.`)
    }
  })
  const indicaciones = d.indicaciones
    .filter((i) => i.titulo.trim() !== "" || i.texto.trim() !== "")
    .map((i) => {
      if (i.titulo.trim() === "" || i.texto.trim() === "") {
        errores.push("Cada indicación necesita título y texto.")
      }
      return { titulo: i.titulo.trim(), texto: i.texto.trim() }
    })
  if (errores.length > 0) return { documento: null, errores: [...new Set(errores)] }

  const resultado = DocumentoDietaSchema.safeParse({
    formato: 1,
    nombre: d.nombre.trim(),
    tiposDeDia,
    semana: d.semana,
    indicaciones,
  })
  if (!resultado.success) {
    // Límites de longitud o de cantidad que el formulario no ha podido anticipar.
    return {
      documento: null,
      errores: [...new Set(resultado.error.issues.map((i) => `Revisa la dieta: ${i.message}`))],
    }
  }
  return { documento: resultado.data, errores: [] }
}
