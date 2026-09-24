import { useCallback, useState } from "react"
import { useFocusEffect } from "expo-router"
import { Pressable, StyleSheet, Text, View } from "react-native"
import {
  ETIQUETA_DE_ZONA,
  type FichaDeUsuario,
  type LecturaDietaVigente,
  type ListadoMedidas,
  type ListadoResultados,
  type Molestia,
  type PlanVigente,
} from "@alpha-omega/shared"

import { AvisoDeError, BotonSecundario } from "../../componentes/formulario"
import type { ApiEntrenamiento } from "../../entrenamiento/api"
import { fechaLegible, hoyAgenda, lunesDeSemana } from "../../entrenamiento/fechas"
import { faseActual, semanaDelBloque, textoDeDeporte } from "../../entrenamiento/plan/modelo"
import { Fila, Pestanas, Tarjeta, Titulo } from "../../entrenamiento/plan/piezas"
import { Enlace } from "../../entrenamiento/sesion/controles"
import { faltaDe } from "../../lib/errores"
import type { ApiNutricion } from "../../nutricion/api"
import { tipoDelDia } from "../../nutricion/hoy-modelo"
import type { ApiSeguimiento } from "../../seguimiento/api"
import { edadEn, miles, pesoLegible } from "../../seguimiento/modelo"
import { ProgresoCliente } from "../../seguimiento/progreso"
import { degradadoOro, tema } from "../../tema"
import { resumenDeResultado } from "../ficha-modelo"
import { DialogoResponder, RequiereAtencion } from "./atencion"
import { CheckinsYMolestias } from "./checkins"
import { SesionesDelCliente } from "./sesiones"

type Pestana = "resumen" | "sesiones" | "progreso" | "checkins" | "nutricion" | "salud"
const PESTANAS = [
  { valor: "resumen", texto: "Resumen" },
  { valor: "sesiones", texto: "Sesiones" },
  { valor: "progreso", texto: "Progreso" },
  { valor: "checkins", texto: "Check-ins y molestias" },
  { valor: "nutricion", texto: "Nutrición" },
  { valor: "salud", texto: "Salud" },
] as const

type Datos = {
  ficha: FichaDeUsuario
  plan: PlanVigente | null
  resultados: ListadoResultados["resultados"]
  molestias: Molestia[]
  dieta: LecturaDietaVigente | null
  medidas: ListadoMedidas | null
}

/**
 * Ficha del cliente para el entrenador, como en el diseño: lo que requiere
 * atención, cada sesión con su tabla y comentarios, progreso, check-ins y
 * molestias, nutrición y salud.
 */
