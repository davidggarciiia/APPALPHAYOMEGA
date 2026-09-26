import { useLocalSearchParams } from "expo-router"

import { EditorDePlan } from "../../../../src/entrenamiento-entrenador/editor-plan"

function uno(valor: string | string[] | undefined): string {
  return (Array.isArray(valor) ? valor[0] : valor) ?? ""
}

export default function PlanDelCliente(): React.JSX.Element {
  const parametros = useLocalSearchParams<{ id?: string | string[]; nombre?: string | string[] }>()
  return (
    <EditorDePlan
      clienteId={uno(parametros.id)}
      nombreCliente={uno(parametros.nombre) || "Cliente"}
    />
  )
}
