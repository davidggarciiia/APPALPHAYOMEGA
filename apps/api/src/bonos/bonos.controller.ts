import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from "@nestjs/common"
import { z } from "zod"
import {
  AjustarBonoSchema,
  CambiarSeguimientoActivoSchema,
  CargarBonoSchema,
  ConsultarMovimientosBonoSchema,
  type AjustarBono,
  type CambiarSeguimientoActivo,
  type CargarBono,
  type ConsultarMovimientosBono,
  type ListadoMovimientosBono,
  type ListadoServiciosReserva,
  type MovimientoBono,
  type SaldoBonos,
} from "@alpha-omega/shared"
import { EntradaApiPipe } from "../comun/entrada-api.pipe.js"
import type { IdentidadVerificada, PeticionAutenticada } from "../identity/peticion.js"
import { Roles } from "../identity/roles.decorator.js"
import { BonosService } from "./bonos.service.js"

@Controller("bonos")
@Roles("cliente", "entrenador")
export class BonosController {
  constructor(private readonly bonos: BonosService) {}

  private actor(peticion: PeticionAutenticada): IdentidadVerificada {
    if (!peticion.usuario) throw new UnauthorizedException()
    return peticion.usuario
  }

  @Get("servicios")
  servicios(): ListadoServiciosReserva {
    return {
      servicios: [
        { id: "entrenoPersonal", nombre: "Entreno personal", unidad: "creditos" },
        { id: "seguimiento", nombre: "Seguimiento", unidad: "minutos" },
      ],
    }
  }

  @Get("clientes/:clienteId")
  saldo(
    @Req() peticion: PeticionAutenticada,
    @Param("clienteId", new EntradaApiPipe(z.uuid())) clienteId: string,
  ): Promise<SaldoBonos> {
    return this.bonos.saldo(this.actor(peticion), clienteId)
  }

  @Post("clientes/:clienteId/cargas")
  @Roles("entrenador")
  cargar(
    @Req() peticion: PeticionAutenticada,
    @Param("clienteId", new EntradaApiPipe(z.uuid())) clienteId: string,
    @Body(new EntradaApiPipe(CargarBonoSchema)) datos: CargarBono,
  ): Promise<MovimientoBono> {
    return this.bonos.cargar(this.actor(peticion), clienteId, datos)
  }

  @Post("clientes/:clienteId/ajustes")
  @Roles("entrenador")
  ajustar(
    @Req() peticion: PeticionAutenticada,
    @Param("clienteId", new EntradaApiPipe(z.uuid())) clienteId: string,
    @Body(new EntradaApiPipe(AjustarBonoSchema)) datos: AjustarBono,
  ): Promise<MovimientoBono> {
    return this.bonos.ajustar(this.actor(peticion), clienteId, datos)
  }

  @Patch("clientes/:clienteId/seguimiento")
  @Roles("entrenador")
  cambiarSeguimiento(
    @Req() peticion: PeticionAutenticada,
    @Param("clienteId", new EntradaApiPipe(z.uuid())) clienteId: string,
    @Body(new EntradaApiPipe(CambiarSeguimientoActivoSchema)) datos: CambiarSeguimientoActivo,
  ): Promise<SaldoBonos> {
    return this.bonos.cambiarSeguimiento(this.actor(peticion), clienteId, datos)
  }

  @Get("clientes/:clienteId/movimientos")
  movimientos(
    @Req() peticion: PeticionAutenticada,
    @Param("clienteId", new EntradaApiPipe(z.uuid())) clienteId: string,
    @Query(new EntradaApiPipe(ConsultarMovimientosBonoSchema)) consulta: ConsultarMovimientosBono,
  ): Promise<ListadoMovimientosBono> {
    return this.bonos.movimientos(this.actor(peticion), clienteId, consulta)
  }
}
