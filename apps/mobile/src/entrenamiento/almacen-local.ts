import { z } from "zod"

export type PersistenciaCifrada = {
  leer: (cuenta: string, clave: string) => Promise<string | null>
  escribir: (cuenta: string, clave: string, valor: string) => Promise<void>
  borrar: (cuenta: string, clave: string) => Promise<void>
  listar: (cuenta: string) => Promise<string[]>
  limpiar: (cuenta: string) => Promise<void>
}
export type Cifrado = {
  cifrar: (cuenta: string, clave: string, texto: string) => Promise<string>
  descifrar: (cuenta: string, clave: string, texto: string) => Promise<string>
  olvidar: (cuenta: string) => Promise<void>
}
export type AlmacenLocal = {
  habilitar: (cuenta: string) => void
  leer: <T>(cuenta: string, clave: string, esquema: z.ZodType<T>) => Promise<T | null>
  guardar: (cuenta: string, clave: string, datos: unknown) => Promise<void>
  borrar: (cuenta: string, clave: string) => Promise<void>
  listar: (cuenta: string) => Promise<string[]>
  limpiar: (cuenta: string) => Promise<void>
}

/** Una única cola impide que cifrados lentos escriban detrás de cambios más nuevos. */
export function crearAlmacenLocal(
  persistencia: PersistenciaCifrada,
  cifrado: Cifrado,
): AlmacenLocal {
  let cola: Promise<unknown> = Promise.resolve()
  const cerradas = new Set<string>()
  const epocas = new Map<string, number>()
  function ejecutar<T>(cuenta: string, accion: () => Promise<T>): Promise<T> {
    z.uuid().parse(cuenta)
    const siguiente = cola.then(accion)
    cola = siguiente.catch(() => undefined)
    return siguiente
  }
  function protegida<T>(cuenta: string, accion: () => Promise<T>): Promise<T> {
    const epoca = epocas.get(cuenta)
    const comprobar = (): void => {
      if (cerradas.has(cuenta) || epoca !== epocas.get(cuenta))
        throw new Error("La cuenta local se ha cerrado")
    }
    return ejecutar(cuenta, async () => {
      comprobar()
      const resultado = await accion()
      comprobar()
      return resultado
    })
  }
  return {
    habilitar: (cuenta) => {
      cerradas.delete(cuenta)
      epocas.set(cuenta, (epocas.get(cuenta) ?? 0) + 1)
    },
    leer: <T>(cuenta: string, clave: string, esquema: z.ZodType<T>) =>
      protegida(cuenta, async () => {
        const valor = await persistencia.leer(cuenta, clave)
        if (valor === null) return null
        const documento: unknown = JSON.parse(await cifrado.descifrar(cuenta, clave, valor))
        return z.strictObject({ version: z.literal(1), datos: esquema }).parse(documento).datos
      }),
    guardar: (cuenta, clave, datos) => {
      // Capturar el valor antes de entrar en cola; el llamante puede seguir editando.
      const documento = JSON.stringify({ version: 1, datos })
      const epoca = epocas.get(cuenta)
      return ejecutar(cuenta, async () => {
        if (cerradas.has(cuenta) || epoca !== epocas.get(cuenta))
          throw new Error("La cuenta local se ha cerrado")
        const valor = await cifrado.cifrar(cuenta, clave, documento)
        if (cerradas.has(cuenta) || epoca !== epocas.get(cuenta))
          throw new Error("La cuenta local se ha cerrado")
        await persistencia.escribir(cuenta, clave, valor)
      })
    },
    borrar: (cuenta, clave) => protegida(cuenta, () => persistencia.borrar(cuenta, clave)),
    listar: (cuenta) => protegida(cuenta, () => persistencia.listar(cuenta)),
    limpiar: (cuenta) => {
      cerradas.add(cuenta)
      epocas.set(cuenta, (epocas.get(cuenta) ?? 0) + 1)
      return ejecutar(cuenta, async () => {
        const resultados = await Promise.allSettled([
          persistencia.limpiar(cuenta),
          cifrado.olvidar(cuenta),
        ])
        const fallo = resultados.find((r) => r.status === "rejected")
        if (fallo?.status === "rejected") throw fallo.reason
      })
    },
  }
}
