/**
 * La API guarda la fecha de nacimiento como `AAAA-MM-DD`; la gente la escribe y la
 * lee como `DD/MM/AAAA`. Estas dos funciones traducen entre ambas sin tocar la API.
 */

/** `1995-04-12` → `12/04/1995`. Cadena vacía si no hay fecha. */
export function isoAFechaEspanola(iso: string | null | undefined): string {
  const partes = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "")
  return partes ? `${partes[3]}/${partes[2]}/${partes[1]}` : ""
}

/**
 * `12/04/1995` (también `12-4-1995` o `12.04.1995`) → `1995-04-12`.
 * Devuelve `null` si no es una fecha real del pasado desde 1900.
 */
export function fechaEspanolaAIso(texto: string, hoy: Date = new Date()): string | null {
  const partes = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(texto.trim())
  if (!partes) return null
  const dia = Number(partes[1])
  const mes = Number(partes[2])
  const anio = Number(partes[3])
  const fecha = new Date(Date.UTC(anio, mes - 1, dia))
  const real =
    fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia
  if (!real || anio < 1900 || fecha.getTime() > hoy.getTime()) return null
  return `${String(anio).padStart(4, "0")}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`
}
