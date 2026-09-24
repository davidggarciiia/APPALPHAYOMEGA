import { useMemo } from "react"
import { useSesion } from "../sesion"
import { crearApiSeguimiento, type ApiSeguimiento } from "./api"

export function useSeguimiento(): ApiSeguimiento {
  const { pedir } = useSesion()
  return useMemo(() => crearApiSeguimiento(pedir), [pedir])
}
