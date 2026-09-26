import { randomUUID } from "node:crypto"

import {
  diaSemanaFecha,
  lunesDeFecha,
  sumarDiasFecha,
  type Bloque,
  type EjercicioEnRutina,
  type ListadoNovedades,
  type PatronRutina,
  type PlanAsignado,
  type Registro,
  type RegistrarMolestia,
  type RutinaGuardada,
  type SeccionDeSesion,
  type SeriePrescrita,
  type SerieRegistrada,
  type SesionEnRutina,
} from "@alpha-omega/shared"

import type { Prisma } from "@prisma/client"

import { normalizarNombre } from "../catalogo-ejercicios/catalogo-ejercicios.service.js"
import type { Cuenta } from "./api-demo.js"
import { redondearA } from "./azar.js"
import { diasEntre, instante, type ClaveCliente, type ContextoDemo } from "./contexto-demo.js"

// ─── Rutinas inventadas ───

type Medida =
  | { tipo: "repeticiones"; reps: number; repsMax?: number }
  | { tipo: "tiempo"; segundos: number }
  | { tipo: "distancia"; metros: number }

/** Un ejercicio de la demo. `carga` es la prescrita al empezar y la que se alcanza al final. */
type EjercicioDemo = {
  nombre: string
  seccion: SeccionDeSesion
  series: number
  medida: Medida
  carga: { desde: number; hasta: number; paso: number } | null
  rir?: [number, number]
  descanso?: string
  dosis?: string
  nota?: string
  compuesto?: boolean
  alternativas?: string[]
}

type SesionDemo = {
  nombre: string
  duracion?: string
  nota?: string
  circuito?: { nombre: string; vueltas: number; descanso: string }
  ejercicios: EjercicioDemo[]
}

const reps = (n: number, max?: number): Medida => ({
  tipo: "repeticiones",
  reps: n,
  ...(max !== undefined && { repsMax: max }),
})
const segundos = (n: number): Medida => ({ tipo: "tiempo", segundos: n })
const metros = (n: number): Medida => ({ tipo: "distancia", metros: n })
const carga = (desde: number, hasta: number, paso: number): EjercicioDemo["carga"] => ({
  desde,
  hasta,
  paso,
})

const calentamiento = (nombre: string, medida: Medida, dosis: string): EjercicioDemo => ({
  nombre,
  seccion: "calentamiento",
  series: 1,
  medida,
  carga: null,
  dosis,
})
const final = (nombre: string, medida: Medida, dosis: string): EjercicioDemo => ({
  nombre,
  seccion: "final",
  series: 1,
  medida,
  carga: null,
  dosis,
})

const SESIONES_LUCIA: SesionDemo[] = [
  {
    nombre: "Pierna y glúteo",
    duracion: "60–70 min",
    nota: "Hip thrust: pausa de un segundo arriba en cada repetición.",
    ejercicios: [
      calentamiento("Bicicleta estática", segundos(300), "5 min suaves"),
      {
        nombre: "Hip thrust con barra",
        seccion: "principal",
        series: 4,
        medida: reps(10, 12),
        carga: carga(40, 57.5, 2.5),
        rir: [2, 3],
        descanso: "2 min",
        compuesto: true,
      },
      {
        nombre: "Sentadilla goblet con mancuerna",
        seccion: "principal",
        series: 3,
        medida: reps(10, 12),
        carga: carga(14, 22, 2),
        rir: [2, 3],
        descanso: "90 s",
        compuesto: true,
      },
      {
        nombre: "Peso muerto rumano con barra",
        seccion: "principal",
        series: 3,
        medida: reps(10),
        carga: carga(30, 42.5, 2.5),
        rir: [2, 3],
        descanso: "2 min",
        nota: "Espalda neutra; baja hasta media tibia.",
        compuesto: true,
      },
      {
        nombre: "Abducción de cadera en máquina",
        seccion: "principal",
        series: 3,
        medida: reps(15),
        carga: carga(35, 50, 5),
        rir: [1, 2],
        descanso: "60 s",
      },
      final("Caminar en cinta", segundos(600), "10 min a paso vivo con un 8 % de pendiente"),
    ],
  },
  {
    nombre: "Torso",
    duracion: "55–65 min",
    ejercicios: [
      calentamiento("Remo en ergómetro", metros(1000), "1.000 m suaves"),
      {
        nombre: "Press de hombros con mancuernas",
        seccion: "principal",
        series: 3,
        medida: reps(10, 12),
        carga: carga(6, 9, 1),
        rir: [2, 3],
        descanso: "90 s",
        compuesto: true,
      },
      {
        nombre: "Dominadas",
        seccion: "principal",
        series: 3,
        medida: reps(4, 6),
        carga: null,
        rir: [1, 2],
        descanso: "2 min",
        nota: "Con banda elástica mientras haga falta.",
        alternativas: ["Jalón al pecho en polea"],
        compuesto: true,
      },
      {
        nombre: "Aperturas con mancuernas",
        seccion: "principal",
        series: 3,
        medida: reps(12),
        carga: carga(6, 9, 1),
        rir: [2, 3],
        descanso: "75 s",
      },
      {
        nombre: "Elevaciones laterales con mancuernas",
        seccion: "principal",
        series: 3,
        medida: reps(15),
        carga: carga(4, 6, 1),
        rir: [1, 2],
        descanso: "60 s",
      },
      {
        nombre: "Extensión de tríceps en polea con cuerda",
        seccion: "principal",
        series: 3,
        medida: reps(12),
        carga: carga(12.5, 20, 2.5),
        rir: [1, 2],
        descanso: "60 s",
      },
    ],
  },
  {
    nombre: "Full body y cardio",
    duracion: "60 min",
    circuito: { nombre: "Metabólico", vueltas: 3, descanso: "90 s entre vueltas" },
    ejercicios: [
      calentamiento("Bicicleta estática", segundos(300), "5 min suaves"),
      {
        nombre: "Sentadilla búlgara con mancuernas",
        seccion: "principal",
        series: 3,
        medida: reps(8, 10),
        carga: carga(8, 14, 2),
        rir: [2, 3],
        descanso: "90 s",
        nota: "Repeticiones por pierna.",
        compuesto: true,
      },
      {
        nombre: "Press Arnold con mancuernas",
        seccion: "principal",
        series: 3,
        medida: reps(10),
        carga: carga(6, 9, 1),
        rir: [2, 3],
        descanso: "90 s",
      },
      {
        nombre: "Swing con kettlebell",
        seccion: "circuito",
        series: 3,
        medida: reps(15),
        carga: carga(12, 16, 4),
      },
      {
        nombre: "Marcha con kettlebell",
        seccion: "circuito",
        series: 3,
        medida: metros(40),
        carga: carga(12, 16, 4),
      },
      {
        nombre: "Subidas al cajón con peso",
        seccion: "circuito",
        series: 3,
        medida: reps(10),
        carga: carga(6, 10, 2),
      },
      final("Elíptica en intervalos", segundos(900), "15 min: 1 min fuerte, 1 min suave"),
    ],
  },
]

