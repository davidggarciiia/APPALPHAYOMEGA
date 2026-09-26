import { useFocusEffect } from "expo-router"
import { useCallback, useEffect, useRef, useState } from "react"
import { sumarDias, type ResumenSesion, type SesionProgramada } from "@alpha-omega/shared"

import { faltaDe, type Falta } from "../lib/errores"
import { ErrorDeRed } from "../lib/transporte"
import { useSesion } from "../sesion"

import { listarCopias } from "./almacen-borradores"
import { listarSemana } from "./api"
import type { CopiaLocal } from "./copia-local"
import { abrirSesionEnCurso } from "./sesiones-abiertas"

export type FilaDeSemana = ResumenSesion & { enCurso: boolean }

export type CargaDeSemana =
  | { fase: "cargando" }
  | { fase: "lista"; filas: FilaDeSemana[]; soloLocal: boolean }
  | { fase: "error"; falta: Falta }

function desdeCopias(copias: CopiaLocal[], semana: string): FilaDeSemana[] {
  const domingo = sumarDias(semana, 6)
  return copias
    .filter((c) => c.sesion.agenda.fechaActual >= semana && c.sesion.agenda.fechaActual <= domingo)
    .map((c) => ({
      agenda: c.sesion.agenda,
      nombre: c.sesion.prescripcion.nombre,
      enviadoEn: c.resultado?.enviadoEn ?? c.sesion.enviadoEn,
      enCurso: c.resultado === null && Object.keys(c.entradas).length > 0,
    }))
    .sort((a, b) => a.agenda.fechaActual.localeCompare(b.agenda.fechaActual))
}

/**
 * La semana del cliente que empieza en `semana` (un lunes).
 *
 * Con conexión, lo que dice el servidor, y de paso se descargan las sesiones
 * abiertas para poder registrarlas en la sala sin cobertura. Sin conexión, lo
 * que ya estaba guardado en el móvil, con `soloLocal` para que la pantalla lo
 * diga. Vuelve a cargar al volver a la pantalla.
 */
export function useSemana(semana: string): {
  carga: CargaDeSemana
  refrescando: boolean
  refrescar: () => void
  actualizarAgenda: (agenda: SesionProgramada) => void
} {
  const { estado } = useSesion()
  const usuario = estado.fase === "dentro" || estado.fase === "local" ? estado.usuario : null
  const enLinea = estado.fase === "dentro"

  const [carga, setCarga] = useState<CargaDeSemana>({ fase: "cargando" })
  const [intento, setIntento] = useState(0)
  const [refrescando, setRefrescando] = useState(false)
  const primerFoco = useRef(true)

  useEffect(() => {
    if (usuario === null) {
      return
    }
    let vigente = true
    const cargar = async (): Promise<void> => {
      const copias = await listarCopias(usuario.id).catch(() => [] as CopiaLocal[])
      const enCurso = new Set(
        desdeCopias(copias, semana)
          .filter((f) => f.enCurso)
          .map((f) => f.agenda.id),
      )
      if (!enLinea) {
        if (vigente)
          setCarga({ fase: "lista", filas: desdeCopias(copias, semana), soloLocal: true })
        return
      }
      try {
        const listado = await listarSemana(usuario.id, semana)
        if (!vigente) return
        setCarga({
          fase: "lista",
          filas: listado.sesiones.map((s) => ({ ...s, enCurso: enCurso.has(s.agenda.id) })),
          soloLocal: false,
        })
        // Descarga en segundo plano de lo que se puede entrenar esta semana.
        const guardadas = new Set(copias.map((c) => c.sesionId))
        for (const sesion of listado.sesiones) {
          if (sesion.agenda.estado === "abierta" && !guardadas.has(sesion.agenda.id)) {
            await abrirSesionEnCurso(usuario.id, sesion.agenda.id).catch(() => undefined)
          }
        }
      } catch (error) {
        if (!vigente) return
        if (error instanceof ErrorDeRed) {
          setCarga({ fase: "lista", filas: desdeCopias(copias, semana), soloLocal: true })
        } else {
          setCarga({ fase: "error", falta: faltaDe(error, "No hemos podido cargar tu semana.") })
        }
      }
    }
    void cargar().finally(() => {
      if (vigente) setRefrescando(false)
    })
    return () => {
      vigente = false
    }
  }, [usuario, enLinea, semana, intento])

  useFocusEffect(
    useCallback(() => {
      if (primerFoco.current) {
        primerFoco.current = false
        return
      }
      setIntento((n) => n + 1)
    }, []),
  )

  const refrescar = useCallback((): void => {
    setRefrescando(true)
    setIntento((n) => n + 1)
  }, [])

  const actualizarAgenda = useCallback((agenda: SesionProgramada): void => {
    setCarga((actual) =>
      actual.fase !== "lista"
        ? actual
        : {
            ...actual,
            filas: actual.filas
              .map((fila) => (fila.agenda.id === agenda.id ? { ...fila, agenda } : fila))
              .sort((a, b) => a.agenda.fechaActual.localeCompare(b.agenda.fechaActual)),
          },
    )
  }, [])

  return { carga, refrescando, refrescar, actualizarAgenda }
}
