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
  function ejecutar<T>(cuenta: string, accion: () => Promise<T>): Promise<T> {
    z.uuid().parse(cuenta)
    const siguiente = cola.then(accion)
    cola = siguiente.catch(() => undefined)
    return siguiente
  }
  return {
    leer: <T>(cuenta: string, clave: string, esquema: z.ZodType<T>) =>
      ejecutar(cuenta, async () => {
        const valor = await persistencia.leer(cuenta, clave)
        if (valor === null) return null
        const documento: unknown = JSON.parse(await cifrado.descifrar(cuenta, clave, valor))
        return z.strictObject({ version: z.literal(1), datos: esquema }).parse(documento).datos
      }),
    guardar: (cuenta, clave, datos) => {
      // Capturar el valor antes de entrar en cola; el llamante puede seguir editando.
      const documento = JSON.stringify({ version: 1, datos })
      return ejecutar(cuenta, async () => {
        const valor = await cifrado.cifrar(cuenta, clave, documento)
        await persistencia.escribir(cuenta, clave, valor)
      })
    },
    borrar: (cuenta, clave) => ejecutar(cuenta, () => persistencia.borrar(cuenta, clave)),
    listar: (cuenta) => ejecutar(cuenta, () => persistencia.listar(cuenta)),
    limpiar: (cuenta) =>
      ejecutar(cuenta, async () => {
        await persistencia.limpiar(cuenta)
        await cifrado.olvidar(cuenta)
      }),
  }
}
