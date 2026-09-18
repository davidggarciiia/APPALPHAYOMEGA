import { useMemo } from "react"
import { useSesion } from "../sesion"
import { crearApiDeCatalogo, type ApiDeCatalogo } from "./api"

export function useCatalogo(): ApiDeCatalogo {
  const { pedir } = useSesion()
  return useMemo(() => crearApiDeCatalogo(pedir), [pedir])
}
