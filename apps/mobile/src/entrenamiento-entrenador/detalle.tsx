import { useCallback, useState } from "react"
import { useFocusEffect, useRouter } from "expo-router"
import { AppState, Text, View } from "react-native"
import type { SesionEntrenador, ResultadoEntrenamiento } from "@alpha-omega/shared"
import type { ApiEntrenamiento } from "../entrenamiento/api"
import { FechaSesion } from "../entrenamiento/fecha-sesion"
import { PrescripcionVisible } from "../entrenamiento/resultado"
import { seriesDeTrabajo } from "../entrenamiento/sesion/modelo"
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
  const [revisando, setRevisando] = useState(false)
  const router = useRouter()
  const completada = Boolean(
    sesion?.agenda.id === id && sesion.enviadoEn && sesion.revisadaEn && resultado && !error,
  )
  const trabajo = new Set(resultado ? seriesDeTrabajo(resultado.prescripcion) : [])
  useFocusEffect(
    useCallback(() => {
      if (completada) return
      let vigente = true,
        cargando = false,
        enviada = false
      const cargar = async (): Promise<void> => {
        if (
          !vigente ||
          cargando ||
          (AppState.currentState !== null && AppState.currentState !== "active")
        )
          return
        cargando = true
        try {
          const lectura = api.leerEntrenador(id)
          const [s, r] = await Promise.allSettled([
            lectura,
            enviada
              ? api.resultado(id)
              : lectura.then((s) => (vigente && s.enviadoEn ? api.resultado(id) : undefined)),
          ])
          if (vigente) {
            if (s.status === "fulfilled") {
              setSesion(s.value)
              enviada = Boolean(s.value.enviadoEn)
            }
            if (r.status === "fulfilled") setResultado(r.value)
            setError(
              s.status === "rejected" || r.status === "rejected"
                ? "No se pudo actualizar el entrenamiento."
                : "",
            )
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
    }, [id, api, intento, completada]),
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
          {resultado && (
            <Text style={{ fontFamily: tema.fuenteTexto, color: tema.textoTenue, fontSize: 13 }}>
              {resultado.series.filter((serie) => serie.hecha && trabajo.has(serie.serieId)).length}
              {" de "}
              {trabajo.size} series
            </Text>
          )}
          <PrescripcionVisible prescripcion={sesion.prescripcion} resultado={resultado} />
          {resultado &&
            (sesion.revisadaEn ? (
              <Text style={{ fontFamily: tema.fuenteTexto, color: tema.textoTenue }}>Revisado</Text>
            ) : (
              <BotonSecundario
                texto={revisando ? "Guardando revisión…" : "Marcar como revisado"}
                onPress={() => {
                  if (revisando) return
                  setRevisando(true)
                  void api
                    .revisar(id)
                    .then((actualizada) => {
                      setSesion(actualizada)
                      setError("")
                    })
                    .catch(() => setError("No se pudo guardar la revisión. Reintenta."))
                    .finally(() => setRevisando(false))
                }}
              />
            ))}
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
