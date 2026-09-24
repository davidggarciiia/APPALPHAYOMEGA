import { useMemo } from "react"
import {
  ComidaRegistradaSchema,
  ListadoComidasRegistradasSchema,
  RegistrarComidaSchema,
  type ComidaRegistrada,
  type ListadoComidasRegistradas,
  type RegistrarComida,
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
  comidas: (clienteId: string, desde: string, hasta: string) => Promise<ListadoComidasRegistradas>
  registrarComida: (
    clienteId: string,
    fecha: string,
    comidaId: string,
    datos: RegistrarComida,
  ) => Promise<ComidaRegistrada>
  quitarComida: (clienteId: string, fecha: string, comidaId: string) => Promise<void>
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
    comidas: (clienteId, desde, hasta) =>
      pedir(
        `${ruta(clienteId)}/comidas?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}`,
        ListadoComidasRegistradasSchema,
      ),
    registrarComida: (clienteId, fecha, comidaId, datos) =>
      pedir(
        `${ruta(clienteId)}/comidas/${encodeURIComponent(fecha)}/${encodeURIComponent(comidaId)}`,
        ComidaRegistradaSchema,
        { method: "PUT", body: JSON.stringify(RegistrarComidaSchema.parse(datos)) },
      ),
    quitarComida: async (clienteId, fecha, comidaId) => {
      await pedir(
        `${ruta(clienteId)}/comidas/${encodeURIComponent(fecha)}/${encodeURIComponent(comidaId)}`,
        z.null(),
        { method: "DELETE" },
      )
    },
  }
}

export function useNutricion(): ApiNutricion {
  const { pedir } = useSesion()
  return useMemo(() => crearApiNutricion(pedir), [pedir])
}
