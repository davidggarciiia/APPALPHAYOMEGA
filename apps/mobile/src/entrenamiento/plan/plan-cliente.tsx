import { useCallback, useRef, useState } from "react"
import { useFocusEffect } from "expo-router"
import { StyleSheet, Text, View } from "react-native"
import { z } from "zod"
import {
  ListadoSesionesSchema,
  PlanVigenteSchema,
  PrescripcionSchema,
  type EjercicioPrescrito,
} from "@alpha-omega/shared"

import { useAccesoAFiguras } from "../../catalogo-ejercicios/figura-ejercicio"
import { useCatalogo } from "../../catalogo-ejercicios/use-catalogo"
import { AvisoDeError, BotonSecundario } from "../../componentes/formulario"
import { faltaDe } from "../../lib/errores"
import { ErrorDePermiso, ErrorDeSesion } from "../../lib/http"
import { tema } from "../../tema"
import { almacenDispositivo } from "../almacen-dispositivo"
import type { ApiEntrenamiento } from "../api"
import { hoyAgenda, lunesDeSemana, sumarDias } from "../fechas"
import { Enlace } from "../sesion/controles"
import { VerTecnica } from "../ver-tecnica"
import { BloqueDelPlan } from "./bloque"
import { fechaCorta } from "./modelo"
import { Guia } from "./guia"
import { Pestanas } from "./piezas"
import { RutinaDeLaSemana, type DiaDelPlan } from "./rutina"
import { EsqueletoEntrenamiento } from "../esqueleto-entrenamiento"

type Pestana = "rutina" | "bloque" | "guia"
const PESTANAS = [
  { valor: "rutina", texto: "Rutina" },
  { valor: "bloque", texto: "Bloque" },
  { valor: "guia", texto: "Guía" },
] as const

const CopiaDelPlanSchema = z.object({
  listado: ListadoSesionesSchema,
  prescripciones: z.record(z.string(), PrescripcionSchema),
  plan: PlanVigenteSchema.nullable(),
})
type CopiaDelPlan = z.infer<typeof CopiaDelPlanSchema>

/** «Tu plan»: Rutina, Bloque y Guía, como en el diseño. */
export function PlanCliente({
  clienteId,
  api,
  abrir,
  pestana: controlada,
}: {
  clienteId: string
  api: ApiEntrenamiento
  abrir: (id: string) => void
  pestana?: Pestana
}): React.JSX.Element {
  const [interna, setPestana] = useState<Pestana>("rutina")
  const pestana = controlada ?? interna
  const [semana, setSemana] = useState(lunesDeSemana)
  const [datos, setDatos] = useState<CopiaDelPlan | null>(null)
  const [elegido, setElegido] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [reintentable, setReintentable] = useState(true)
  const [intento, setIntento] = useState(0)
  const [tecnica, setTecnica] = useState<EjercicioPrescrito | null>(null)
  const abriendo = useRef(false)
  const catalogo = useCatalogo()
  const acceso = useAccesoAFiguras()
  const hoy = hoyAgenda()

  useFocusEffect(
    useCallback(() => {
      abriendo.current = false
    }, []),
  )
  useFocusEffect(
    useCallback(() => {
      let vigente = true
      const clave = `plan-${semana}`
      setError("")
      setReintentable(true)
      const cargar = async (): Promise<void> => {
        try {
          const [listado, { plan }] = await Promise.all([
            api.semana(clienteId, semana),
            api.plan(clienteId, semana),
          ])
          const sesiones = await Promise.all(
            listado.sesiones.map((s) => api.leerCliente(s.agenda.id)),
          )
          const nuevos: CopiaDelPlan = {
            listado,
            plan,
            prescripciones: Object.fromEntries(sesiones.map((s) => [s.agenda.id, s.prescripcion])),
          }
          if (!vigente) return
          setDatos(nuevos)
          await almacenDispositivo.guardar(clienteId, clave, nuevos).catch(() => undefined)
        } catch (error) {
          if (!vigente) return
          if (error instanceof ErrorDeSesion || error instanceof ErrorDePermiso) {
            setDatos(null)
            setTecnica(null)
            const falta = faltaDe(error, "No se pudo cargar tu plan.")
            setError(falta.texto)
            setReintentable(falta.reintentable)
            return
          }
          const copia = await almacenDispositivo
            .leer(clienteId, clave, CopiaDelPlanSchema)
            .catch(() => null)
          if (!vigente) return
          if (copia) setDatos(copia)
          setError(
            copia
              ? "Sin conexión: ves la última copia guardada de esta semana."
              : "No se pudo cargar tu plan. Revisa la conexión y vuelve a intentarlo.",
          )
        }
      }
      void cargar()
      return () => {
        vigente = false
      }
    }, [api, clienteId, semana, intento]),
  )

  const dias: DiaDelPlan[] =
    datos?.listado.sesiones.map((resumen) => ({
      resumen,
      prescripcion: datos.prescripciones[resumen.agenda.id] ?? null,
    })) ?? []
  // Por defecto, la sesión de hoy o la siguiente sin hacer.
  const porDefecto =
    dias.find((d) => d.resumen.agenda.fechaActual === hoy) ??
    dias.find((d) => d.resumen.agenda.fechaActual >= hoy && d.resumen.enviadoEn === null) ??
    dias[0]
  const cambiarSemana = (dias_: number): void => {
    setDatos(null)
    setElegido(null)
    setSemana((actual) => sumarDias(actual, dias_))
  }
  const abrirSesion = (id: string): void => {
    if (abriendo.current) return
    abriendo.current = true
    abrir(id)
  }

  return (
    <View style={s.contenido}>
      {controlada === undefined && (
        <Pestanas opciones={PESTANAS} activa={pestana} cambiar={setPestana} />
      )}
      {error !== "" && (
        <View style={s.error}>
          <AvisoDeError mensaje={error} />
          {reintentable && (
            <BotonSecundario texto="Reintentar" onPress={() => setIntento((n) => n + 1)} />
          )}
        </View>
      )}
      <View>
        {pestana === "guia" ? (
          <View>
            <Guia />
          </View>
        ) : datos === null ? (
          error === "" && <EsqueletoEntrenamiento />
        ) : pestana === "rutina" ? (
          <View>
            <RutinaDeLaSemana
              dias={dias}
              elegido={elegido ?? porDefecto?.resumen.agenda.id ?? null}
              elegir={setElegido}
              hoy={hoy}
              verTecnica={setTecnica}
              abrir={abrirSesion}
            />
          </View>
        ) : (
          <View>
            <BloqueDelPlan plan={datos.plan} lunes={semana} dias={dias} hoy={hoy} />
          </View>
        )}
      </View>
      {pestana !== "guia" && (
        <View style={s.semanas}>
          <Enlace texto="‹ Semana anterior" onPress={() => cambiarSemana(-7)} />
          <Text style={s.tenue}>
            {fechaCorta(semana)} – {fechaCorta(sumarDias(semana, 6))}
          </Text>
          <Enlace texto="Siguiente ›" onPress={() => cambiarSemana(7)} />
        </View>
      )}
      {tecnica && (
        <VerTecnica
          cuenta={clienteId}
          ejercicioId={tecnica.ejercicioId}
          nombre={tecnica.nombre}
          leer={catalogo.leer}
          almacen={almacenDispositivo}
          acceso={acceso}
          cerrar={() => setTecnica(null)}
        />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  contenido: { gap: 24 },
  tenue: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 13 },
  error: { gap: 8 },
  semanas: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
})
