export function tiempoRelativo(fecha: string, ahora: number): string {
  const minutos = Math.max(0, Math.floor((ahora - Date.parse(fecha)) / 60_000))
  if (minutos === 0) return "hace un momento"
  if (minutos < 60) return `hace ${minutos} min`
  if (minutos < 1440) return `hace ${Math.floor(minutos / 60)} h`
  const dias = Math.floor(minutos / 1440)
  if (dias === 1) return "ayer"
  if (dias === 2) return "anteayer"
  return `hace ${dias} días`
}
