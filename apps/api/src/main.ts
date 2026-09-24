import "reflect-metadata"

import { Logger } from "@nestjs/common"
import { NestFactory } from "@nestjs/core"
import type { NestExpressApplication } from "@nestjs/platform-express"
import { configurarCuerposHttp } from "./config/http.js"

import { AppModule } from "./app.module.js"
import { cargarEntornoLocal, leerVariableOpcional } from "./config/entorno.js"

cargarEntornoLocal()

async function arrancar(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule)
  configurarCuerposHttp(app)
  // Con SIGTERM (reinicio del gestor de procesos o del contenedor) Nest llama a
  // los ganchos de cierre: se desconecta de la base y para la limpieza de fotos
  // en lugar de cortar a medias.
  app.enableShutdownHooks()
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
