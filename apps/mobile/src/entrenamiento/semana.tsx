import { AgendaSemanal } from "./agenda-semanal"
import type { DetalleDeHoy } from "./hoy-toca"
import { useCallback, useRef, useState } from "react"
import { useFocusEffect } from "expo-router"
import { AppState, View } from "react-native"
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
import { faltaDe } from "../lib/errores"
import { ErrorDePermiso, ErrorDeSesion, ErrorDeRed } from "../lib/http"
import { Aviso } from "../componentes/aviso"
import { CambioDeContenido } from "../componentes/entrada-marca"

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
  const clave = `${clienteId}:${semana}`
  const [cargado, setCargado] = useState<{ clave: string; datos: ListadoSesiones } | null>(null)
  const listado = cargado?.clave === clave ? cargado.datos : null
  const ultimaCopia = useRef<{ clave: string; contenido: string } | null>(null)
  const [empezadas, setEmpezadas] = useState<Record<string, string>>({})
  const [error, setError] = useState("")
  const [sinConexion, setSinConexion] = useState(false)
  const [reintentable, setReintentable] = useState(true)
  const [intento, setIntento] = useState(0)
  const guardarCopia = useCallback(
    async (datos: ListadoSesiones): Promise<void> => {
      if (!copiaLocal) return
      const contenido = JSON.stringify(datos)
      if (ultimaCopia.current?.clave === clave && ultimaCopia.current.contenido === contenido)
        return
      await almacenDispositivo
        .guardar(clienteId, `semana-${semana}`, datos)
        .then(() => {
          ultimaCopia.current = { clave, contenido }
        })
        .catch(() => undefined)
    },
    [clienteId, semana, clave, copiaLocal],
  )
  useFocusEffect(
    useCallback(() => {
      let vigente = true
      let enCurso = false
      let ultimaConsultaDetalles = 0
      let idsPendientes = ""
      let remotas: Record<string, string> = {}
      let locales: Record<string, string> = {}
      let contenidoLocal: string | null = null
      let copiaLeida = false
      let accesoRechazado = false
      const cancelacion = new AbortController()
      setError("")
      setReintentable(true)
      const cargar = async (): Promise<void> => {
        if (
          enCurso ||
          accesoRechazado ||
          (AppState.currentState !== null && AppState.currentState !== "active")
        )
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
          if (copiaLocal && !copiaLeida) {
            copiaLeida = true
            const copia = await almacenDispositivo
              .leer(clienteId, `semana-${semana}`, ListadoSesionesSchema)
              .catch(() => null)
            if (!vigente) return
            if (copia) {
              const contenido = JSON.stringify(copia)
              ultimaCopia.current = { clave, contenido }
              setCargado((anterior) =>
                anterior?.clave === clave ? anterior : { clave, datos: copia },
              )
              if ((resumenHoy && semana === actual) || detectarEmpezadas) {
                locales = await empezadasLocales(clienteId, copia.sesiones)
                contenidoLocal = contenido
                if (vigente) setEmpezadas(locales)
              }
            }
          }
          if (!vigente) return
          const datos = await api.semana(clienteId, semana, cancelacion.signal)
          if (!vigente) return
          setCargado({ clave, datos })
          setError("")
          setSinConexion(false)
          await guardarCopia(datos)
          if (!vigente) return
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
            const contenido = JSON.stringify(datos)
            if (copiaLocal && contenidoLocal !== contenido) {
              locales = await empezadasLocales(clienteId, datos.sesiones)
              contenidoLocal = contenido
            }
            if (vigente) setEmpezadas({ ...remotas, ...locales })
          }
        } catch (error) {
          if (!vigente) return
          if (error instanceof ErrorDeSesion || error instanceof ErrorDePermiso) {
            accesoRechazado = true
            setCargado(null)
            setEmpezadas({})
          }
          const falta = faltaDe(
            error,
            "No se pudo actualizar la semana. Revisa la conexión y vuelve a intentarlo.",
          )
          setError(falta.texto)
          setSinConexion(error instanceof ErrorDeRed)
          setReintentable(falta.reintentable)
        } finally {
          enCurso = false
        }
      }
      void cargar()
      const reloj = setInterval(() => void cargar(), copiaLocal ? 15_000 : 5000)
      const actividad = AppState.addEventListener("change", (estado) => {
        if (estado === "active") void cargar()
      })
      return () => {
        vigente = false
        cancelacion.abort()
        clearInterval(reloj)
        actividad.remove()
      }
    }, [
      api,
      clienteId,
      semana,
      clave,
      intento,
      copiaLocal,
      resumenHoy,
      detectarEmpezadas,
      guardarCopia,
    ]),
  )
  const actualizar = async (): Promise<void> => {
    const datos = await api.semana(clienteId, semana)
    setCargado({ clave, datos })
    await guardarCopia(datos)
  }
  return (
    <View style={{ gap: 14 }}>
      {error !== "" && (
        <>
          {listado && sinConexion ? (
            <Aviso
              mensaje={`Sin conexión · copia de la semana del ${semana.slice(8, 10)}/${semana.slice(5, 7)}`}
              tipo="conexion"
            />
          ) : (
            <AvisoDeError mensaje={error} />
          )}
          {reintentable && (
            <BotonSecundario texto="Reintentar" onPress={() => setIntento((n) => n + 1)} />
          )}
        </>
      )}
      <CambioDeContenido clave={semana}>
        <AgendaSemanal
          key={semana}
          semana={semana}
          listado={listado}
          cargando={listado === null && error === ""}
          abrir={abrir}
          resumenHoy={resumenHoy}
          detalle={detalle}
          deportes={deportes}
          empezadas={empezadas}
          api={api}
          actualizado={actualizar}
          cambiarSemana={(dias) => setSemana((actual) => sumarDias(actual, dias))}
        />
      </CambioDeContenido>
    </View>
  )
}
