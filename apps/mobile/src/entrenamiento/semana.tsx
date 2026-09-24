import { AgendaSemanal } from "./agenda-semanal"
import type { DetalleDeHoy } from "./hoy-toca"
import { useCallback, useRef, useState } from "react"
import { useFocusEffect } from "expo-router"
import { AppState, Text, View } from "react-native"
import {
  ListadoSesionesSchema,
  type DeporteDelPlan,
  type ListadoSesiones,
} from "@alpha-omega/shared"
import { almacenDispositivo } from "./almacen-dispositivo"
import type { ApiEntrenamiento } from "./api"
import { claveSesion, DocumentoSesionSchema } from "./documento-local"
import { lunesDeSemana, sumarDias } from "./fechas"
import { AvisoDeError, BotonSecundario } from "../componentes/formulario"
import { tema } from "../tema"

async function empezadasLocales(
  clienteId: string,
  sesiones: ListadoSesiones["sesiones"],
): Promise<Record<string, string>> {
  const pendientes = sesiones.filter((sesion) => sesion.enviadoEn === null)
  const documentos = await Promise.allSettled(
    pendientes.map((sesion) =>
      almacenDispositivo.leer(clienteId, claveSesion(sesion.agenda.id), DocumentoSesionSchema),
    ),
  )
  return Object.fromEntries(
    documentos.flatMap((resultado, indice) => {
      if (resultado.status !== "fulfilled" || !resultado.value) return []
      const documento = resultado.value
      const { edicion } = documento
      if (!edicion.checkin && !edicion.inicio && !edicion.series.some((serie) => serie.hecha))
        return []
      const sesion = pendientes[indice]!
      return [
        [
          sesion.agenda.id,
          edicion.inicio ??
            documento.sesion.borrador?.actualizadoEn ??
            `${sesion.agenda.fechaActual}T00:00:00.000Z`,
        ],
      ]
    }),
  )
}

export function SemanaEntrenamiento({
  clienteId,
  api,
  abrir,
  copiaLocal = false,
  resumenHoy = false,
  detectarEmpezadas = false,
  detalle,
  deportes,
}: {
  clienteId: string
  api: ApiEntrenamiento
  abrir: (id: string) => void
  copiaLocal?: boolean
  resumenHoy?: boolean
  detectarEmpezadas?: boolean
  detalle?: DetalleDeHoy
  deportes?: DeporteDelPlan[]
}): React.JSX.Element {
  const [semana, setSemana] = useState(lunesDeSemana)
  const semanaActual = useRef(lunesDeSemana())
  const [listado, setListado] = useState<ListadoSesiones | null>(null)
  const [empezadas, setEmpezadas] = useState<Record<string, string>>({})
  const [error, setError] = useState("")
  const [intento, setIntento] = useState(0)
  useFocusEffect(
    useCallback(() => {
      let vigente = true
      let enCurso = false
      let ultimaConsultaDetalles = 0
      let idsPendientes = ""
      let remotas: Record<string, string> = {}
      const cancelacion = new AbortController()
      setListado(null)
      setEmpezadas({})
      const cargar = async (): Promise<void> => {
        if (enCurso || (AppState.currentState !== null && AppState.currentState !== "active"))
          return
        const actual = lunesDeSemana()
        if (resumenHoy && semanaActual.current !== actual) {
          const anterior = semanaActual.current
          semanaActual.current = actual
          if (semana === anterior) {
            setSemana(actual)
            return
          }
        }
        enCurso = true
        try {
          const datos = await api.semana(clienteId, semana, cancelacion.signal)
          if (vigente && copiaLocal)
            await almacenDispositivo.guardar(clienteId, `semana-${semana}`, datos)
          if (vigente) {
            setListado(datos)
            setError("")
          }
          if ((resumenHoy && semana === actual) || detectarEmpezadas) {
            const pendientes = datos.sesiones.filter((sesion) => sesion.enviadoEn === null)
            const clave = pendientes.map((sesion) => sesion.agenda.id).join(",")
            if (pendientes.length === 0) {
              remotas = {}
              if (vigente) setEmpezadas({})
              idsPendientes = ""
            } else if (clave !== idsPendientes || Date.now() - ultimaConsultaDetalles >= 60_000) {
              if (clave !== idsPendientes) remotas = {}
              idsPendientes = clave
              ultimaConsultaDetalles = Date.now()
              const detalles = await Promise.allSettled(
                pendientes.map((sesion) => api.leerCliente(sesion.agenda.id)),
              )
              if (vigente && detalles.some((detalle) => detalle.status === "fulfilled")) {
                remotas = Object.fromEntries(
                  detalles.flatMap((detalle, indice) => {
                    if (detalle.status !== "fulfilled") return []
                    const registro = detalle.value.borrador?.registro
                    const empezada =
                      registro?.checkin ||
                      registro?.inicio ||
                      registro?.series.some((serie) => serie.hecha)
                    return empezada
                      ? [[pendientes[indice]!.agenda.id, detalle.value.borrador!.actualizadoEn]]
                      : []
                  }),
                )
              }
            }
            const locales = copiaLocal ? await empezadasLocales(clienteId, datos.sesiones) : {}
            if (vigente) setEmpezadas({ ...remotas, ...locales })
          }
        } catch {
          if (vigente && copiaLocal) {
            const copia = await almacenDispositivo
              .leer(clienteId, `semana-${semana}`, ListadoSesionesSchema)
              .catch(() => null)
            if (vigente && copia) {
              if ((resumenHoy && semana === lunesDeSemana()) || detectarEmpezadas) {
                const locales = await empezadasLocales(clienteId, copia.sesiones)
                if (vigente) setEmpezadas(locales)
              }
              if (vigente) setListado(copia)
            }
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
    }, [api, clienteId, semana, intento, copiaLocal, resumenHoy, detectarEmpezadas]),
  )
  const actualizar = async (): Promise<void> => {
    const datos = await api.semana(clienteId, semana)
    setListado(datos)
    if (copiaLocal)
      await almacenDispositivo.guardar(clienteId, `semana-${semana}`, datos).catch(() => undefined)
  }
  return (
    <View style={{ gap: 14 }}>
      {error !== "" && (
        <>
          <AvisoDeError mensaje={error} />
          <BotonSecundario texto="Actualizar semana" onPress={() => setIntento((n) => n + 1)} />
        </>
      )}
      {listado === null && error === "" && (
        <Text style={{ fontFamily: tema.fuenteTexto, color: tema.textoTenue }}>
          Cargando entrenamientos…
        </Text>
      )}
      <AgendaSemanal
        key={semana}
        semana={semana}
        listado={listado}
        abrir={abrir}
        resumenHoy={resumenHoy}
        detalle={detalle}
        deportes={deportes}
        empezadas={empezadas}
        api={api}
        actualizado={actualizar}
        cambiarSemana={(dias) => setSemana((actual) => sumarDias(actual, dias))}
      />
    </View>
  )
}
