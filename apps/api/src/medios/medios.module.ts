import { Module } from "@nestjs/common"

import { crearAlmacen } from "./almacen-configurado.js"
import { ALMACEN_OBJETOS } from "./almacen-objetos.js"
import { LimpiezaMedios } from "./limpieza-medios.js"
import {
  AlmacenLocalController,
  FotosClienteController,
  MediosController,
} from "./medios.controller.js"
import { MediosService } from "./medios.service.js"

/**
 * Módulo `medios`: fotos privadas de evolución (ADR 0005). El almacén lo elige
 * `ALMACEN` (s3 en producción, local en desarrollo). `LimpiezaMedios` retira
 * las subidas abandonadas.
 */
@Module({
  controllers: [MediosController, FotosClienteController, AlmacenLocalController],
  providers: [
    MediosService,
    LimpiezaMedios,
    { provide: ALMACEN_OBJETOS, useFactory: crearAlmacen },
  ],
  exports: [MediosService, ALMACEN_OBJETOS],
})
export class MediosModule {}
