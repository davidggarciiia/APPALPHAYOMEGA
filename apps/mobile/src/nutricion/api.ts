import { useMemo } from "react"
import {
  BorradorDietaSchema,
  DietaDelHistoricoSchema,
  DietaPublicadaSchema,
  GuardarBorradorDietaSchema,
  LecturaBorradorDietaSchema,
  LecturaDietaVigenteSchema,
  ListadoDietasSchema,
  PublicarDietaSchema,
  type BorradorDieta,
  type DietaDelHistorico,
  type DietaPublicada,
  type DocumentoDieta,
  type LecturaBorradorDieta,
  type LecturaDietaVigente,
  type ListadoDietas,
} from "@alpha-omega/shared"
import { z } from "zod"
import type { PeticionAutenticada } from "../lib/peticion-autenticada"
import { useSesion } from "../sesion"

/** Lo que las pantallas de nutrición necesitan del servidor. Las pruebas usan dobles. */
export type ApiNutricion = {
  vigente: (clienteId: string, signal?: AbortSignal) => Promise<LecturaDietaVigente>
  borrador: (clienteId: string) => Promise<LecturaBorradorDieta>
  guardar: (
    clienteId: string,
    revision: number,
    documento: DocumentoDieta,
  ) => Promise<BorradorDieta>
  publicar: (clienteId: string, operacionId: string, revision: number) => Promise<DietaPublicada>
  descartar: (clienteId: string, revision: number) => Promise<void>
  historico: (clienteId: string, desplazamiento: number) => Promise<ListadoDietas>
  delHistorico: (clienteId: string, dietaId: string) => Promise<DietaDelHistorico>
}

const ruta = (clienteId: string): string => `/nutricion/clientes/${encodeURIComponent(clienteId)}`

export function crearApiNutricion(pedir: PeticionAutenticada): ApiNutricion {
  return {
    vigente: (clienteId, signal) =>
      pedir(`${ruta(clienteId)}/dieta`, LecturaDietaVigenteSchema, { signal }),
    borrador: (clienteId) => pedir(`${ruta(clienteId)}/borrador`, LecturaBorradorDietaSchema),
    guardar: (clienteId, revision, documento) =>
      pedir(`${ruta(clienteId)}/borrador`, BorradorDietaSchema, {
        method: "PUT",
        body: JSON.stringify(GuardarBorradorDietaSchema.parse({ revision, documento })),
      }),
    // Lleva operacionId: el transporte puede repetirla tras renovar el acceso sin duplicarla.
    publicar: (clienteId, operacionId, revision) =>
      pedir(`${ruta(clienteId)}/borrador/publicar`, DietaPublicadaSchema, {
        method: "POST",
        body: JSON.stringify(PublicarDietaSchema.parse({ operacionId, revision })),
      }),
    descartar: async (clienteId, revision) => {
      await pedir(`${ruta(clienteId)}/borrador/descartar`, z.null(), {
        method: "POST",
        body: JSON.stringify({ revision }),
      })
    },
    historico: (clienteId, desplazamiento) =>
      pedir(
        `${ruta(clienteId)}/historico?limite=20&desplazamiento=${String(desplazamiento)}`,
        ListadoDietasSchema,
      ),
    delHistorico: (clienteId, dietaId) =>
      pedir(`${ruta(clienteId)}/dietas/${encodeURIComponent(dietaId)}`, DietaDelHistoricoSchema),
  }
}

export function useNutricion(): ApiNutricion {
  const { pedir } = useSesion()
  return useMemo(() => crearApiNutricion(pedir), [pedir])
}
