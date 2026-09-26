import { useLocalSearchParams } from "expo-router"

import { DetalleDeSesion } from "../../../src/entrenamiento-entrenador/detalle-sesion"

function uno(valor: string | string[] | undefined): string | null {
  const primero = Array.isArray(valor) ? valor[0] : valor
  return primero === undefined || primero === "" ? null : primero
}

export default function SesionDelEntrenador(): React.JSX.Element {
  const { id, cliente } = useLocalSearchParams<{
    id?: string | string[]
    cliente?: string | string[]
  }>()
  return <DetalleDeSesion id={uno(id) ?? ""} cliente={uno(cliente)} />
}
