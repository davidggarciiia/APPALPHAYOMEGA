import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UnauthorizedException,
} from "@nestjs/common"
import { z } from "zod"
import {
  CambiosAjustesAgendaSchema,
  CambiosServicioSchema,
  CancelarReservaSchema,
  ConsultarDisponibilidadSchema,
  ConsultarReservasSchema,
  CrearExcepcionSchema,
  HorarioSemanalSchema,
  MoverReservaSchema,
  ReservarSchema,
  type AjustesAgenda,
  type CambiosAjustesAgenda,
  type CambiosServicio,
  type CancelarReserva,
  type ConsultarDisponibilidad,
  type ConsultarReservas,
  type CrearExcepcion,
  type Disponibilidad,
  type ExcepcionAgenda,
  type HorarioSemanal,
  type ListadoExcepciones,
  type ListadoReservas,
  type ListadoServicios,
  type MisReservas,
  type MoverReserva,
  type Reserva,
  type Reservar,
  type Servicio,
} from "@alpha-omega/shared"

import { EntradaApiPipe } from "../comun/entrada-api.pipe.js"
import type { IdentidadVerificada, PeticionAutenticada } from "../identity/peticion.js"
import { Roles } from "../identity/roles.decorator.js"
import { HorarioService } from "./horario.service.js"
import { ReservasService } from "./reservas.service.js"

const Id = new EntradaApiPipe(z.uuid())

/**
 * Horarios y reservas (SPEC-agenda.md, «Permisos»). Sin lógica: la llevan los
 * servicios. El cliente sale siempre de la sesión, nunca del cuerpo.
 */
@Controller("agenda")
export class ReservasController {
  constructor(
    private readonly reservas: ReservasService,
    private readonly horario: HorarioService,
  ) {}

  private actor(peticion: PeticionAutenticada): IdentidadVerificada {
    if (!peticion.usuario) throw new UnauthorizedException()
    return peticion.usuario
  }

  @Roles("cliente", "entrenador")
  @Get("servicios")
  servicios(@Req() peticion: PeticionAutenticada): Promise<ListadoServicios> {
    return this.reservas.servicios(this.actor(peticion))
  }

  @Roles("entrenador")
  @Patch("servicios/:id")
  cambiarServicio(
    @Param("id", Id) id: string,
    @Body(new EntradaApiPipe(CambiosServicioSchema)) cambios: CambiosServicio,
  ): Promise<Servicio> {
    return this.horario.cambiarServicio(id, cambios)
  }

  @Roles("cliente", "entrenador")
  @Get("disponibilidad")
  disponibilidad(
    @Req() peticion: PeticionAutenticada,
    @Query(new EntradaApiPipe(ConsultarDisponibilidadSchema)) consulta: ConsultarDisponibilidad,
  ): Promise<Disponibilidad> {
    return this.reservas.disponibilidad(this.actor(peticion), consulta)
  }

  @Roles("cliente", "entrenador")
  @Get("ajustes")
  ajustes(): Promise<AjustesAgenda> {
    return this.horario.ajustes()
  }

  @Roles("entrenador")
  @Patch("ajustes")
  cambiarAjustes(
    @Body(new EntradaApiPipe(CambiosAjustesAgendaSchema)) cambios: CambiosAjustesAgenda,
  ): Promise<AjustesAgenda> {
    return this.horario.cambiarAjustes(cambios)
  }

  @Roles("cliente")
  @Get("mis-reservas")
  misReservas(@Req() peticion: PeticionAutenticada): Promise<MisReservas> {
    return this.reservas.misReservas(this.actor(peticion).sub)
  }

  @Roles("cliente")
  @Post("mis-reservas")
  reservar(
    @Req() peticion: PeticionAutenticada,
    @Body(new EntradaApiPipe(ReservarSchema)) datos: Reservar,
  ): Promise<Reserva> {
    const actor = this.actor(peticion)
    return this.reservas.reservar(actor, actor.sub, datos)
  }

  @Roles("cliente")
  @Post("mis-reservas/:id/cancelar")
  @HttpCode(200)
  cancelarPropia(
    @Req() peticion: PeticionAutenticada,
    @Param("id", Id) id: string,
    @Body(new EntradaApiPipe(CancelarReservaSchema)) datos: CancelarReserva,
  ): Promise<Reserva> {
    return this.reservas.cancelar(this.actor(peticion), id, datos.motivo)
  }

  @Roles("entrenador")
  @Get("reservas")
  listar(
    @Query(new EntradaApiPipe(ConsultarReservasSchema)) consulta: ConsultarReservas,
  ): Promise<ListadoReservas> {
    return this.reservas.listar(consulta)
  }

  @Roles("entrenador")
  @Post("clientes/:clienteId/reservas")
  reservarPara(
    @Req() peticion: PeticionAutenticada,
    @Param("clienteId", Id) clienteId: string,
    @Body(new EntradaApiPipe(ReservarSchema)) datos: Reservar,
  ): Promise<Reserva> {
    return this.reservas.reservar(this.actor(peticion), clienteId, datos)
  }

  @Roles("entrenador")
  @Post("reservas/:id/cancelar")
  @HttpCode(200)
  cancelar(
    @Req() peticion: PeticionAutenticada,
    @Param("id", Id) id: string,
    @Body(new EntradaApiPipe(CancelarReservaSchema)) datos: CancelarReserva,
  ): Promise<Reserva> {
    return this.reservas.cancelar(this.actor(peticion), id, datos.motivo)
  }

  @Roles("entrenador")
  @Post("reservas/:id/devolver")
  @HttpCode(200)
  devolver(@Req() peticion: PeticionAutenticada, @Param("id", Id) id: string): Promise<Reserva> {
    return this.reservas.devolverAMano(this.actor(peticion), id)
  }

  @Roles("entrenador")
  @Patch("reservas/:id")
  mover(
    @Req() peticion: PeticionAutenticada,
    @Param("id", Id) id: string,
    @Body(new EntradaApiPipe(MoverReservaSchema)) datos: MoverReserva,
  ): Promise<Reserva> {
    return this.reservas.mover(this.actor(peticion), id, datos)
  }

  @Roles("entrenador")
  @Get("horario-semanal")
  horarioSemanal(): Promise<HorarioSemanal> {
    return this.horario.horario()
  }

  @Roles("entrenador")
  @Put("horario-semanal")
  guardarHorario(
    @Body(new EntradaApiPipe(HorarioSemanalSchema)) horario: HorarioSemanal,
  ): Promise<HorarioSemanal> {
    return this.horario.guardarHorario(horario)
  }

  @Roles("entrenador")
  @Get("excepciones")
  excepciones(
    @Query(new EntradaApiPipe(ConsultarReservasSchema)) consulta: ConsultarReservas,
  ): Promise<ListadoExcepciones> {
    return this.horario.excepciones(consulta)
  }

  @Roles("entrenador")
  @Post("excepciones")
  crearExcepcion(
    @Req() peticion: PeticionAutenticada,
    @Body(new EntradaApiPipe(CrearExcepcionSchema)) datos: CrearExcepcion,
  ): Promise<ExcepcionAgenda> {
    return this.horario.crearExcepcion(this.actor(peticion).sub, datos)
  }

  @Roles("entrenador")
  @Delete("excepciones/:id")
  @HttpCode(204)
  async borrarExcepcion(@Param("id", Id) id: string): Promise<void> {
    await this.horario.borrarExcepcion(id)
  }
}
