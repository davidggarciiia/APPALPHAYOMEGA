import type { DefinicionCorporal, ResultadoCorporal } from "./valoraciones"

/**
 * Referencias de las ecuaciones (mm, años cumplidos, densidad en g/ml):
 * - Jackson & Pollock (1978), tabla 4, ecuaciones 1 y 5; hombres 18–61 años.
 *   https://doi.org/10.1079/BJN19780152
 *   Reimpresión del original: https://www.kinantropo.org/_files/ugd/af7497_d8d71d5067184e93a90ae954a74c5c18.pdf
 * - Jackson, Pollock & Ward (1980), mujeres 18–55 años, PMID 7402053.
 *   https://pubmed.ncbi.nlm.nih.gov/7402053/
 *   Coeficientes reproducidos en Temple et al. (2014), tabla 1 (estudio original de validación):
 *   https://pmc.ncbi.nlm.nih.gov/articles/PMC10271096/
 * - Durnin & Womersley (1974), tablas 1 y 5: hombres 17–72, mujeres 16–68 años.
 *   D = c − m·log10(Σ4). No se añaden las ecuaciones juveniles de otros trabajos.
 *   https://doi.org/10.1079/BJN19740060
 * - Siri: % = 495/D − 450, como en los originales JP (tabla 1) y DW (p. 79).
 * - Faulkner clásica: % = 0.153·Σ4 + 5.783, sin conversión por densidad.
 *   Aplicación y fórmula explícita en Knechtle et al. (2011), estudio de atletas varones:
 *   https://scielo.isciii.es/scielo.php?script=sci_arttext&pid=S0212-16112011000600032
 *
 * Son estimaciones dependientes de la población y de la técnica de medición. Faulkner no
 * incorpora edad ni sexo; eso no demuestra validez universal. Aquí no se aplica una supuesta
 * variante femenina ni se equiparan supraespinal y suprailíaco. Cada protocolo exige que
 * el profesional haya medido sus sitios anatómicos conforme a su técnica original.
 * Los límites individuales de mm son los del contrato existente. La guarda del vértice JP
 * es matemática; no declara que todo el tramo restante esté validado empíricamente.
 * Sobre la extrapolación de ese polinomio: https://pmc.ncbi.nlm.nih.gov/articles/PMC2891061/
 */
export const PROTOCOLOS_GRASA_POR_PLIEGUES = [
  {
    id: "jacksonPollock3",
    nombre: "Jackson-Pollock 3 pliegues",
    requiereEdad: true,
    requiereSexo: true,
  },
  {
    id: "jacksonPollock7",
    nombre: "Jackson-Pollock 7 pliegues",
    requiereEdad: true,
    requiereSexo: true,
  },
  {
    id: "durninWomersley4",
    nombre: "Durnin-Womersley 4 pliegues",
    requiereEdad: true,
    requiereSexo: true,
  },
  { id: "faulkner4", nombre: "Faulkner 4 pliegues", requiereEdad: false, requiereSexo: false },
] as const
export type ProtocoloGrasaPorPliegues = (typeof PROTOCOLOS_GRASA_POR_PLIEGUES)[number]["id"]
export type SexoCalculoPliegues = "hombre" | "mujer"

const PUNTOS = {
  pectoral: { nombre: "Pectoral", alias: ["pectoral", "pecho", "toracico"] },
  axilarMedia: {
    nombre: "Axilar media",
    alias: ["axilar media", "axilar medio", "medio axilar", "midaxilar", "axilar"],
  },
  tricipital: { nombre: "Tricipital", alias: ["tricipital", "triceps", "tricep"] },
  subescapular: { nombre: "Subescapular", alias: ["subescapular"] },
  abdominal: { nombre: "Abdominal", alias: ["abdominal", "abdomen"] },
  suprailiaco: {
    nombre: "Suprailíaco",
    alias: ["suprailiaco", "suprailiaca", "supra iliaco", "supra iliaca"],
  },
  musloAnterior: {
    nombre: "Muslo anterior",
    alias: ["muslo anterior", "muslo frontal", "anterior del muslo", "muslo medio", "muslo"],
  },
  bicipital: { nombre: "Bicipital", alias: ["bicipital", "biceps"] },
} as const
export type PuntoPliegue = keyof typeof PUNTOS

