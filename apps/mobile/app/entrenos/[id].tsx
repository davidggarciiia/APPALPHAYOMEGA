import { useLocalSearchParams } from "expo-router"

import { RegistroDeSesion } from "../../src/entrenamiento-cliente/registro"

export default function Entreno(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>()
  const sesionId = Array.isArray(id) ? (id[0] ?? "") : (id ?? "")
  return <RegistroDeSesion key={sesionId} sesionId={sesionId} />
}
