import { useCallback, useRef, useState } from "react"
import { useFocusEffect, useRouter } from "expo-router"
import { AppState, StyleSheet, Text, View } from "react-native"
import {
  ETIQUETA_DE_ZONA,
  type EstadoConsentimiento,
  type FichaDeUsuario,
  type LecturaDietaVigente,
  type ListadoMedidas,
  type ListadoResultados,
  type Molestia,
  type PlanVigente,
} from "@alpha-omega/shared"

import {
  AvisoDeError,
  BotonPrincipal,
  BotonSecundario,
  BotonEnlace,
} from "../../componentes/formulario"
import { CambioDeContenido, EntradaMarca } from "../../componentes/entrada-marca"
import { Esqueleto, GrupoEsqueletos } from "../../componentes/esqueleto"
import { Icono } from "../../componentes/iconos"
import { InsigniaDeEstado } from "../../componentes/insignia-estado"
import { Pulsable } from "../../componentes/pulsable"
import type { ApiEntrenamiento } from "../../entrenamiento/api"
import { fechaLegible, hoyAgenda, lunesDeSemana } from "../../entrenamiento/fechas"
import { faseActual, semanaDelBloque, textoDeDeporte } from "../../entrenamiento/plan/modelo"
import { Fila, Pestanas, Tarjeta, Titulo } from "../../entrenamiento/plan/piezas"
import { faltaDe } from "../../lib/errores"
import { ErrorDePermiso, ErrorDeSesion } from "../../lib/http"
import type { ApiNutricion } from "../../nutricion/api"
import { tipoDelDia } from "../../nutricion/hoy-modelo"
import type { ApiSeguimiento } from "../../seguimiento/api"
import { edadEn, miles, pesoLegible } from "../../seguimiento/modelo"
import { ValoracionesProfesional } from "../../seguimiento/editor-valoracion"
import { ProgresoCliente } from "../../seguimiento/progreso"
import type { ApiMedios } from "../../seguimiento/medios-api"
import type { ApiValoraciones } from "../../seguimiento/valoraciones-api"
import { alto, espacio, radio, tema, tipo } from "../../tema"
import { DialogoResponder, RequiereAtencion } from "./atencion"
import { SesionesDelCliente, UltimaSesion } from "./sesiones"

type Pestana = "resumen" | "sesiones" | "progreso" | "nutricion" | "salud"
const PESTANAS = [
  { valor: "resumen", texto: "Resumen" },
  { valor: "sesiones", texto: "Sesiones" },
  { valor: "progreso", texto: "Progreso" },
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
  consentimiento: EstadoConsentimiento | null
  totalValoraciones: number | null
}

/** Cómo está el consentimiento de datos de salud, en una línea. */
function textoConsentimiento(estado: EstadoConsentimiento | null): string {
  if (estado === null) return "No se pudo comprobar"
  if (estado.vigente && estado.aceptadoEn)
    return `Dado el ${fechaLegible(estado.aceptadoEn.slice(0, 10))}`
  if (estado.retiradoEn) return `Retirado el ${fechaLegible(estado.retiradoEn.slice(0, 10))}`
  return estado.version ? "Pendiente de la versión nueva" : "Pendiente"
}

type Propiedades = {
  clienteId: string
  cuentaId: string
  leerFicha: () => Promise<FichaDeUsuario>
  api: ApiEntrenamiento
  seguimiento: ApiSeguimiento
  valoraciones: ApiValoraciones
  medios: ApiMedios
  nutricion: ApiNutricion
  nuevoId: () => string
  editarPlan: () => void
  verSemana: (nombre: string) => void
  abrirNutricion: (nombre: string) => void
  valoracionInicial?: boolean
  pestanaInicial?: "progreso"
}

/** La identidad delimita también los datos y borradores montados de la ficha. */
export function FichaCliente(props: Propiedades): React.JSX.Element {
  return <FichaActual key={`${props.cuentaId}:${props.clienteId}`} {...props} />
}

