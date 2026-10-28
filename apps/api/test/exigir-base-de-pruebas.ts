/**
 * Los E2E crean y borran filas de verdad. Para que un `npm run test:e2e` a secas
 * no acabe escribiendo en la base habitual, solo se ejecutan contra una base cuyo
 * nombre lleve "e2e" (alpha_omega_e2e_codex, alpha_omega_e2e_ci...).
 */
export function exigirBaseDePruebas(baseDeDatos: string): void {
  if (!/e2e/i.test(baseDeDatos))
    throw new Error(
      `Los E2E se niegan a correr contra la base "${baseDeDatos}". Usa una base de pruebas ` +
        `con "e2e" en el nombre, por ejemplo: POSTGRES_DB=alpha_omega_e2e_codex`,
    )
}
