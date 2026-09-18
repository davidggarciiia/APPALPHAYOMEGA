import { AgendaSemanal } from "./agenda-semanal"
import { useCallback, useState } from "react"
import { useFocusEffect } from "expo-router"
import { AppState, Text, View } from "react-native"
import { ListadoSesionesSchema, type ListadoSesiones } from "@alpha-omega/shared"
import { almacenDispositivo } from "./almacen-dispositivo"
import type { ApiEntrenamiento } from "./api"
import { lunesDeSemana, sumarDias } from "./fechas"
import { AvisoDeError, BotonSecundario } from "../componentes/formulario"
import { tema } from "../tema"

export function SemanaEntrenamiento({
  clienteId,
  api,
  abrir,
  copiaLocal = false,
  resumenHoy = false,
}: {
  clienteId: string
  api: ApiEntrenamiento
  abrir: (id: string) => void
  copiaLocal?: boolean
  resumenHoy?: boolean
}): React.JSX.Element {
  const [semana, setSemana] = useState(lunesDeSemana)
  const [listado, setListado] = useState<ListadoSesiones | null>(null)
  const [error, setError] = useState("")
  const [intento, setIntento] = useState(0)
  useFocusEffect(
    useCallback(() => {
      let vigente = true
      let enCurso = false
      const cancelacion = new AbortController()
      setListado(null)
      const cargar = async (): Promise<void> => {
        if (enCurso || (AppState.currentState !== null && AppState.currentState !== "active"))
          return
        enCurso = true
        try {
          const datos = await api.semana(clienteId, semana, cancelacion.signal)
          if (vigente && copiaLocal)
            await almacenDispositivo.guardar(clienteId, `semana-${semana}`, datos)
          if (vigente) {
            setListado(datos)
            setError("")
          }
        } catch {
          if (vigente && copiaLocal) {
            const copia = await almacenDispositivo
              .leer(clienteId, `semana-${semana}`, ListadoSesionesSchema)
              .catch(() => null)
            if (vigente && copia) setListado(copia)
          }
          if (vigente)
            setError("No se pudo actualizar la semana. Revisa la conexión y vuelve a intentarlo.")
        } finally {
          enCurso = false
        }
      }
      void cargar()
      const reloj = setInterval(() => void cargar(), 5000)
      const actividad = AppState.addEventListener("change", (estado) => {
        if (estado === "active") void cargar()
      })
      return () => {
        vigente = false
        cancelacion.abort()
        clearInterval(reloj)
        actividad.remove()
      }
    }, [api, clienteId, semana, intento, copiaLocal]),
  )
  return (
    <View style={{ gap: 14 }}>
      {error !== "" && (
        <>
          <AvisoDeError mensaje={error} />
          <BotonSecundario texto="Actualizar semana" onPress={() => setIntento((n) => n + 1)} />
        </>
      )}
      {listado === null && error === "" && (
        <Text style={{ color: tema.textoTenue }}>Cargando entrenamientos…</Text>
      )}
      <AgendaSemanal
        key={semana}
        semana={semana}
        listado={listado}
        abrir={abrir}
        resumenHoy={resumenHoy}
        cambiarSemana={(dias) => setSemana((actual) => sumarDias(actual, dias))}
      />
    </View>
  )
}
