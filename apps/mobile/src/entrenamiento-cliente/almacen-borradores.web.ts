import { CopiaLocalSchema, tienePendientes, type CopiaLocal } from "./copia-local"

/*
 * Adaptador web, SOLO para desarrollo.
 *
 * El navegador no tiene llavero ni SQLite de Expo, y en una dirección http de
 * la red local tampoco hay criptografía web. Se guarda en `localStorage` sin
 * cifrar, por cuenta y sesión, igual que el token de refresco en web
 * (`almacen-seguro.ts`). No es la protección del móvil y no se presenta como tal.
 */

const PREFIJO = "alpha_omega_copia"

function clave(cuenta: string, sesion: string): string {
  return `${PREFIJO}:${cuenta}:${sesion}`
}

function almacen(): Storage {
  const local = globalThis.localStorage
  if (local === undefined) {
    throw new Error("Este navegador no permite guardar datos locales")
  }
  return local
}

export async function leerCopia(cuenta: string, sesion: string): Promise<CopiaLocal | null> {
  const valor = almacen().getItem(clave(cuenta, sesion))
  return valor === null ? null : CopiaLocalSchema.parse(JSON.parse(valor))
}

export async function guardarCopia(cuenta: string, copia: CopiaLocal): Promise<void> {
  almacen().setItem(clave(cuenta, copia.sesionId), JSON.stringify(copia))
}

function clavesDe(cuenta: string): string[] {
  const local = almacen()
  const claves: string[] = []
  for (let i = 0; i < local.length; i++) {
    const nombre = local.key(i)
    if (nombre?.startsWith(`${PREFIJO}:${cuenta}:`) === true) {
      claves.push(nombre)
    }
  }
  return claves
}

export async function listarCopias(cuenta: string): Promise<CopiaLocal[]> {
  return clavesDe(cuenta).flatMap((nombre) => {
    const leido = CopiaLocalSchema.safeParse(JSON.parse(almacen().getItem(nombre) ?? "null"))
    return leido.success ? [leido.data] : []
  })
}

export async function borrarCopia(cuenta: string, sesion: string): Promise<void> {
  almacen().removeItem(clave(cuenta, sesion))
}

export async function hayPendientes(cuenta: string): Promise<boolean> {
  return (await listarCopias(cuenta)).some(tienePendientes)
}

export async function borrarDatosDeCuenta(cuenta: string): Promise<void> {
  for (const nombre of clavesDe(cuenta)) {
    almacen().removeItem(nombre)
  }
}
