import { useLocalSearchParams } from "expo-router"

import { EditorDeRutina } from "../../../src/entrenamiento-entrenador/rutinas"

export default function Rutina(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>()
  const rutinaId = (Array.isArray(id) ? id[0] : id) ?? "nueva"
  return <EditorDeRutina key={rutinaId} id={rutinaId} />
}
