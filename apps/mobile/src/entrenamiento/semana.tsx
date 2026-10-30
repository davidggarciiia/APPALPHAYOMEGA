import { AgendaSemanal } from "./agenda-semanal"
import type { SesionCalendario } from "./calendario-hoy"
import { useCallback, useRef, useState } from "react"
import { useFocusEffect } from "expo-router"
import { AppState, View } from "react-native"
import {
  ListadoSesionesSchema,
  type DeporteDelPlan,
  type ListadoSesiones,
  type SesionProgramada,
} from "@alpha-omega/shared"
import { almacenDispositivo } from "./almacen-dispositivo"
import type { ApiEntrenamiento } from "./api"
import { claveSesion, DocumentoSesionSchema } from "./documento-local"
import { lunesDeSemana, sumarDias } from "./fechas"
import { AvisoDeError, BotonSecundario } from "../componentes/formulario"
import { faltaDe } from "../lib/errores"
import { ErrorDePermiso, ErrorDeSesion, ErrorDeRed } from "../lib/http"
import { Aviso } from "../componentes/aviso"

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
  deportes,
}: {
  clienteId: string
  api: ApiEntrenamiento
  abrir: (id: string) => void
  copiaLocal?: boolean
  resumenHoy?: boolean
  detectarEmpezadas?: boolean
  deportes?: DeporteDelPlan[]
}): React.JSX.Element {
  const [semana, setSemana] = useState(lunesDeSemana)
  const semanaActual = useRef(lunesDeSemana())
  const clave = `${clienteId}:${semana}`
  const [cargado, setCargado] = useState<{ clave: string; datos: ListadoSesiones } | null>(null)
  const listado = cargado?.clave === clave ? cargado.datos : null
  const ultimaCopia = useRef<{ clave: string; contenido: string } | null>(null)
  const agendasVigentes = useRef(new Map<string, SesionProgramada>())
  const [empezadas, setEmpezadas] = useState<Record<string, string>>({})
  const [error, setError] = useState("")
  const [sinConexion, setSinConexion] = useState(false)
  const [reintentable, setReintentable] = useState(true)
  const [intento, setIntento] = useState(0)
  const conservarRevisiones = useCallback(
    (datos: ListadoSesiones): ListadoSesiones => ({
      ...datos,
      sesiones: datos.sesiones.map((sesion) => {
        const clave = `${clienteId}:${sesion.agenda.id}`
        const vigente = agendasVigentes.current.get(clave)
        if (vigente && vigente.revision > sesion.agenda.revision)
          return { ...sesion, agenda: vigente }
        agendasVigentes.current.set(clave, sesion.agenda)
        return sesion
      }),
    }),
    [clienteId],
  )
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
              const datos = conservarRevisiones(copia)
              const contenido = JSON.stringify(copia)
              ultimaCopia.current = { clave, contenido }
              setCargado((anterior) => (anterior?.clave === clave ? anterior : { clave, datos }))
              if ((resumenHoy && semana === actual) || detectarEmpezadas) {
                locales = await empezadasLocales(clienteId, datos.sesiones)
                contenidoLocal = contenido
                if (vigente) setEmpezadas(locales)
              }
            }
          }
          if (!vigente) return
          const respuesta = await api.semana(clienteId, semana, cancelacion.signal)
          if (!vigente) return
          const datos = conservarRevisiones(respuesta)
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
      conservarRevisiones,
    ]),
  )
  const actualizar = async (agenda?: SesionProgramada): Promise<void> => {
    if (agenda && listado) {
      const datos = conservarRevisiones({
        ...listado,
        sesiones: listado.sesiones.map((sesion) =>
          sesion.agenda.id === agenda.id ? { ...sesion, agenda } : sesion,
        ),
      })
      setCargado({ clave, datos })
      await guardarCopia(datos)
    }
    const datos = conservarRevisiones(await api.semana(clienteId, semana))
    setCargado({ clave, datos })
    await guardarCopia(datos)
  }
  const cargarMes = useCallback(
    async (mes: string): Promise<SesionCalendario[]> => {
      const inicio = `${mes}-01`
      const siguiente = new Date(`${inicio}T00:00:00Z`)
      siguiente.setUTCMonth(siguiente.getUTCMonth() + 1)
      const fin = siguiente.toISOString().slice(0, 10)
      const semanas: string[] = []
      for (let lunes = lunesDeSemana(inicio); lunes < fin; lunes = sumarDias(lunes, 7))
        semanas.push(lunes)
      const respuestas = await Promise.all(semanas.map((lunes) => api.semana(clienteId, lunes)))
      const sesiones = [
        ...new Map(
          respuestas
            .flatMap((datos) => conservarRevisiones(datos).sesiones)
            .map((sesion) => [sesion.agenda.id, sesion]),
        ).values(),
      ].filter((s) => s.agenda.fechaActual >= inicio && s.agenda.fechaActual < fin)
      const locales = copiaLocal ? await empezadasLocales(clienteId, sesiones) : {}
      const pendientes = sesiones.filter((s) => !s.enviadoEn && !locales[s.agenda.id])
      const detalles = await Promise.all(pendientes.map((s) => api.leerCliente(s.agenda.id)))
      const remotas = Object.fromEntries(
        detalles.flatMap((detalle, n) => {
          const registro = detalle.borrador?.registro
          return registro?.inicio || registro?.checkin || registro?.series.some((s) => s.hecha)
            ? [[pendientes[n]!.agenda.id, registro.inicio ?? detalle.borrador!.actualizadoEn]]
            : []
        }),
      )
      return sesiones.map((s) => ({
        ...s,
        empezadaEn: locales[s.agenda.id] ?? remotas[s.agenda.id],
      }))
    },
    [api, clienteId, conservarRevisiones, copiaLocal],
  )
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
      <AgendaSemanal
        key={semana}
        semana={semana}
        listado={listado}
        cargando={listado === null && error === ""}
        abrir={abrir}
        resumenHoy={resumenHoy}
        cargarMes={cargarMes}
        deportes={deportes}
        empezadas={empezadas}
        api={api}
        actualizado={actualizar}
        cambiarSemana={(dias) => setSemana((actual) => sumarDias(actual, dias))}
      />
    </View>
  )
}
