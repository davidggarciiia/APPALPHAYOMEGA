import { useCallback, useRef, useState } from "react"
import { useFocusEffect } from "expo-router"
import { AppState } from "react-native"
import type {
  EstadoConsentimiento,
  FichaDeUsuario,
  LecturaDietaVigente,
  ListadoMedidas,
  ListadoResultados,
  ListadoSesiones,
  Molestia,
  PlanVigente,
} from "@alpha-omega/shared"

import type { ApiEntrenamiento } from "../../entrenamiento/api"
import { lunesDeSemana, sumarDias } from "../../entrenamiento/fechas"
import { semanaDelBloque } from "../../entrenamiento/plan/modelo"
import { faltaDe } from "../../lib/errores"
import { ErrorDePermiso, ErrorDeSesion } from "../../lib/http"
import type { ApiNutricion } from "../../nutricion/api"
import type { ApiSeguimiento } from "../../seguimiento/api"
import type { ApiValoraciones } from "../../seguimiento/valoraciones-api"

export type FuentesFicha = {
  clienteId: string
  leerFicha: () => Promise<FichaDeUsuario>
  api: ApiEntrenamiento
  seguimiento: ApiSeguimiento
  valoraciones: ApiValoraciones
  nutricion: ApiNutricion
}

export type DatosFicha = {
  ficha: FichaDeUsuario
  plan: PlanVigente | null
  siguiente: PlanVigente | null | undefined
  semana: ListadoSesiones | null
  resultados: ListadoResultados["resultados"]
  molestias: Molestia[]
  dieta: LecturaDietaVigente | null
  medidas: ListadoMedidas | null
  consentimiento: EstadoConsentimiento | null
  totalValoraciones: number | null
  ultimaValoracion: string | null
}

type ControlFicha = {
  datos: DatosFicha | null
  error: string
  copia: string
  lunes: string
  actualizarFicha: (ficha: FichaDeUsuario) => void
  responder: (molestia: Molestia, texto: string) => Promise<void>
  sinAcceso: (causa: unknown) => void
  reintentar: () => void
}

