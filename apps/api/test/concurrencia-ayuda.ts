/**
 * Espera la barrera del servicio, pero falla si el HTTP termina antes de llegar.
 * Así un rechazo del guard o del contrato entra en el finally y libera la pausa.
 */
export async function esperarPausa(
  entrada: Promise<void>,
  respuesta: Promise<{ status: number }>,
): Promise<void> {
  await Promise.race([
    entrada,
    respuesta.then((r) => {
      throw new Error(`La petición terminó con HTTP ${r.status} antes de alcanzar la barrera`)
    }),
  ])
}
