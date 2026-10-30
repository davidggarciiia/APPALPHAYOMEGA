import { Module } from "@nestjs/common"

import { BonosModule } from "./bonos/bonos.module.js"
import { CatalogoEjerciciosModule } from "./catalogo-ejercicios/catalogo-ejercicios.module.js"
import { EntrenamientoModule } from "./entrenamiento/entrenamiento.module.js"
import { CorreoModule } from "./correo/correo.module.js"
import { IdentityModule } from "./identity/identity.module.js"
import { MediosModule } from "./medios/medios.module.js"
import { NutricionModule } from "./nutricion/nutricion.module.js"
import { PrismaModule } from "./prisma/prisma.module.js"
import { SaludModule } from "./salud/salud.module.js"
import { SeguimientoModule } from "./seguimiento/seguimiento.module.js"

/**
 * Raiz de la aplicacion. Cada modulo del mapa de capacidades se cuelga de aqui.
 */
@Module({
  imports: [
    PrismaModule,
    CorreoModule,
    IdentityModule,
    SaludModule,
    CatalogoEjerciciosModule,
    EntrenamientoModule,
    NutricionModule,
    SeguimientoModule,
    MediosModule,
    BonosModule,
  ],
})
export class AppModule {}
