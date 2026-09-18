import { Module } from "@nestjs/common"

import { CatalogoEjerciciosController } from "./catalogo-ejercicios.controller.js"
import { CatalogoEjerciciosService } from "./catalogo-ejercicios.service.js"

/** Modulo `catalogo-ejercicios` del mapa de capacidades: que ejercicios existen. */
@Module({
  controllers: [CatalogoEjerciciosController],
  providers: [CatalogoEjerciciosService],
})
export class CatalogoEjerciciosModule {}
