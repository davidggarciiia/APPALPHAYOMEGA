import { useCallback, useState } from "react"
import { useFocusEffect, useRouter } from "expo-router"
import { AppState, Text, View } from "react-native"
import type { SesionEntrenador, ResultadoEntrenamiento } from "@alpha-omega/shared"
import type { ApiEntrenamiento } from "../entrenamiento/api"
import { FechaSesion } from "../entrenamiento/fecha-sesion"
import { PrescripcionVisible } from "../entrenamiento/resultado"
import { AvisoDeError, BotonSecundario } from "../componentes/formulario"
import { tema } from "../tema"

export function DetalleEntrenador({
  id,
  api,
}: {
  id: string
  api: ApiEntrenamiento
}): React.JSX.Element {
  const [sesion, setSesion] = useState<SesionEntrenador | null>(null)
  const [resultado, setResultado] = useState<ResultadoEntrenamiento | undefined>()
  const [error, setError] = useState("")
  const [intento, setIntento] = useState(0)
  const router = useRouter()
  useFocusEffect(
    useCallback(() => {
      let vigente = true,
        cargando = false
      const cargar = async (): Promise<void> => {
        if (cargando || (AppState.currentState !== null && AppState.currentState !== "active"))
          return
        cargando = true
        try {
          const s = await api.leerEntrenador(id)
          const r = s.enviadoEn ? await api.resultado(id) : undefined
          if (vigente) {
            setSesion(s)
            setResultado(r)
            setError("")
          }
        } catch {
          if (vigente) setError("No se pudo actualizar el entrenamiento.")
        } finally {
          cargando = false
        }
      }
      void cargar()
      const reloj = setInterval(() => void cargar(), 5000)
      const actividad = AppState.addEventListener("change", (s) => {
        if (s === "active") void cargar()
      })
      return () => {
        vigente = false
        clearInterval(reloj)
        actividad.remove()
      }
    }, [id, api, intento]),
  )
  return (
    <View style={{ gap: 16 }}>
      {error !== "" && (
        <>
          <AvisoDeError mensaje={error} />
          <BotonSecundario
            texto="Actualizar entrenamiento"
            onPress={() => setIntento((n) => n + 1)}
          />
        </>
      )}
      {sesion ? (
        <>
          <Text style={{ fontFamily: tema.fuenteBoton, color: tema.texto, fontSize: 28 }}>
            {sesion.prescripcion.nombre}
          </Text>
          <FechaSesion
            agenda={sesion.agenda}
            api={api}
            actualizado={async () => {
              setSesion(await api.leerEntrenador(id))
            }}
          />
          {!resultado && (
            <Text style={{ fontFamily: tema.fuenteTexto, color: tema.textoTenue }}>
              Pendiente de envío. Los registros del cliente son privados hasta que termine el
              entrenamiento.
            </Text>
          )}
          <PrescripcionVisible prescripcion={sesion.prescripcion} resultado={resultado} />
          {sesion.permiteAjuste && (
            <BotonSecundario
              texto="Ajustar esta sesión"
              onPress={() =>
                router.push({ pathname: "/entrenador/sesion/[id]/ajustar", params: { id } })
              }
            />
          )}
        </>
      ) : (
        <Text style={{ fontFamily: tema.fuenteTexto, color: tema.texto }}>Cargando…</Text>
      )}
    </View>
  )
}
