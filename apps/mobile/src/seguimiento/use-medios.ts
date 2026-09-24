import { useMemo } from "react"
import { useSesion } from "../sesion"
import { crearApiMedios, type ApiMedios } from "./medios-api"

export function useMedios(): ApiMedios {
  const { pedir } = useSesion()
  return useMemo(() => crearApiMedios(pedir), [pedir])
}