const SESIONES_MARCOS: SesionDemo[] = [
  {
    nombre: "Pierna",
    duracion: "75 min",
    nota: "Sentadilla: si la barra va lenta en la última serie, no subas carga.",
    ejercicios: [
      calentamiento("Bicicleta estática", segundos(300), "5 min y movilidad de cadera"),
      {
        nombre: "Sentadilla trasera con barra",
        seccion: "principal",
        series: 4,
        medida: reps(5, 6),
        carga: carga(80, 97.5, 2.5),
        rir: [1, 2],
        descanso: "3 min",
        compuesto: true,
      },
      {
        nombre: "Prensa de piernas",
        seccion: "principal",
        series: 3,
        medida: reps(10),
        carga: carga(140, 180, 10),
        rir: [2, 2],
        descanso: "2 min",
      },
      {
        nombre: "Curl femoral tumbado en máquina",
        seccion: "principal",
        series: 3,
        medida: reps(12),
        carga: carga(35, 45, 5),
        rir: [1, 2],
        descanso: "75 s",
      },
      {
        nombre: "Extensión de cuádriceps en máquina",
        seccion: "principal",
        series: 3,
        medida: reps(12),
        carga: carga(45, 60, 5),
        rir: [1, 2],
        descanso: "75 s",
      },
    ],
  },
  {
    nombre: "Empuje",
    duracion: "60 min",
    ejercicios: [
      calentamiento("Remo en ergómetro", metros(500), "500 m suaves"),
      {
        nombre: "Press militar de pie con barra",
        seccion: "principal",
        series: 4,
        medida: reps(6),
        carga: carga(40, 50, 2.5),
        rir: [1, 2],
        descanso: "2 min 30 s",
        compuesto: true,
      },
      {
        nombre: "Press Svend",
        seccion: "principal",
        series: 3,
        medida: reps(12),
        carga: carga(10, 15, 2.5),
        rir: [2, 2],
        descanso: "75 s",
      },
      {
        nombre: "Elevaciones laterales con mancuernas",
        seccion: "principal",
        series: 3,
        medida: reps(15),
        carga: carga(8, 12, 2),
        rir: [1, 2],
        descanso: "60 s",
      },
      {
        nombre: "Extensión de tríceps en polea con cuerda",
        seccion: "principal",
        series: 3,
        medida: reps(12),
        carga: carga(25, 32.5, 2.5),
        rir: [1, 2],
        descanso: "60 s",
      },
    ],
  },
  {
    nombre: "Tirón y acondicionamiento",
    duracion: "65 min",
    ejercicios: [
      {
        nombre: "Dominadas",
        seccion: "principal",
        series: 4,
        medida: reps(6, 8),
        carga: null,
        rir: [1, 2],
        descanso: "2 min",
        compuesto: true,
      },
      {
        nombre: "Peso muerto rumano con barra",
        seccion: "principal",
        series: 3,
        medida: reps(8),
        carga: carga(80, 95, 5),
        rir: [2, 2],
        descanso: "2 min 30 s",
        compuesto: true,
      },
      {
        nombre: "Remo al mentón con barra",
        seccion: "principal",
        series: 3,
        medida: reps(10),
        carga: carga(30, 37.5, 2.5),
        rir: [2, 2],
        descanso: "90 s",
      },
      {
        nombre: "Pájaros en polea",
        seccion: "principal",
        series: 3,
        medida: reps(15),
        carga: carga(7.5, 12.5, 2.5),
        rir: [1, 2],
        descanso: "60 s",
      },
      final("Remo en ergómetro", metros(2000), "2.000 m por debajo de 2:05 cada 500 m"),
    ],
  },
]

const SESIONES_SARA: SesionDemo[] = [
  {
    nombre: "Full body A",
    duracion: "50 min",
    nota: "Prioriza la técnica: si una repetición sale fea, para ahí.",
    ejercicios: [
      calentamiento("Caminar en cinta", segundos(300), "5 min a paso vivo"),
      {
        nombre: "Sentadilla goblet con mancuerna",
        seccion: "principal",
        series: 3,
        medida: reps(12),
        carga: carga(8, 12, 2),
        rir: [3, 3],
        descanso: "90 s",
        compuesto: true,
      },
      {
        nombre: "Press de hombros con mancuernas",
        seccion: "principal",
        series: 3,
        medida: reps(12),
        carga: carga(4, 6, 1),
        rir: [3, 3],
        descanso: "75 s",
      },
      {
        nombre: "Hip thrust con barra",
        seccion: "principal",
        series: 3,
        medida: reps(12),
        carga: carga(20, 30, 2.5),
        rir: [3, 3],
        descanso: "90 s",
        compuesto: true,
      },
      {
        nombre: "Pájaros en polea",
        seccion: "principal",
        series: 3,
        medida: reps(15),
        carga: carga(5, 7.5, 2.5),
        rir: [2, 3],
        descanso: "60 s",
      },
    ],
  },
  {
    nombre: "Full body B",
    duracion: "50 min",
    ejercicios: [
      calentamiento("Bicicleta estática", segundos(300), "5 min suaves"),
      {
        nombre: "Zancadas atrás con barra",
        seccion: "principal",
        series: 3,
        medida: reps(10),
        carga: carga(15, 20, 2.5),
        rir: [3, 3],
        descanso: "90 s",
        nota: "Repeticiones por pierna.",
      },
      {
        nombre: "Aperturas con mancuernas",
        seccion: "principal",
        series: 3,
        medida: reps(12),
        carga: carga(4, 6, 1),
        rir: [3, 3],
        descanso: "60 s",
      },
      {
        nombre: "Curl femoral sentado en máquina",
        seccion: "principal",
        series: 3,
        medida: reps(12),
        carga: carga(20, 30, 5),
        rir: [2, 3],
        descanso: "60 s",
      },
      final("Elíptica en intervalos", segundos(600), "10 min a ritmo cómodo"),
    ],
  },
]

