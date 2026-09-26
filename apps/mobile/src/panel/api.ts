import { useMemo } from "react"
import {
  NovedadesLeidasSchema,
  PanelHoySchema,
  type NovedadesLeidas,
  type PanelHoy,
} from "@alpha-omega/shared"

import type { PeticionAutenticada } from "../lib/peticion-autenticada"
import { useSesion } from "../sesion"

export type ApiPanel = {
  /** Todo el panel «Hoy» en una petición. */
  hoy: () => Promise<PanelHoy>
  /** Abrir un comentario desde el panel lo da por leído para este entrenador. */
  leerComentario: (sesionId: string, novedadId: string) => Promise<NovedadesLeidas>
}

export function crearApiPanel(pedir: PeticionAutenticada): ApiPanel {
  return {
    hoy: () => pedir("/panel/hoy", PanelHoySchema),
    leerComentario: (sesionId, novedadId) =>
      pedir(
        `/entrenamiento/sesiones/${encodeURIComponent(sesionId)}/novedades/leidas`,
        NovedadesLeidasSchema,
        { method: "POST", body: JSON.stringify({ novedadIds: [novedadId] }) },
      ),
  }
}

export function usePanel(): ApiPanel {
  const { pedir } = useSesion()
  return useMemo(() => crearApiPanel(pedir), [pedir])
}
