import type {
  Comida,
  ComidaRegistrada,
  DiaDeSeguimiento,
  DocumentoDieta,
  Macros,
  Suplemento,
  TipoDeDia,
} from "@alpha-omega/shared"

/** El tipo de día que toca en esa fecha de calendario. */
export function tipoDelDia(documento: DocumentoDieta, fecha: string): TipoDeDia | undefined {
  const indice = (new Date(`${fecha}T00:00:00Z`).getUTCDay() + 6) % 7
  return documento.tiposDeDia.find((t) => t.id === documento.semana[indice])
}

/**
 * La comida de «Ahora»: la última cuya hora ya ha llegado y aún no está hecha;
 * si ninguna tiene hora, la primera sin hacer.
 */
export function comidaDeAhora(
  comidas: Comida[],
  hechas: ReadonlySet<string>,
  hora: string,
): string | null {
  const pendientes = comidas.filter((c) => !hechas.has(c.id))
  if (pendientes.length === 0) return null
  const conHora = pendientes.filter((c) => c.hora !== null)
  if (conHora.length === 0) return pendientes[0]!.id
  const llegadas = conHora.filter((c) => c.hora! <= hora)
  return (llegadas[llegadas.length - 1] ?? conHora[0])!.id
}

/** Bajo el nombre de la comida: lo elegido o qué hay que hacer. */
export function subtituloDeComida(
  comida: Comida,
  registrada: ComidaRegistrada | undefined,
): string {
  const eleccion = registrada?.eleccion
  if (eleccion?.tipo === "alternativa" && comida.forma === "alternativas") {
    const elegida = comida.grupos
      .flatMap((g) => g.alternativas)
      .find((a) => a.id === eleccion.alternativaId)
    if (elegida) return elegida.titulo
  }
  if (eleccion?.tipo === "plato") return eleccion.elegidos.map((e) => e.alimento).join(" · ")
  if (eleccion?.tipo === "hecha") return "Hecha"
  if (comida.forma === "intercambio") return "Elige tu plato"
  const opciones = comida.grupos.flatMap((g) => g.alternativas)
  return opciones.length === 1 ? opciones[0]!.titulo : `${opciones.length} opciones`
}

export type Reparto = Array<{
  clave: "hidratos" | "proteina" | "grasas"
  nombre: string
  gramos: number
  pct: number
}>

/** Hidratos, proteína y grasas con su porcentaje de las kcal (4, 4 y 9 kcal por gramo). */
export function repartoDeMacros(objetivo: Macros | null): Reparto | null {
  if (
    !objetivo ||
    objetivo.hidratosG === null ||
    objetivo.proteinaG === null ||
    objetivo.grasaG === null
  )
    return null
  const kcal = objetivo.hidratosG * 4 + objetivo.proteinaG * 4 + objetivo.grasaG * 9
  if (kcal === 0) return null
  const pct = (valor: number): number => Math.round((valor / kcal) * 100)
  return [
    {
      clave: "hidratos",
      nombre: "Hidratos",
      gramos: objetivo.hidratosG,
      pct: pct(objetivo.hidratosG * 4),
    },
    {
      clave: "proteina",
      nombre: "Proteína",
      gramos: objetivo.proteinaG,
      pct: pct(objetivo.proteinaG * 4),
    },
    { clave: "grasas", nombre: "Grasas", gramos: objetivo.grasaG, pct: pct(objetivo.grasaG * 9) },
  ]
}

/** Un suplemento de creatina se apunta en el campo de creatina del día; el resto, por nombre. */
export function esCreatina(suplemento: Suplemento): boolean {
  return /creatina/i.test(suplemento.nombre)
}

export function suplementoTomado(suplemento: Suplemento, dia: DiaDeSeguimiento | null): boolean {
  if (!dia) return false
  return esCreatina(suplemento)
    ? dia.creatina === true
    : dia.suplementos.includes(suplemento.nombre)
}
