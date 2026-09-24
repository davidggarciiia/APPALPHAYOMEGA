import { useMemo } from "react"
import { useSesion } from "../sesion"
import { crearApiValoraciones, type ApiValoraciones } from "./valoraciones-api"

export function useValoraciones(): ApiValoraciones {
  const { pedir } = useSesion()
  return useMemo(() => crearApiValoraciones(pedir), [pedir])
}
