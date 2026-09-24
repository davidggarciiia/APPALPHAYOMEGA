import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common"
import { existsSync } from "node:fs"
import type {
  AsignarFigura,
  BuscarEjercicios,
  CrearEjercicio,
  EditarEjercicio,
  Ejercicio,
  ErrorDeApi,
  Figura,
  ListadoEjercicios,
  ListadoMedios,
  Rol,
} from "@alpha-omega/shared"
import type { Prisma } from "@prisma/client"

import { PrismaService } from "../prisma/prisma.service.js"

import {
  carpetaDeMedios,
  mediosDisponibles,
  rutaDelPoster,
  rutaDelVideo,
} from "./almacen-medios.js"
import { medioDelIndice } from "./medios.js"

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
  contenidos: { where: { tipo: "figura" } },
} satisfies Prisma.EjercicioInclude

type Fila = Prisma.EjercicioGetPayload<{ include: typeof CON_SECUNDARIOS }>

/**
 * De la fila a lo que viaja.
 *
 * Campo a campo y no con un spread: `nombreNormalizado` y las fechas son asunto
 * del servidor, y el contrato es estricto precisamente para que no se escapen.
 * El video va siempre como ausente y no omitido: la ficha dibuja su hueco desde
 * el primer dia. La figura sale del indice de medios cuando hay una asociada.
 */
function aEjercicio(fila: Fila): Ejercicio {
  return {
    id: fila.id,
    nombre: fila.nombre,
    grupoPrincipal: fila.grupoPrincipal,
    gruposSecundarios: fila.gruposSecundarios.map((secundario) => secundario.grupo),
    instrucciones: fila.instrucciones,
    estado: fila.estado,
    figura: aFigura(fila.contenidos[0]),
    video: null,
  }
}

/** La figura asociada, si su medio sigue en el índice. La clave no sale del servidor. */
function aFigura(contenido: Fila["contenidos"][number] | undefined): Figura | null {
  const medio = contenido === undefined ? undefined : medioDelIndice(contenido.claveDeObjeto)
  if (contenido === undefined || medio === undefined) return null
  return {
    medioId: medio.id,
    version: medio.version,
    origen: contenido.origen,
    licencia: contenido.licencia ?? medio.licencia,
    sinConexion: medio.sinConexion,
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
   * Saca el ejercicio del presente sin tocar el pasado: deja de salir en la
   * busqueda y en el selector, y los entrenos que lo citan lo siguen abriendo.
   */
  async retirar(id: string): Promise<Ejercicio> {
    return this.cambiarEstado(id, "publicado", { estado: "retirado", retiradoEn: new Date() })
  }

  /** Retirar por error no puede exigir entrar en la base de datos a mano. */
  async reponer(id: string): Promise<Ejercicio> {
    return this.cambiarEstado(id, "retirado", { estado: "publicado", retiradoEn: null })
  }

  /** Las figuras del índice que este servidor tiene importadas. */
  medios(): ListadoMedios {
    const medios = mediosDisponibles().map((medio) => ({
      id: medio.id,
      nombre: medio.nombre,
      fuente: medio.fuente,
      licencia: medio.licencia,
      sinConexion: medio.sinConexion,
    }))
    return { medios, total: medios.length }
  }

  /**
   * Asocia una figura del índice, o la quita con `null`. Solo se aceptan medios
   * importados en este servidor: nunca una URL ni un archivo arbitrario.
   */
  async asignarFigura(id: string, datos: AsignarFigura): Promise<Ejercicio> {
    await this.leer(id)
    if (datos.medioId === null) {
      await this.prisma.contenidoDeEjercicio.deleteMany({
        where: { ejercicioId: id, tipo: "figura" },
      })
      return this.leer(id)
    }
    const medio = mediosDisponibles().find((disponible) => disponible.id === datos.medioId)
    if (medio === undefined) {
      throw new ConflictException({
        statusCode: 409,
        codigo: "operacion_incompatible",
        message: "Esa figura no está disponible en este servidor",
      } satisfies ErrorDeApi)
    }
    const contenido = {
      claveDeObjeto: medio.id,
      origen: "licenciado" as const,
      licencia: medio.licencia,
      subidoEn: new Date(),
    }
    await this.prisma.contenidoDeEjercicio.upsert({
      where: { ejercicioId_tipo: { ejercicioId: id, tipo: "figura" } },
      create: { ejercicioId: id, tipo: "figura", ...contenido },
      update: contenido,
    })
    return this.leer(id)
  }

  /**
   * El archivo de la figura de un ejercicio, publicado o retirado (el histórico
   * la sigue enseñando). 404 si no tiene figura o el archivo no está.
   */
  async archivoDeFigura(id: string, parte: "video" | "poster"): Promise<string> {
    const figura = (await this.leer(id)).figura
    const carpeta = carpetaDeMedios()
    const medio = figura === null ? undefined : medioDelIndice(figura.medioId)
    const ruta =
      carpeta === null || medio === undefined
        ? null
        : parte === "video"
          ? rutaDelVideo(carpeta, medio)
          : rutaDelPoster(carpeta, medio)
    if (ruta === null || !existsSync(ruta)) {
      throw new NotFoundException("Este ejercicio no tiene figura disponible")
    }
    return ruta
  }

  /**
   * Solo escribe si el ejercicio esta en el estado de partida. Repetir la
   * operacion no toca nada, asi que no mueve `retiradoEn`, y dos peticiones a
   * la vez acaban igual que una. Despues se lee la fila: si no existe, 404.
   */
  private async cambiarEstado(
    id: string,
    desde: Ejercicio["estado"],
    cambio: Pick<Prisma.EjercicioUpdateManyMutationInput, "estado" | "retiradoEn">,
  ): Promise<Ejercicio> {
    await this.prisma.ejercicio.updateMany({ where: { id, estado: desde }, data: cambio })

    return this.leer(id)
  }

  /**
   * El nombre unico lo impone la base, no una consulta previa: dos altas a la
   * vez pasarian las dos por un "¿existe ya?" y solo el indice las distingue.
   */
  private traducir(error: unknown): unknown {
    const codigo = codigoDePrisma(error)

    if (codigo === NOMBRE_REPETIDO) {
      // Con `codigo`, como fija el contrato de errores: el formulario pinta este
      // rechazo en el campo del nombre sin interpretar el texto.
      return new ConflictException({
        statusCode: 409,
        codigo: "nombre_duplicado",
        message: "Ya existe un ejercicio con ese nombre",
      } satisfies ErrorDeApi)
    }

    if (codigo === FILA_INEXISTENTE) {
      return new NotFoundException("Este ejercicio no existe")
    }

    return error
  }
}
