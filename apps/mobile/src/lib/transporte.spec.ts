import {
  ErrorDePermiso,
  ErrorDeRed,
  ErrorDeSesion,
  conectarSesion,
  pedirAutenticado,
} from "./transporte"

jest.mock("./direccion-api", () => ({ direccionDeLaApi: () => "https://api.prueba" }))

type Llamada = { ruta: string; token: string | undefined; metodo: string; cuerpo: unknown }

/**
 * Un servidor de mentira que solo acepta los tokens que se le digan. Anota cada
 * peticion para poder comprobar con que token y que cuerpo llego.
 */
function servidor(tokensValidos: string[]): { llamadas: Llamada[] } {
  const llamadas: Llamada[] = []

  globalThis.fetch = jest.fn((url: string, opciones: RequestInit) => {
    const cabeceras = (opciones.headers ?? {}) as Record<string, string>
    const token = cabeceras.Authorization?.replace("Bearer ", "")
    llamadas.push({
      ruta: url.replace("https://api.prueba", ""),
      token,
      metodo: opciones.method ?? "GET",
      cuerpo: opciones.body,
    })

    const valido = token !== undefined && tokensValidos.includes(token)
    return Promise.resolve({
      status: valido ? 200 : 401,
      ok: valido,
      json: () => Promise.resolve({ para: token }),
    } as unknown as Response)
  }) as unknown as typeof fetch

  return { llamadas }
}

/** Una renovacion que no termina hasta que el test lo decide. */
function renovacionControlada(): { renovar: jest.Mock; terminar: (token: string) => void } {
  let terminar: (token: string) => void = () => undefined
  const renovar = jest.fn(
    () =>
      new Promise<string>((resolver) => {
        terminar = resolver
      }),
  )
  return { renovar, terminar: (token) => terminar(token) }
}

afterEach(() => {
  conectarSesion(null)
})

describe("pedirAutenticado", () => {
  it("con el token vigente no renueva nada", async () => {
    const { llamadas } = servidor(["a1"])
    const renovar = jest.fn()
    conectarSesion({ tokenActual: () => "a1", renovar })

    await expect(pedirAutenticado("/perfil", "a1")).resolves.toEqual({ para: "a1" })

    expect(renovar).not.toHaveBeenCalled()
    expect(llamadas).toHaveLength(1)
  })

  it("ante un 401 renueva una vez y repite la peticion con el token nuevo", async () => {
    const { llamadas } = servidor(["a2"])
    const renovar = jest.fn(() => Promise.resolve("a2"))
    conectarSesion({ tokenActual: () => "a1", renovar })

    await expect(pedirAutenticado("/perfil", "a1")).resolves.toEqual({ para: "a2" })

    expect(renovar).toHaveBeenCalledTimes(1)
    expect(llamadas.map((llamada) => llamada.token)).toEqual(["a1", "a2"])
  })

  it("dos peticiones que caducan a la vez comparten una sola renovacion", async () => {
    servidor(["a2"])
    const { renovar, terminar } = renovacionControlada()
    conectarSesion({ tokenActual: () => "a1", renovar })

    const perfil = pedirAutenticado("/perfil", "a1")
    const cartera = pedirAutenticado("/usuarios", "a1")

    // Las dos han recibido su 401 y esperan. Si cada una renovara por su cuenta,
    // el servidor veria dos canjes del mismo token de refresco.
    await new Promise((resolver) => setTimeout(resolver, 0))
    expect(renovar).toHaveBeenCalledTimes(1)

    terminar("a2")

    await expect(perfil).resolves.toEqual({ para: "a2" })
    await expect(cartera).resolves.toEqual({ para: "a2" })
    expect(renovar).toHaveBeenCalledTimes(1)
  })

  it("si otra peticion ya renovo, usa el token vigente sin volver a renovar", async () => {
    const { llamadas } = servidor(["a2"])
    const renovar = jest.fn()
    // La peticion salio con a1, pero mientras viajaba otra ya renovo a a2.
    conectarSesion({ tokenActual: () => "a2", renovar })

    await expect(pedirAutenticado("/perfil", "a1")).resolves.toEqual({ para: "a2" })

    expect(renovar).not.toHaveBeenCalled()
    expect(llamadas.map((llamada) => llamada.token)).toEqual(["a1", "a2"])
  })

  it("repite una sola vez: un segundo 401 llega a la pantalla", async () => {
    const { llamadas } = servidor([])
    const renovar = jest.fn(() => Promise.resolve("a2"))
    conectarSesion({ tokenActual: () => "a1", renovar })

    await expect(pedirAutenticado("/perfil", "a1")).rejects.toBeInstanceOf(ErrorDeSesion)

    expect(renovar).toHaveBeenCalledTimes(1)
    expect(llamadas).toHaveLength(2)
  })

  it("una escritura se repite con el mismo metodo y el mismo cuerpo", async () => {
    const { llamadas } = servidor(["a2"])
    conectarSesion({ tokenActual: () => "a1", renovar: () => Promise.resolve("a2") })
    const cuerpo = JSON.stringify({ telefono: "600000000" })

    await pedirAutenticado("/perfil", "a1", { method: "PATCH", body: cuerpo })

    expect(llamadas).toHaveLength(2)
    expect(llamadas[1]).toMatchObject({ metodo: "PATCH", cuerpo, token: "a2" })
  })

  it("un 403 no renueva ni cierra nada", async () => {
    globalThis.fetch = jest.fn(() =>
      Promise.resolve({ status: 403, ok: false } as unknown as Response),
    ) as unknown as typeof fetch
    const renovar = jest.fn()
    conectarSesion({ tokenActual: () => "a1", renovar })

    await expect(pedirAutenticado("/usuarios", "a1")).rejects.toBeInstanceOf(ErrorDePermiso)

    expect(renovar).not.toHaveBeenCalled()
  })

  it("sin red durante la renovacion el error es de red, no de sesion", async () => {
    servidor([])
    conectarSesion({
      tokenActual: () => "a1",
      renovar: () => Promise.reject(new ErrorDeRed("sin cobertura")),
    })

    // La pantalla ofrecera reintentar en vez de mandar a nadie al login.
    await expect(pedirAutenticado("/perfil", "a1")).rejects.toBeInstanceOf(ErrorDeRed)
  })

  it("sin sesion conectada, un 401 se queda en 401", async () => {
    const { llamadas } = servidor([])

    await expect(pedirAutenticado("/perfil", "a1")).rejects.toBeInstanceOf(ErrorDeSesion)

    expect(llamadas).toHaveLength(1)
  })

  it("tras una renovacion fallida, la siguiente vuelve a intentarlo", async () => {
    servidor(["a2"])
    const renovar = jest
      .fn<Promise<string>, []>()
      .mockRejectedValueOnce(new ErrorDeRed("sin cobertura"))
      .mockResolvedValueOnce("a2")
    conectarSesion({ tokenActual: () => "a1", renovar })

    await expect(pedirAutenticado("/perfil", "a1")).rejects.toBeInstanceOf(ErrorDeRed)
    await expect(pedirAutenticado("/perfil", "a1")).resolves.toEqual({ para: "a2" })

    expect(renovar).toHaveBeenCalledTimes(2)
  })
})
