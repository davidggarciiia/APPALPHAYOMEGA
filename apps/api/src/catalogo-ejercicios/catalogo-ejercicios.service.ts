import { ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common"
import {
  GRUPOS_MUSCULARES,
  normalizarNombreEjercicio,
  type BuscarEjercicios,
  type CrearEjercicio,
  type EditarEjercicio,
  type Ejercicio,
  type GrupoMuscular,
  type ListadoEjercicios,
  type Rol,
} from "@alpha-omega/shared"
import type { Prisma } from "@prisma/client"

import { conflicto, esViolacionDeUnicidad } from "../comun/conflictos.js"
import { PrismaService } from "../prisma/prisma.service.js"

const CON_GRUPOS = { gruposSecundarios: { select: { grupo: true } } } as const

type FilaEjercicio = Prisma.EjercicioGetPayload<{ include: typeof CON_GRUPOS }>

/** Orden estable de los grupos, el del vocabulario y no el de la base. */
function ordenarGrupos(grupos: GrupoMuscular[]): GrupoMuscular[] {
  return [...grupos].sort((a, b) => GRUPOS_MUSCULARES.indexOf(a) - GRUPOS_MUSCULARES.indexOf(b))
}

/** Lo que sale del servidor, campo a campo. Figura y vídeo son huecos ausentes. */
export function aEjercicio(fila: FilaEjercicio): Ejercicio {
  return {
    id: fila.id,
    nombre: fila.nombre,
    grupoPrincipal: fila.grupoPrincipal,
    gruposSecundarios: ordenarGrupos(fila.gruposSecundarios.map((g) => g.grupo)),
    instrucciones: fila.instrucciones,
    estado: fila.estado,
    figura: null,
    video: null,
  }
}

/**
 * El catálogo único de ejercicios (SPEC-catalogo-ejercicios.md).
 *
 * El cliente lee y el entrenador escribe. Nada se borra: retirar saca el
 * ejercicio del presente y el histórico de entrenos lo sigue encontrando.
 */
@Injectable()
export class CatalogoEjerciciosService {
  private readonly registro = new Logger(CatalogoEjerciciosService.name)

  constructor(private readonly prisma: PrismaService) {}

  async buscar(rol: Rol, filtros: BuscarEjercicios): Promise<ListadoEjercicios> {
    if (rol !== "entrenador" && filtros.estado !== "publicado") {
      throw new ForbiddenException("Solo el entrenador ve los ejercicios retirados")
    }

    const where: Prisma.EjercicioWhereInput = {
      ...(filtros.estado !== "todos" && { estado: filtros.estado }),
      ...(filtros.buscar !== undefined &&
        filtros.buscar !== "" && {
          nombreNormalizado: { contains: normalizarNombreEjercicio(filtros.buscar) },
        }),
      ...(filtros.grupo !== undefined && {
        OR: [
          { grupoPrincipal: filtros.grupo },
          { gruposSecundarios: { some: { grupo: filtros.grupo } } },
        ],
      }),
    }

    const [filas, total] = await Promise.all([
      this.prisma.ejercicio.findMany({
        where,
        include: CON_GRUPOS,
        orderBy: [{ nombreNormalizado: "asc" }, { id: "asc" }],
        skip: filtros.desplazamiento,
        take: filtros.limite,
      }),
      this.prisma.ejercicio.count({ where }),
    ])

    return { ejercicios: filas.map(aEjercicio), total }
  }

  /**
   * Varios ejercicios por id, publicados o retirados.
   *
   * Sirve para poner nombre a una rutina guardada o a un entreno antiguo. Un
   * retirado se sigue abriendo por su identificador (requisito 3).
   */
  async porIds(ids: string[]): Promise<ListadoEjercicios> {
    const filas = await this.prisma.ejercicio.findMany({
      where: { id: { in: ids } },
      include: CON_GRUPOS,
      orderBy: [{ nombreNormalizado: "asc" }, { id: "asc" }],
    })
    return { ejercicios: filas.map(aEjercicio), total: filas.length }
  }

  async leer(id: string): Promise<Ejercicio> {
    return aEjercicio(await this.buscarFila(id))
  }

  async crear(datos: CrearEjercicio): Promise<Ejercicio> {
    const nombreNormalizado = normalizarNombreEjercicio(datos.nombre)
    await this.exigirNombreLibre(nombreNormalizado, null)

    try {
      const fila = await this.prisma.ejercicio.create({
        data: {
          nombre: datos.nombre.replace(/\s+/g, " "),
          nombreNormalizado,
          grupoPrincipal: datos.grupoPrincipal,
          instrucciones: datos.instrucciones,
          gruposSecundarios: { create: datos.gruposSecundarios.map((grupo) => ({ grupo })) },
        },
        include: CON_GRUPOS,
      })
      this.registro.log(`Ejercicio ${fila.id} creado`)
      return aEjercicio(fila)
    } catch (error) {
      // Dos altas simultáneas con el mismo nombre: la base decide y la segunda pierde.
      if (esViolacionDeUnicidad(error)) {
        throw conflicto("nombre_duplicado", "Ya existe un ejercicio con ese nombre")
      }
      throw error
    }
  }

  async editar(id: string, datos: EditarEjercicio): Promise<Ejercicio> {
    await this.buscarFila(id)
    const nombreNormalizado = normalizarNombreEjercicio(datos.nombre)
    await this.exigirNombreLibre(nombreNormalizado, id)

    try {
      const fila = await this.prisma.$transaction(async (tx) => {
        await tx.grupoSecundarioDeEjercicio.deleteMany({ where: { ejercicioId: id } })
        return tx.ejercicio.update({
          where: { id },
          data: {
            nombre: datos.nombre.replace(/\s+/g, " "),
            nombreNormalizado,
            grupoPrincipal: datos.grupoPrincipal,
            instrucciones: datos.instrucciones,
            gruposSecundarios: { create: datos.gruposSecundarios.map((grupo) => ({ grupo })) },
          },
          include: CON_GRUPOS,
        })
      })
      return aEjercicio(fila)
    } catch (error) {
      if (esViolacionDeUnicidad(error)) {
        throw conflicto("nombre_duplicado", "Ya existe un ejercicio con ese nombre")
      }
      throw error
    }
  }

  /** Idempotente: retirar uno ya retirado lo deja igual y conserva cuándo se retiró. */
  async retirar(id: string): Promise<Ejercicio> {
    await this.buscarFila(id)
    await this.prisma.ejercicio.updateMany({
      where: { id, estado: "publicado" },
      data: { estado: "retirado", retiradoEn: new Date() },
    })
    return this.leer(id)
  }

  async reponer(id: string): Promise<Ejercicio> {
    await this.buscarFila(id)
    await this.prisma.ejercicio.updateMany({
      where: { id, estado: "retirado" },
      data: { estado: "publicado", retiradoEn: null },
    })
    return this.leer(id)
  }

  private async buscarFila(id: string): Promise<FilaEjercicio> {
    const fila = await this.prisma.ejercicio.findUnique({ where: { id }, include: CON_GRUPOS })
    if (fila === null) {
      throw new NotFoundException("Este ejercicio no existe")
    }
    return fila
  }

  private async exigirNombreLibre(nombreNormalizado: string, propio: string | null): Promise<void> {
    const otro = await this.prisma.ejercicio.findUnique({
      where: { nombreNormalizado },
      select: { id: true },
    })
    if (otro !== null && otro.id !== propio) {
      // Con el id, el selector puede ofrecer el que ya existe en vez de otro igual.
      throw conflicto("nombre_duplicado", "Ya existe un ejercicio con ese nombre", {
        ejercicioId: otro.id,
      })
    }
  }
}
