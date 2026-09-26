import { randomUUID } from "node:crypto"

import {
  diaSemanaFecha,
  partesLocales,
  sumarDiasFecha,
  ZONA_AGENDA,
  type Alimento,
  type BorradorDieta,
  type Comida,
  type DietaPublicada,
  type DocumentoDieta,
  type EleccionDeComida,
  type Macros,
  type TipoDeDia,
} from "@alpha-omega/shared"

import type { Cuenta } from "./api-demo.js"
import { dia, instante, type ContextoDemo } from "./contexto-demo.js"
import { conHoy } from "./entrenamiento-demo.js"

// ─── Piezas de una dieta inventada ───

const alimento = (nombre: string, cantidad: string | null = null): Alimento => ({
  nombre,
  cantidad,
})
const macros = (kcal: number, proteinaG: number, hidratosG: number, grasaG: number): Macros => ({
  kcal,
  proteinaG,
  hidratosG,
  grasaG,
})

function desayuno(hora: string): Comida {
  return {
    id: randomUUID(),
    nombre: "Desayuno",
    hora,
    indicacion: "Elige una opción.",
    forma: "alternativas",
    grupos: [
      {
        nombre: null,
        alternativas: [
          {
            id: randomUUID(),
            titulo: "Tostadas con pavo",
            alimentos: [
              alimento("Pan integral", "60 g"),
              alimento("Pechuga de pavo", "60 g"),
              alimento("Tomate", "al gusto"),
            ],
            nota: null,
            macros: macros(320, 24, 38, 7),
          },
          {
            id: randomUUID(),
            titulo: "Yogur con avena y frutos rojos",
            alimentos: [
              alimento("Yogur griego natural", "150 g"),
              alimento("Copos de avena", "40 g"),
              alimento("Frutos rojos", "80 g"),
            ],
            nota: null,
            macros: macros(340, 20, 42, 10),
          },
          {
            id: randomUUID(),
            titulo: "Tortilla y fruta",
            alimentos: [
              alimento("Huevos", "2 ud"),
              alimento("Pan integral", "40 g"),
              alimento("Pieza de fruta"),
            ],
            nota: "La tortilla, con una cucharadita de aceite.",
            macros: macros(330, 18, 33, 13),
          },
        ],
      },
    ],
  }
}

function comida(hora: string, hidratos: string): Comida {
  return {
    id: randomUUID(),
    nombre: "Comida",
    hora,
    indicacion: "Un alimento de cada columna.",
    forma: "intercambio",
    columnas: [
      {
        nombre: "Proteína",
        alimentos: [
          alimento("Pechuga de pollo", "130 g"),
          alimento("Merluza", "170 g"),
          alimento("Lentejas cocidas", "200 g"),
          alimento("Tofu firme", "150 g"),
        ],
      },
      {
        nombre: "Hidratos",
        alimentos: [
          alimento("Arroz (en crudo)", hidratos),
          alimento("Pasta integral (en crudo)", hidratos),
          alimento("Quinoa (en crudo)", hidratos),
          alimento("Patata", "250 g"),
        ],
      },
      {
        nombre: "Verdura",
        alimentos: [
          alimento("Ensalada variada", "al gusto"),
          alimento("Brócoli", "al gusto"),
          alimento("Judías verdes", "al gusto"),
          alimento("Calabacín a la plancha", "al gusto"),
        ],
      },
    ],
  }
}

function merienda(hora: string): Comida {
  return {
    id: randomUUID(),
    nombre: "Merienda",
    hora,
    indicacion: null,
    forma: "alternativas",
    grupos: [
      {
        nombre: null,
        alternativas: [
          {
            id: randomUUID(),
            titulo: "Fruta y nueces",
            alimentos: [alimento("Pieza de fruta"), alimento("Nueces", "20 g")],
            nota: null,
            macros: macros(210, 4, 22, 13),
          },
          {
            id: randomUUID(),
            titulo: "Queso fresco batido con fruta",
            alimentos: [alimento("Queso fresco batido", "200 g"), alimento("Pieza de fruta")],
            nota: null,
            macros: macros(200, 17, 26, 1),
          },
        ],
      },
    ],
  }
}

