/**
 * Límites de los datos de demostración. El sembrado borra y recrea todo lo de
 * sus cuentas, así que solo puede tocar una base pensada para ello y solo a
 * los usuarios de su dominio reservado.
 */

/** Dominio reservado (RFC 2606): ningún correo real acaba así. */
export const DOMINIO_DEMO = "demo.alphaomega.test"

export function esCorreoDemo(email: string): boolean {
  return email.trim().toLowerCase().endsWith(`@${DOMINIO_DEMO}`)
}

/**
 * `null` si la base admite datos de demostración; si no, el motivo para
 * negarse. Solo vale una base cuyo nombre diga `demo`: nunca la principal.
 */
export function motivoParaNoSembrar(baseDeDatos: string | undefined): string | null {
  const nombre = baseDeDatos?.trim() ?? ""
  if (nombre === "") return "Falta POSTGRES_DB: no se sabe en qué base se escribiría."
  if (!nombre.toLowerCase().includes("demo"))
    return (
      `La base «${nombre}» no es de demostración. El sembrado de demo solo escribe en una ` +
      "base cuyo nombre contenga «demo» (por ejemplo, POSTGRES_DB=alpha_omega_demo)."
    )
  return null
}
