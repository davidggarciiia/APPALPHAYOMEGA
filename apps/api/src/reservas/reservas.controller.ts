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
  AsignarReservaSchema,
  CancelarReservaSchema,
  ConsultarAvisosReservaSchema,
  ConsultarReservasSchema,
  MarcarAsistenciaReservaSchema,
  type AsignarReserva,
  type AvisoReserva,
  type CancelarReserva,
  type ConsultarAvisosReserva,
  type ConsultarReservas,
  type ListadoAvisosReserva,
  type ListadoReservas,
  type MarcarAsistenciaReserva,
  type Reserva,
} from "@alpha-omega/shared"
import { EntradaApiPipe } from "../comun/entrada-api.pipe.js"
import type { IdentidadVerificada, PeticionAutenticada } from "../identity/peticion.js"
import { Roles } from "../identity/roles.decorator.js"
import { ReservasService } from "./reservas.service.js"

@Controller("reservas")
@Roles("cliente", "entrenador")
export class ReservasController {
  constructor(private readonly reservas: ReservasService) {}
  private actor(peticion: PeticionAutenticada): IdentidadVerificada {
    if (!peticion.usuario) throw new UnauthorizedException()
    return peticion.usuario
  }
  @Post()
  @Roles("entrenador")
  asignar(
    @Req() peticion: PeticionAutenticada,
    @Body(new EntradaApiPipe(AsignarReservaSchema)) datos: AsignarReserva,
  ): Promise<Reserva> {
    return this.reservas.asignar(this.actor(peticion), datos)
  }
  @Get()
  @Roles("entrenador")
  agenda(
    @Req() peticion: PeticionAutenticada,
    @Query(new EntradaApiPipe(ConsultarReservasSchema)) consulta: ConsultarReservas,
  ): Promise<ListadoReservas> {
    return this.reservas.agenda(this.actor(peticion), consulta)
  }
  @Get("clientes/:clienteId")
  deCliente(
    @Req() peticion: PeticionAutenticada,
    @Param("clienteId", new EntradaApiPipe(z.uuid())) clienteId: string,
    @Query(new EntradaApiPipe(ConsultarReservasSchema)) consulta: ConsultarReservas,
  ): Promise<ListadoReservas> {
    return this.reservas.deCliente(this.actor(peticion), clienteId, consulta)
  }
  @Patch(":id/cancelacion")
  @Roles("entrenador")
  cancelar(
    @Req() peticion: PeticionAutenticada,
    @Param("id", new EntradaApiPipe(z.uuid())) id: string,
    @Body(new EntradaApiPipe(CancelarReservaSchema)) datos: CancelarReserva,
  ): Promise<Reserva> {
    return this.reservas.cancelar(this.actor(peticion), id, datos)
  }
  @Patch(":id/asistencia")
  @Roles("entrenador")
  asistencia(
    @Req() peticion: PeticionAutenticada,
    @Param("id", new EntradaApiPipe(z.uuid())) id: string,
    @Body(new EntradaApiPipe(MarcarAsistenciaReservaSchema)) datos: MarcarAsistenciaReserva,
  ): Promise<Reserva> {
    return this.reservas.asistencia(this.actor(peticion), id, datos)
  }
  @Get("clientes/:clienteId/avisos")
  avisos(
    @Req() peticion: PeticionAutenticada,
    @Param("clienteId", new EntradaApiPipe(z.uuid())) clienteId: string,
    @Query(new EntradaApiPipe(ConsultarAvisosReservaSchema)) consulta: ConsultarAvisosReserva,
  ): Promise<ListadoAvisosReserva> {
    return this.reservas.avisos(this.actor(peticion), clienteId, consulta)
  }
  @Patch("avisos/:id/lectura")
  @Roles("cliente")
  leerAviso(
    @Req() peticion: PeticionAutenticada,
    @Param("id", new EntradaApiPipe(z.uuid())) id: string,
  ): Promise<AvisoReserva> {
    return this.reservas.leerAviso(this.actor(peticion), id)
  }
}