const SESIONES_NEREA: SesionDemo[] = [
  {
    nombre: "Tren inferior",
    duracion: "45 min",
    ejercicios: [
      calentamiento("Bicicleta estática", segundos(300), "5 min suaves"),
      {
        nombre: "Sentadilla goblet con mancuerna",
        seccion: "principal",
        series: 3,
        medida: reps(12),
        carga: carga(10, 12, 2),
        rir: [3, 3],
        descanso: "90 s",
        compuesto: true,
      },
      {
        nombre: "Hip thrust con barra",
        seccion: "principal",
        series: 3,
        medida: reps(12),
        carga: carga(30, 35, 2.5),
        rir: [3, 3],
        descanso: "90 s",
      },
      {
        nombre: "Abducción de cadera en máquina",
        seccion: "principal",
        series: 3,
        medida: reps(15),
        carga: carga(30, 35, 5),
        rir: [2, 3],
        descanso: "60 s",
      },
      final("Caminar en cinta", segundos(600), "10 min"),
    ],
  },
  {
    nombre: "Tren superior",
    duracion: "45 min",
    ejercicios: [
      calentamiento("Remo en ergómetro", metros(500), "500 m suaves"),
      {
        nombre: "Press de hombros con mancuernas",
        seccion: "principal",
        series: 3,
        medida: reps(12),
        carga: carga(5, 6, 1),
        rir: [3, 3],
        descanso: "75 s",
      },
      {
        nombre: "Elevaciones laterales con mancuernas",
        seccion: "principal",
        series: 3,
        medida: reps(15),
        carga: carga(3, 4, 1),
        rir: [2, 3],
        descanso: "60 s",
      },
      {
        nombre: "Extensión de tríceps en polea con cuerda",
        seccion: "principal",
        series: 3,
        medida: reps(12),
        carga: carga(10, 12.5, 2.5),
        rir: [2, 3],
        descanso: "60 s",
      },
      final("Elíptica en intervalos", segundos(600), "10 min a ritmo cómodo"),
    ],
  },
]

const SESIONES_PABLO: SesionDemo[] = [
  {
    nombre: "Fuerza de pierna",
    duracion: "60 min",
    ejercicios: [
      calentamiento("Correr en cinta", segundos(600), "10 min de trote suave"),
      {
        nombre: "Sentadilla trasera con barra",
        seccion: "principal",
        series: 4,
        medida: reps(6),
        carga: carga(60, 75, 2.5),
        rir: [2, 2],
        descanso: "2 min 30 s",
        compuesto: true,
      },
      {
        nombre: "Sentadilla búlgara con mancuernas",
        seccion: "principal",
        series: 3,
        medida: reps(8),
        carga: carga(12, 18, 2),
        rir: [2, 2],
        descanso: "90 s",
        nota: "Repeticiones por pierna.",
      },
      {
        nombre: "Peso muerto rumano con barra",
        seccion: "principal",
        series: 3,
        medida: reps(8),
        carga: carga(50, 65, 2.5),
        rir: [2, 2],
        descanso: "2 min",
        compuesto: true,
      },
      {
        nombre: "Extensión de cuádriceps en máquina",
        seccion: "principal",
        series: 3,
        medida: reps(12),
        carga: carga(30, 40, 5),
        rir: [1, 2],
        descanso: "60 s",
      },
    ],
  },
  {
    nombre: "Potencia",
    duracion: "45 min",
    ejercicios: [
      {
        nombre: "Swing con kettlebell",
        seccion: "principal",
        series: 4,
        medida: reps(15),
        carga: carga(16, 24, 4),
        descanso: "90 s",
      },
      {
        nombre: "Sentadilla con salto y mancuernas",
        seccion: "principal",
        series: 3,
        medida: reps(8),
        carga: carga(6, 10, 2),
        descanso: "2 min",
        nota: "Aterriza suave y en silencio.",
      },
      {
        nombre: "Subidas al cajón con peso",
        seccion: "principal",
        series: 3,
        medida: reps(10),
        carga: carga(10, 16, 2),
        descanso: "90 s",
      },
      {
        nombre: "Marcha con kettlebell",
        seccion: "principal",
        series: 3,
        medida: metros(40),
        carga: carga(16, 24, 4),
        descanso: "60 s",
      },
    ],
  },
  {
    nombre: "Rodaje en cinta",
    duracion: "50 min",
    ejercicios: [
      {
        nombre: "Correr en cinta",
        seccion: "principal",
        series: 1,
        medida: segundos(2400),
        carga: null,
        nota: "Ritmo cómodo: entre 5:30 y 5:45 el kilómetro.",
      },
      final("Caminar en cinta", segundos(300), "5 min para soltar"),
    ],
  },
]

const SESIONES_JAVIER: SesionDemo[] = [
  { ...SESIONES_SARA[0]!, nombre: "Primer contacto A" },
  { ...SESIONES_SARA[1]!, nombre: "Primer contacto B" },
]

// ─── Patrones con identificadores ───

type EjercicioConIds = EjercicioDemo & { id: string; ejercicioId: string; serieIds: string[] }
type SesionConIds = Omit<SesionDemo, "ejercicios"> & {
  id: string
  diaSemana: number
  ejercicios: EjercicioConIds[]
}

function idDe(ctx: ContextoDemo, nombre: string): string {
  const id = ctx.ejercicios.get(normalizarNombre(nombre))
  if (!id) throw new Error(`Falta el ejercicio «${nombre}» en el catálogo`)
  return id
}

function conIds(ctx: ContextoDemo, sesiones: SesionDemo[], dias: number[]): SesionConIds[] {
  return sesiones.map((sesion, i) => ({
    ...sesion,
    id: randomUUID(),
    diaSemana: dias[i]!,
    ejercicios: sesion.ejercicios.map((ejercicio) => ({
      ...ejercicio,
      id: randomUUID(),
      ejercicioId: idDe(ctx, ejercicio.nombre),
      serieIds: Array.from({ length: ejercicio.series }, () => randomUUID()),
    })),
  }))
}