function cena(hora: string): Comida {
  return {
    id: randomUUID(),
    nombre: "Cena",
    hora,
    indicacion: "Un alimento de cada columna.",
    forma: "intercambio",
    columnas: [
      {
        nombre: "Proteína",
        alimentos: [
          alimento("Huevos", "2 ud"),
          alimento("Salmón", "120 g"),
          alimento("Pechuga de pavo", "120 g"),
          alimento("Sepia a la plancha", "180 g"),
        ],
      },
      {
        nombre: "Verdura",
        alimentos: [
          alimento("Crema de calabaza", "300 ml"),
          alimento("Parrillada de verduras", "al gusto"),
          alimento("Espinacas salteadas", "al gusto"),
        ],
      },
      {
        nombre: "Grasa",
        alimentos: [alimento("Aceite de oliva", "10 g"), alimento("Aguacate", "50 g")],
      },
    ],
  }
}

function tipoDeDia(nombre: string, objetivo: Macros, comidas: Comida[]): TipoDeDia {
  return { id: randomUUID(), nombre, objetivo, margenKcal: 100, comidas }
}

/** Dieta de Lucía. `diasEntreno`: días de la semana (1 = lunes) con sesión. */
function dietaLucia(fase: 1 | 2, diasEntreno: number[]): DocumentoDieta {
  const entreno = tipoDeDia(
    "Día de entreno",
    fase === 1 ? macros(1850, 125, 190, 60) : macros(1750, 130, 170, 58),
    [desayuno("08:00"), comida("14:30", "70 g"), merienda("17:30"), cena("21:30")],
  )
  const descanso = tipoDeDia(
    "Día de descanso",
    fase === 1 ? macros(1650, 120, 150, 60) : macros(1550, 125, 130, 58),
    [desayuno("08:30"), comida("14:30", "50 g"), cena("21:00")],
  )
  return {
    formato: 1,
    nombre: fase === 1 ? "Déficit suave · fase 1" : "Déficit · fase 2",
    tiposDeDia: [entreno, descanso],
    semana: [1, 2, 3, 4, 5, 6, 7].map((d) => (diasEntreno.includes(d) ? entreno.id : descanso.id)),
    indicaciones: [
      { titulo: "Agua", texto: "Entre 2 y 2,5 litros al día; algo más los días de entreno." },
      {
        titulo: "Fin de semana",
        texto: "Una comida libre a la semana, sin compensar al día siguiente.",
      },
    ],
    suplementos: [{ nombre: "Creatina monohidrato", dosis: "3 g al día" }],
    nota:
      fase === 1
        ? "Empezamos con un déficit suave para que no pases hambre. Pésate en ayunas."
        : "Seguimos con un déficit suave. Si algún día tienes más hambre, añade verdura y proteína antes que hidratos.",
    registroComidas: true,
    calculo: {
      pesoKg: fase === 1 ? 72.1 : 69.2,
      alturaCm: 166,
      edad: 34,
      sexo: "mujer",
      grasaPct: fase === 1 ? 31.6 : 29.4,
      factorActividad: 1.45,
      nota: "Mifflin-St Jeor con actividad moderada y un déficit de unas 350 kcal.",
    },
  }
}

/** Solo objetivos diarios, sin comidas: la forma más sencilla de dieta. */
function objetivos(nombre: string, objetivo: Macros, indicacion: string): DocumentoDieta {
  const todos = randomUUID()
  return {
    formato: 1,
    nombre,
    tiposDeDia: [{ id: todos, nombre: "Todos los días", objetivo, comidas: [] }],
    semana: Array.from({ length: 7 }, () => todos),
    indicaciones: [{ titulo: "Cómo cumplirlo", texto: indicacion }],
    registroComidas: false,
  }
}

// ─── Escritura ───

async function guardarBorrador(
  ctx: ContextoDemo,
  autor: Cuenta,
  clienteId: string,
  documento: DocumentoDieta,
): Promise<BorradorDieta> {
  const ruta = `/nutricion/clientes/${clienteId}/borrador`
  return ctx.api.pedir<BorradorDieta>(autor, "PUT", ruta, { revision: 0, documento })
}

async function publicar(
  ctx: ContextoDemo,
  autor: Cuenta,
  clienteId: string,
  documento: DocumentoDieta,
  fecha: string,
): Promise<DietaPublicada> {
  const borrador = await guardarBorrador(ctx, autor, clienteId, documento)
  const publicada = await ctx.api.pedir<DietaPublicada>(
    autor,
    "POST",
    `/nutricion/clientes/${clienteId}/borrador/publicar`,
    { operacionId: randomUUID(), revision: borrador.revision },
  )
  const publicadaEn = instante(fecha, 17, 30)
  await ctx.prisma.dieta.update({
    where: { id: publicada.id },
    data: { creadaEn: instante(fecha, 11, 0), publicadaEn },
  })
  // La que sustituyó queda archivada ese mismo momento.
  await ctx.prisma.dieta.updateMany({
    where: { clienteId, estado: "archivada", archivadaEn: { gt: publicadaEn } },
    data: { archivadaEn: publicadaEn },
  })
  return { ...publicada, publicadaEn: publicadaEn.toISOString() }
}

