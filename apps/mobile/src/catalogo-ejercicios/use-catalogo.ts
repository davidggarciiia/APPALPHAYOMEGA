import { useMemo } from "react"
import { useSesion } from "../sesion"
import { crearPeticionAutenticada } from "../lib/peticion-autenticada"
import { crearApiDeCatalogo, type ApiDeCatalogo } from "./api"

export function useCatalogo(): ApiDeCatalogo {
  const { estado } = useSesion()
  const token = estado.fase === "dentro" ? estado.tokenAcceso : null
  return useMemo(() => crearApiDeCatalogo(crearPeticionAutenticada(() => token)), [token])
}