function seriePrescrita(ejercicio: EjercicioConIds, id: string): SeriePrescrita {
  const pesoKg = ejercicio.carga?.desde ?? null
  const medida = ejercicio.medida
  switch (medida.tipo) {
    case "repeticiones":
      return {
        id,
        tipoMedicion: "repeticiones",
        pesoKg,
        repeticiones: medida.reps,
        ...(medida.repsMax !== undefined && { repeticionesMax: medida.repsMax }),
      }
    case "tiempo":
      return { id, tipoMedicion: "tiempo", pesoKg, segundos: medida.segundos }
    case "distancia":
      return { id, tipoMedicion: "distancia", pesoKg, metros: medida.metros }
  }
}

function ejercicioEnRutina(ejercicio: EjercicioConIds): EjercicioEnRutina {
  return {
    id: ejercicio.id,
    ejercicioId: ejercicio.ejercicioId,
    indicaciones: null,
    seccion: ejercicio.seccion,
    tipoCarga: ejercicio.carga ? "conCargaExterna" : "sinCarga",
    ...(ejercicio.rir && {
      rir: { min: ejercicio.rir[0], max: ejercicio.rir[1] },
      modoRir: "alFinalizarEjercicio" as const,
    }),
    ...(ejercicio.carga && { subidaKg: ejercicio.carga.paso }),
    ...(ejercicio.descanso && { descanso: ejercicio.descanso }),
    ...(ejercicio.dosis && { dosis: ejercicio.dosis }),
    ...(ejercicio.nota && { nota: ejercicio.nota }),
    ...(ejercicio.compuesto && { compuesto: true }),
    ...(ejercicio.alternativas && { alternativas: ejercicio.alternativas }),
    series: ejercicio.serieIds.map((id) => seriePrescrita(ejercicio, id)),
  }
}

function sesionEnRutina(sesion: SesionConIds): SesionEnRutina {
  return {
    id: sesion.id,
    nombre: sesion.nombre,
    diaSemana: sesion.diaSemana,
    ...(sesion.duracion && { duracion: sesion.duracion }),
    ...(sesion.nota && { nota: sesion.nota }),
    ...(sesion.circuito && { circuito: sesion.circuito }),
    ejercicios: sesion.ejercicios.map(ejercicioEnRutina),
  }
}

const patron = (sesiones: SesionConIds[]): PatronRutina => ({
  sesiones: sesiones.map(sesionEnRutina),
})

/** Los días del patrón, cambiando el más cercano por hoy si hoy no está: así hay sesiones hoy. */
export function conHoy(dias: number[], hoy: string): number[] {
  const diaHoy = diaSemanaFecha(hoy)
  if (dias.includes(diaHoy)) return dias
  const distancia = (d: number): number => Math.min(Math.abs(d - diaHoy), 7 - Math.abs(d - diaHoy))
  const cercano = [...dias].sort((a, b) => distancia(a) - distancia(b))[0]!
  return dias.map((d) => (d === cercano ? diaHoy : d)).sort((a, b) => a - b)
}

// ─── Registro de lo hecho ───

/** Serie registrada con la progresión del bloque: `progreso` va de 0 (inicio) a 1 (hoy). */
function registrarSeries(
  ctx: ContextoDemo,
  sesion: SesionConIds,
  progreso: number,
  opciones: {
    hastaEjercicio?: number
    omitir?: (ejercicio: EjercicioConIds, serie: number) => boolean
  },
): SerieRegistrada[] {
  const series: SerieRegistrada[] = []
  sesion.ejercicios.forEach((ejercicio, indice) => {
    const pendiente = opciones.hastaEjercicio !== undefined && indice >= opciones.hastaEjercicio
    ejercicio.serieIds.forEach((serieId, numero) => {
      const ultima = numero === ejercicio.serieIds.length - 1
      const omitida = opciones.omitir?.(ejercicio, numero) ?? false
      const medida = ejercicio.medida
      if (pendiente || omitida) {
        const base = {
          serieId,
          pesoKg: null,
          hecha: false,
          ...(omitida && { omitida: true as const }),
        }
        if (medida.tipo === "repeticiones")
          series.push({ ...base, tipoMedicion: "repeticiones", repeticiones: null })
        else if (medida.tipo === "tiempo")
          series.push({ ...base, tipoMedicion: "tiempo", segundos: null })
        else series.push({ ...base, tipoMedicion: "distancia", metros: null })
        return
      }
      const c = ejercicio.carga
      const pesoKg = c
        ? Math.max(c.paso, redondearA(c.desde + (c.hasta - c.desde) * progreso, c.paso))
        : null
      const rir = ejercicio.rir
        ? Math.min(
            5,
            Math.max(
              0,
              Math.round(
                ejercicio.rir[1] -
                  (ejercicio.rir[1] - ejercicio.rir[0]) * progreso +
                  ctx.azar.ruido(0.6),
              ) - (ultima ? 1 : 0),
            ),
          )
        : null
      const comunes = { serieId, pesoKg, hecha: true, rir }
      if (medida.tipo === "repeticiones") {
        const tope = medida.repsMax ?? medida.reps
        const objetivo = medida.reps + Math.round((tope - medida.reps) * ((progreso * 3) % 1))
        const repeticiones = Math.max(1, objetivo - (ultima && ctx.azar.probabilidad(0.35) ? 1 : 0))
        series.push({ ...comunes, tipoMedicion: "repeticiones", repeticiones })
      } else if (medida.tipo === "tiempo") {
        series.push({ ...comunes, tipoMedicion: "tiempo", segundos: medida.segundos })
      } else {
        series.push({ ...comunes, tipoMedicion: "distancia", metros: medida.metros })
      }
    })
  })
  return series
}

// ─── Planes de cada cliente ───

type Molestia = Omit<RegistrarMolestia, "operacionId" | "ejercicioPrescritoId" | "serie"> & {
  /** Ejercicios en los que pudo aparecer, por orden de preferencia. */
  ejercicios: string[]
  respuesta?: string
}

