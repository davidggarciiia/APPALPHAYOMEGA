import type { Consejo, Ejercicio } from "@alpha-omega/shared"

/** La técnica tal como se escribe en el formulario: una línea por paso o consejo. */
export type TecnicaEnTexto = { pasos: string; evita: string; consejos: string }

export const TECNICA_VACIA: TecnicaEnTexto = { pasos: "", evita: "", consejos: "" }

export function tecnicaEnTexto(ejercicio: Ejercicio): TecnicaEnTexto {
  return {
    pasos: ejercicio.pasos.join("\n"),
    evita: ejercicio.evita ?? "",
    consejos: ejercicio.consejos.map((c) => `${c.titulo}: ${c.texto}`).join("\n"),
  }
}

type Tecnica = { pasos: string[]; evita: string | null; consejos: Consejo[] }

/**
 * Del texto a la ficha. Cada consejo va en su línea como «Título: texto»; una
 * línea sin los dos puntos no se adivina: se devuelve el error para corregirla.
 */
export function tecnicaDesdeTexto(texto: TecnicaEnTexto): Tecnica | { error: string } {
  const lineas = (valor: string): string[] =>
    valor
      .split("\n")
      .map((linea) => linea.trim())
      .filter((linea) => linea !== "")
  const pasos = lineas(texto.pasos)
  if (pasos.length > 10) return { error: "Como mucho diez pasos." }
  if (pasos.some((paso) => paso.length > 200))
    return { error: "Cada paso, en menos de 200 letras." }
  const consejos: Consejo[] = []
  for (const linea of lineas(texto.consejos)) {
    const corte = linea.indexOf(":")
    const titulo = corte === -1 ? "" : linea.slice(0, corte).trim()
    const cuerpo = corte === -1 ? "" : linea.slice(corte + 1).trim()
    if (titulo === "" || cuerpo === "")
      return { error: `Escribe cada consejo como «Título: texto». Revisa «${linea}».` }
    if (titulo.length > 40 || cuerpo.length > 300)
      return { error: "Cada consejo: título de hasta 40 letras y texto de hasta 300." }
    consejos.push({ titulo, texto: cuerpo })
  }
  if (consejos.length > 6) return { error: "Como mucho seis consejos." }
  const evita = texto.evita.trim()
  if (evita.length > 500) return { error: "«Evita», en menos de 500 letras." }
  return { pasos, evita: evita === "" ? null : evita, consejos }
}