export function useDatosFicha({
  clienteId,
  leerFicha,
  api,
  seguimiento,
  valoraciones,
  nutricion,
}: FuentesFicha): ControlFicha {
  const [datos, setDatos] = useState<DatosFicha | null>(null)
  const [error, setError] = useState("")
  const [copia, setCopia] = useState("")
  const [intento, setIntento] = useState(0)
  const versionFicha = useRef(0)
  const versionMolestias = useRef(0)
  const permisoRevocado = useRef(false)
  const lunes = lunesDeSemana()
  const sinAcceso = useCallback((causa: unknown) => {
    permisoRevocado.current = true
    setDatos(null)
    setError(faltaDe(causa, "No se pudo cargar la ficha").texto)
  }, [])

  useFocusEffect(
    useCallback(() => {
      permisoRevocado.current = false
      let vigente = true
      let cargando = false
      let ultimaLenta: number | null = null
      let falloLento = false
      const cargar = async (): Promise<void> => {
        if (
          cargando ||
          permisoRevocado.current ||
          (AppState.currentState !== null && AppState.currentState !== "active")
        )
          return
        cargando = true
        const lenta = ultimaLenta === null || Date.now() - ultimaLenta >= 60000
        if (lenta) ultimaLenta = Date.now()
        const versionDelPerfil = versionFicha.current
        const versionDeMolestias = versionMolestias.current
        try {
          const [
            semana,
            resultados,
            molestias,
            ficha,
            plan,
            dieta,
            medidas,
            consentimiento,
            visitas,
          ] = await Promise.allSettled([
            api.semana(clienteId, lunes),
            api.resultados(clienteId, 60),
            api.molestias(clienteId, "todas"),
            lenta ? leerFicha() : undefined,
            lenta ? api.plan(clienteId, lunes) : undefined,
            lenta ? nutricion.vigente(clienteId) : undefined,
            lenta ? seguimiento.medidas(clienteId) : undefined,
            lenta ? seguimiento.consentimiento(clienteId) : undefined,
            lenta ? valoraciones.listar(clienteId, 1) : undefined,
          ])
          if (!vigente || permisoRevocado.current) return
          const consultas = [
            semana,
            resultados,
            molestias,
            ficha,
            plan,
            dieta,
            medidas,
            consentimiento,
            visitas,
          ]
          const denegada = consultas.find(
            (r) =>
              r.status === "rejected" &&
              (r.reason instanceof ErrorDePermiso || r.reason instanceof ErrorDeSesion),
          )
          if (denegada?.status === "rejected") return sinAcceso(denegada.reason)
          let siguiente: PlanVigente | null | undefined
          let falloSiguiente: unknown
          if (
            plan.status === "fulfilled" &&
            plan.value?.plan &&
            semanaDelBloque(plan.value.plan, lunes) === plan.value.plan.semanas
          ) {
            try {
              siguiente = (await api.plan(clienteId, sumarDias(lunes, 7))).plan
            } catch (causa) {
              if (causa instanceof ErrorDePermiso || causa instanceof ErrorDeSesion) {
                if (vigente) sinAcceso(causa)
                return
              }
              falloSiguiente = causa
            }
          }
          if (!vigente || permisoRevocado.current) return
          setDatos((actual) => {
            const perfil =
              ficha.status === "fulfilled" &&
              ficha.value &&
              versionDelPerfil === versionFicha.current
                ? ficha.value
                : actual?.ficha
            if (!perfil) return null
            const nuevasMedidas =
              medidas.status === "fulfilled" && medidas.value ? medidas.value : actual?.medidas
            const siguiente: DatosFicha = {
              ficha: perfil,
              plan:
                plan.status === "fulfilled" && plan.value
                  ? plan.value.plan
                  : (actual?.plan ?? null),
              siguiente: lenta ? siguiente : actual?.siguiente,
              semana: semana.status === "fulfilled" ? semana.value : (actual?.semana ?? null),
              resultados:
                resultados.status === "fulfilled"
                  ? resultados.value.resultados
                  : (actual?.resultados ?? []),
              molestias:
                molestias.status === "fulfilled" && versionDeMolestias === versionMolestias.current
                  ? molestias.value.molestias
                  : (actual?.molestias ?? []),
              dieta:
                dieta.status === "fulfilled" && dieta.value !== undefined
                  ? dieta.value
                  : (actual?.dieta ?? null),
              medidas: nuevasMedidas
                ? { ...nuevasMedidas, fechaNacimiento: perfil.fechaNacimiento ?? null }
                : null,
              consentimiento:
                consentimiento.status === "fulfilled" && consentimiento.value !== undefined
                  ? consentimiento.value
                  : (actual?.consentimiento ?? null),
              totalValoraciones:
                visitas.status === "fulfilled" && visitas.value
                  ? visitas.value.total
                  : (actual?.totalValoraciones ?? null),
              ultimaValoracion:
                visitas.status === "fulfilled" && visitas.value
                  ? (visitas.value.valoraciones[0]?.fechaToma ?? null)
                  : (actual?.ultimaValoracion ?? null),
            }
            return JSON.stringify(actual) === JSON.stringify(siguiente) ? actual : siguiente
          })
          if (lenta)
            falloLento = consultas.slice(3).some((r) => r.status === "rejected") || !!falloSiguiente
          const fallo = consultas.slice(0, 3).some((r) => r.status === "rejected") || falloLento
          setError(fallo ? "No se pudo cargar la ficha" : "")
          if (!fallo)
            setCopia(
              new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit" }).format(
                new Date(),
              ),
            )
        } finally {
          cargando = false
        }
      }
      void cargar()
      const reloj = setInterval(() => void cargar(), 10000)
      return () => {
        vigente = false
        clearInterval(reloj)
      }
    }, [
      clienteId,
      leerFicha,
      api,
      seguimiento,
      valoraciones,
      nutricion,
      lunes,
      intento,
      sinAcceso,
    ]),
  )

  const actualizarFicha = (ficha: FichaDeUsuario): void => {
    versionFicha.current += 1
    setDatos((actual) =>
      actual
        ? {
            ...actual,
            ficha,
            medidas: actual.medidas
              ? { ...actual.medidas, fechaNacimiento: ficha.fechaNacimiento }
              : null,
          }
        : actual,
    )
  }
  const responder = async (molestia: Molestia, texto: string): Promise<void> => {
    try {
      const atendida = await api.atenderMolestia(molestia.id, texto)
      versionMolestias.current += 1
      setDatos((actual) =>
        actual
          ? {
              ...actual,
              molestias: actual.molestias.map((m) => (m.id === atendida.id ? atendida : m)),
            }
          : actual,
      )
    } catch (causa) {
      if (causa instanceof ErrorDePermiso || causa instanceof ErrorDeSesion) sinAcceso(causa)
      throw causa
    }
  }
  return {
    datos,
    error,
    copia,
    lunes,
    actualizarFicha,
    responder,
    sinAcceso,
    reintentar: () => setIntento((n) => n + 1),
  }
}
