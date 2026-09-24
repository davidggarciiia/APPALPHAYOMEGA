import { useMemo } from "react"
import { useSesion } from "../sesion"
import {
  crearApiValoraciones,
  type ApiValoraciones,
  type ApiValoracionesCliente,
} from "./valoraciones-api"

export function useValoraciones(): ApiValoraciones & ApiValoracionesCliente {
  const { pedir } = useSesion()
  return useMemo(() => crearApiValoraciones(pedir), [pedir])
}
