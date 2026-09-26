import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from "@nestjs/common"
import { z } from "zod"
import {
  ActivarProductoSchema,
  ActivarSolicitudSchema,
  CambiosProductoSchema,
  ConsultarCobrosSchema,
  ConsultarResumenCobrosSchema,
  EstadoSolicitudSchema,
  PedirProductoSchema,
  type ActivacionProducto,
  type ActivarProducto,
  type ActivarSolicitud,
  type CambiosProducto,
  type Cobro,
  type ConsultarCobros,
  type ConsultarResumenCobros,
  type DetalleSaldo,
  type EstadoSolicitud,
  type ListadoCobros,
  type ListadoProductos,
  type ListadoSolicitudes,
  type PedirProducto,
  type Producto,
  type ResumenCobros,
  type ResumenSaldo,
  type SolicitudProducto,
} from "@alpha-omega/shared"

import { EntradaApiPipe } from "../comun/entrada-api.pipe.js"
import type { IdentidadVerificada, PeticionAutenticada } from "../identity/peticion.js"
import { Roles } from "../identity/roles.decorator.js"
import { CobrosService } from "./cobros.service.js"
import { PlanesService } from "./planes.service.js"
import { SaldoService } from "./saldo.service.js"

const Id = new EntradaApiPipe(z.uuid())
const FiltroSolicitudes = z.strictObject({ estado: EstadoSolicitudSchema.optional() })

/**
 * Productos, saldo, solicitudes y cobros. Sin lógica: la llevan los servicios. El
 * cliente sale siempre de la sesión; nutricionista y empleado, denegados.
 */
@Controller("planes")
export class PlanesController {
  constructor(
    private readonly planes: PlanesService,
    private readonly saldo: SaldoService,
    private readonly cobros: CobrosService,
  ) {}

  private actor(peticion: PeticionAutenticada): IdentidadVerificada {
    if (!peticion.usuario) throw new UnauthorizedException()
    return peticion.usuario
  }

  @Roles("cliente", "entrenador")
  @Get("productos")
  productos(@Req() peticion: PeticionAutenticada): Promise<ListadoProductos> {
    return this.planes.productos(this.actor(peticion))
  }

  @Roles("entrenador")
  @Patch("productos/:id")
  cambiarProducto(
    @Param("id", Id) id: string,
    @Body(new EntradaApiPipe(CambiosProductoSchema)) cambios: CambiosProducto,
  ): Promise<Producto> {
    return this.planes.cambiarProducto(id, cambios)
  }

  @Roles("cliente")
  @Get("mi-saldo")
  miSaldo(@Req() peticion: PeticionAutenticada): Promise<ResumenSaldo> {
    return this.saldo.resumen(this.actor(peticion).sub)
  }

  @Roles("cliente")
  @Get("mis-solicitudes")
  misSolicitudes(@Req() peticion: PeticionAutenticada): Promise<ListadoSolicitudes> {
    return this.planes.misSolicitudes(this.actor(peticion).sub)
  }

  @Roles("cliente")
  @Post("mis-solicitudes")
  pedir(
    @Req() peticion: PeticionAutenticada,
    @Body(new EntradaApiPipe(PedirProductoSchema)) datos: PedirProducto,
  ): Promise<SolicitudProducto> {
    return this.planes.pedir(this.actor(peticion).sub, datos)
  }

  @Roles("cliente")
  @Post("mis-solicitudes/:id/anular")
  @HttpCode(200)
  anular(
    @Req() peticion: PeticionAutenticada,
    @Param("id", Id) id: string,
  ): Promise<SolicitudProducto> {
    return this.planes.anular(this.actor(peticion).sub, id)
  }

  @Roles("entrenador")
  @Get("solicitudes")
  solicitudes(
    @Query(new EntradaApiPipe(FiltroSolicitudes)) filtro: { estado?: EstadoSolicitud },
  ): Promise<ListadoSolicitudes> {
    return this.planes.solicitudes(filtro.estado)
  }

  @Roles("entrenador")
  @Post("solicitudes/:id/activar")
  @HttpCode(200)
  activar(
    @Req() peticion: PeticionAutenticada,
    @Param("id", Id) id: string,
    @Body(new EntradaApiPipe(ActivarSolicitudSchema)) datos: ActivarSolicitud,
  ): Promise<ActivacionProducto> {
    return this.planes.activarSolicitud(this.actor(peticion), id, datos)
  }

  @Roles("entrenador")
  @Post("solicitudes/:id/rechazar")
  @HttpCode(200)
  rechazar(
    @Req() peticion: PeticionAutenticada,
    @Param("id", Id) id: string,
  ): Promise<SolicitudProducto> {
    return this.planes.rechazar(this.actor(peticion), id)
  }

  @Roles("entrenador")
  @Post("clientes/:clienteId/activaciones")
  @HttpCode(200)
  activarProducto(
    @Req() peticion: PeticionAutenticada,
    @Param("clienteId", Id) clienteId: string,
    @Body(new EntradaApiPipe(ActivarProductoSchema)) datos: ActivarProducto,
  ): Promise<ActivacionProducto> {
    return this.planes.activarProducto(this.actor(peticion), clienteId, datos)
  }

  @Roles("entrenador")
  @Get("clientes/:clienteId/saldo")
  saldoDeCliente(@Param("clienteId", Id) clienteId: string): Promise<DetalleSaldo> {
    return this.saldo.detalle(clienteId)
  }

  @Roles("entrenador")
  @Get("cobros")
  listarCobros(
    @Query(new EntradaApiPipe(ConsultarCobrosSchema)) consulta: ConsultarCobros,
  ): Promise<ListadoCobros> {
    return this.cobros.listar(consulta)
  }

  @Roles("entrenador")
  @Get("cobros/resumen")
  resumenCobros(
    @Query(new EntradaApiPipe(ConsultarResumenCobrosSchema)) consulta: ConsultarResumenCobros,
  ): Promise<ResumenCobros> {
    return this.cobros.resumen(consulta.mes)
  }

  @Roles("entrenador")
  @Post("cobros/:id/cobrar")
  @HttpCode(200)
  cobrar(@Param("id", Id) id: string): Promise<Cobro> {
    return this.cobros.cobrar(id)
  }

  @Roles("entrenador")
  @Post("cobros/:id/anular")
  @HttpCode(200)
  anularCobro(@Req() peticion: PeticionAutenticada, @Param("id", Id) id: string): Promise<Cobro> {
    return this.cobros.anular(id, this.actor(peticion).sub)
  }
}
