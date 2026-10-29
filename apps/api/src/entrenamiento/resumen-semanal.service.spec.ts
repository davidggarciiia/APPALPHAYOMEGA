import { ForbiddenException } from "@nestjs/common"
import { PrescripcionSchema, ResultadoEntrenamientoSchema } from "@alpha-omega/shared"
import type { PrismaService } from "../prisma/prisma.service.js"
import { ResumenSemanalService } from "./resumen-semanal.service.js"

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const actor = { sub: uuid(1), rol: "entrenador" as const, sid: uuid(2) }
const cliente = { id: uuid(3), nombre: "Ana", apellidos: "García" }

function enviada(n: number, fecha: string, pesoKg: number) {
  const prescripcion = PrescripcionSchema.parse({
    nombre: "Fuerza",
    ejercicios: [
      {
        id: uuid(10),
        ejercicioId: uuid(11),
        nombre: "Sentadilla",
        indicaciones: null,
        compuesto: true,
        series: [{ id: uuid(12), tipoMedicion: "repeticiones", pesoKg, repeticiones: 8 }],
      },
    ],
  })
  return {
    id: uuid(n),
    clienteId: cliente.id,
    version: 1,
    agenda: { fechaActual: new Date(fecha) },
    resultado: ResultadoEntrenamientoSchema.parse({
      sesionId: uuid(n),
      prescripcion,
      revisionPrescripcion: 0,
      enviadoEn: `${fecha}T12:00:00Z`,
      notas: null,
      series: [
        {
          serieId: uuid(12),
          hecha: true,
          valores: { tipoMedicion: "repeticiones", pesoKg, repeticiones: 8, rir: null },
        },
      ],
    }),
  }
}

function entorno(clientes = [cliente], filas = [enviada(20, "2026-10-19", 60)]) {
  const consultas: unknown[] = []
  const consultar =
    <T>(valor: T) =>
    async (consulta: unknown) => {
      consultas.push(consulta)
      return valor
    }
  const prisma = {
    usuario: { findMany: consultar(clientes) },
    sesionEntrenamiento: {
      findMany: consultar(filas),
      groupBy: consultar([{ clienteId: cliente.id, _count: { _all: 3 } }]),
    },
    molestia: { findMany: consultar([]) },
  }
  return {
    servicio: new ResumenSemanalService(prisma as unknown as PrismaService),
    consultas,
  }
}

describe("ResumenSemanalService", () => {
  it("cierra el acceso antes de consultar datos", async () => {
    const { servicio, consultas } = entorno()
    await expect(servicio.resumen({ ...actor, rol: "cliente" }, "2026-10-19")).rejects.toThrow(
      ForbiddenException,
    )
    expect(consultas).toHaveLength(0)
  })

  it("devuelve una cartera vacía sin consultar sesiones ni molestias", async () => {
    const { servicio, consultas } = entorno([])
    await expect(servicio.resumen(actor, "2026-10-19")).resolves.toEqual({
      semana: "2026-10-19",
      clientes: [],
    })
    expect(consultas).toHaveLength(1)
  })

  it("reutiliza E1 para la baja de dos sesiones y el récord de todo el historial", async () => {
    const { servicio } = entorno(
      [cliente],
      [
        enviada(20, "2026-10-05", 100),
        enviada(21, "2026-10-12", 80),
        enviada(22, "2026-10-19", 60),
      ],
    )
    const resumen = await servicio.resumen(actor, "2026-10-19")
    expect(resumen.clientes[0]).toMatchObject({
      clienteId: cliente.id,
      sesionesPrevistas: 3,
      sesionesEnviadas: 1,
      ejercicios: [
        {
          mejorSerie: { pesoKg: 60, rir: null, estimado1RM: 76 },
          mejorSerieAnterior: { pesoKg: 80 },
          comparacion: { direccion: "baja", diferenciaKg: -20 },
          estado: "Baja",
          record: false,
        },
      ],
    })
  })

  it("mantiene cuatro consultas por lotes con uno o quince clientes sin leer borradores", async () => {
    for (const cantidad of [1, 15]) {
      const clientes = Array.from({ length: cantidad }, (_, n) => ({
        ...cliente,
        id: uuid(30 + n),
      }))
      const { servicio, consultas } = entorno(clientes)
      const resumen = await servicio.resumen(actor, "2026-10-19")
      expect(resumen.clientes).toHaveLength(cantidad)
      expect(consultas).toHaveLength(4)
      expect(JSON.stringify(consultas)).not.toContain("borrador")
      expect(consultas[0]).toMatchObject({ where: { rol: "cliente", estado: "activo" } })
    }
  })
})