type PlanCliente = {
  clave: Exclude<ClaveCliente, "javier">
  nombre: string
  /** Semanas completas antes de la actual en que empezó el plan (negativo = empieza después). */
  semanasAtras: number
  semanas: number
  dias: number[]
  incluirHoy: boolean
  /** Hora local a la que entrena. */
  hora: [number, number]
  sesiones: SesionDemo[]
  bloque: Bloque
  /** Probabilidad de hacer cada sesión pasada. */
  adherencia: number
  /** Días recientes sin entrenar (baja adherencia). */
  pausaDias?: number
  /** Las últimas N sesiones enviadas quedan sin revisar. */
  sinRevisarUltimas: number
  /** Cada cuántas sesiones revisadas comenta el entrenador. */
  comentarCada: number
  comentarios: string[]
  notasCliente: string[]
  /** Molestias por índice de sesión enviada (negativo: desde la última). */
  molestias: { indice: number; molestia: Molestia }[]
  /** Hoy deja la sesión a medias (borrador guardado). */
  enCursoHoy?: boolean
  /** Pregunta del cliente sobre su última sesión enviada, aún sin leer. */
  preguntaFinal?: { ejercicio: string; texto: string }
}

const fases = (...lista: [number, number, string, string | null][]): Bloque["fases"] =>
  lista.map(([desde, hasta, nombre, detalle]) => ({ desde, hasta, nombre, detalle }))

function planes(ctx: ContextoDemo): PlanCliente[] {
  const lista: PlanCliente[] = [
    {
      clave: "lucia",
      nombre: "Recomposición · 16 semanas",
      semanasAtras: 11,
      semanas: 16,
      dias: [1, 3, 5],
      incluirHoy: true,
      hora: [18, 30],
      sesiones: SESIONES_LUCIA,
      bloque: {
        objetivos: [
          "Bajar grasa conservando la fuerza",
          "Tres dominadas seguidas con la banda fina",
          "8.000 pasos al día de media",
        ],
        fases: fases(
          [1, 4, "Adaptación", "RIR 3 · técnica y cargas de partida"],
          [5, 8, "Hipertrofia", "RIR 2 · subir repeticiones antes que carga"],
          [9, 12, "Fuerza", "RIR 1–2 · doble progresión"],
          [13, 16, "Consolidar", "RIR 2 · mantener cargas con menos volumen"],
        ),
        deportes: [{ nombre: "Pádel", dias: [7], minutos: 90 }],
        notas: [
          "Si duermes menos de 6 horas, deja un RIR más en los ejercicios principales.",
          "Calienta cinco minutos en la bici antes de empezar.",
        ],
        pasosDiarios: 8000,
      },
      adherencia: 0.9,
      sinRevisarUltimas: 2,
      comentarCada: 3,
      comentarios: [
        "Muy buena sesión. La semana que viene sube 2,5 kg en el hip thrust.",
        "Se nota la constancia: las repeticiones salen limpias hasta el final.",
        "Bien el peso muerto rumano; sigue bajando controlado.",
        "Buen trabajo. En las laterales, sube despacio y sin impulso.",
        "Perfecta la dominada con banda: pronto probamos con la fina.",
      ],
      notasCliente: [
        "Me he notado muy fuerte hoy.",
        "Algo cansada del trabajo, pero ha salido bien.",
        "El último bloque del circuito se me ha hecho largo.",
      ],
      molestias: [
        {
          indice: 5,
          molestia: {
            zona: "hombro",
            intensidad: 3,
            sintomas: ["rigidez"],
            nota: "Molestia en el hombro derecho en las últimas repeticiones del press.",
            ejercicios: ["Press de hombros con mancuernas", "Press Arnold con mancuernas"],
            respuesta:
              "Baja a 6 kg esta semana y haz dos series de rotación externa con banda antes del press. Si no mejora, lo vemos en la próxima sesión.",
          },
        },
      ],
      enCursoHoy: true,
      preguntaFinal: {
        ejercicio: "Hip thrust con barra",
        texto: "¿Subo carga en el hip thrust? Las últimas repeticiones me salen con RIR 3.",
      },
    },
    {
      clave: "marcos",
      nombre: "Bloque de fuerza · 12 semanas",
      semanasAtras: 6,
      semanas: 12,
      dias: [2, 4, 5],
      incluirHoy: true,
      hora: [7, 15],
      sesiones: SESIONES_MARCOS,
      bloque: {
        objetivos: ["Sentadilla de 100 kg a cinco repeticiones", "Mantener el peso corporal"],
        fases: fases(
          [1, 4, "Base", "RIR 2 · volumen moderado"],
          [5, 8, "Intensificación", "RIR 1–2 · series de 5"],
          [9, 11, "Pico", "RIR 1 · menos volumen"],
          [12, 12, "Descarga", "Mitad de series, misma técnica"],
        ),
        deportes: [{ nombre: "Fútbol sala", dias: [3], minutos: 60 }],
        notas: ["El día de fútbol sala no entrenes pierna."],
        pasosDiarios: 9000,
      },
      adherencia: 0.85,
      sinRevisarUltimas: 1,
      comentarCada: 3,
      comentarios: [
        "Sentadilla sólida. Si la última serie sale con RIR 2, sube 2,5 kg.",
        "Bien el press militar: aprieta glúteo para no arquear.",
        "Buen ritmo en el remo, sigue así.",
      ],
      notasCliente: ["Dormí poco, he bajado un poco la carga.", "Hoy ha ido todo muy fluido."],
      molestias: [
        {
          indice: -1,
          molestia: {
            zona: "otra",
            intensidad: 4,
            sintomas: ["va_a_mas"],
            nota: "Rodilla derecha, por la parte de fuera. Me molesta desde el último día de pierna y va a más al bajar escaleras.",
            ejercicios: [
              "Sentadilla trasera con barra",
              "Prensa de piernas",
              "Peso muerto rumano con barra",
            ],
          },
        },
      ],
    },
    {
      clave: "sara",
      nombre: "Iniciación · 8 semanas",
      semanasAtras: 3,
      semanas: 8,
      dias: [2, 4],
      incluirHoy: false,
      hora: [19, 0],
      sesiones: SESIONES_SARA,
      bloque: {
        objetivos: ["Aprender la técnica de los básicos", "Dos sesiones por semana sin fallar"],
        fases: fases(
          [1, 4, "Técnica", "RIR 3 · cargas cómodas"],
          [5, 8, "Progresión", "RIR 2 · subir cargas poco a poco"],
        ),
        deportes: [],
        notas: ["Apunta las cargas aunque sean ligeras: nos sirven para progresar."],
        pasosDiarios: 7000,
      },
      adherencia: 0.95,
      sinRevisarUltimas: 1,
      comentarCada: 2,
      comentarios: [
        "Muy bien para ser las primeras semanas. Técnica cada vez mejor.",
        "Genial la sentadilla goblet: el pecho arriba en todo el recorrido.",
      ],
      notasCliente: ["¡Me está gustando mucho!"],
      molestias: [],
    },
    {
      clave: "nerea",
      nombre: "Vuelta a la rutina · 12 semanas",
      semanasAtras: 9,
      semanas: 12,
      dias: [2, 4],
      incluirHoy: true,
      hora: [20, 0],
      sesiones: SESIONES_NEREA,
      bloque: {
        objetivos: ["Recuperar el hábito: dos sesiones por semana", "Ganar movilidad de cadera"],
        fases: fases([1, 6, "Hábito", "RIR 3 · sesiones cortas"], [7, 12, "Progresión", "RIR 2"]),
        deportes: [],
        notas: ["Si una semana no puedes venir, haz al menos la sesión de tren inferior."],
      },
      adherencia: 0.4,
      pausaDias: 13,
      sinRevisarUltimas: 0,
      comentarCada: 2,
      comentarios: [
        "¡Bien por venir! Lo importante ahora es la constancia.",
        "Te echo de menos por aquí. ¿Buscamos otro horario que te venga mejor?",
      ],
      notasCliente: ["Semana complicada en el trabajo."],
      molestias: [],
    },
    {
      clave: "pablo",
      nombre: "Fuerza para corredor · 12 semanas",
      semanasAtras: 7,
      semanas: 12,
      dias: [1, 3, 6],
      incluirHoy: true,
      hora: [6, 45],
      sesiones: SESIONES_PABLO,
      bloque: {
        objetivos: [
          "Media maratón por debajo de 1 h 45 min",
          "Pierna fuerte para prevenir lesiones",
        ],
        fases: fases(
          [1, 4, "Base", "Fuerza general y rodajes suaves"],
          [5, 9, "Específico", "Potencia y series en cinta"],
          [10, 12, "Afinar", "Menos volumen antes de la carrera"],
        ),
        deportes: [{ nombre: "Carrera continua", dias: [2, 4, 7], minutos: 50 }],
        notas: ["El día después de la tirada larga, solo movilidad."],
        pasosDiarios: 10000,
      },
      adherencia: 0.65,
      sinRevisarUltimas: 2,
      comentarCada: 4,
      comentarios: [
        "Buen trabajo de fuerza; esto se va a notar en los últimos kilómetros.",
        "Swing potente. Cuida que la cadera empuje y no los brazos.",
      ],
      notasCliente: ["Hecho antes de trabajar, a primera hora."],
      molestias: [],
    },
  ]
  return lista.map((plan) => ({
    ...plan,
    dias: plan.incluirHoy ? conHoy(plan.dias, ctx.hoy) : plan.dias,
  }))
}

