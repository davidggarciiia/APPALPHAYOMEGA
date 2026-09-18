import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common"
import type {
  BuscarEjercicios,
  CrearEjercicio,
  EditarEjercicio,
  Ejercicio,
  ListadoEjercicios,
  Rol,
} from "@alpha-omega/shared"
import type { Prisma } from "@prisma/client"

import { PrismaService } from "../prisma/prisma.service.js"

/**
 * La forma en que se compara un nombre con otro.
 *
 * "Press  de Banca" y "press de banca" son el mismo ejercicio. Sin esto acaban
 * los dos en el selector de rutinas y las series de un cliente se reparten entre
 * ambos. Los acentos SI cuentan: plegarlos exige decidir que hacer con la ene, y
 * un catalogo de decenas de ejercicios no lo compensa todavia.
 */
export function normalizarNombre(nombre: string): string {
  return nombre.trim().replace(/\s+/g, " ").toLocaleLowerCase("es")
}

/**
 * Los secundarios se piden siempre, y siempre en el mismo orden, para que dos
 * lecturas de la misma ficha sean iguales.
 */
const CON_SECUNDARIOS = {
  gruposSecundarios: { select: { grupo: true }, orderBy: { grupo: "asc" } },
} satisfies Prisma.EjercicioInclude

type Fila = Prisma.EjercicioGetPayload<{ include: typeof CON_SECUNDARIOS }>

/**
 * De la fila a lo que viaja.
 *
 * Campo a campo y no con un spread: `nombreNormalizado` y las fechas son asunto
 * del servidor, y el contrato es estricto precisamente para que no se escapen.
 * Figura y video van como ausentes y no omitidos: la ficha dibuja su hueco
 * desde el primer dia aunque esta entrega no guarde medios.
 */
function aEjercicio(fila: Fila): Ejercicio {
  return {
    id: fila.id,
    nombre: fila.nombre,
    grupoPrincipal: fila.grupoPrincipal,
    gruposSecundarios: fila.gruposSecundarios.map((secundario) => secundario.grupo),
    instrucciones: fila.instrucciones,
    estado: fila.estado,
    figura: null,
    video: null,
  }
}

/** El codigo de un error conocido de Prisma, o nada si es otra cosa. */
function codigoDePrisma(error: unknown): string | undefined {
  return typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
    ? error.code
    : undefined
}

const NOMBRE_REPETIDO = "P2002"
const FILA_INEXISTENTE = "P2025"

/**
 * El catalogo unico de ejercicios.
 *
 * No hay ningun metodo que borre: un ejercicio se retira, y el historico de
 * entrenos sigue apuntando a su fila. Tampoco hay ninguna referencia a un
 * usuario: quien autoriza es el rol, no la pertenencia a un cliente.
 */
@Injectable()
export class CatalogoEjerciciosService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Busca en el catalogo. Devuelve el total ademas de la pagina, para que la
   * app pueda decir "mostrando 30 de 140" en lugar de cortar en silencio.
   */
  async buscar(rol: Rol, filtros: BuscarEjercicios): Promise<ListadoEjercicios> {
    if (rol === "cliente" && filtros.estado !== "publicado") {
      // Ver los retirados es del entrenador. Se deniega en voz alta en lugar de
      // devolver los publicados: una lista que ignora el filtro parece correcta.
      throw new ForbiddenException("Tu perfil solo puede ver ejercicios publicados")
    }

    const donde: Prisma.EjercicioWhereInput = {
      ...(filtros.estado !== "todos" && { estado: filtros.estado }),
      ...(filtros.buscar !== undefined &&
        filtros.buscar !== "" && {
          nombreNormalizado: { contains: normalizarNombre(filtros.buscar) },
        }),
      // El principal decide donde sale en el mapa muscular; los secundarios
      // solo amplian la busqueda (requisito 6), asi que el filtro mira los dos.
      ...(filtros.grupo !== undefined && {
        OR: [
          { grupoPrincipal: filtros.grupo },
          { gruposSecundarios: { some: { grupo: filtros.grupo } } },
        ],
      }),
    }

    const [filas, total] = await Promise.all([
      this.prisma.ejercicio.findMany({
        where: donde,
        include: CON_SECUNDARIOS,
        // El id desempata para que paginar no repita ni se salte filas.
        orderBy: [{ nombreNormalizado: "asc" }, { id: "asc" }],
        skip: filtros.desplazamiento,
        take: filtros.limite,
      }),
      this.prisma.ejercicio.count({ where: donde }),
    ])

    return { ejercicios: filas.map(aEjercicio), total }
  }

  /** La ficha por su id. Un retirado se sigue abriendo: su `estado` lo dice. */
  async leer(id: string): Promise<Ejercicio> {
    const fila = await this.prisma.ejercicio.findUnique({
      where: { id },
      include: CON_SECUNDARIOS,
    })

    if (fila === null) {
      throw new NotFoundException("Este ejercicio no existe")
    }

    return aEjercicio(fila)
  }

  async crear(datos: CrearEjercicio): Promise<Ejercicio> {
    try {
      const fila = await this.prisma.ejercicio.create({
        data: {
          nombre: datos.nombre,
          nombreNormalizado: normalizarNombre(datos.nombre),
          grupoPrincipal: datos.grupoPrincipal,
          instrucciones: datos.instrucciones,
          gruposSecundarios: { create: datos.gruposSecundarios.map((grupo) => ({ grupo })) },
        },
        include: CON_SECUNDARIOS,
      })

      return aEjercicio(fila)
    } catch (error) {
      throw this.traducir(error)
    }
  }

  /**
   * Sustituye la ficha de texto entera. No toca el estado: editar un ejercicio
   * retirado no lo repone.
   */
  async editar(id: string, datos: EditarEjercicio): Promise<Ejercicio> {
    try {
      const fila = await this.prisma.ejercicio.update({
        where: { id },
        data: {
          nombre: datos.nombre,
          nombreNormalizado: normalizarNombre(datos.nombre),
          grupoPrincipal: datos.grupoPrincipal,
          instrucciones: datos.instrucciones,
          // Una sola escritura anidada: o cambian ficha y secundarios, o nada.
          gruposSecundarios: {
            deleteMany: {},
            create: datos.gruposSecundarios.map((grupo) => ({ grupo })),
          },
        },
        include: CON_SECUNDARIOS,
      })

      return aEjercicio(fila)
    } catch (error) {
      throw this.traducir(error)
    }
  }

  /**
   * El nombre unico lo impone la base, no una consulta previa: dos altas a la
   * vez pasarian las dos por un "¿existe ya?" y solo el indice las distingue.
   */
  private traducir(error: unknown): unknown {
    const codigo = codigoDePrisma(error)

    if (codigo === NOMBRE_REPETIDO) {
      return new ConflictException("Ya existe un ejercicio con ese nombre")
    }

    if (codigo === FILA_INEXISTENTE) {
      return new NotFoundException("Este ejercicio no existe")
    }

    return error
  }
}