export type EntradaCalculoGrasaPorPliegues = {
  protocolo: ProtocoloGrasaPorPliegues
  sexo?: SexoCalculoPliegues | null
  edad?: number | null
  definiciones: readonly DefinicionCorporal[]
  corporales: readonly ResultadoCorporal[]
}
export type ResultadoCalculoGrasaPorPliegues =
  | { ok: true; valorPct: number; metodo: string; sumaMm: number; densidad: number | null }
  | { ok: false; problemas: string[]; faltantes: PuntoPliegue[]; ambiguos: PuntoPliegue[] }

const SIETE: readonly PuntoPliegue[] = [
  "pectoral",
  "axilarMedia",
  "tricipital",
  "subescapular",
  "abdominal",
  "suprailiaco",
  "musloAnterior",
]
const DW: readonly PuntoPliegue[] = ["bicipital", "tricipital", "subescapular", "suprailiaco"]
const FAULKNER: readonly PuntoPliegue[] = ["tricipital", "subescapular", "suprailiaco", "abdominal"]

// Los límites de edad son los observados por sexo en los estudios, no una extensión «50+».
const TABLA_DW = {
  hombre: [
    { hasta: 19, c: 1.162, m: 0.063 },
    { hasta: 29, c: 1.1631, m: 0.0632 },
    { hasta: 39, c: 1.1422, m: 0.0544 },
    { hasta: 49, c: 1.162, m: 0.07 },
    { hasta: 72, c: 1.1715, m: 0.0779 },
  ],
  mujer: [
    { hasta: 19, c: 1.1549, m: 0.0678 },
    { hasta: 29, c: 1.1599, m: 0.0717 },
    { hasta: 39, c: 1.1423, m: 0.0632 },
    { hasta: 49, c: 1.1333, m: 0.0612 },
    { hasta: 68, c: 1.1339, m: 0.0645 },
  ],
} as const
const COEFICIENTES_JP = {
  jacksonPollock3: {
    hombre: { c: 1.10938, b: 0.0008267, q: 0.0000016, a: 0.0002574 },
    mujer: { c: 1.0994921, b: 0.0009929, q: 0.0000023, a: 0.0001392 },
  },
  jacksonPollock7: {
    hombre: { c: 1.112, b: 0.00043499, q: 0.00000055, a: 0.00028826 },
    mujer: { c: 1.097, b: 0.00046971, q: 0.00000056, a: 0.00012828 },
  },
} as const

function reconocerPunto(texto: string | null): PuntoPliegue | undefined {
  const nombre = (texto ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\(mm\)/g, "")
    .replace(/^pliegue\s+(?:(?:de la|del|de)\s+)?/, "")
    .replace(/\s+(?:derech[oa]|izquierd[oa])$/, "")
    .replace(/\s+/g, " ")
    .trim()
  return (Object.keys(PUNTOS) as PuntoPliegue[]).find((p) =>
    (PUNTOS[p].alias as readonly string[]).includes(nombre),
  )
}