// ─── Escritura ───

type SesionAsignada = { id: string; fecha: string; sesion: SesionConIds }

async function asignar(
  ctx: ContextoDemo,
  clienteId: string,
  datos: {
    nombre: string
    semanaInicial: string
    semanas: number
    sesiones: SesionConIds[]
    bloque: Bloque
  },
): Promise<{ planId: string; sesiones: SesionAsignada[] }> {
  const asignado = await ctx.api.pedir<PlanAsignado>(
    ctx.entrenador,
    "POST",
    `/entrenamiento/clientes/${clienteId}/planes`,
    {
      operacionId: randomUUID(),
      nombre: datos.nombre,
      semanaInicial: datos.semanaInicial,
      semanas: datos.semanas,
      patron: patron(datos.sesiones),
      bloque: datos.bloque,
    },
  )
  const porNombre = new Map(datos.sesiones.map((s) => [s.nombre, s]))
  return {
    planId: asignado.id,
    sesiones: asignado.sesiones
      .map((s) => ({
        id: s.agenda.id,
        fecha: s.agenda.fechaActual,
        sesion: porNombre.get(s.nombre)!,
      }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha)),
  }
}

/** Una marca de tiempo pasada: nunca después de ahora. */
function antesDeAhora(fecha: Date, margenMin = 5): Date {
  const tope = Date.now() - margenMin * 60_000
  return new Date(Math.min(fecha.getTime(), tope))
}

/**
 * Lo que la API sella con la hora actual (envío, revisión, avisos, comentarios)
 * se mueve al día en que habría pasado. Solo marcas de tiempo.
 */
async function fecharSesion(
  ctx: ContextoDemo,
  sesionId: string,
  enviadoEn: Date,
  revisadaEn: Date | null,
): Promise<void> {
  const { prisma } = ctx
  const fila = await prisma.sesionEntrenamiento.findUniqueOrThrow({ where: { id: sesionId } })
  const resultado = {
    ...(fila.resultado as Prisma.JsonObject),
    enviadoEn: enviadoEn.toISOString(),
  }
  await prisma.sesionEntrenamiento.update({
    where: { id: sesionId },
    data: { enviadoEn, resultado, ...(revisadaEn && { revisadaEn }) },
  })
  const envio = await prisma.operacionEntrenamiento.findFirst({
    where: { sesionId, tipo: "envio" },
  })
  if (envio)
    await prisma.operacionEntrenamiento.update({
      where: { sesionId_operacionId: { sesionId, operacionId: envio.operacionId } },
      data: {
        creadoEn: enviadoEn,
        respuesta: {
          ...(envio.respuesta as Prisma.JsonObject),
          enviadoEn: enviadoEn.toISOString(),
        },
      },
    })
  const antes = new Date(enviadoEn.getTime() - 20 * 60_000)
  await prisma.molestia.updateMany({ where: { sesionId }, data: { creadaEn: antes } })
  await prisma.novedadEntrenamiento.updateMany({
    where: { sesionId, tipo: "molestia" },
    data: { creadaEn: antes },
  })
  await prisma.novedadEntrenamiento.updateMany({
    where: { sesionId, tipo: "entrenamiento_enviado" },
    data: { creadaEn: enviadoEn },
  })
  // Comentarios del cliente, justo después de enviar; los del entrenador, al revisar.
  const cliente = await prisma.comentarioSesion.findMany({
    where: { sesionId, autorId: fila.clienteId },
    select: { id: true },
  })
  const despues = new Date(enviadoEn.getTime() + 4 * 60_000)
  await prisma.comentarioSesion.updateMany({
    where: { id: { in: cliente.map((c) => c.id) } },
    data: { creadoEn: despues },
  })
  await prisma.novedadEntrenamiento.updateMany({
    where: { sesionId, tipo: "comentario", audiencia: "entrenador" },
    data: { creadaEn: despues },
  })
  if (revisadaEn) {
    const tras = new Date(revisadaEn.getTime() + 60_000)
    await prisma.novedadEntrenamiento.updateMany({
      where: { sesionId, tipo: { in: ["sesion_revisada", "molestia_atendida"] } },
      data: { creadaEn: revisadaEn },
    })
    await prisma.novedadEntrenamiento.updateMany({
      where: { sesionId, tipo: "comentario", audiencia: "cliente" },
      data: { creadaEn: tras },
    })
    await prisma.comentarioSesion.updateMany({
      where: { sesionId, autorId: { not: fila.clienteId } },
      data: { creadoEn: tras },
    })
    await prisma.molestia.updateMany({
      where: { sesionId, estado: "atendida" },
      data: { atendidaEn: revisadaEn },
    })
  }
}

