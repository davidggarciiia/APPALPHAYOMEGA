import { useState } from "react"
import type { ActivarSolicitud, TipoProducto } from "@alpha-omega/shared"

import { centimosDe, textoImporte } from "./formato"
import { Aviso, Boton, CampoTexto, Eleccion, Grupo, Texto } from "./piezas"

/**
 * Lo que el entrenador indica al activar un producto: cuánto ha cobrado (por
 * defecto, el precio), si un plan empieza este mes o el siguiente, y si el
 * dinero ya está en su mano o queda pendiente.
 */
export function FormularioActivacion({
  tipo,
  precioCentimos,
  ocupado,
  fallo,
  confirmar,
  cancelar,
}: {
  tipo: TipoProducto
  precioCentimos: number
  ocupado: boolean
  fallo: string | null
  confirmar: (datos: ActivarSolicitud) => void
  cancelar: () => void
}): React.JSX.Element {
  const [importe, setImporte] = useState(textoImporte(precioCentimos))
  const [mesInicio, setMesInicio] = useState<ActivarSolicitud["mesInicio"]>("actual")
  const [cobrado, setCobrado] = useState(true)
  const [invalido, setInvalido] = useState(false)

  return (
    <>
      <CampoTexto
        etiqueta="Importe (€)"
        value={importe}
        onChangeText={(texto) => {
          setImporte(texto)
          setInvalido(false)
        }}
        keyboardType="decimal-pad"
        editable={!ocupado}
        aria-invalid={invalido}
      />
      {invalido && <Aviso texto="Escribe un importe válido, por ejemplo 35 o 12,50." />}
      {tipo === "plan" && (
        <>
          <Texto tenue>Empieza</Texto>
          <Grupo etiqueta="Empieza">
            <Eleccion
              texto="Este mes"
              elegida={mesInicio === "actual"}
              onPress={() => setMesInicio("actual")}
            />
            <Eleccion
              texto="El siguiente"
              elegida={mesInicio === "siguiente"}
              onPress={() => setMesInicio("siguiente")}
            />
          </Grupo>
        </>
      )}
      <Texto tenue>Cobro</Texto>
      <Grupo etiqueta="Cobro">
        <Eleccion texto="Cobrado ya" elegida={cobrado} onPress={() => setCobrado(true)} />
        <Eleccion texto="Pendiente" elegida={!cobrado} onPress={() => setCobrado(false)} />
      </Grupo>
      {fallo !== null && <Aviso texto={fallo} />}
      <Boton
        texto="Activar"
        ocupado={ocupado}
        onPress={() => {
          const importeCentimos = centimosDe(importe)
          if (importeCentimos === null) {
            setInvalido(true)
            return
          }
          confirmar({ importeCentimos, mesInicio, cobrado })
        }}
      />
      <Boton texto="Cancelar" tipo="secundario" deshabilitado={ocupado} onPress={cancelar} />
    </>
  )
}