/** Usa exclusivamente valores adoptados, sin promediar lecturas ni elegir campos duplicados. */
export function calcularGrasaPorPliegues(
  entrada: EntradaCalculoGrasaPorPliegues,
): ResultadoCalculoGrasaPorPliegues {
  const { protocolo, sexo, edad, definiciones, corporales } = entrada
  const problemas: string[] = []
  const faltantes: PuntoPliegue[] = []
  const ambiguos: PuntoPliegue[] = []
  const fallo = (): ResultadoCalculoGrasaPorPliegues => ({
    ok: false,
    problemas,
    faltantes,
    ambiguos,
  })
  const opcion = PROTOCOLOS_GRASA_POR_PLIEGUES.find((p) => p.id === protocolo)
  if (!opcion) {
    problemas.push("Elige un protocolo de pliegues disponible.")
    return fallo()
  }
  const sexoValido = sexo === "hombre" || sexo === "mujer"
  if (opcion.requiereSexo && !sexoValido) problemas.push("Elige el sexo para este protocolo.")
  const edadValida = typeof edad === "number" && Number.isInteger(edad) && edad >= 0
  if (opcion.requiereEdad && !edadValida)
    problemas.push("Indica una edad válida en años cumplidos.")
  if (opcion.requiereEdad && sexoValido && edadValida) {
    const [min, max] =
      protocolo === "durninWomersley4"
        ? sexo === "hombre"
          ? [17, 72]
          : [16, 68]
        : sexo === "hombre"
          ? [18, 61]
          : [18, 55]
    if (edad < min! || edad > max!)
      problemas.push(`Edad fuera del rango de este protocolo: ${min}–${max} años.`)
  }
  if (problemas.length) return fallo()

  const necesarios: readonly PuntoPliegue[] =
    protocolo === "faulkner4"
      ? FAULKNER
      : protocolo === "durninWomersley4"
        ? DW
        : protocolo === "jacksonPollock7"
          ? SIETE
          : sexo === "hombre"
            ? ["pectoral", "abdominal", "musloAnterior"]
            : ["tricipital", "suprailiaco", "musloAnterior"]
  const candidatos = new Map<PuntoPliegue, DefinicionCorporal[]>()
  for (const d of definiciones) {
    if (d.bloque !== "pliegues" || d.magnitud !== "pliegue" || d.unidad !== "mm") continue
    const puntos = [...new Set([reconocerPunto(d.nombre), reconocerPunto(d.zona)])].filter(
      (p): p is PuntoPliegue => p !== undefined,
    )
    if (puntos.length > 1 && puntos.some((p) => necesarios.includes(p))) {
      problemas.push(`«${d.nombre}»: el nombre y la zona indican puntos distintos.`)
      for (const p of puntos) if (necesarios.includes(p) && !ambiguos.includes(p)) ambiguos.push(p)
    }
    for (const p of puntos) candidatos.set(p, [...(candidatos.get(p) ?? []), d])
  }

  let sumaMm = 0
  for (const punto of necesarios) {
    const campos = candidatos.get(punto) ?? []
    const nombre = PUNTOS[punto].nombre
    if (campos.length > 1) {
      if (!ambiguos.includes(punto)) ambiguos.push(punto)
      problemas.push(
        `${nombre}: hay varios campos de plantilla para este punto; aclara cuál corresponde.`,
      )
      continue
    }
    const campo = campos[0]
    const resultados = campo ? corporales.filter((r) => r.definicionId === campo.id) : []
    if (resultados.length > 1) {
      if (!ambiguos.includes(punto)) ambiguos.push(punto)
      problemas.push(`${nombre}: hay resultados duplicados para este campo.`)
      continue
    }
    const resultado = resultados[0]
    if (!resultado || resultado.estado !== "registrado") {
      faltantes.push(punto)
      problemas.push(`Falta el valor adoptado de ${nombre.toLowerCase()}.`)
    } else if (!Number.isFinite(resultado.valor) || resultado.valor <= 0 || resultado.valor > 100) {
      problemas.push(`${nombre}: indica un pliegue mayor que 0 y hasta 100 mm.`)
    } else {
      sumaMm += resultado.valor
    }
  }
  if (problemas.length) return fallo()

  let densidad: number | null = null
  let valorPct: number
  if (protocolo === "faulkner4") {
    valorPct = 0.153 * sumaMm + 5.783
  } else if (protocolo === "durninWomersley4") {
    // Edad y sexo se comprobaron antes de buscar esta fila de la tabla original.
    const fila = TABLA_DW[sexo as SexoCalculoPliegues].find((f) => edad! <= f.hasta)!
    densidad = fila.c - fila.m * Math.log10(sumaMm)
    valorPct = 495 / densidad - 450
  } else {
    const { c, b, q, a } = COEFICIENTES_JP[protocolo][sexo as SexoCalculoPliegues]
    // Fuera del vértice, el polinomio invertiría el efecto de aumentar los pliegues.
    if (sumaMm >= b / (2 * q)) {
      problemas.push("La suma de pliegues queda fuera del dominio útil de esta ecuación.")
      return fallo()
    }
    densidad = c - b * sumaMm + q * sumaMm ** 2 - a * edad!
    valorPct = 495 / densidad - 450
  }
  valorPct = Number(valorPct.toFixed(2))
  if (
    (densidad !== null && (!Number.isFinite(densidad) || densidad <= 0)) ||
    !Number.isFinite(valorPct) ||
    valorPct <= 0 ||
    valorPct > 100
  ) {
    problemas.push(
      "Los datos producen un porcentaje fuera de rango; revisa el protocolo y las medidas.",
    )
    return fallo()
  }
  const metodo =
    protocolo === "faulkner4"
      ? "Faulkner 4"
      : protocolo === "durninWomersley4"
        ? "Durnin-Womersley 4 · Siri"
        : protocolo === "jacksonPollock7"
          ? "Jackson-Pollock 7 · Siri"
          : "Jackson-Pollock 3 · Siri"
  return { ok: true, valorPct, metodo, sumaMm, densidad }
}
