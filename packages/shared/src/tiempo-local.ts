/**
 * Hora local de la agenda sin librerías de zonas horarias (SPEC-agenda.md,
 * «Ampliación: horarios y reservas»).
 *
 * El negocio vive en `Europe/Madrid`. Las fechas de calendario viajan como
 * `AAAA-MM-DD` y las horas del horario como minutos desde medianoche local; los
 * instantes, en ISO con zona. Aquí se pasa de unas a otros con
 * `Intl.DateTimeFormat`, que conoce las reglas de cada zona, para que ni la zona
 * del servidor ni la del teléfono muevan nada.
 *
 * Cambios de hora: la hora que no existe en marzo devuelve `null` y no se ofrece;
 * la repetida de octubre se resuelve a la primera de las dos.
 */

const MS_MINUTO = 60_000
const MS_DIA = 86_400_000

const formateadores = new Map<string, Intl.DateTimeFormat>()

function formateador(zona: string): Intl.DateTimeFormat {
  let existente = formateadores.get(zona)
  if (!existente) {
    existente = new Intl.DateTimeFormat("en-US", {
      timeZone: zona,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
    })
    formateadores.set(zona, existente)
  }
  return existente
}

const DIAS: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }

/** Fecha, minutos desde medianoche y día de la semana (1 = lunes) en la zona. */
export type PartesLocales = { fecha: string; minutos: number; diaSemana: number }

export function partesLocales(instante: Date, zona: string): PartesLocales {
  const partes: Record<string, string> = {}
  for (const parte of formateador(zona).formatToParts(instante)) partes[parte.type] = parte.value
  const hora = Number(partes.hour) % 24
  return {
    fecha: `${partes.year}-${partes.month}-${partes.day}`,
    minutos: hora * 60 + Number(partes.minute),
    diaSemana: DIAS[partes.weekday ?? ""] ?? 1,
  }
}

/** Minutos que la zona va por delante de UTC en ese instante (60 o 120 en Madrid). */
export function desfaseMin(instante: Date, zona: string): number {
  const { fecha, minutos } = partesLocales(instante, zona)
  const comoUtc = Date.parse(`${fecha}T00:00:00.000Z`) + minutos * MS_MINUTO
  const redondeado = Math.floor(instante.getTime() / MS_MINUTO) * MS_MINUTO
  return Math.round((comoUtc - redondeado) / MS_MINUTO)
}

/**
 * El instante en que el reloj de la zona marca `minutos` del día `fecha`.
 * `null` si esa hora no existe (el salto de marzo).
 */
export function aInstante(fecha: string, minutos: number, zona: string): Date | null {
  const pared = Date.parse(`${fecha}T00:00:00.000Z`) + minutos * MS_MINUTO
  if (Number.isNaN(pared)) return null
  // El desfase de medio día antes y medio día después cubre los dos lados de un
  // cambio de hora. Cada candidato se comprueba: solo vale si el reloj marca eso.
  const candidatos = new Set([
    pared - desfaseMin(new Date(pared - MS_DIA / 2), zona) * MS_MINUTO,
    pared - desfaseMin(new Date(pared + MS_DIA / 2), zona) * MS_MINUTO,
  ])
  const validos = [...candidatos].filter((t) => {
    const partes = partesLocales(new Date(t), zona)
    return partes.fecha === fecha && partes.minutos === minutos
  })
  if (validos.length === 0) return null
  return new Date(Math.min(...validos))
}

export function sumarDiasFecha(fecha: string, dias: number): string {
  return new Date(Date.parse(`${fecha}T00:00:00.000Z`) + dias * MS_DIA).toISOString().slice(0, 10)
}

/** 1 = lunes … 7 = domingo. Una fecha de calendario no tiene zona. */
export function diaSemanaFecha(fecha: string): number {
  return ((new Date(`${fecha}T00:00:00.000Z`).getUTCDay() + 6) % 7) + 1
}

export function lunesDeFecha(fecha: string): string {
  return sumarDiasFecha(fecha, 1 - diaSemanaFecha(fecha))
}

/** El primer día del mes de una fecha: `2026-10-25` → `2026-10-01`. */
export function mesDeFecha(fecha: string): string {
  return `${fecha.slice(0, 7)}-01`
}

