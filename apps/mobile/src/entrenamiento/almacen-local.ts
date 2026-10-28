import { z } from "zod"
import { conRecursoLocalExclusivo } from "../lib/candado-local"

export class ErrorDeCopiaLocal extends Error {
  constructor(
    readonly operacion: "leer" | "guardar",
    readonly causa: unknown,
  ) {
    super(
      operacion === "leer"
        ? "No se pudo leer la copia guardada en este dispositivo."
        : "No se pudo guardar la copia en este dispositivo.",
    )
    this.name = "ErrorDeCopiaLocal"
  }
}

export class ConflictoDeEdicionLocal extends Error {
  constructor() {
    super("Hay otra edición local de esta sesión. Se deben conservar ambas copias.")
  }
}

/** La igualdad del documento no depende del orden en que se escribieron sus campos. */
function contenidoDe(texto: string | null): string | null {
  if (texto === null) return null
  const ordenar = (valor: unknown): unknown => {
    if (Array.isArray(valor)) return valor.map(ordenar)
    if (valor !== null && typeof valor === "object")
      return Object.fromEntries(
        Object.entries(valor)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([clave, dato]) => [clave, ordenar(dato)]),
      )
    return valor
  }
  return JSON.stringify(ordenar(JSON.parse(texto)))
}

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
  guardar: (
    cuenta: string,
    clave: string,
    datos: unknown,
    version?: { anterior: unknown | null },
  ) => Promise<void>
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
  const lecturas = new Map<string, string | null>()
  const nombreLectura = (cuenta: string, clave: string): string => `${cuenta}/${clave}`
  function ejecutar<T>(cuenta: string, accion: () => Promise<T>): Promise<T> {
    z.uuid().parse(cuenta)
    const siguiente = cola.then(() => conRecursoLocalExclusivo(`ao-documentos-${cuenta}`, accion))
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
        try {
          const valor = await persistencia.leer(cuenta, clave)
          if (valor === null) {
            lecturas.set(nombreLectura(cuenta, clave), null)
            return null
          }
          const texto = await cifrado.descifrar(cuenta, clave, valor)
          const documento: unknown = JSON.parse(texto)
          const datos = z
            .strictObject({ version: z.literal(1), datos: esquema })
            .parse(documento).datos
          lecturas.set(nombreLectura(cuenta, clave), contenidoDe(texto))
          return datos
        } catch (error) {
          throw new ErrorDeCopiaLocal("leer", error)
        }
      }),
    guardar: (cuenta, clave, datos, version) => {
      // Capturar el valor antes de entrar en cola; el llamante puede seguir editando.
      const documento = JSON.stringify({ version: 1, datos })
      const epoca = epocas.get(cuenta)
      return ejecutar(cuenta, async () => {
        if (cerradas.has(cuenta) || epoca !== epocas.get(cuenta))
          throw new Error("La cuenta local se ha cerrado")
        const nombre = nombreLectura(cuenta, clave)
        if (clave.startsWith("sesion-") && (version !== undefined || lecturas.has(nombre))) {
          const guardado = await persistencia.leer(cuenta, clave)
          const actual = contenidoDe(
            guardado === null ? null : await cifrado.descifrar(cuenta, clave, guardado),
          )
          const anterior =
            version === undefined
              ? lecturas.get(nombre)
              : version.anterior === null
                ? null
                : contenidoDe(JSON.stringify({ version: 1, datos: version.anterior }))
          if (actual !== anterior && actual !== contenidoDe(documento))
            throw new ConflictoDeEdicionLocal()
        }
        const valor = await cifrado.cifrar(cuenta, clave, documento)
        if (cerradas.has(cuenta) || epoca !== epocas.get(cuenta))
          throw new Error("La cuenta local se ha cerrado")
        await persistencia.escribir(cuenta, clave, valor)
        lecturas.set(nombre, contenidoDe(documento))
      })
    },
    borrar: (cuenta, clave) =>
      protegida(cuenta, async () => {
        await persistencia.borrar(cuenta, clave)
        lecturas.delete(nombreLectura(cuenta, clave))
      }),
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
        for (const clave of lecturas.keys())
          if (clave.startsWith(`${cuenta}/`)) lecturas.delete(clave)
      })
    },
  }
}
