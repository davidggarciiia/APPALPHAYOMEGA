import type { NestExpressApplication } from "@nestjs/platform-express"
import { isIP } from "node:net"
import { leerVariableOpcional } from "./entorno.js"

/** Admite el patrón máximo, incluidas indicaciones UTF-8, sin cuerpos ilimitados. */
export function configurarCuerposHttp(app: NestExpressApplication): void {
  app.set("x-powered-by", false)
  app.use(
    (
      peticion: { secure: boolean },
      respuesta: { setHeader(nombre: string, valor: string): void },
      siguiente: () => void,
    ) => {
      respuesta.setHeader("X-Content-Type-Options", "nosniff")
      respuesta.setHeader("X-Frame-Options", "DENY")
      respuesta.setHeader("Referrer-Policy", "no-referrer")
      respuesta.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")
      respuesta.setHeader("Cache-Control", "no-store")
      if (peticion.secure) respuesta.setHeader("Strict-Transport-Security", "max-age=31536000")
      siguiente()
    },
  )
  app.useBodyParser("json", { limit: "8mb" })
  const texto = leerVariableOpcional("API_PROXIES_CONFIABLES", "").trim()
  const proxies = texto === "" ? [] : texto.split(",").map((direccion) => direccion.trim())
  for (const proxy of proxies) {
    const [direccion = "", prefijo, extra] = proxy.split("/")
    const version = isIP(direccion)
    const bits = version === 4 ? 32 : 128
    if (
      version === 0 ||
      extra !== undefined ||
      (prefijo !== undefined &&
        (!/^\d+$/.test(prefijo) || Number(prefijo) < 1 || Number(prefijo) > bits))
    ) {
      throw new Error(
        "API_PROXIES_CONFIABLES debe contener solo IP o redes CIDR restringidas, separadas por comas",
      )
    }
  }
  // Nunca confiar por número de saltos o en cualquier cabecera enviada por el cliente.
  app.set("trust proxy", proxies.length === 0 ? false : proxies)
}
