import { Module } from "@nestjs/common"

import { ALMACEN_OBJETOS, crearAlmacenLocal } from "./almacen-objetos.js"
import { LimpiezaMedios } from "./limpieza-medios.js"
import { AlmacenLocalController, MediosController } from "./medios.controller.js"
import { MediosService } from "./medios.service.js"

/**
 * Módulo `medios`: fotos privadas de evolución (ADR 0005). Por ahora con el
 * almacén local; el proveedor de producción se enchufa en `ALMACEN_OBJETOS`
 * cuando se decida. `LimpiezaMedios` retira las subidas abandonadas.
 */
@Module({
  controllers: [MediosController, AlmacenLocalController],
  providers: [
    MediosService,
    LimpiezaMedios,
    { provide: ALMACEN_OBJETOS, useFactory: crearAlmacenLocal },
  ],
  exports: [MediosService, ALMACEN_OBJETOS],
})
export class MediosModule {}
