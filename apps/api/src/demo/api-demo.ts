/**
 * Cliente HTTP mínimo contra la API arrancada en el propio proceso. Todo lo
 * que la API permite se escribe por aquí, con sus validaciones y sus permisos,
 * igual que lo haría la app.
 */

export type Cuenta = {
  id: string
  email: string
  nombre: string
  rol: "cliente" | "entrenador" | "nutricionista" | "empleado"
  token: string
}

/** Respuesta inesperada de la API: el método, la ruta y lo que dijo, nunca credenciales. */
export class ErrorApiDemo extends Error {
  constructor(
    readonly estado: number,
    readonly cuerpo: unknown,
    readonly codigo: string | null,
    mensaje: string,
  ) {
    super(mensaje)
    this.name = "ErrorApiDemo"
  }
}

type Metodo = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

function textoDeError(cuerpo: unknown): { mensaje: string; codigo: string | null } {
  if (typeof cuerpo === "object" && cuerpo !== null) {
    const { message, codigo } = cuerpo as { message?: unknown; codigo?: unknown }
    const mensaje = Array.isArray(message) ? message.join("; ") : String(message ?? "")
    return { mensaje, codigo: typeof codigo === "string" ? codigo : null }
  }
  return { mensaje: String(cuerpo ?? ""), codigo: null }
}

export class ApiDemo {
  /** Contraseñas en memoria para volver a entrar si caduca el token de acceso. */
  private readonly claves = new Map<string, string>()

  constructor(readonly base: string) {}

  async entrar(email: string, contrasena: string): Promise<Cuenta> {
    const sesion = await this.pedir<{
      tokenAcceso: string
      usuario: { id: string; email: string; nombre: string; rol: Cuenta["rol"] }
    }>(null, "POST", "/auth/login", { email, contrasena })
    this.claves.set(email, contrasena)
    return {
      id: sesion.usuario.id,
      email: sesion.usuario.email,
      nombre: sesion.usuario.nombre,
      rol: sesion.usuario.rol,
      token: sesion.tokenAcceso,
    }
  }

  async pedir<T>(
    cuenta: Cuenta | null,
    metodo: Metodo,
    ruta: string,
    cuerpo?: unknown,
  ): Promise<T> {
    const respuesta = await this.enviar(cuenta, metodo, ruta, cuerpo)
    if (respuesta.status === 401 && cuenta !== null && this.claves.has(cuenta.email)) {
      // El token de acceso dura minutos: se vuelve a entrar y se repite una vez.
      const nueva = await this.entrar(cuenta.email, this.claves.get(cuenta.email)!)
      cuenta.token = nueva.token
      return this.leer<T>(await this.enviar(cuenta, metodo, ruta, cuerpo), metodo, ruta)
    }
    return this.leer<T>(respuesta, metodo, ruta)
  }

  /** PUT de un archivo al enlace temporal del almacén local (solo su ruta y su firma). */
  async subirArchivo(url: string, tipoMime: string, datos: Buffer): Promise<void> {
    const enlace = new URL(url)
    const respuesta = await fetch(`${this.base}${enlace.pathname}${enlace.search}`, {
      method: "PUT",
      headers: { "Content-Type": tipoMime },
      body: new Uint8Array(datos),
    })
    if (respuesta.status !== 204)
      throw new ErrorApiDemo(
        respuesta.status,
        null,
        null,
        `PUT almacén local → ${respuesta.status}: no se pudo subir la foto`,
      )
  }

  /** GET de un enlace temporal de lectura; devuelve el código y el tamaño recibido. */
  async leerEnlace(url: string): Promise<{ estado: number; bytes: number }> {
    const enlace = new URL(url)
    const respuesta = await fetch(`${this.base}${enlace.pathname}${enlace.search}`)
    const contenido = await respuesta.arrayBuffer()
    return { estado: respuesta.status, bytes: contenido.byteLength }
  }

  private enviar(
    cuenta: Cuenta | null,
    metodo: Metodo,
    ruta: string,
    cuerpo: unknown,
  ): Promise<Response> {
    const cabeceras: Record<string, string> = {}
    if (cuenta !== null) cabeceras.Authorization = `Bearer ${cuenta.token}`
    if (cuerpo !== undefined) cabeceras["Content-Type"] = "application/json"
    return fetch(`${this.base}${ruta}`, {
      method: metodo,
      headers: cabeceras,
      ...(cuerpo !== undefined && { body: JSON.stringify(cuerpo) }),
    })
  }

  private async leer<T>(respuesta: Response, metodo: Metodo, ruta: string): Promise<T> {
    const texto = await respuesta.text()
    let cuerpo: unknown = null
    if (texto !== "") {
      try {
        cuerpo = JSON.parse(texto)
      } catch {
        cuerpo = texto
      }
    }
    if (!respuesta.ok) {
      const { mensaje, codigo } = textoDeError(cuerpo)
      // La ruta sin su consulta: puede llevar fechas, nunca credenciales, pero así se lee mejor.
      throw new ErrorApiDemo(
        respuesta.status,
        cuerpo,
        codigo,
        `${metodo} ${ruta.split("?")[0]} → ${respuesta.status}${codigo ? ` (${codigo})` : ""}: ${mensaje}`,
      )
    }
    return cuerpo as T
  }
}
