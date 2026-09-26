import { useLocalSearchParams } from "expo-router"

import { PanelDeEntrenos } from "../../../../src/entrenamiento-entrenador/panel"
import { PlanesDelCliente } from "../../../../src/entrenamiento-entrenador/planes-del-cliente"

function uno(valor: string | string[] | undefined): string {
  return (Array.isArray(valor) ? valor[0] : valor) ?? ""
}

/** Los entrenos de un cliente: sus planes arriba y su semana debajo. */
export default function EntrenosDelCliente(): React.JSX.Element {
  const parametros = useLocalSearchParams<{ id?: string | string[]; nombre?: string | string[] }>()
  const clienteId = uno(parametros.id)
  const nombre = uno(parametros.nombre) || "Cliente"
  return (
    <PanelDeEntrenos
      clienteId={clienteId}
      titulo={nombre}
      cabecera={<PlanesDelCliente clienteId={clienteId} nombre={nombre} />}
    />
  )
}
