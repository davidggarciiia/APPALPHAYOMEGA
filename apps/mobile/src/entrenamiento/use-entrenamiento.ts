import { useMemo } from "react"
import { useSesion } from "../sesion"
import { crearPeticionAutenticada } from "../lib/peticion-autenticada"
import { crearApiEntrenamiento, type ApiEntrenamiento } from "./api"

export function useEntrenamiento(): ApiEntrenamiento {
  const { estado } = useSesion()
  const token = estado.fase === "dentro" ? estado.tokenAcceso : null
  return useMemo(() => crearApiEntrenamiento(crearPeticionAutenticada(() => token)), [token])
}
