import type {
  Cobro,
  Disponibilidad,
  Producto,
  Reserva,
  ResumenSaldo,
  Servicio,
  SolicitudProducto,
} from "@alpha-omega/shared"

/**
 * Datos de prueba de reservas y saldo. Hoy es el lunes 5 de octubre de 2026 a
 * las 10:00 en Madrid (horario de verano, +02:00).
 */
export const AHORA = new Date("2026-10-05T08:00:00.000Z")
export const HOY = "2026-10-05"

export const uuid = (prefijo: number, n: number): string =>
  `${String(prefijo).padStart(8, "0")}-0000-4000-8000-${String(n).padStart(12, "0")}`

export const CLIENTE = { id: uuid(3, 1), nombre: "Lara", apellidos: "García" }
export const OTRA = { id: uuid(3, 2), nombre: "Marta", apellidos: null }

export const EP: Servicio = {
  id: uuid(6, 1),
  codigo: "ep",
  nombre: "EP individual",
  descripcion: null,
  duracionMin: 60,
  minPersonas: 1,
  maxPersonas: 1,
  claseDeSaldo: "ep",
  precioCentimos: 3500,
  tarifas: [],
  reservable: true,
  activo: true,
}

export const GRUPO: Servicio = {
  id: uuid(6, 2),
  codigo: "ep_grupo",
  nombre: "EP en pareja o grupo",
  descripcion: null,
  duracionMin: 60,
  minPersonas: 2,
  maxPersonas: 6,
  claseDeSaldo: null,
  precioCentimos: null,
  tarifas: [
    { personas: 2, precioPorPersonaCentimos: 2500 },
    { personas: 3, precioPorPersonaCentimos: 2000 },
    { personas: 4, precioPorPersonaCentimos: 1500 },
  ],
  reservable: true,
  activo: true,
}

/** Instante de Madrid en octubre (antes del cambio de hora): `("2026-10-06", "10:00")`. */
export const en = (fecha: string, hora: string): string => `${fecha}T${hora}:00+02:00`

/** Catorce días desde hoy con los huecos indicados por fecha, de 60 minutos. */
export function disponibilidad(
  servicioId: string,
  huecos: Record<string, string[]>,
): Disponibilidad {
  return {
    servicioId,
    zona: "Europe/Madrid",
    dias: Array.from({ length: 14 }, (_, i) => {
      const fecha = new Date(Date.parse(`${HOY}T00:00:00Z`) + i * 86_400_000)
        .toISOString()
        .slice(0, 10)
      return {
        fecha,
        huecos: (huecos[fecha] ?? []).map((hora) => {
          const inicio = en(fecha, hora)
          const fin = new Date(Date.parse(inicio) + 3_600_000).toISOString()
          return { inicio, fin }
        }),
      }
    }),
  }
}

export function saldo(cambios: Partial<ResumenSaldo["ep"]> = {}): ResumenSaldo {
  return {
    clienteId: CLIENTE.id,
    fecha: HOY,
    ep: {
      mesActual: { mes: "2026-10-01", cupo: 2, usadas: 0, quedan: 2 },
      mesSiguiente: null,
      bonos: [],
      disponibles: 2,
      ...cambios,
    },
    suscripciones: [],
  }
}

export const SIN_SALDO: ResumenSaldo = saldo({ mesActual: null, disponibles: 0 })

export function reserva(cambios: Partial<Reserva> = {}): Reserva {
  const inicio = cambios.inicio ?? en("2026-10-08", "10:00")
  return {
    id: uuid(7, 1),
    servicio: { id: EP.id, codigo: EP.codigo, nombre: EP.nombre, duracionMin: 60 },
    cliente: CLIENTE,
    inicio,
    fin: new Date(Date.parse(inicio) + 3_600_000).toISOString(),
    personas: 1,
    estado: "confirmada",
    fuenteSaldo: "Plan de octubre",
    cobroCentimos: null,
    cancelarSinPerderHasta: new Date(Date.parse(inicio) - 24 * 3_600_000).toISOString(),
    cancelacion: null,
    devueltaAMano: false,
    revision: 0,
    creadaEn: "2026-10-01T09:00:00+02:00",
    ...cambios,
  }
}

export function producto(cambios: Partial<Producto> = {}): Producto {
  return {
    id: uuid(8, 1),
    codigo: "bono_ep_6",
    tipo: "bono",
    clase: "ep",
    nombre: "Bono EP 6",
    descripcion: null,
    precioCentimos: 19200,
    sesionesPorMes: null,
    clasesPorSemana: null,
    meses: null,
    sesiones: 6,
    validezDias: 365,
    regalo: null,
    visibleParaCliente: true,
    activo: true,
    ...cambios,
  }
}

export const PLAN_ESENCIAL = producto({
  id: uuid(8, 2),
  codigo: "presencial_esencial",
  tipo: "plan",
  nombre: "Presencial Esencial",
  precioCentimos: 10000,
  sesionesPorMes: 2,
  meses: 1,
  sesiones: null,
  validezDias: null,
})

export function solicitud(cambios: Partial<SolicitudProducto> = {}): SolicitudProducto {
  return {
    id: uuid(9, 1),
    producto: { id: uuid(8, 1), nombre: "Bono EP 6", tipo: "bono" },
    cliente: CLIENTE,
    precioCentimos: 19200,
    estado: "pendiente",
    creadaEn: "2026-10-04T12:00:00+02:00",
    resueltaEn: null,
    ...cambios,
  }
}

export function cobro(cambios: Partial<Cobro> = {}): Cobro {
  return {
    id: uuid(10, 1),
    cliente: CLIENTE,
    concepto: "EP en pareja · 2 personas",
    importeCentimos: 5000,
    estado: "pendiente",
    origenTipo: "reserva",
    cobradoEn: null,
    creadoEn: "2026-10-02T12:00:00+02:00",
    ...cambios,
  }
}
