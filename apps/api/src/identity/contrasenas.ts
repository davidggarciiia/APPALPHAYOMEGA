import { hash, verify } from "@node-rs/argon2"

/**
 * Cifrado y verificacion de contrasenas.
 *
 * Argon2id segun SPEC.md. Se usa la implementacion en Rust porque trae binarios
 * precompilados: la alternativa en C exige un compilador instalado, y eso en
 * Windows es media tarde perdida antes de escribir la primera linea util.
 */

/**
 * Argon2id, la variante que SPEC.md exige.
 *
 * Se escribe el numero y no `Algorithm.Argon2id` porque esa constante esta
 * declarada como enum ambiente: existe en los tipos y no en el paquete
 * compilado, asi que en ejecucion valia `undefined`. Funcionaba de milagro,
 * porque Argon2id resulta ser tambien el valor por defecto de la libreria.
 * Confiar en un valor por defecto para un parametro de seguridad es como no
 * fijarlo. El test de este fichero comprueba que el hash producido lo declara.
 */
const ARGON2ID = 2

const OPCIONES = { algorithm: ARGON2ID } as const

/**
 * Hash de una contrasena en claro. El resultado incluye la sal y los parametros,
 * asi que no hace falta guardarlos aparte.
 */
export async function cifrarContrasena(enClaro: string): Promise<string> {
  return hash(enClaro, OPCIONES)
}

/**
 * Comprueba una contrasena contra su hash.
 *
 * Devuelve false ante un hash con formato invalido en lugar de lanzar, porque
 * quien llama solo necesita saber si coincide, y un hash corrupto en la base de
 * datos no debe distinguirse de una contrasena equivocada.
 */
export async function verificarContrasena(hashGuardado: string, enClaro: string): Promise<boolean> {
  try {
    return await verify(hashGuardado, enClaro)
  } catch {
    return false
  }
}
