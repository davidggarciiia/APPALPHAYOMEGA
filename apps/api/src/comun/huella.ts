import { createHash } from "node:crypto"

/**
 * JSON con las claves ordenadas, para que dos objetos iguales den el mismo texto
 * aunque sus propiedades lleguen en otro orden.
 */
export function jsonCanonico(valor: unknown): string {
  if (Array.isArray(valor)) {
    return `[${valor.map(jsonCanonico).join(",")}]`
  }
  if (valor !== null && typeof valor === "object") {
    const claves = Object.keys(valor).sort()
    const objeto = valor as Record<string, unknown>
    return `{${claves
      .filter((clave) => objeto[clave] !== undefined)
      .map((clave) => `${JSON.stringify(clave)}:${jsonCanonico(objeto[clave])}`)
      .join(",")}}`
  }
  return JSON.stringify(valor) ?? "null"
}

/**
 * Huella de una petición idempotente.
 *
 * Repetir una operación con el mismo id y la misma huella es un reintento y
 * devuelve lo mismo; con otra huella es reutilizar un id para otra cosa y es 409.
 */
export function huellaDe(valor: unknown): string {
  return createHash("sha256").update(jsonCanonico(valor)).digest("hex")
}
