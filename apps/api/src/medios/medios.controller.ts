import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  PayloadTooLargeException,
  Post,
  Put,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from "@nestjs/common"
import {
  SolicitarSubidaSchema,
  type AccesoMedio,
  type IntencionSubida,
  type MedioFoto,
  type SolicitarSubida,
} from "@alpha-omega/shared"
import type { IncomingMessage } from "node:http"
import { z } from "zod"

import { EntradaApiPipe } from "../comun/entrada-api.pipe.js"
import type { IdentidadVerificada, PeticionAutenticada } from "../identity/peticion.js"
import { Publico } from "../identity/publico.decorator.js"
import { Roles } from "../identity/roles.decorator.js"
import { ALMACEN_OBJETOS, AlmacenLocal, type AlmacenObjetos } from "./almacen-objetos.js"
import { MediosService } from "./medios.service.js"

const IdSchema = z.uuid()

/** Fotos privadas. El alcance por cliente se comprueba en el servicio, con el medio leído. */
@Controller("medios")
export class MediosController {
  constructor(private readonly medios: MediosService) {}

  private actor(peticion: PeticionAutenticada): IdentidadVerificada {
    if (!peticion.usuario) throw new UnauthorizedException()
    return peticion.usuario
  }

  @Roles("cliente", "entrenador")
  @Post("subidas")
  solicitarSubida(
    @Req() peticion: PeticionAutenticada,
    @Body(new EntradaApiPipe(SolicitarSubidaSchema)) datos: SolicitarSubida,
  ): Promise<IntencionSubida> {
    return this.medios.solicitarSubida(this.actor(peticion), datos)
  }

  @Roles("cliente", "entrenador")
  @Post(":id/confirmacion")
  @HttpCode(200)
  confirmar(
    @Req() peticion: PeticionAutenticada,
    @Param("id", new EntradaApiPipe(IdSchema)) id: string,
  ): Promise<MedioFoto> {
    return this.medios.confirmar(this.actor(peticion), id)
  }

  @Roles("cliente", "entrenador")
  @Get(":id/acceso")
  acceso(
    @Req() peticion: PeticionAutenticada,
    @Param("id", new EntradaApiPipe(IdSchema)) id: string,
  ): Promise<AccesoMedio> {
    return this.medios.acceso(this.actor(peticion), id)
  }
}

/** Lo mínimo de la respuesta de Express que usa la lectura del almacén local. */
type RespuestaHttp = {
  status(codigo: number): RespuestaHttp
  set(cabeceras: Record<string, string>): RespuestaHttp
  send(cuerpo: Buffer): unknown
}

async function leerCuerpo(peticion: IncomingMessage, limite: number): Promise<Buffer | null> {
  const partes: Buffer[] = []
  let total = 0
  for await (const trozo of peticion as AsyncIterable<Buffer>) {
    total += trozo.length
    if (total > limite) return null
    partes.push(trozo)
  }
  return Buffer.concat(partes)
}

/**
 * Almacén local de desarrollo: hace de «bucket» privado. No lleva sesión porque
 * lo autoriza el enlace firmado que dio la API tras comprobar permisos, igual
 * que una URL prefirmada de S3. Sin firma válida y vigente, nada.
 */
@Controller("medios/almacen-local")
export class AlmacenLocalController {
  constructor(@Inject(ALMACEN_OBJETOS) private readonly almacen: AlmacenObjetos) {}

  private local(): AlmacenLocal {
    if (!(this.almacen instanceof AlmacenLocal)) throw new NotFoundException()
    return this.almacen
  }

  @Publico()
  @Put(":clave")
  @HttpCode(204)
  async subir(
    @Param("clave") clave: string,
    @Query() consulta: Record<string, unknown>,
    @Req() peticion: IncomingMessage,
  ): Promise<void> {
    const local = this.local()
    const permiso = local.permiso(clave, consulta)
    if (!permiso || permiso.operacion !== "subir")
      throw new ForbiddenException("Enlace de subida no válido o caducado")
    if (peticion.headers["content-type"] !== permiso.tipoMime)
      throw new BadRequestException("El tipo del archivo no coincide con el anunciado")
    const contenido = await leerCuerpo(peticion, permiso.bytes)
    if (contenido === null) throw new PayloadTooLargeException("La foto supera el tamaño anunciado")
    await local.guardar(clave, contenido)
  }

  @Publico()
  @Get(":clave")
  async leer(
    @Param("clave") clave: string,
    @Query() consulta: Record<string, unknown>,
    @Res() respuesta: RespuestaHttp,
  ): Promise<void> {
    const local = this.local()
    const permiso = local.permiso(clave, consulta)
    if (!permiso || permiso.operacion !== "leer")
      throw new ForbiddenException("Enlace de lectura no válido o caducado")
    const contenido = await local.leer(clave)
    if (!contenido) throw new NotFoundException()
    respuesta
      .status(200)
      .set({
        "Content-Type": permiso.tipoMime,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      })
      .send(Buffer.from(contenido))
  }
}
