import { ZONA_AGENDA } from "@alpha-omega/shared"
import { invalida } from "../entrenamiento/documentos.js"

const formato = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA_AGENDA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
  era: "short",
})

function horaLocal(instante: Date): number {
  const p = Object.fromEntries(
    formato.formatToParts(instante).map(({ type, value }) => [type, value]),
  )
  const anio = Number(p.year)
  const local = new Date(0)
  // setUTCFullYear conserva los años 0–99 y admite muestras anteriores al año 1 o posteriores al 9999.
  local.setUTCFullYear(p.era === "BC" ? 1 - anio : anio, Number(p.month) - 1, Number(p.day))
  local.setUTCHours(Number(p.hour), Number(p.minute), Number(p.second), 0)
  return local.getTime()
}

/** La fecha y hora llegan validadas por el contrato; un cambio horario puede dejarlas sin instante único. */
export function inicioEnMadrid(fecha: string, horaInicio: string): Date {
  const deseada = `${fecha}T${horaInicio}:00`
  const referencia = Date.parse(`${deseada}Z`)
  if (
    !Number.isFinite(referencia) ||
    referencia < Date.parse("0001-01-01T00:00:00Z") ||
    referencia > Date.parse("9999-12-31T23:59:59.999Z")
  )
    throw invalida("La hora elegida queda fuera del rango de fechas permitido.")
  // Consultar ambos lados del día recoge los dos desfases cuando cambia la hora.
  const desfases = new Set(
    [-1, 0, 1].map((dia) => {
      const muestra = referencia + dia * 86_400_000
      return horaLocal(new Date(muestra)) - muestra
    }),
  )
  const candidatos = [...desfases]
    .map((desfase) => new Date(referencia - desfase))
    .filter((instante) => horaLocal(instante) === referencia)
  if (candidatos.length === 0)
    throw invalida("La hora elegida no existe por el cambio de hora. Elige otra hora.")
  if (candidatos.length > 1)
    throw invalida("La hora elegida se repite por el cambio de hora. Elige otra hora.")
  const inicio = candidatos[0]!
  if (inicio.getUTCFullYear() < 1 || inicio.getUTCFullYear() > 9999)
    throw invalida("La hora elegida queda fuera del rango de fechas permitido.")
  return inicio
}