/** Suma meses a un primer día de mes. */
export function sumarMeses(mes: string, meses: number): string {
  const [anio, numero] = mes.split("-").map(Number) as [number, number]
  const total = anio * 12 + (numero - 1) + meses
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}-01`
}

/** Hoy en la zona. */
export function hoyEnZona(zona: string, ahora: Date = new Date()): string {
  return partesLocales(ahora, zona).fecha
}

/** `540` → `"09:00"`. */
export function horaDeMinutos(minutos: number): string {
  return `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`
}

export type Tramo = { inicio: number; fin: number }

/** Resta a unos tramos (ms) otros tramos. Todos semiabiertos `[inicio, fin)`. */
export function restarTramos(base: Tramo[], quitar: Tramo[]): Tramo[] {
  let restantes = base.filter((t) => t.fin > t.inicio)
  for (const q of quitar) {
    if (q.fin <= q.inicio) continue
    const siguientes: Tramo[] = []
    for (const t of restantes) {
      if (q.fin <= t.inicio || q.inicio >= t.fin) {
        siguientes.push(t)
        continue
      }
      if (q.inicio > t.inicio) siguientes.push({ inicio: t.inicio, fin: q.inicio })
      if (q.fin < t.fin) siguientes.push({ inicio: q.fin, fin: t.fin })
    }
    restantes = siguientes
  }
  return restantes
}

/** Une tramos que se tocan o solapan, ordenados por inicio. */
export function unirTramos(tramos: Tramo[]): Tramo[] {
  const ordenados = tramos.filter((t) => t.fin > t.inicio).sort((a, b) => a.inicio - b.inicio)
  const unidos: Tramo[] = []
  for (const t of ordenados) {
    const ultimo = unidos.at(-1)
    if (ultimo && t.inicio <= ultimo.fin) ultimo.fin = Math.max(ultimo.fin, t.fin)
    else unidos.push({ ...t })
  }
  return unidos
}

export type FranjaHorario = { diaSemana: number; inicioMin: number; finMin: number }

export type EntradaHuecos = {
  zona: string
  /** Primer día (fecha local) y número de días a calcular. */
  desde: string
  dias: number
  franjas: FranjaHorario[]
  /** Aperturas puntuales, en ms. Añaden tiempo a la plantilla. */
  aperturas: Tramo[]
  /** Cierres puntuales, reservas confirmadas y demás tiempo ocupado, en ms. */
  ocupado: Tramo[]
  duracionMin: number
  intervaloMin: number
  /** Límites del cliente (antelación y horizonte). Sin ellos, el entrenador. */
  minimo?: number
  maximo?: number
}

export type DiaConHuecos = { fecha: string; huecos: Tramo[] }

/**
 * Huecos libres donde cabe el servicio entero.
 *
 * Tiempo del día = plantilla de ese día de la semana ∪ aperturas, menos lo
 * ocupado. Los inicios van cada `intervaloMin` desde el comienzo de cada tramo
 * libre, y la duración es tiempo real (un hueco que cruza el cambio de hora dura
 * lo mismo).
 */
export function calcularHuecos(entrada: EntradaHuecos): DiaConHuecos[] {
  const resultado: DiaConHuecos[] = []
  const duracion = entrada.duracionMin * MS_MINUTO
  const paso = entrada.intervaloMin * MS_MINUTO
  for (let i = 0; i < entrada.dias; i++) {
    const fecha = sumarDiasFecha(entrada.desde, i)
    const comienzoDia = aInstante(fecha, 0, entrada.zona)?.getTime()
    const finDia = aInstante(sumarDiasFecha(fecha, 1), 0, entrada.zona)?.getTime()
    if (comienzoDia === undefined || finDia === undefined) {
      resultado.push({ fecha, huecos: [] })
      continue
    }
    const plantilla = plantillaDelDia(fecha, entrada.franjas, entrada.zona)
    const aperturas = entrada.aperturas
      .map((t) => ({ inicio: Math.max(t.inicio, comienzoDia), fin: Math.min(t.fin, finDia) }))
      .filter((t) => t.fin > t.inicio)
    const libres = restarTramos(unirTramos([...plantilla, ...aperturas]), entrada.ocupado)
    const huecos: Tramo[] = []
    for (const tramo of libres) {
      for (let inicio = tramo.inicio; inicio + duracion <= tramo.fin; inicio += paso) {
        if (entrada.minimo !== undefined && inicio < entrada.minimo) continue
        if (entrada.maximo !== undefined && inicio > entrada.maximo) continue
        huecos.push({ inicio, fin: inicio + duracion })
      }
    }
    resultado.push({ fecha, huecos })
  }
  return resultado
}

/**
 * Las franjas de la plantilla que tocan a una fecha, como instantes (ms). La usan
 * los huecos y la comprobación de reservas afectadas, para que las dos traten
 * igual el cambio de hora.
 */
export function plantillaDelDia(fecha: string, franjas: FranjaHorario[], zona: string): Tramo[] {
  const diaSemana = diaSemanaFecha(fecha)
  const tramos: Tramo[] = []
  for (const franja of franjas) {
    if (franja.diaSemana !== diaSemana) continue
    const inicio = instanteValido(fecha, franja.inicioMin, zona, 1)
    const fin = instanteValido(fecha, franja.finMin, zona, -1)
    if (inicio !== null && fin !== null && fin > inicio) tramos.push({ inicio, fin })
  }
  return tramos
}

/**
 * Un borde de franja que cae en la hora que no existe se desplaza al primer
 * minuto que sí existe (hacia delante para un inicio, hacia atrás para un fin).
 * `minutos` = 1440 es la medianoche del día siguiente.
 */
function instanteValido(
  fecha: string,
  minutos: number,
  zona: string,
  sentido: 1 | -1,
): number | null {
  if (minutos >= 1440)
    return aInstante(sumarDiasFecha(fecha, 1), minutos - 1440, zona)?.getTime() ?? null
  for (let desplazado = minutos, pasos = 0; pasos <= 120; pasos++, desplazado += sentido) {
    if (desplazado < 0 || desplazado >= 1440) return null
    const instante = aInstante(fecha, desplazado, zona)
    if (instante) return instante.getTime()
  }
  return null
}
