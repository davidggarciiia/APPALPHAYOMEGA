import { useState } from "react"
import { Text, View } from "react-native"
import type { SesionProgramada, CambioDeFecha } from "@alpha-omega/shared"
import type { ApiEntrenamiento } from "./api"
import { fechaLegible, lunesDeSemana, sumarDias } from "./fechas"
import { AvisoDeError, BotonSecundario } from "../componentes/formulario"
import { tema } from "../tema"

export function FechaSesion({
  agenda,
  api,
  actualizado,
}: {
  agenda: SesionProgramada
  api: ApiEntrenamiento
  actualizado: () => Promise<void>
}): React.JSX.Element {
  const [eligiendo, setEligiendo] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState("")
  const [historial, setHistorial] = useState<CambioDeFecha[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const mover = async (fecha: string): Promise<void> => {
    setOcupado(true)
    setError("")
    try {
      await api.mover(agenda.id, { fecha, revision: agenda.revision })
      await actualizado()
      setEligiendo(false)
      setHistorial([])
      setTotal(null)
    } catch {
      setError("No se pudo cambiar el día. Actualiza la sesión antes de reintentar.")
      await actualizado().catch(() => undefined)
    } finally {
      setOcupado(false)
    }
  }
  const cambios = async (): Promise<void> => {
    setOcupado(true)
    setError("")
    try {
      const pagina = await api.cambios(agenda.id, historial.length)
      setHistorial((v) => [...v, ...pagina.cambios])
      setTotal(pagina.total)
    } catch {
      setError("No se pudo consultar el historial de cambios.")
    } finally {
      setOcupado(false)
    }
  }
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: tema.texto }}>{fechaLegible(agenda.fechaActual)}</Text>
      {agenda.fechaActual !== agenda.fechaOriginal && (
        <Text style={{ color: tema.textoTenue }}>
          Día original: {fechaLegible(agenda.fechaOriginal)}
        </Text>
      )}
      {agenda.estado === "abierta" && (
        <BotonSecundario
          texto={eligiendo ? "Cancelar cambio de día" : "Cambiar día"}
          onPress={() => setEligiendo(!eligiendo)}
          ocupado={ocupado}
        />
      )}
      {eligiendo && (
        <View style={{ gap: 4 }}>
          <Text style={{ color: tema.textoTenue }}>
            Puedes elegir cualquier día de esta semana. Tu entrenador verá el cambio.
          </Text>
          {Array.from({ length: 7 }, (_, n) =>
            sumarDias(lunesDeSemana(agenda.fechaOriginal), n),
          ).map((fecha) => (
            <BotonSecundario
              key={fecha}
              texto={fechaLegible(fecha)}
              ocupado={ocupado}
              onPress={() => void mover(fecha)}
            />
          ))}
        </View>
      )}
      {(total === null || historial.length < total) && (
        <BotonSecundario
          texto={total === null ? "Ver cambios de día" : "Más cambios"}
          ocupado={ocupado}
          onPress={() => void cambios()}
        />
      )}
      {total === 0 && <Text style={{ color: tema.textoTenue }}>Sin cambios de día.</Text>}
      {historial.map((c) => (
        <Text key={c.id} style={{ color: tema.textoTenue }}>
          {fechaLegible(c.fechaAnterior)} → {fechaLegible(c.fechaNueva)}
        </Text>
      ))}
      {error !== "" && <AvisoDeError mensaje={error} />}
    </View>
  )
}
