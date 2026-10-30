import { useCallback, useRef, useState } from "react"
import { useFocusEffect } from "expo-router"
import { Pressable, StyleSheet, Text, View } from "react-native"
import type { DeporteDelPlan, ListadoSesiones, SesionProgramada } from "@alpha-omega/shared"

import { Hoja } from "../componentes/hoja"
import { Icono } from "../componentes/iconos"
import { Pulsable } from "../componentes/pulsable"
import { tema } from "../tema"
import { fechaLegible, hoyAgenda, lunesDeSemana, sumarDias } from "./fechas"
import { fechaCorta } from "./plan/modelo"
import { TarjetaHoy } from "./hoy-toca"
import { CalendarioHoy, type CargarMes } from "./calendario-hoy"
import { FechaSesion } from "./fecha-sesion"
import type { ApiEntrenamiento } from "./api"
import { EsqueletoEntrenamiento } from "./esqueleto-entrenamiento"

export function AgendaSemanal({
  semana,
  listado,
  cambiarSemana,
  abrir,
  resumenHoy,
  cargarMes,
  deportes = [],
  empezadas = {},
  api,
  actualizado,
  cargando = false,
}: {
  semana: string
  listado: ListadoSesiones | null
  cambiarSemana: (dias: number) => void
  abrir: (id: string) => void
  resumenHoy: boolean
  cargarMes?: CargarMes
  deportes?: DeporteDelPlan[]
  empezadas?: Record<string, string>
  api?: Pick<ApiEntrenamiento, "mover" | "cambios">
  actualizado?: (agenda?: SesionProgramada) => Promise<void>
  cargando?: boolean
}): React.JSX.Element {
  const [moviendoId, setMoviendoId] = useState<string | null>(null)
  const abriendo = useRef(false)
  useFocusEffect(
    useCallback(() => {
      abriendo.current = false
    }, []),
  )
  const abrirSesion = (id: string): void => {
    if (abriendo.current) return
    abriendo.current = true
    abrir(id)
  }
  const hoy = hoyAgenda()
  const sesiones = listado?.sesiones ?? []
  const estaSemana = semana === lunesDeSemana(hoy)
  const empezada = sesiones
    .filter((sesion) => sesion.enviadoEn === null && empezadas[sesion.agenda.id])
    .sort((a, b) => (empezadas[b.agenda.id] ?? "").localeCompare(empezadas[a.agenda.id] ?? ""))[0]
  const sesionHoy =
    resumenHoy && estaSemana
      ? (empezada ??
        sesiones.find((s) => s.agenda.fechaActual === hoy && s.enviadoEn === null) ??
        sesiones.find((s) => s.agenda.fechaActual === hoy && s.enviadoEn !== null))
      : undefined
  const siguiente = sesiones
    .filter((sesion) => sesion.agenda.fechaActual > hoy && sesion.enviadoEn === null)
    .sort((a, b) => a.agenda.fechaActual.localeCompare(b.agenda.fechaActual))[0]
  const moviendo = sesiones.find((sesion) => sesion.agenda.id === moviendoId)

  if (resumenHoy && estaSemana)
    return (
      <View style={s.contenedor}>
        {cargando && <EsqueletoEntrenamiento hoy />}
        {listado && (
          <>
            <TarjetaHoy
              sesion={sesionHoy}
              sinSesion="Descanso"
              hoy={sesionHoy?.agenda.fechaActual ?? hoy}
              abrir={abrirSesion}
              empezada={sesionHoy?.agenda.id === empezada?.agenda.id}
              siguiente={
                siguiente
                  ? `${siguiente.agenda.fechaActual === sumarDias(hoy, 1) ? "Mañana" : fechaCorta(siguiente.agenda.fechaActual)} · ${siguiente.nombre}`
                  : undefined
              }
            />
            <CalendarioHoy
              semana={semana}
              hoy={hoy}
              sesiones={sesiones}
              deportes={deportes}
              abrir={abrirSesion}
              empezadas={empezadas}
              cargarMes={cargarMes}
            />
          </>
        )}
      </View>
    )

  return (
    <View style={s.contenedor}>
      <View style={s.fila}>
        <Text style={s.intervalo}>
          {fechaCorta(semana)} — {fechaCorta(sumarDias(semana, 6))}
        </Text>
        <Pressable
          style={s.flecha}
          accessibilityRole="button"
          accessibilityLabel="Semana anterior"
          onPress={() => cambiarSemana(-7)}
        >
          <Icono nombre="atras" color={tema.texto} tamano={20} />
        </Pressable>
        <Pressable
          style={s.flecha}
          accessibilityRole="button"
          accessibilityLabel="Semana siguiente"
          onPress={() => cambiarSemana(7)}
        >
          <Icono nombre="adelante" color={tema.texto} tamano={20} />
        </Pressable>
      </View>
      <View>
        {cargando && <EsqueletoEntrenamiento />}
        {listado?.total === 0 && <Text style={s.vacio}>Sin entrenamientos esta semana</Text>}
        {sesiones.length > 0 && (
          <View style={s.lista}>
            {sesiones.map((sesion, n) => {
              const enviada = sesion.enviadoEn !== null
              const enCurso = !enviada && Boolean(empezadas[sesion.agenda.id])
              const fecha = sesion.agenda.fechaActual
              return (
                <View key={sesion.agenda.id} style={[s.fila, n > 0 && s.separado]}>
                  <Pulsable
                    accessibilityRole="button"
                    accessibilityLabel={`${enviada ? "Ver resumen de" : enCurso ? "Continuar" : "Empezar"} ${sesion.nombre}, ${fechaLegible(fecha)}, ${enviada ? "enviado" : enCurso ? "en curso" : "pendiente"}`}
                    onPress={() => abrirSesion(sesion.agenda.id)}
                    style={[s.renglon, enviada && s.enviada]}
                  >
                    <View style={[s.fecha, fecha === hoy && s.fechaHoy]}>
                      <Text style={[s.secundario, fecha === hoy && s.acento]}>
                        {fechaLegible(fecha).split(",")[0]?.slice(0, 3)}
                      </Text>
                      <Text style={[s.numeroFecha, fecha === hoy && s.acento]}>
                        {Number(fecha.slice(-2))}
                      </Text>
                    </View>
                    <View style={s.informacion}>
                      <Text style={s.nombre}>{sesion.nombre}</Text>
                      <Text style={s.secundario}>
                        {enviada ? "Enviado" : enCurso ? "En curso" : "Pendiente"}
                      </Text>
                      {fecha !== sesion.agenda.fechaOriginal && (
                        <Text style={s.movido}>
                          Movido desde {fechaLegible(sesion.agenda.fechaOriginal)}
                        </Text>
                      )}
                    </View>
                    <Icono
                      nombre={enviada ? "hecho" : "adelante"}
                      color={enviada ? tema.exito : tema.textoTenue}
                      tamano={20}
                    />
                  </Pulsable>
                  {api && actualizado && !enviada && sesion.agenda.estado === "abierta" && (
                    <Pressable
                      style={s.flecha}
                      accessibilityRole="button"
                      accessibilityLabel={`Cambiar día de ${sesion.nombre}`}
                      onPress={() => setMoviendoId(sesion.agenda.id)}
                    >
                      <Text style={s.puntos} aria-hidden>
                        ···
                      </Text>
                    </Pressable>
                  )}
                </View>
              )
            })}
          </View>
        )}
      </View>
      {api && actualizado && (
        <Hoja visible={Boolean(moviendo)} alCerrar={() => setMoviendoId(null)} titulo="Cambiar día">
          {moviendo && (
            <FechaSesion
              key={moviendo.agenda.id}
              agenda={moviendo.agenda}
              api={api}
              actualizado={actualizado}
              iniciarAbierta
              enHoja
              onTerminar={() => setMoviendoId(null)}
            />
          )}
        </Hoja>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  contenedor: { gap: 24 },
  fila: { flexDirection: "row", alignItems: "center", gap: 8 },
  intervalo: { flex: 1, color: tema.texto, fontFamily: tema.fuenteSemi, fontSize: 16 },
  secundario: { color: tema.textoTenue, fontSize: 13, fontFamily: tema.fuenteTexto },
  movido: { color: tema.aviso, fontSize: 13, fontFamily: tema.fuenteTexto },
  flecha: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  puntos: { color: tema.textoTenue, fontSize: 24 },
  lista: { backgroundColor: tema.superficie, borderRadius: 20, paddingHorizontal: 16 },
  renglon: {
    flex: 1,
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
  separado: { borderTopWidth: 1, borderTopColor: tema.borde },
  informacion: { flex: 1, gap: 4 },
  nombre: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 17 },
  fecha: {
    width: 44,
    minHeight: 56,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "transparent",
  },
  fechaHoy: { borderColor: tema.bordeDestacado },
  numeroFecha: { fontFamily: tema.fuenteTitulo, fontSize: 24, color: tema.texto },
  acento: { color: tema.acento },
  enviada: { opacity: 0.6 },
  vacio: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 15 },
})
