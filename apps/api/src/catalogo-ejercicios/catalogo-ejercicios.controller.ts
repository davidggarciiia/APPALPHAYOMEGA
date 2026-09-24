import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
} from "@nestjs/common"
import {
  AsignarFiguraSchema,
  BuscarEjerciciosSchema,
  CrearEjercicioSchema,
  EditarEjercicioSchema,
  type AsignarFigura,
  type BuscarEjercicios,
  type CrearEjercicio,
  type EditarEjercicio,
  type Ejercicio,
  type ListadoEjercicios,
  type ListadoMedios,
} from "@alpha-omega/shared"
import { z } from "zod"

import { EntradaApiPipe } from "../comun/entrada-api.pipe.js"
import type { PeticionAutenticada } from "../identity/peticion.js"
import { Roles } from "../identity/roles.decorator.js"

import { CatalogoEjerciciosService } from "./catalogo-ejercicios.service.js"

/** Lo único que se usa de la respuesta de Express: enviar un archivo con rangos. */
type RespuestaDeArchivo = {
  headersSent: boolean
  sendFile: (
    ruta: string,
    opciones: { headers: Record<string, string>; dotfiles: "allow" },
    alTerminar: (error?: Error & { status?: number }) => void,
  ) => void
  status: (codigo: number) => { end: () => void }
}

/** Una ruta es entrada de fuera: sin esto un id cualquiera llega a la base y sale como 500. */
const IdEjercicioSchema = z.uuid()

/**
 * El catalogo tiene una sola frontera: el cliente lee y el entrenador escribe.
 *
 * El nutricionista y el empleado no aparecen en ningun decorador, y eso los
 * deja fuera por el cierre por defecto. No se usa `AlcanceClienteGuard`: un
 * ejercicio no pertenece a ningun cliente, asi que aqui autoriza el rol. Dar
 * acceso al nutricionista por tener clientes asignados seria abrirle un modulo
 * entero por una relacion que no tiene nada que ver.
 *
 * No hay ninguna ruta DELETE y no se anade: un ejercicio se retira.
 */
@Controller("ejercicios")
export class CatalogoEjerciciosController {
  constructor(private readonly catalogo: CatalogoEjerciciosService) {}

  @Roles("cliente", "entrenador")
  @Get()
  async buscar(
    @Req() peticion: PeticionAutenticada,
    @Query(new EntradaApiPipe(BuscarEjerciciosSchema)) filtros: BuscarEjercicios,
  ): Promise<ListadoEjercicios> {
    // El guard de roles ya ha exigido un usuario. Si faltara, se trata como el
    // rol que menos ve.
    return this.catalogo.buscar(peticion.usuario?.rol ?? "cliente", filtros)
  }

  @Roles("entrenador")
  @Post()
  async crear(
    @Body(new EntradaApiPipe(CrearEjercicioSchema)) datos: CrearEjercicio,
  ): Promise<Ejercicio> {
    return this.catalogo.crear(datos)
  }

  /** Declarada antes que `:id`: si no, "medios" llegaría como identificador. */
  @Roles("entrenador")
  @Get("medios")
  medios(): ListadoMedios {
    return this.catalogo.medios()
  }

  @Roles("cliente", "entrenador")
  @Get(":id")
  async leer(@Param("id", new EntradaApiPipe(IdEjercicioSchema)) id: string): Promise<Ejercicio> {
    return this.catalogo.leer(id)
  }

  @Roles("entrenador")
  @Patch(":id")
  async editar(
    @Param("id", new EntradaApiPipe(IdEjercicioSchema)) id: string,
    @Body(new EntradaApiPipe(EditarEjercicioSchema)) datos: EditarEjercicio,
  ): Promise<Ejercicio> {
    return this.catalogo.editar(id, datos)
  }

  /** 200 y no el 201 por defecto de un POST: no crea nada, mueve un estado. */
  @Roles("entrenador")
  @Post(":id/retirar")
  @HttpCode(HttpStatus.OK)
  async retirar(
    @Param("id", new EntradaApiPipe(IdEjercicioSchema)) id: string,
  ): Promise<Ejercicio> {
    return this.catalogo.retirar(id)
  }

  @Roles("entrenador")
  @Post(":id/reponer")
  @HttpCode(HttpStatus.OK)
  async reponer(
    @Param("id", new EntradaApiPipe(IdEjercicioSchema)) id: string,
  ): Promise<Ejercicio> {
    return this.catalogo.reponer(id)
  }

  /** Asocia una figura del índice o la quita con `null`. No hay ruta DELETE. */
  @Roles("entrenador")
  @Put(":id/figura")
  async asignarFigura(
    @Param("id", new EntradaApiPipe(IdEjercicioSchema)) id: string,
    @Body(new EntradaApiPipe(AsignarFiguraSchema)) datos: AsignarFigura,
  ): Promise<Ejercicio> {
    return this.catalogo.asignarFigura(id, datos)
  }

  /**
   * El vídeo de la figura, después de comprobar el rol. Admite peticiones por
   * rangos, que es como lo piden los reproductores. Privado: sin caché compartida.
   */
  @Roles("cliente", "entrenador")
  @Get(":id/figura")
  async video(
    @Param("id", new EntradaApiPipe(IdEjercicioSchema)) id: string,
    @Res() respuesta: RespuestaDeArchivo,
  ): Promise<void> {
    enviar(respuesta, await this.catalogo.archivoDeFigura(id, "video"), "video/mp4")
  }

  @Roles("cliente", "entrenador")
  @Get(":id/figura/poster")
  async poster(
    @Param("id", new EntradaApiPipe(IdEjercicioSchema)) id: string,
    @Res() respuesta: RespuestaDeArchivo,
  ): Promise<void> {
    enviar(respuesta, await this.catalogo.archivoDeFigura(id, "poster"), "image/jpeg")
  }
}

/**
 * La ruta sale del índice, nunca de la petición: por eso se admiten carpetas con
 * punto (`~/.local/...`). Con callback, Express deja la respuesta en nuestras
 * manos si falla: un rango imposible (416) o el archivo borrado entre medias.
 */
function enviar(respuesta: RespuestaDeArchivo, ruta: string, tipo: string): void {
  respuesta.sendFile(
    ruta,
    {
      headers: { "Content-Type": tipo, "Cache-Control": "private, max-age=86400" },
      dotfiles: "allow",
    },
    (error) => {
      // Un corte del cliente a mitad de descarga ya tiene las cabeceras enviadas.
      if (error !== undefined && !respuesta.headersSent) {
        respuesta.status(error.status ?? 500).end()
      }
    },
  )
}
