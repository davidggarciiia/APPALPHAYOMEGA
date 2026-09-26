import type { ClaseSaldo, PrismaClient, TipoProducto } from "@prisma/client"

/**
 * Catálogo inicial de la hoja de servicios del entrenador (SPEC-planes.md,
 * «Catálogo inicial», y SPEC-agenda.md). Lo crea el seed una sola vez; después el
 * entrenador edita precios y visibilidad, y volver a sembrar nunca los pisa.
 */

type ProductoInicial = {
  codigo: string
  tipo: TipoProducto
  clase: ClaseSaldo | null
  nombre: string
  precioCentimos: number
  sesionesPorMes?: number
  clasesPorSemana?: number
  meses?: number
  sesiones?: number
  validezDias?: number
  regalo?: string
  visibleParaCliente: boolean
}

const ANIO = 365

const plan = (
  codigo: string,
  nombre: string,
  euros: number,
  sesionesPorMes: number,
  meses: number,
  visible: boolean,
): ProductoInicial => ({
  codigo,
  tipo: "plan",
  clase: "ep",
  nombre,
  precioCentimos: euros * 100,
  sesionesPorMes,
  meses,
  visibleParaCliente: visible,
})

const bono = (
  codigo: string,
  nombre: string,
  euros: number,
  sesiones: number,
  clase: ClaseSaldo,
  regalo?: string,
): ProductoInicial => ({
  codigo,
  tipo: "bono",
  clase,
  nombre,
  precioCentimos: euros * 100,
  sesiones,
  validezDias: ANIO,
  ...(regalo ? { regalo } : {}),
  visibleParaCliente: true,
})

export const PRODUCTOS_INICIALES: readonly ProductoInicial[] = [
  plan("presencial-esencial", "Presencial Esencial", 100, 2, 1, true),
  plan("presencial-esencial-2m", "Presencial Esencial, 2 meses", 190, 2, 2, true),
  plan("presencial-esencial-3m", "Presencial Esencial, 3 meses", 270, 2, 3, true),
  plan("presencial-esencial-5m", "Presencial Esencial, 5 meses", 420, 2, 5, true),
  plan("presencial-integral", "Presencial Integral", 125, 2, 1, true),
  plan("presencial-integral-3m", "Presencial Integral, 3 meses", 369, 2, 3, true),
  plan("presencial-plus", "Presencial Plus", 185, 4, 1, true),
  plan("presencial-plus-3m", "Presencial Plus, 3 meses", 549, 4, 3, true),
  plan("online-entrenamiento", "Online Entrenamiento", 50, 0, 1, false),
  plan("online-entrenamiento-3m", "Online Entrenamiento, 3 meses", 138, 0, 3, false),
  plan("online-entrenamiento-5m", "Online Entrenamiento, 5 meses", 215, 0, 5, false),
  plan("online-integral", "Online Integral", 75, 0, 1, false),
  plan("online-integral-3m", "Online Integral, 3 meses", 219, 0, 3, false),
  {
    codigo: "boxeo-1-semana",
    tipo: "plan",
    clase: "boxeo",
    nombre: "Boxeo, 1 clase por semana",
    precioCentimos: 3000,
    clasesPorSemana: 1,
    meses: 1,
    visibleParaCliente: true,
  },
  {
    codigo: "boxeo-2-semana",
    tipo: "plan",
    clase: "boxeo",
    nombre: "Boxeo, 2 clases por semana",
    precioCentimos: 4000,
    clasesPorSemana: 2,
    meses: 1,
    visibleParaCliente: true,
  },
  bono("ep-suelta", "EP suelta", 35, 1, "ep"),
  bono("bono-ep-6", "Bono EP 6", 192, 6, "ep"),
  bono("bono-ep-8", "Bono EP 8", 240, 8, "ep", "Una sesión de quiromasaje"),
  bono("bono-ep-10", "Bono EP 10", 290, 10, "ep", "Una sesión de quiromasaje"),
  bono("bono-boxeo-5", "Bono boxeo 5", 50, 5, "boxeo"),
  bono("bono-boxeo-10", "Bono boxeo 10", 80, 10, "boxeo"),
  {
    codigo: "matricula-boxeo",
    tipo: "matricula",
    clase: null,
    nombre: "Matrícula de boxeo",
    precioCentimos: 3500,
    visibleParaCliente: false,
  },
]

/**
 * Servicios reservables. La EP en pareja o grupo no gasta saldo: se paga allí,
 * por persona. Las tarifas son editables por el entrenador.
 */
export const SERVICIOS_INICIALES = [
  {
    codigo: "ep_individual",
    nombre: "Entrenamiento personal",
    descripcion: "Sesión individual de 60 minutos con tu entrenador.",
    duracionMin: 60,
    minPersonas: 1,
    maxPersonas: 1,
    claseDeSaldo: "ep" as const,
    precioCentimos: 3500,
    orden: 1,
    tarifas: [],
  },
  {
    codigo: "ep_grupo",
    nombre: "Entrenamiento en pareja o grupo",
    descripcion: "De 2 a 6 personas. Se paga en el centro, por persona.",
    duracionMin: 60,
    minPersonas: 2,
    maxPersonas: 6,
    claseDeSaldo: null,
    precioCentimos: null,
    orden: 2,
    tarifas: [
      { personas: 2, precioPorPersonaCentimos: 2500 },
      { personas: 3, precioPorPersonaCentimos: 2000 },
      { personas: 4, precioPorPersonaCentimos: 1500 },
      { personas: 5, precioPorPersonaCentimos: 1200 },
      { personas: 6, precioPorPersonaCentimos: 1000 },
    ],
  },
] as const

/** Crea lo que falte del catálogo. Lo que ya existe (y su precio) no se toca. */
export async function asegurarCatalogoInicial(
  prisma: Pick<PrismaClient, "producto" | "servicio" | "ajustesAgenda">,
): Promise<{ productos: number; servicios: number }> {
  let productos = 0
  let servicios = 0
  for (const [orden, producto] of PRODUCTOS_INICIALES.entries()) {
    const existe = await prisma.producto.findUnique({ where: { codigo: producto.codigo } })
    if (existe) continue
    await prisma.producto.create({ data: { ...producto, orden } })
    productos++
  }
  for (const { tarifas, ...servicio } of SERVICIOS_INICIALES) {
    const existe = await prisma.servicio.findUnique({ where: { codigo: servicio.codigo } })
    if (existe) continue
    await prisma.servicio.create({
      data: { ...servicio, tarifas: { create: tarifas.map((t) => ({ ...t })) } },
    })
    servicios++
  }
  await prisma.ajustesAgenda.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} })
  return { productos, servicios }
}