export function FichaCliente({
  clienteId,
  cuentaId,
  leerFicha,
  api,
  seguimiento,
  nutricion,
  nuevoId,
  editarPlan,
  verSemana,
  abrirNutricion,
}: {
  clienteId: string
  cuentaId: string
  leerFicha: () => Promise<FichaDeUsuario>
  api: ApiEntrenamiento
  seguimiento: ApiSeguimiento
  nutricion: ApiNutricion
  nuevoId: () => string
  editarPlan: () => void
  verSemana: () => void
  abrirNutricion: (nombre: string) => void
}): React.JSX.Element {
  const [pestana, setPestana] = useState<Pestana>("resumen")
  const [datos, setDatos] = useState<Datos | null>(null)
  const [error, setError] = useState("")
  const [intento, setIntento] = useState(0)
  const [respondiendo, setRespondiendo] = useState<Molestia | null>(null)
  const lunes = lunesDeSemana()

  useFocusEffect(
    useCallback(() => {
      let vigente = true
      Promise.all([
        leerFicha(),
        api.plan(clienteId, lunes),
        api.resultados(clienteId, 30),
        api.molestias(clienteId, "todas"),
        nutricion.vigente(clienteId).catch(() => null),
        seguimiento.medidas(clienteId).catch(() => null),
      ])
        .then(([ficha, { plan }, { resultados }, { molestias }, dieta, medidas]) => {
          if (!vigente) return
          setDatos({ ficha, plan, resultados, molestias, dieta, medidas })
          setError("")
        })
        .catch((e: unknown) => {
          if (vigente) setError(faltaDe(e, "No se pudo cargar la ficha.").texto)
        })
      return () => {
        vigente = false
      }
    }, [leerFicha, api, nutricion, seguimiento, clienteId, lunes, intento]),
  )

  if (error !== "")
    return (
      <View style={s.grupo}>
        <AvisoDeError mensaje={error} />
        <BotonSecundario texto="Reintentar" onPress={() => setIntento((n) => n + 1)} />
      </View>
    )
  if (datos === null) return <Text style={s.tenue}>Cargando la ficha…</Text>

  const nombre = [datos.ficha.nombre, datos.ficha.apellidos].filter(Boolean).join(" ")
  const plan = datos.plan
  const semana = plan ? semanaDelBloque(plan, lunes) : null
  const fase =
    plan?.bloque && semana ? plan.bloque.fases[faseActual(plan.bloque.fases, semana)] : undefined
  const subtitulo = plan
    ? [
        fase ? `${plan.nombre} · ${fase.nombre}` : plan.nombre,
        `semana ${semana} de ${plan.semanas}`,
        plan.bloque?.deportes.map(textoDeDeporte).join(" · ") || null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "Sin plan esta semana"
  const deEstaSemana = datos.resultados
    .filter((r) => r.agenda.fechaActual >= lunes)
    .map((r) => r.resultado)
  const ultima = datos.resultados[0]
  const responder = async (molestia: Molestia, texto: string): Promise<void> => {
    const atendida = await api.atenderMolestia(molestia.id, texto)
    setDatos((actual) =>
      actual
        ? {
            ...actual,
            molestias: actual.molestias.map((m) => (m.id === atendida.id ? atendida : m)),
          }
        : actual,
    )
  }

  return (
    <View style={s.contenido}>
      <View style={s.cabecera}>
        <View style={s.textos}>
          <Text style={s.nombre} accessibilityRole="header">
            {nombre}
          </Text>
          <Text style={s.tenue}>{subtitulo}</Text>
        </View>
        <View style={s.botones}>
          <Pressable
            accessibilityRole="button"
            onPress={verSemana}
            style={({ pressed }) => [s.secundario, pressed && s.pulsado]}
          >
            <Text style={s.textoSecundario}>Semana</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={editarPlan}
            style={({ pressed }) => [s.principal, degradadoOro, pressed && s.pulsado]}
          >
            <Text style={s.textoPrincipal}>Editar plan</Text>
          </Pressable>
        </View>
      </View>
      <Pestanas opciones={PESTANAS} activa={pestana} cambiar={setPestana} />

      {pestana === "resumen" && (
        <View style={s.contenido}>
          <RequiereAtencion
            molestias={datos.molestias}
            semana={deEstaSemana}
            responder={setRespondiendo}
            verSesiones={() => setPestana("sesiones")}
          />
          <View style={s.grupo}>
            <Titulo>Última sesión</Titulo>
            {ultima ? (
              <Tarjeta>
                <Fila primera>
                  <View style={s.textos}>
                    <Text style={s.fuerte}>
                      {ultima.resultado.prescripcion.nombre} ·{" "}
                      {fechaLegible(ultima.agenda.fechaActual)}
                    </Text>
                    <Text style={s.tenue}>{resumenDeResultado(ultima.resultado)}</Text>
                  </View>
                  <Enlace texto="Ver sesión" onPress={() => setPestana("sesiones")} />
                </Fila>
              </Tarjeta>
            ) : (
              <Text style={s.tenue}>Aún no ha enviado ninguna sesión.</Text>
            )}
          </View>
          {plan?.bloque && plan.bloque.objetivos.length > 0 && (
            <View style={s.grupo}>
              <Titulo>Qué buscamos</Titulo>
              {plan.bloque.objetivos.map((o) => (
                <Text key={o} style={s.texto}>
                  {o}
                </Text>
              ))}
            </View>
          )}
        </View>
      )}

      {pestana === "sesiones" && (
        <SesionesDelCliente
          resultados={datos.resultados}
          molestias={datos.molestias}
          api={api}
          cuentaId={cuentaId}
          nuevoId={nuevoId}
        />
      )}

      {pestana === "progreso" && (
        <ProgresoCliente clienteId={clienteId} seguimiento={seguimiento} entrenamiento={api} />
      )}

      {pestana === "checkins" && (
        <CheckinsYMolestias
          resultados={datos.resultados}
          molestias={datos.molestias}
          responder={setRespondiendo}
        />
      )}

      {pestana === "nutricion" && (
        <View style={s.grupo}>
          <Titulo>Dieta vigente</Titulo>
          {datos.dieta?.dieta ? (
            (() => {
              const documento = datos.dieta.dieta.documento
              const tipo = tipoDelDia(documento, hoyAgenda())
              return (
                <Tarjeta>
                  <Fila primera>
                    <Text style={[s.texto, s.textos]}>Dieta</Text>
                    <Text style={s.fuerte}>{documento.nombre}</Text>
                  </Fila>
                  <Fila>
                    <Text style={[s.texto, s.textos]}>La publicó</Text>
                    <Text style={s.fuerte}>
                      {datos.dieta.deNutricionista ? "Su nutricionista" : "Tú"}
                    </Text>
                  </Fila>
                  {tipo?.objetivo?.kcal != null && (
                    <Fila>
                      <Text style={[s.texto, s.textos]}>Objetivo de hoy</Text>
                      <Text style={s.fuerte}>{miles(tipo.objetivo.kcal)} kcal</Text>
                    </Fila>
                  )}
                  <Fila>
                    <Text style={[s.texto, s.textos]}>Comidas de hoy</Text>
                    <Text style={s.fuerte}>{tipo?.comidas.length ?? 0}</Text>
                  </Fila>
                </Tarjeta>
              )
            })()
          ) : (
            <Text style={s.tenue}>Aún no tiene una dieta publicada.</Text>
          )}
          <BotonSecundario
            texto="Abrir ficha de nutrición"
            onPress={() => abrirNutricion(nombre)}
          />
        </View>
      )}

      {pestana === "salud" && (
        <View style={s.contenido}>
          <View style={s.grupo}>
            <Titulo>Datos</Titulo>
            <Tarjeta>
              {(() => {
                const medidas = datos.medidas?.medidas ?? []
                const ultima = <K extends "pesoKg" | "alturaCm" | "grasaPct">(clave: K) =>
                  [...medidas].reverse().find((m) => m[clave] !== null)?.[clave] ?? null
                const nacimiento = datos.medidas?.fechaNacimiento ?? datos.ficha.fechaNacimiento
                const filas: Array<[string, string]> = [
                  ["Edad", nacimiento ? `${edadEn(nacimiento, hoyAgenda())} años` : "—"],
                  ["Altura", ultima("alturaCm") !== null ? `${ultima("alturaCm")} cm` : "—"],
                  ["Peso", ultima("pesoKg") !== null ? pesoLegible(ultima("pesoKg")!) : "—"],
                  [
                    "Grasa corporal",
                    ultima("grasaPct") !== null
                      ? `${String(ultima("grasaPct")).replace(".", ",")} %`
                      : "—",
                  ],
                  ["Teléfono", datos.ficha.telefono ?? "—"],
                ]
                return filas.map(([k, v], n) => (
                  <Fila key={k} primera={n === 0}>
                    <Text style={[s.texto, s.textos]}>{k}</Text>
                    <Text style={s.fuerte}>{v}</Text>
                  </Fila>
                ))
              })()}
            </Tarjeta>
          </View>
          <View style={s.grupo}>
            <Titulo>Molestias por zona</Titulo>
            {datos.molestias.length === 0 ? (
              <Text style={s.tenue}>Sin molestias registradas.</Text>
            ) : (
              <Tarjeta>
                {Object.entries(
                  datos.molestias.reduce<Record<string, Molestia[]>>((grupos, m) => {
                    ;(grupos[m.zona] ??= []).push(m)
                    return grupos
                  }, {}),
                ).map(([zona, lista], n) => (
                  <Fila key={zona} primera={n === 0}>
                    <Text style={[s.texto, s.textos]}>
                      {ETIQUETA_DE_ZONA[zona as keyof typeof ETIQUETA_DE_ZONA]}
                    </Text>
                    <Text style={s.fuerte}>
                      {lista.length} · última {fechaLegible(lista[0]!.creadaEn.slice(0, 10))}
                    </Text>
                  </Fila>
                ))}
              </Tarjeta>
            )}
          </View>
        </View>
      )}

      <DialogoResponder
        molestia={respondiendo}
        cerrar={() => setRespondiendo(null)}
        responder={responder}
      />
    </View>
  )
}

const s = StyleSheet.create({
  contenido: { gap: 24 },
  grupo: { gap: 12 },
  cabecera: { flexDirection: "row", flexWrap: "wrap", gap: 16, alignItems: "flex-start" },
  textos: { flex: 1, minWidth: 220, gap: 4 },
  nombre: {
    color: tema.texto,
    fontFamily: tema.fuenteTitulo,
    fontSize: 34,
    lineHeight: 38,
    textTransform: "uppercase",
  },
  tenue: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 13, lineHeight: 18 },
  texto: { color: tema.texto, fontFamily: tema.fuenteTexto, fontSize: 15 },
  fuerte: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 14 },
  botones: { flexDirection: "row", gap: 8 },
  secundario: {
    minHeight: 42,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tema.bordeFuerte,
    justifyContent: "center",
  },
  textoSecundario: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 14 },
  principal: { minHeight: 42, paddingHorizontal: 16, borderRadius: 12, justifyContent: "center" },
  textoPrincipal: { color: tema.sobreAcento, fontFamily: tema.fuenteBoton, fontSize: 14 },
  pulsado: { opacity: 0.8 },
})