type ResumenEntrenamiento = { planes: number; enviadas: number; revisadas: number; hoy: number }

async function sembrarPlanCliente(
  ctx: ContextoDemo,
  plan: PlanCliente,
  resumen: ResumenEntrenamiento,
): Promise<void> {
  const cuenta = ctx.clientes[plan.clave]
  const lunesHoy = lunesDeFecha(ctx.hoy)
  const semanaInicial = sumarDiasFecha(lunesHoy, -7 * plan.semanasAtras)
  const sesiones = conIds(ctx, plan.sesiones, plan.dias)
  const { planId, sesiones: agenda } = await asignar(ctx, cuenta.id, {
    nombre: plan.nombre,
    semanaInicial,
    semanas: plan.semanas,
    sesiones,
    bloque: plan.bloque,
  })
  resumen.planes++
  await ctx.prisma.planEntrenamiento.update({
    where: { id: planId },
    data: { creadoEn: instante(sumarDiasFecha(semanaInicial, -3), 12, 10) },
  })

  // Qué sesiones pasadas se hicieron: fijado antes de escribir para saber cuál es la última.
  const pasadas = agenda.filter((s) => s.fecha < ctx.hoy)
  const hechas = pasadas.filter(
    (s) =>
      ctx.azar.probabilidad(plan.adherencia) &&
      (plan.pausaDias === undefined || diasEntre(s.fecha, ctx.hoy) > plan.pausaDias),
  )
  const semanasPasadas = Math.max(1, plan.semanasAtras)
  let revisadas = 0

  for (const [indice, asignada] of hechas.entries()) {
    const desdeElFinal = indice - hechas.length
    const progreso = Math.min(
      1,
      Math.floor(diasEntre(semanaInicial, asignada.fecha) / 7) / semanasPasadas,
    )
    const inicio = instante(asignada.fecha, plan.hora[0], plan.hora[1] + ctx.azar.entero(0, 20))
    const tiempoActivo = ctx.azar.entero(48, 70) * 60
    const enviadoEn = antesDeAhora(new Date(inicio.getTime() + (tiempoActivo + 240) * 1000))

    const prevista = plan.molestias.find((m) => m.indice === indice || m.indice === desdeElFinal)
    let omitir: ((e: EjercicioConIds, serie: number) => boolean) | undefined
    if (prevista) {
      const ejercicio = prevista.molestia.ejercicios
        .map((nombre) => asignada.sesion.ejercicios.find((e) => e.nombre === nombre))
        .find((e) => e !== undefined)
      const serie = ejercicio ? Math.min(ejercicio.series, 3) : null
      const { zona, intensidad, sintomas, nota } = prevista.molestia
      await ctx.api.pedir(cuenta, "POST", `/entrenamiento/sesiones/${asignada.id}/molestias`, {
        zona,
        intensidad,
        sintomas,
        nota,
        operacionId: randomUUID(),
        ejercicioPrescritoId: ejercicio?.id ?? null,
        serie,
      })
      // Tras avisar, deja las series que quedaban de ese ejercicio.
      if (ejercicio && serie !== null)
        omitir = (e, numero) => e.id === ejercicio.id && numero >= serie
    }

    const registro: Registro = {
      series: registrarSeries(ctx, asignada.sesion, progreso, { ...(omitir && { omitir }) }),
      notas: ctx.azar.probabilidad(0.2) ? ctx.azar.elegir(plan.notasCliente) : null,
      checkin: {
        sensacion: ctx.azar.entero(3, 5),
        molestia: ctx.azar.probabilidad(0.15) ? "agujetas" : "nada",
      },
      cierre: {
        esfuerzo: ctx.azar.entero(6, 9),
        energia: ctx.azar.entero(3, 5),
        incomodo: prevista !== undefined,
      },
      inicio: inicio.toISOString(),
      tiempoActivoSegundos: tiempoActivo,
    }
    await ctx.api.pedir(cuenta, "POST", `/entrenamiento/sesiones/${asignada.id}/enviar`, {
      operacionId: randomUUID(),
      revisionPrescripcion: 0,
      revisionBorrador: 0,
      registro,
    })
    resumen.enviadas++

    const revisar = desdeElFinal < -plan.sinRevisarUltimas
    let revisadaEn: Date | null = null
    if (revisar) {
      await ctx.api.pedir(ctx.entrenador, "PUT", `/entrenamiento/sesiones/${asignada.id}/revision`)
      revisadaEn = antesDeAhora(
        instante(sumarDiasFecha(asignada.fecha, 1), 9, ctx.azar.entero(0, 50)),
      )
      revisadas++
      resumen.revisadas++
      if (revisadas % plan.comentarCada === 0)
        await ctx.api.pedir(
          ctx.entrenador,
          "POST",
          `/entrenamiento/sesiones/${asignada.id}/comentarios`,
          {
            operacionId: randomUUID(),
            ejercicioPrescritoId: null,
            texto: plan.comentarios[(revisadas / plan.comentarCada - 1) % plan.comentarios.length]!,
          },
        )
      if (prevista?.molestia.respuesta) {
        const { molestias } = await ctx.api.pedir<{
          molestias: { id: string; sesionId: string }[]
        }>(ctx.entrenador, "GET", `/entrenamiento/clientes/${cuenta.id}/molestias?estado=abierta`)
        for (const molestia of molestias.filter((m) => m.sesionId === asignada.id))
          await ctx.api.pedir(
            ctx.entrenador,
            "POST",
            `/entrenamiento/molestias/${molestia.id}/atender`,
            {
              respuesta: prevista.molestia.respuesta,
            },
          )
      }
    }
    const pregunta = desdeElFinal === -1 ? plan.preguntaFinal : undefined
    if (pregunta) {
      const ejercicio = asignada.sesion.ejercicios.find((e) => e.nombre === pregunta.ejercicio)
      await ctx.api.pedir(cuenta, "POST", `/entrenamiento/sesiones/${asignada.id}/comentarios`, {
        operacionId: randomUUID(),
        ejercicioPrescritoId: ejercicio?.id ?? null,
        texto: pregunta.texto,
      })
    }
    await fecharSesion(ctx, asignada.id, enviadoEn, revisadaEn)
  }

  // Hoy: la sesión de hoy queda pendiente o, si toca, a medias.
  const deHoy = agenda.filter((s) => s.fecha === ctx.hoy)
  resumen.hoy += deHoy.length
  if (plan.enCursoHoy)
    for (const asignada of deHoy) {
      const progreso = Math.min(
        1,
        Math.floor(diasEntre(semanaInicial, ctx.hoy) / 7) / semanasPasadas,
      )
      await ctx.api.pedir(cuenta, "PUT", `/entrenamiento/sesiones/${asignada.id}/borrador`, {
        operacionId: randomUUID(),
        revisionPrescripcion: 0,
        revisionBorrador: 0,
        registro: {
          series: registrarSeries(ctx, asignada.sesion, progreso, { hastaEjercicio: 2 }),
          notas: null,
          checkin: { sensacion: 4, molestia: "nada" },
          cierre: null,
          inicio: new Date(Date.now() - 25 * 60_000).toISOString(),
          tiempoActivoSegundos: 22 * 60,
        },
      })
    }
}

