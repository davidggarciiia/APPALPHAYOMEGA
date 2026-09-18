import { useCallback, useState } from "react"
import { useFocusEffect } from "expo-router"
import { AppState, Text, View } from "react-native"
import { ListadoSesionesSchema, type ListadoSesiones } from "@alpha-omega/shared"
import { almacenDispositivo } from "./almacen-dispositivo"
import type { ApiEntrenamiento } from "./api"
import { fechaLegible, lunesDeSemana, sumarDias } from "./fechas"
import { AvisoDeError, BotonSecundario } from "../componentes/formulario"
import { tema } from "../tema"

export function SemanaEntrenamiento({
  clienteId,
  api,
  abrir,
  copiaLocal = false,
}: {
  clienteId: string
  api: ApiEntrenamiento
  abrir: (id: string) => void
  copiaLocal?: boolean
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
      <Text style={{ color: tema.texto, fontSize: 26, fontWeight: "700" }}>Tu semana</Text>
      <Text style={{ color: tema.textoTenue }}>
        {fechaLegible(semana)} — {fechaLegible(sumarDias(semana, 6))}
      </Text>
      <View style={{ flexDirection: "row", gap: 14 }}>
        <BotonSecundario
          texto="Semana anterior"
          onPress={() => setSemana((actual) => sumarDias(actual, -7))}
        />
        <BotonSecundario
          texto="Semana siguiente"
          onPress={() => setSemana((actual) => sumarDias(actual, 7))}
        />
      </View>
      {error !== "" && (
        <>
          <AvisoDeError mensaje={error} />
          <BotonSecundario texto="Actualizar semana" onPress={() => setIntento((n) => n + 1)} />
        </>
      )}
      {listado === null && error === "" && (
        <Text style={{ color: tema.textoTenue }}>Cargando entrenamientos…</Text>
      )}
      {listado?.total === 0 && (
        <Text style={{ color: tema.textoTenue }}>No hay entrenamientos asignados esta semana.</Text>
      )}
      {listado?.sesiones.map((s) => (
        <View
          key={s.agenda.id}
          style={{
            backgroundColor: tema.superficie,
            borderColor: tema.borde,
            borderWidth: 1,
            borderRadius: 18,
            padding: 16,
            gap: 6,
          }}
        >
          <Text style={{ color: tema.textoTenue }}>{fechaLegible(s.agenda.fechaActual)}</Text>
          <Text style={{ color: tema.texto, fontSize: 20, fontWeight: "700" }}>{s.nombre}</Text>
          {s.agenda.fechaActual !== s.agenda.fechaOriginal && (
            <Text style={{ color: tema.textoTenue }}>
              Movido desde {fechaLegible(s.agenda.fechaOriginal)}
            </Text>
          )}
          <Text style={{ color: tema.texto }}>
            {s.enviadoEn === null ? "Pendiente de envío" : "Enviado"}
          </Text>
          <BotonSecundario texto={`Abrir ${s.nombre}`} onPress={() => abrir(s.agenda.id)} />
        </View>
      ))}
    </View>
  )
}
