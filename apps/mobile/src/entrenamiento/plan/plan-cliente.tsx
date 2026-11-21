import { useCallback, useRef, useState } from "react"
import { useFocusEffect } from "expo-router"
import { Pressable, StyleSheet, Text, View } from "react-native"
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
import { VerTecnica } from "../ver-tecnica"
import { Guia } from "./guia"
import { Pestanas } from "./piezas"
import { SelectorDeSemana } from "./selector-semana"
import { RutinaDeLaSemana, type DiaDelPlan } from "./rutina"
import { EsqueletoEntrenamiento } from "../esqueleto-entrenamiento"

type Pestana = "rutina" | "guia"
const PESTANAS = [
  { valor: "rutina", texto: "Rutina" },
  { valor: "guia", texto: "Guía" },
] as const

const CopiaDelPlanSchema = z.object({
  listado: ListadoSesionesSchema,
  prescripciones: z.record(z.string(), PrescripcionSchema),
  plan: PlanVigenteSchema.nullable(),
  /** Sesiones sin enviar con algo hecho. Ausente en copias anteriores. */
  empezadas: z.record(z.string(), z.boolean()).optional(),
})
type CopiaDelPlan = z.infer<typeof CopiaDelPlanSchema>

/** «Tu plan»: Rutina y Guía. */
export function PlanCliente({
  clienteId,
  api,
  abrir,
  pestana: controlada,
  semanaElegida,
  elegirSemana,
}: {
  clienteId: string
  api: ApiEntrenamiento
  abrir: (id: string) => void
  pestana?: Pestana
  /** Si la pantalla que lo contiene guarda la semana, para compartirla con la agenda. */
  semanaElegida?: string
  elegirSemana?: (lunes: string) => void
}): React.JSX.Element {
  const [interna, setPestana] = useState<Pestana>("rutina")
  const pestana = controlada ?? interna
  const [semanaInterna, setSemanaInterna] = useState(lunesDeSemana)
  const semana = semanaElegida ?? semanaInterna
  const [datos, setDatos] = useState<CopiaDelPlan | null>(null)
  const [elegido, setElegido] = useState<string | null>(null)
  const [indicacionesAbiertas, setIndicacionesAbiertas] = useState(false)
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
            empezadas: Object.fromEntries(
              sesiones
                .filter((s) => {
                  const registro = s.borrador?.registro
                  return (
                    !s.enviadoEn &&
                    Boolean(
                      registro?.checkin ||
                      registro?.inicio ||
                      registro?.series.some((serie) => serie.hecha),
                    )
                  )
                })
                .map((s) => [s.agenda.id, true]),
            ),
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
  const cambiarSemana = (dias_: number): void => {
    setDatos(null)
    setElegido(null)
    const lunes = sumarDias(semana, dias_)
    setSemanaInterna(lunes)
    elegirSemana?.(lunes)
  }
  const abrirSesion = (id: string): void => {
    if (abriendo.current) return
    abriendo.current = true
    setElegido(null)
    abrir(id)
  }

  return (
    <View style={s.contenido}>
      {controlada === undefined && (
        <Pestanas opciones={PESTANAS} activa={pestana} cambiar={setPestana} />
      )}
      {pestana !== "guia" && <SelectorDeSemana semana={semana} cambiarSemana={cambiarSemana} />}
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
        ) : (
          <View>
            {datos.plan?.bloque &&
              (datos.plan.bloque.objetivos.length > 0 || datos.plan.bloque.notas.length > 0) && (
                <View style={s.indicaciones}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Indicaciones del entrenador"
                    accessibilityState={{ expanded: indicacionesAbiertas }}
                    onPress={() => setIndicacionesAbiertas(!indicacionesAbiertas)}
                    style={s.filaIndicaciones}
                  >
                    <Text style={s.indicacion}>Indicaciones del entrenador</Text>
                  </Pressable>
                  {indicacionesAbiertas &&
                    [...datos.plan.bloque.objetivos, ...datos.plan.bloque.notas].map(
                      (texto, indice) => (
                        <Text key={`${indice}-${texto}`} style={s.indicacion}>
                          {texto}
                        </Text>
                      ),
                    )}
                </View>
              )}
            <RutinaDeLaSemana
              dias={dias}
              elegido={elegido}
              elegir={(id) => setElegido((actual) => (actual === id ? null : id))}
              cerrar={() => {
                setElegido(null)
                setTecnica(null)
              }}
              hoy={hoy}
              empezadas={datos.empezadas}
              verTecnica={setTecnica}
              abrir={abrirSesion}
              contenidoTecnica={
                tecnica && (
                  <VerTecnica
                    cuenta={clienteId}
                    ejercicioId={tecnica.ejercicioId}
                    nombre={tecnica.nombre}
                    leer={catalogo.leer}
                    almacen={almacenDispositivo}
                    acceso={acceso}
                    cerrar={() => setTecnica(null)}
                  />
                )
              }
            />
          </View>
        )}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  contenido: { gap: 24 },
  error: { gap: 8 },
  indicaciones: { gap: 4, marginBottom: 24 },
  filaIndicaciones: {
    minHeight: 52,
    justifyContent: "center",
    borderBottomWidth: 1,
    borderBottomColor: tema.borde,
  },
  indicacion: { color: tema.texto, fontFamily: tema.fuenteTexto, fontSize: 15, lineHeight: 21 },
})
