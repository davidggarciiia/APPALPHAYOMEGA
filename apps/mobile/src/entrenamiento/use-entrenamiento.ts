import { useMemo } from "react"
import { useSesion } from "../sesion"
import { crearApiEntrenamiento, type ApiEntrenamiento } from "./api"

export function useEntrenamiento(): ApiEntrenamiento {
  const { pedir } = useSesion()
  return useMemo(() => crearApiEntrenamiento(pedir), [pedir])
}
