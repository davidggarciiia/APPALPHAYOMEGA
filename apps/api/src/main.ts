import "reflect-metadata"

import { Logger } from "@nestjs/common"
import { NestFactory } from "@nestjs/core"

import { AppModule } from "./app.module.js"
import { cargarEntornoLocal, leerVariableOpcional } from "./config/entorno.js"

cargarEntornoLocal()

async function arrancar(): Promise<void> {
  const app = await NestFactory.create(AppModule)
  const registro = new Logger("arranque")

  /**
   * Origenes permitidos para peticiones desde un navegador.
   *
   * La app nativa no pasa por aqui: las peticiones de una app movil no llevan
   * origen y el navegador no interviene. Esto existe para la version web de
   * Expo durante el desarrollo.
   *
   * Cerrado por defecto a proposito. Sin la variable, ningun origen es
   * aceptado, asi que un despliegue que se olvide de configurarla no queda
   * abierto a cualquier pagina de internet.
   */
  const origenes = leerVariableOpcional("CORS_ORIGENES", "")
    .split(",")
    .map((origen) => origen.trim())
    .filter((origen) => origen !== "")

  if (origenes.length > 0) {
    app.enableCors({ origin: origenes })
    registro.log(`CORS permitido para: ${origenes.join(", ")}`)
  }

  const puerto = Number(leerVariableOpcional("API_PORT", "3000"))

  await app.listen(puerto)
  registro.log(`API escuchando en http://localhost:${String(puerto)}`)
}

void arrancar()
