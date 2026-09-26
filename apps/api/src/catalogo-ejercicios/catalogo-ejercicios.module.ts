import { Module } from "@nestjs/common"

import { CatalogoEjerciciosController } from "./catalogo-ejercicios.controller.js"
import { CatalogoEjerciciosService } from "./catalogo-ejercicios.service.js"

@Module({
  controllers: [CatalogoEjerciciosController],
  providers: [CatalogoEjerciciosService],
  exports: [CatalogoEjerciciosService],
})
export class CatalogoEjerciciosModule {}