function FichaActual({
  clienteId,
  leerFicha,
  api,
  seguimiento,
  valoraciones,
  medios,
  nutricion,
  nuevoId,
  editarPlan,
  verSemana,
  abrirNutricion,
  valoracionInicial = false,
  pestanaInicial,
}: Propiedades): React.JSX.Element {
  const [pestana, setPestana] = useState<Pestana>(
    valoracionInicial ? "progreso" : (pestanaInicial ?? "resumen"),
  )
  const [iniciarInicial, setIniciarInicial] = useState(valoracionInicial)
  const [editandoProgreso, setEditandoProgreso] = useState(false)
  const [datos, setDatos] = useState<Datos | null>(null)
  const [error, setError] = useState("")
  const [intento, setIntento] = useState(0)
  const [respondiendo, setRespondiendo] = useState<Molestia | null>(null)
  const versionMolestias = useRef(0)
  const permisoRevocado = useRef(false)
  const router = useRouter()
  const lunes = lunesDeSemana()
  const sinAcceso = useCallback((causa: unknown) => {
    permisoRevocado.current = true
    setDatos(null)
    setRespondiendo(null)
    setError(faltaDe(causa, "No se pudo cargar la ficha.").texto)
  }, [])

  useFocusEffect(
    useCallback(() => {
      permisoRevocado.current = false
      let vigente = true,
        cargando = false
      const cargar = async (): Promise<void> => {
        if (cargando || (AppState.currentState !== null && AppState.currentState !== "active"))
          return
        cargando = true
        const versionDeMolestias = versionMolestias.current
        try {
          const [ficha, plan, resultados, molestias, dieta, medidas, consentimiento, visitas] =
            await Promise.allSettled([
              leerFicha(),
              api.plan(clienteId, lunes),
              api.resultados(clienteId, 60),
              api.molestias(clienteId, "todas"),
              nutricion.vigente(clienteId),
              seguimiento.medidas(clienteId),
              seguimiento.consentimiento(clienteId),
              valoraciones.listar(clienteId, 1),
            ])
          if (!vigente || permisoRevocado.current) return
          const sinAcceso = [
            ficha,
            plan,
            resultados,
            molestias,
            dieta,
            medidas,
            consentimiento,
            visitas,
          ].find(
            (consulta) =>
              consulta.status === "rejected" &&
              (consulta.reason instanceof ErrorDeSesion ||
                consulta.reason instanceof ErrorDePermiso),
          )
          if (sinAcceso?.status === "rejected") {
            setDatos(null)
            setRespondiendo(null)
            setError(faltaDe(sinAcceso.reason, "No se pudo cargar la ficha.").texto)
            return
          }
          setDatos((actual) => {
            const perfil = ficha.status === "fulfilled" ? ficha.value : actual?.ficha
            if (!perfil) return null
            return {
              ficha: perfil,
              plan: plan.status === "fulfilled" ? plan.value.plan : (actual?.plan ?? null),
              resultados:
                resultados.status === "fulfilled"
                  ? resultados.value.resultados
                  : (actual?.resultados ?? []),
              molestias:
                molestias.status === "fulfilled" && versionDeMolestias === versionMolestias.current
                  ? molestias.value.molestias
                  : (actual?.molestias ?? []),
              dieta: dieta.status === "fulfilled" ? dieta.value : (actual?.dieta ?? null),
              medidas: medidas.status === "fulfilled" ? medidas.value : (actual?.medidas ?? null),
              consentimiento:
                consentimiento.status === "fulfilled"
                  ? consentimiento.value
                  : (actual?.consentimiento ?? null),
              totalValoraciones: visitas.status === "fulfilled" ? visitas.value.total : null,
            }
          })
          const fallo = [ficha, plan, resultados, molestias].find((r) => r.status === "rejected")
          setError(fallo ? faltaDe(fallo.reason, "No se pudo cargar la ficha.").texto : "")
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
    }, [leerFicha, api, nutricion, seguimiento, valoraciones, clienteId, lunes, intento]),
  )

  const aviso =
    error !== "" ? (
      <View style={s.grupo}>
        <AvisoDeError mensaje={error} />
        <BotonSecundario texto="Reintentar" onPress={() => setIntento((n) => n + 1)} />
      </View>
    ) : null
  if (datos === null)
    return (
      aviso ?? (
        <GrupoEsqueletos>
          <View
            style={s.contenido}
            accessibilityLabel="Cargando ficha"
            accessibilityState={{ busy: true }}
          >
            <Esqueleto ancho={44} alto={44} />
            <Esqueleto ancho="75%" alto={38} />
            <Esqueleto alto={18} />
            {[0, 1, 2].map((n) => (
              <Esqueleto key={n} alto={132} radio={radio.tarjeta} />
            ))}
          </View>
        </GrupoEsqueletos>
      )
    )

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
  const verSesion = (sesionId: string): void => {
    router.push({
      pathname: "/entrenamiento/[id]",
      params: { id: sesionId, nombre },
    })
  }
  const responder = async (molestia: Molestia, texto: string): Promise<void> => {
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
  }

  return (
    <View style={s.contenido}>
      {aviso}
      <EntradaMarca style={s.cabecera}>
        <View style={s.barraSuperior}>
          <Pulsable
            accessibilityLabel="Volver"
            style={s.volver}
            onPress={() => {
              if (router.canGoBack()) router.back()
              else router.replace("/cartera")
            }}
          >
            <Icono nombre="atras" tamano={20} color={tema.texto} />
          </Pulsable>
          {datos.ficha.estado && <InsigniaDeEstado estado={datos.ficha.estado} />}
        </View>
        <View style={s.textos}>
          <Text style={s.nombre} accessibilityRole="header">
            {nombre}
          </Text>
          <Text style={s.tenue}>{subtitulo}</Text>
        </View>
        <View style={s.botones}>
          <View style={s.accion} testID="ficha-accion-semana">
            <BotonSecundario texto="Semana" onPress={() => verSemana(nombre)} compacto sinMargen />
          </View>
          <View style={s.accion} testID="ficha-accion-plan">
            <BotonPrincipal texto="Crear plan nuevo" onPress={editarPlan} compacto sinMargen />
          </View>
        </View>
      </EntradaMarca>
      <Pestanas
        opciones={PESTANAS}
        activa={pestana}
        cambiar={setPestana}
        bloquearCambio={editandoProgreso}
      />
      {datos.consentimiento && !datos.consentimiento.vigente && (
        <Text style={s.aviso} accessibilityRole="alert">
          Sin consentimiento de datos de salud: hasta que lo acepte en su app no se pueden guardar
          sus medidas, pruebas, valoraciones ni fotos.
        </Text>
      )}
      {editandoProgreso && (
        <Text style={s.tenue}>Vuelve al listado de valoraciones antes de cambiar de pestaña.</Text>
      )}

      <CambioDeContenido clave={pestana}>
        {pestana === "resumen" && (
          <View style={s.contenido}>
            {datos.totalValoraciones === 0 && (
              <BotonSecundario
                texto="Valoración inicial"
                onPress={() => {
                  setIniciarInicial(true)
                  setPestana("progreso")
                }}
              />
            )}
            <RequiereAtencion
              molestias={datos.molestias}
              semana={deEstaSemana}
              responder={setRespondiendo}
              verSesiones={verSesion}
            />
            <View style={s.grupo}>
              <Titulo>Última sesión</Titulo>
              {ultima ? (
                <UltimaSesion
                  resultado={ultima}
                  molestias={datos.molestias}
                  api={api}
                  abrir={verSesion}
                  sinAcceso={sinAcceso}
                />
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
            abrir={verSesion}
            api={api}
            sinAcceso={sinAcceso}
          />
        )}

        {pestana === "progreso" && (
          <View style={s.contenido}>
            <ValoracionesProfesional
              clienteId={clienteId}
              api={valoraciones}
              medios={medios}
              nuevoId={nuevoId}
              alEditar={setEditandoProgreso}
              iniciarInicial={iniciarInicial}
              fechaNacimiento={datos.ficha.fechaNacimiento}
            />
            <ProgresoCliente
              clienteId={clienteId}
              seguimiento={seguimiento}
              entrenamiento={api}
              modo="entrenador"
              resultados={datos.resultados}
              abrirEjercicio={(ejercicioId) =>
                router.push({
                  pathname: "/entrenador/cliente/[id]/ejercicio/[ejercicioId]",
                  params: { id: clienteId, ejercicioId },
                })
              }
            />
          </View>
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
                  const medidas = [...(datos.medidas?.medidas ?? [])].reverse()
                  const ultima = (clave: "pesoKg" | "alturaCm" | "grasaPct"): number | null =>
                    medidas.find((m) => m[clave] !== null)?.[clave] ?? null
                  const altura = ultima("alturaCm")
                  const peso = ultima("pesoKg")
                  const grasa = ultima("grasaPct")
                  const nacimiento = datos.medidas?.fechaNacimiento ?? datos.ficha.fechaNacimiento
                  const filas: Array<[string, string]> = [
                    ["Edad", nacimiento ? `${edadEn(nacimiento, hoyAgenda())} años` : "—"],
                    ["Altura", altura !== null ? `${altura} cm` : "—"],
                    ["Peso", peso !== null ? pesoLegible(peso) : "—"],
                    [
                      "Grasa corporal",
                      grasa !== null ? `${String(grasa).replace(".", ",")} %` : "—",
                    ],
                    ["Teléfono", datos.ficha.telefono ?? "—"],
                    ["Consentimiento de salud", textoConsentimiento(datos.consentimiento)],
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
            <BotonEnlace
              texto="Datos y acceso"
              onPress={() => router.push({ pathname: "/cliente/[id]", params: { id: clienteId } })}
            />
          </View>
        )}
      </CambioDeContenido>

      <DialogoResponder
        molestia={respondiendo}
        cerrar={() => setRespondiendo(null)}
        responder={responder}
      />
    </View>
  )
}

const s = StyleSheet.create({
  contenido: { gap: espacio[24] },
  grupo: { gap: espacio[12] },
  cabecera: { gap: espacio[16] },
  barraSuperior: {
    minHeight: alto.barraSuperior,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  volver: {
    width: alto.tactil,
    height: alto.tactil,
    borderRadius: radio.celda,
    justifyContent: "center",
    alignItems: "center",
  },
  textos: { flex: 1, minWidth: 0, gap: espacio[4] },
  nombre: {
    color: tema.texto,
    fontFamily: tema.fuenteTitulo,
    fontSize: 34,
    lineHeight: 38,
    textTransform: "uppercase",
  },
  tenue: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 13, lineHeight: 18 },
  aviso: { color: tema.aviso, fontFamily: tema.fuenteSemi, fontSize: 13, lineHeight: 18 },
  texto: { color: tema.texto, fontFamily: tema.fuenteTexto, fontSize: 15 },
  fuerte: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 14 },
  destacada: { ...tipo.fila, color: tema.texto },
  botones: { flexDirection: "row", gap: espacio[8] },
  accion: { flex: 1, minWidth: 0 },
})
