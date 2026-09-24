import { useMemo } from "react"
import { useSesion } from "../sesion"
import {
  crearApiValoraciones,
  type ApiEvolucionAvisos,
  type ApiValoraciones,
  type ApiValoracionesCliente,
} from "./valoraciones-api"

export function useValoraciones(): ApiValoraciones & ApiValoracionesCliente & ApiEvolucionAvisos {
  const { pedir } = useSesion()
  return useMemo(() => crearApiValoraciones(pedir), [pedir])
}
