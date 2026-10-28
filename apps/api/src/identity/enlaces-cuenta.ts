import { leerVariableOpcional } from "../config/entorno.js"

type Tipo = "activacion" | "recuperacion"

const DESTINOS = {
  activacion: { variable: "ACTIVACION_URL_BASE", desarrollo: "alphaomega://activar" },
  recuperacion: { variable: "RECUPERACION_URL_BASE", desarrollo: "alphaomega://restablecer" },
} as const

function destino(tipo: Tipo): URL {
  const { variable, desarrollo } = DESTINOS[tipo]
  const produccion = leerVariableOpcional("NODE_ENV", "development") === "production"
  const base = leerVariableOpcional(variable, produccion ? "" : desarrollo)
  let url: URL
  try {
    url = new URL(base)
  } catch {
    throw new Error(
      `${variable} debe ser una URL válida${produccion ? " HTTPS en producción" : ""}`,
    )
  }
  if (produccion && url.protocol !== "https:") {
    throw new Error(`${variable} debe usar HTTPS en producción`)
  }
  if (
    !["https:", "http:", "alphaomega:"].includes(url.protocol) ||
    url.hostname === "" ||
    url.username !== "" ||
    url.password !== "" ||
    url.search !== "" ||
    url.hash !== ""
  ) {
    throw new Error(`${variable} debe ser una URL sin credenciales, consulta ni fragmento`)
  }
  return url
}

/** Falla al arrancar: un despliegue no puede emitir enlaces que otra app intercepte. */
export function validarEnlacesDeCuenta(): void {
  destino("activacion")
  destino("recuperacion")
}

export function enlaceDeCuenta(tipo: Tipo, token: string): string {
  const url = destino(tipo)
  url.searchParams.set("token", token)
  return url.toString()
}