function elegir(ctx: ContextoDemo, comida: Comida): EleccionDeComida {
  if (ctx.azar.probabilidad(0.12)) return { tipo: "hecha" }
  if (comida.forma === "alternativas") {
    const alternativa = ctx.azar.elegir(comida.grupos.flatMap((g) => g.alternativas))
    return { tipo: "alternativa", alternativaId: alternativa.id }
  }
  return {
    tipo: "plato",
    elegidos: comida.columnas.map((columna) => ({
      columna: columna.nombre,
      alimento: ctx.azar.elegir(columna.alimentos).nombre,
    })),
  }
}

/** Comidas marcadas estos días, con lo que eligió. Hoy, solo las que ya han pasado. */
async function marcarComidas(
  ctx: ContextoDemo,
  cliente: Cuenta,
  dieta: DietaPublicada,
  dias: number,
): Promise<number> {
  const ahora = partesLocales(new Date(), ZONA_AGENDA).minutos
  let marcadas = 0
  for (let d = -dias; d <= 0; d++) {
    const fecha = dia(ctx, d)
    const tipoId = dieta.documento.semana[diaSemanaFecha(fecha) - 1]
    const tipo = dieta.documento.tiposDeDia.find((t) => t.id === tipoId)
    for (const c of tipo?.comidas ?? []) {
      const [h, m] = (c.hora ?? "12:00").split(":").map(Number) as [number, number]
      if (d === 0 && h * 60 + m + 30 > ahora) continue
      if (!ctx.azar.probabilidad(0.86)) continue
      await ctx.api.pedir(
        cliente,
        "PUT",
        `/nutricion/clientes/${cliente.id}/comidas/${fecha}/${c.id}`,
        { dietaId: dieta.id, eleccion: elegir(ctx, c) },
      )
      await ctx.prisma.comidaRegistrada.update({
        where: {
          clienteId_fecha_comidaId: {
            clienteId: cliente.id,
            fecha: new Date(`${fecha}T00:00:00Z`),
            comidaId: c.id,
          },
        },
        data: { registradaEn: instante(fecha, h, m + 25) },
      })
      marcadas++
    }
  }
  return marcadas
}

export async function sembrarNutricion(
  ctx: ContextoDemo,
): Promise<{ dietas: number; comidas: number }> {
  const { lucia, marcos, sara } = ctx.clientes
  const diasEntreno = conHoy([1, 3, 5], ctx.hoy)

  // Lucía: la nutricionista publicó la fase 1 al empezar y la fase 2 hace cuatro semanas.
  await publicar(ctx, ctx.nutricionista, lucia.id, dietaLucia(1, diasEntreno), dia(ctx, -83))
  const vigente = await publicar(
    ctx,
    ctx.nutricionista,
    lucia.id,
    dietaLucia(2, diasEntreno),
    dia(ctx, -28),
  )
  const comidas = await marcarComidas(ctx, lucia, vigente, 7)

  // Marcos: su entrenador le fijó solo objetivos diarios.
  await publicar(
    ctx,
    ctx.entrenador,
    marcos.id,
    objetivos(
      "Objetivos diarios",
      macros(2700, 170, 300, 85),
      "Reparte la proteína en tres o cuatro tomas y deja los hidratos alrededor del entreno.",
    ),
    dia(ctx, -45),
  )

  // Sara: Irene está preparando su primera dieta; aún es un borrador.
  await guardarBorrador(
    ctx,
    ctx.nutricionista,
    sara.id,
    objetivos(
      "Primera propuesta",
      macros(1900, 110, 220, 62),
      "Tres comidas principales y una merienda; prioriza comida sin procesar.",
    ),
  )
  await ctx.prisma.dieta.updateMany({
    where: { clienteId: sara.id, estado: "borrador" },
    data: { creadaEn: instante(sumarDiasFecha(ctx.hoy, -3), 16, 0) },
  })
  return { dietas: 4, comidas }
}
