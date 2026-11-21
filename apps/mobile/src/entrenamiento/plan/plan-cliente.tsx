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
import { Enlace } from "../sesion/controles"
import { VerTecnica } from "../ver-tecnica"
import { fechaCorta } from "./modelo"
import { Guia } from "./guia"
import { Pestanas } from "./piezas"
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
})
type CopiaDelPlan = z.infer<typeof CopiaDelPlanSchema>

/** «Tu plan»: Rutina y Guía. */
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
    setSemana((actual) => sumarDias(actual, dias_))
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
      {pestana !== "guia" && (
        <View style={s.semanas}>
          <Enlace texto="‹ Semana anterior" onPress={() => cambiarSemana(-7)} />
          <Text style={s.tenue}>
            {fechaCorta(semana)} – {fechaCorta(sumarDias(semana, 6))}
          </Text>
          <Enlace texto="Siguiente ›" onPress={() => cambiarSemana(7)} />
        </View>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  contenido: { gap: 24 },
  tenue: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 13 },
  error: { gap: 8 },
  indicaciones: { gap: 4, marginBottom: 24 },
  filaIndicaciones: {
    minHeight: 52,
    justifyContent: "center",
    borderBottomWidth: 1,
    borderBottomColor: tema.borde,
  },
  indicacion: { color: tema.texto, fontFamily: tema.fuenteTexto, fontSize: 15, lineHeight: 21 },
  semanas: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
})
