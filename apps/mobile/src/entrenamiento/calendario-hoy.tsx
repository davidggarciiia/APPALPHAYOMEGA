import { useCallback, useState } from "react"
import { useFocusEffect } from "expo-router"
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import type { DeporteDelPlan, ListadoSesiones } from "@alpha-omega/shared"

import { AvisoDeError, BotonSecundario } from "../componentes/formulario"
import { Esqueleto, GrupoEsqueletos } from "../componentes/esqueleto"
import { Icono } from "../componentes/iconos"
import { tema } from "../tema"
import { faltaDe, type Falta } from "../lib/errores"
import { fechaLegible, sumarDias } from "./fechas"

export type SesionCalendario = ListadoSesiones["sesiones"][number] & { empezadaEn?: string }
type Sesiones = SesionCalendario[]
export type CargarMes = (mes: string) => Promise<Sesiones>
const DIAS = ["L", "M", "X", "J", "V", "S", "D"]

export function CalendarioHoy({
  semana,
  hoy,
  sesiones,
  deportes,
  abrir,
  empezadas,
  cargarMes,
}: {
  semana: string
  hoy: string
  sesiones: Sesiones
  deportes: DeporteDelPlan[]
  abrir: (id: string) => void
  empezadas: Record<string, string>
  cargarMes?: CargarMes
}): React.JSX.Element {
  const [expandido, setExpandido] = useState(false)
  const [mes, setMes] = useState(hoy.slice(0, 7))
  const [cargado, setCargado] = useState<{ mes: string; sesiones: Sesiones } | null>(null)
  const [error, setError] = useState<Falta | null>(null)
  const [intento, setIntento] = useState(0)
  const [sinSesion, setSinSesion] = useState("")
  useFocusEffect(
    useCallback(() => {
      if (!expandido || !cargarMes) return
      let vigente = true
      setError(null)
      setCargado(null)
      setSinSesion("")
      cargarMes(mes).then(
        (sesiones) => {
          if (vigente) setCargado({ mes, sesiones })
        },
        (error) => {
          if (vigente) setError(faltaDe(error, "No se pudo cargar el mes."))
        },
      )
      return () => {
        vigente = false
      }
    }, [expandido, mes, cargarMes, intento]),
  )
  const inicio = `${mes}-01`
  const siguiente = new Date(`${inicio}T00:00:00Z`)
  siguiente.setUTCMonth(siguiente.getUTCMonth() + 1)
  const fin = siguiente.toISOString().slice(0, 10)
  const dias = expandido
    ? Array.from({ length: Number(sumarDias(fin, -1).slice(-2)) }, (_, i) => sumarDias(inicio, i))
    : DIAS.map((_, i) => sumarDias(semana, i))
  const delMes = cargarMes ? (cargado?.mes === mes ? cargado.sesiones : null) : sesiones
  const visibles = expandido ? delMes : sesiones
  const inicioDe = (sesion: SesionCalendario): string =>
    empezadas[sesion.agenda.id] ?? sesion.empezadaEn ?? ""
  const cambiarMes = (paso: number): void => {
    const fecha = new Date(`${inicio}T00:00:00Z`)
    fecha.setUTCMonth(fecha.getUTCMonth() + paso)
    setMes(fecha.toISOString().slice(0, 7))
    setSinSesion("")
  }
  const dia = (fecha: string): React.JSX.Element => {
    const n = (new Date(`${fecha}T00:00:00Z`).getUTCDay() + 6) % 7
    const delDia = (visibles ?? []).filter((s) => s.agenda.fechaActual === fecha)
    const otros = deportes.filter((d) => d.dias.includes(n + 1))
    const destino =
      delDia
        .filter((s) => s.enviadoEn === null)
        .sort((a, b) => inicioDe(b).localeCompare(inicioDe(a)))[0] ?? delDia[0]
    const que = [
      ...delDia.map(
        (s) =>
          `${s.nombre}${s.enviadoEn ? ", hecha" : inicioDe(s) ? ", en curso" : expandido ? ", pendiente" : ""}`,
      ),
      ...otros.map((d) => d.nombre),
    ]
    return (
      <Pressable
        key={fecha}
        style={[s.dia, expandido && s.diaMes, fecha === hoy && s.diaMarcado]}
        accessibilityRole="button"
        accessibilityLabel={`${fechaLegible(fecha)}${fecha === hoy ? ", hoy" : ""}: ${que.length ? que.join(", ") : "descanso"}`}
        accessibilityHint={`${delDia.length} ${delDia.length === 1 ? "sesión" : "sesiones"}`}
        onPress={() => {
          if (destino) abrir(destino.agenda.id)
          else setSinSesion(`Sin sesión el ${fechaLegible(fecha)}`)
        }}
      >
        {!expandido && <Text style={s.letra}>{DIAS[n]}</Text>}
        <Text style={[s.numero, fecha === hoy && s.acento]}>{Number(fecha.slice(-2))}</Text>
        <View style={s.marcas}>
          {delDia.slice(0, 2).map((sesion) => (
            <View
              key={sesion.agenda.id}
              style={[
                s.marca,
                {
                  backgroundColor: sesion.enviadoEn
                    ? tema.exito
                    : inicioDe(sesion)
                      ? tema.acento
                      : tema.naranja,
                },
              ]}
            />
          ))}
          {otros.slice(0, Math.max(0, 2 - delDia.length)).map((d) => (
            <View key={d.nombre} style={[s.marca, s.marcaHueca]} />
          ))}
        </View>
      </Pressable>
    )
  }
  return (
    <View style={s.calendario}>
      <View style={s.cabecera}>
        {expandido && (
          <Text style={s.mes} accessibilityRole="header">
            {new Intl.DateTimeFormat("es-ES", {
              month: "long",
              year: "numeric",
              timeZone: "UTC",
            }).format(new Date(`${inicio}T00:00:00Z`))}
          </Text>
        )}
        <Pressable
          style={s.control}
          accessibilityRole="button"
          accessibilityLabel={expandido ? "Ver semana" : "Ver mes"}
          accessibilityState={{ expanded: expandido }}
          onPress={() => {
            setExpandido(!expandido)
            setSinSesion("")
          }}
        >
          <Text style={s.enlace}>{expandido ? "Ver semana" : "Ver mes"}</Text>
          <Icono nombre="plan" color={tema.textoTenue} tamano={18} />
        </Pressable>
      </View>
      {expandido ? (
        <>
          <View style={s.navegacion}>
            {([-1, 1] as const).map((paso) => (
              <Pressable
                key={paso}
                style={s.flecha}
                accessibilityRole="button"
                accessibilityLabel={paso < 0 ? "Mes anterior" : "Mes siguiente"}
                onPress={() => cambiarMes(paso)}
              >
                <Icono
                  nombre={paso < 0 ? "atras" : "adelante"}
                  color={tema.textoTenue}
                  tamano={20}
                />
              </Pressable>
            ))}
          </View>
          {error ? (
            <>
              <AvisoDeError mensaje={error.texto} />
              {error.reintentable && (
                <BotonSecundario texto="Reintentar mes" onPress={() => setIntento((n) => n + 1)} />
              )}
            </>
          ) : visibles === null ? (
            <View accessible accessibilityRole="progressbar" accessibilityLabel="Cargando mes">
              <GrupoEsqueletos>
                <Esqueleto alto={264} />
              </GrupoEsqueletos>
            </View>
          ) : (
            <View>
              <View style={s.semana}>
                {DIAS.map((d, i) => (
                  <Text key={i} style={[s.letra, s.celdaLetra]}>
                    {d}
                  </Text>
                ))}
              </View>
              <View style={s.cuadricula}>
                {Array.from(
                  { length: (new Date(`${inicio}T00:00:00Z`).getUTCDay() + 6) % 7 },
                  (_, i) => (
                    <View key={`vacio-${i}`} style={s.hueco} />
                  ),
                )}
                {dias.map(dia)}
              </View>
            </View>
          )}
        </>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.dias}
        >
          {dias.map(dia)}
        </ScrollView>
      )}
      {sinSesion !== "" && (
        <Text style={s.letra} accessibilityLiveRegion="polite">
          {sinSesion}
        </Text>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  calendario: { gap: 8 },
  cabecera: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end" },
  mes: {
    flex: 1,
    color: tema.texto,
    fontFamily: tema.fuenteSemi,
    fontSize: 17,
    textTransform: "capitalize",
  },
  control: {
    minHeight: 44,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  enlace: { color: tema.textoTenue, fontFamily: tema.fuenteSemi, fontSize: 13 },
  navegacion: { flexDirection: "row", justifyContent: "space-between" },
  flecha: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  dias: { flexGrow: 1, gap: 4 },
  dia: {
    flex: 1,
    minWidth: 44,
    minHeight: 68,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  diaMes: { flex: 0, width: "14.285714%", minHeight: 52, borderRadius: 10 },
  diaMarcado: { backgroundColor: tema.superficieAlta },
  letra: { fontSize: 13, color: tema.textoTenue, fontFamily: tema.fuenteTexto },
  numero: {
    fontSize: 16,
    color: tema.texto,
    fontFamily: tema.fuenteSemi,
    fontVariant: ["tabular-nums"],
  },
  marcas: { height: 4, flexDirection: "row", gap: 3 },
  marca: { width: 14, height: 4, borderRadius: 2 },
  marcaHueca: { borderWidth: 1.5, borderColor: tema.naranja },
  acento: { color: tema.acento },
  semana: { flexDirection: "row", paddingVertical: 8 },
  celdaLetra: { width: "14.285714%", textAlign: "center" },
  cuadricula: { flexDirection: "row", flexWrap: "wrap" },
  hueco: { width: "14.285714%", minHeight: 52 },
})