/** Rutinas guardadas del entrenador, para reutilizarlas con otros clientes. */
async function sembrarRutinas(ctx: ContextoDemo): Promise<number> {
  const rutinas: [string, SesionDemo[], number[]][] = [
    ["Pierna y glúteo · base", [SESIONES_LUCIA[0]!], [1]],
    ["Torso · base", [SESIONES_LUCIA[1]!], [3]],
    ["Full body principiante", SESIONES_SARA, [2, 4]],
    ["Fuerza de pierna 5×5", [SESIONES_MARCOS[0]!], [1]],
    ["Fuerza para corredores", SESIONES_PABLO, [1, 3, 6]],
  ]
  for (const [indice, [nombre, sesiones, dias]] of rutinas.entries()) {
    const guardada = await ctx.api.pedir<RutinaGuardada>(
      ctx.entrenador,
      "POST",
      "/entrenamiento/rutinas",
      {
        nombre,
        patron: patron(conIds(ctx, sesiones, dias)),
      },
    )
    const fecha = instante(sumarDiasFecha(ctx.hoy, -140 + indice * 23), 16, 5 * indice)
    await ctx.prisma.rutinaGuardada.update({
      where: { id: guardada.id },
      data: { creadoEn: fecha, actualizadoEn: fecha },
    })
  }
  return rutinas.length
}

/**
 * Marca como leídas las novedades de entrenamiento con más de `diasMinimos`
 * días, como si cada uno las hubiera abierto al día siguiente.
 */
async function leerNovedades(
  ctx: ContextoDemo,
  cuenta: Cuenta,
  clienteId: string,
  diasMinimos: number,
): Promise<void> {
  const limite = Date.now() - diasMinimos * 86_400_000
  const porSesion = new Map<string, string[]>()
  for (let desplazamiento = 0; ; desplazamiento += 100) {
    const pagina = await ctx.api.pedir<ListadoNovedades>(
      cuenta,
      "GET",
      `/entrenamiento/clientes/${clienteId}/novedades?limite=100&desplazamiento=${desplazamiento}`,
    )
    for (const novedad of pagina.novedades)
      if (novedad.leidaEn === null && Date.parse(novedad.creadaEn) < limite)
        porSesion.set(novedad.sesionId, [...(porSesion.get(novedad.sesionId) ?? []), novedad.id])
    if (desplazamiento + 100 >= pagina.total) break
  }
  for (const [sesionId, novedadIds] of porSesion)
    await ctx.api.pedir(cuenta, "POST", `/entrenamiento/sesiones/${sesionId}/novedades/leidas`, {
      novedadIds,
    })
}

export async function sembrarEntrenamiento(ctx: ContextoDemo): Promise<ResumenEntrenamiento> {
  const resumen: ResumenEntrenamiento = { planes: 0, enviadas: 0, revisadas: 0, hoy: 0 }
  const rutinas = await sembrarRutinas(ctx)
  ctx.informar(`  ${rutinas} rutinas guardadas`)

  for (const plan of planes(ctx)) await sembrarPlanCliente(ctx, plan, resumen)

  // Javier aún no ha activado su cuenta, pero ya tiene su plan para la semana que viene.
  const lunesSiguiente = sumarDiasFecha(lunesDeFecha(ctx.hoy), 7)
  await asignar(ctx, ctx.ids.javier, {
    nombre: "Primeras semanas",
    semanaInicial: lunesSiguiente,
    semanas: 6,
    sesiones: conIds(ctx, SESIONES_JAVIER, [1, 4]),
    bloque: {
      objetivos: ["Empezar con buena técnica", "Crear el hábito"],
      fases: fases([1, 3, "Técnica", "RIR 3"], [4, 6, "Progresión", "RIR 2"]),
      deportes: [],
      notas: ["Activa tu cuenta para ver las sesiones en la app."],
    },
  })
  resumen.planes++

  // Lo antiguo ya está leído; lo de los últimos días sigue como novedad.
  for (const clave of ["lucia", "marcos", "sara", "nerea", "pablo"] as const) {
    const cliente = ctx.clientes[clave]
    await leerNovedades(ctx, ctx.entrenador, cliente.id, 3)
    await leerNovedades(ctx, cliente, cliente.id, 2)
  }
  const ids = Object.values(ctx.ids)
  await ctx.prisma.$executeRaw`
    UPDATE "lecturas_novedades" AS l
    SET "leidaEn" = LEAST(n."creadaEn" + interval '14 hours', now())
    FROM "novedades_entrenamiento" AS n
    WHERE l."novedadId" = n."id" AND n."clienteId" = ANY(${ids}::text[])`
  return resumen
}
