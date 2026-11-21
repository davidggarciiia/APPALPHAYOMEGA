import { AgendaSemanal } from "./agenda-semanal"
import type { ResultadoMes } from "./calendario-hoy"
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
import { hoyAgenda, lunesDeSemana, sumarDias } from "./fechas"
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
  semanaElegida,
  elegirSemana,
}: {
  clienteId: string
  api: ApiEntrenamiento
  abrir: (id: string) => void
  copiaLocal?: boolean
  resumenHoy?: boolean
  detectarEmpezadas?: boolean
  deportes?: DeporteDelPlan[]
  /** Si la pantalla que lo contiene guarda la semana, para compartirla con otras vistas. */
  semanaElegida?: string
  elegirSemana?: (lunes: string) => void
}): React.JSX.Element {
  const [semanaInterna, setSemanaInterna] = useState(lunesDeSemana)
  const semana = semanaElegida ?? semanaInterna
  const setSemana = useCallback(
    (lunes: string): void => {
      setSemanaInterna(lunes)
      elegirSemana?.(lunes)
    },
    [elegirSemana],
  )
  const [, actualizarDia] = useState(hoyAgenda)
  const semanaActual = useRef(lunesDeSemana())
  const clave = `${clienteId}:${semana}`
  const [cargado, setCargado] = useState<{
    clave: string
    datos: ListadoSesiones
    contenido: string
  } | null>(null)
  const listado = cargado?.clave === clave ? cargado.datos : null
  const ultimaCopia = useRef<{ clave: string; contenido: string } | null>(null)
  const agendasVigentes = useRef(new Map<string, SesionProgramada>())
  const [empezadas, setEmpezadas] = useState<Record<string, string>>({})
  const [error, setError] = useState("")
  const [sinConexion, setSinConexion] = useState(false)
  const [reintentable, setReintentable] = useState(true)
  const [intento, setIntento] = useState(0)
  const [tienePlan, setTienePlan] = useState<boolean | undefined>(undefined)
  const presentar = useCallback(
    (datos: ListadoSesiones): void => {
      const contenido = JSON.stringify(datos)
      setCargado((anterior) =>
        anterior?.clave === clave && anterior.contenido === contenido
          ? anterior
          : { clave, datos, contenido },
      )
    },
    [clave],
  )
  const actualizarEmpezadas = useCallback((nuevas: Record<string, string>): void => {
    setEmpezadas((anteriores) =>
      Object.keys(anteriores).length === Object.keys(nuevas).length &&
      Object.entries(nuevas).every(([id, inicio]) => anteriores[id] === inicio)
        ? anteriores
        : nuevas,
    )
  }, [])
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
        // Hoy debe cambiar a medianoche aunque el servidor conserve la misma agenda.
        actualizarDia(hoyAgenda())
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
              setCargado((anterior) =>
                anterior?.clave === clave ? anterior : { clave, datos, contenido },
              )
              if ((resumenHoy && semana === actual) || detectarEmpezadas) {
                locales = await empezadasLocales(clienteId, datos.sesiones)
                contenidoLocal = contenido
                if (vigente) actualizarEmpezadas(locales)
              }
            }
          }
          if (!vigente) return
          const respuesta = await api.semana(clienteId, semana, cancelacion.signal)
          if (!vigente) return
          const datos = conservarRevisiones(respuesta)
          presentar(datos)
          setError("")
          setSinConexion(false)
          await guardarCopia(datos)
          if (!vigente) return
          if ((resumenHoy && semana === actual) || detectarEmpezadas) {
            const pendientes = datos.sesiones.filter((sesion) => sesion.enviadoEn === null)
            const clave = pendientes.map((sesion) => sesion.agenda.id).join(",")
            if (pendientes.length === 0) {
              remotas = {}
              if (vigente) actualizarEmpezadas({})
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
            if (vigente) actualizarEmpezadas({ ...remotas, ...locales })
          }
        } catch (error) {
          if (!vigente) return
          if (error instanceof ErrorDeSesion || error instanceof ErrorDePermiso) {
            accesoRechazado = true
            setCargado(null)
            actualizarEmpezadas({})
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
      presentar,
      actualizarEmpezadas,
      setSemana,
    ]),
  )
  // Una semana sin sesiones puede ser descanso o que aún no hay plan: se
  // pregunta solo entonces, para no decir «Descanso» a quien no tiene plan.
  const semanaSinSesiones = resumenHoy && listado?.total === 0
  useFocusEffect(
    useCallback(() => {
      if (!semanaSinSesiones) return
      let vigente = true
      const consultar = async (): Promise<void> => {
        try {
          const { plan } = await api.plan(clienteId, semana)
          if (vigente) setTienePlan(plan !== null)
        } catch {
          // Sin respuesta no se afirma nada: la tarjeta no dice «sin plan».
        }
      }
      void consultar()
      return () => {
        vigente = false
      }
    }, [api, clienteId, semana, semanaSinSesiones, intento]),
  )
  const actualizar = async (agenda?: SesionProgramada): Promise<void> => {
    if (agenda && listado) {
      const datos = conservarRevisiones({
        ...listado,
        sesiones: listado.sesiones.map((sesion) =>
          sesion.agenda.id === agenda.id ? { ...sesion, agenda } : sesion,
        ),
      })
      presentar(datos)
      await guardarCopia(datos)
    }
    const datos = conservarRevisiones(await api.semana(clienteId, semana))
    presentar(datos)
    await guardarCopia(datos)
  }
  const cargarMes = useCallback(
    async (mes: string): Promise<ResultadoMes> => {
      const inicio = `${mes}-01`
      const siguiente = new Date(`${inicio}T00:00:00Z`)
      siguiente.setUTCMonth(siguiente.getUTCMonth() + 1)
      const fin = siguiente.toISOString().slice(0, 10)
      const semanas: string[] = []
      for (let lunes = lunesDeSemana(inicio); lunes < fin; lunes = sumarDias(lunes, 7))
        semanas.push(lunes)
      const respuestas = await Promise.allSettled(
        semanas.map((lunes) => api.semana(clienteId, lunes)),
      )
      // Sin acceso no hay mes parcial que valga: se avisa de eso y nada más.
      for (const respuesta of respuestas)
        if (
          respuesta.status === "rejected" &&
          (respuesta.reason instanceof ErrorDeSesion || respuesta.reason instanceof ErrorDePermiso)
        )
          throw respuesta.reason
      const listados: ListadoSesiones[] = []
      const sinDatos: string[] = []
      let deCopia = false
      await Promise.all(
        respuestas.map(async (respuesta, n) => {
          const lunes = semanas[n]!
          if (respuesta.status === "fulfilled") {
            listados.push(respuesta.value)
            if (copiaLocal && lunes !== semana)
              await almacenDispositivo
                .guardar(clienteId, `semana-${lunes}`, respuesta.value)
                .catch(() => undefined)
            return
          }
          const copia = copiaLocal
            ? await almacenDispositivo
                .leer(clienteId, `semana-${lunes}`, ListadoSesionesSchema)
                .catch(() => null)
            : null
          if (copia) {
            listados.push(copia)
            deCopia = true
          } else sinDatos.push(lunes)
        }),
      )
      // Si no llegó nada, es un fallo del mes entero y se cuenta como tal.
      if (sinDatos.length === semanas.length)
        throw (respuestas.find((r) => r.status === "rejected") as PromiseRejectedResult).reason
      const sesiones = [
        ...new Map(
          listados
            .flatMap((datos) => conservarRevisiones(datos).sesiones)
            .map((sesion) => [sesion.agenda.id, sesion]),
        ).values(),
      ].filter((s) => s.agenda.fechaActual >= inicio && s.agenda.fechaActual < fin)
      const locales = copiaLocal ? await empezadasLocales(clienteId, sesiones) : {}
      const pendientes = sesiones.filter((s) => !s.enviadoEn && !locales[s.agenda.id])
      // Si un detalle no llega, esa sesión sale como pendiente; no tumba el mes.
      const detalles = await Promise.allSettled(pendientes.map((s) => api.leerCliente(s.agenda.id)))
      const remotas = Object.fromEntries(
        detalles.flatMap((detalle, n) => {
          if (detalle.status !== "fulfilled") return []
          const registro = detalle.value.borrador?.registro
          return registro?.inicio || registro?.checkin || registro?.series.some((s) => s.hecha)
            ? [[pendientes[n]!.agenda.id, registro.inicio ?? detalle.value.borrador!.actualizadoEn]]
            : []
        }),
      )
      return {
        sesiones: sesiones.map((s) => ({
          ...s,
          empezadaEn: locales[s.agenda.id] ?? remotas[s.agenda.id],
        })),
        sinDatos,
        deCopia,
      }
    },
    [api, clienteId, conservarRevisiones, copiaLocal, semana],
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
        tienePlan={tienePlan}
        abrir={abrir}
        resumenHoy={resumenHoy}
        cargarMes={cargarMes}
        deportes={deportes}
        empezadas={empezadas}
        api={api}
        actualizado={actualizar}
        cambiarSemana={(dias) => setSemana(sumarDias(semana, dias))}
      />
    </View>
  )
}
