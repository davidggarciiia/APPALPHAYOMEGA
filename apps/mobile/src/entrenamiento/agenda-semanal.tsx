import { useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import type { DeporteDelPlan, ListadoSesiones } from "@alpha-omega/shared"
import { fechaLegible, hoyAgenda, lunesDeSemana, sumarDias } from "./fechas"
import { BotonSecundario } from "../componentes/formulario"
import { Icono } from "../componentes/iconos"
import { degradadoExito, degradadoSesion, tema } from "../tema"
import { TarjetaHoy, type DetalleDeHoy } from "./hoy-toca"
import { FechaSesion } from "./fecha-sesion"
import type { ApiEntrenamiento } from "./api"

const DIAS = ["L", "M", "X", "J", "V", "S", "D"]

/**
 * La semana del cliente, con el diseño de «Inicio» de Design.html: la tarjeta
 * «Hoy toca», la tira de siete días con sus marcas y la lista de sesiones.
 * Todo lo que se muestra sale de la API: sin duraciones ni cifras inventadas.
 */
export function AgendaSemanal({
  semana,
  listado,
  cambiarSemana,
  abrir,
  resumenHoy,
  detalle,
  deportes = [],
  empezadas = {},
  api,
  actualizado,
}: {
  semana: string
  listado: ListadoSesiones | null
  cambiarSemana: (dias: number) => void
  abrir: (id: string) => void
  resumenHoy: boolean
  /** Para la animación del primer ejercicio de hoy. Sin él, la foto de la sesión. */
  detalle?: DetalleDeHoy
  /** Otros deportes del bloque: se marcan con un círculo hueco en su día. */
  deportes?: DeporteDelPlan[]
  /** Fecha de última actualización de cada sesión empezada. */
  empezadas?: Record<string, string>
  api?: Pick<ApiEntrenamiento, "mover" | "cambios">
  actualizado?: () => Promise<void>
}): React.JSX.Element {
  const [dia, setDia] = useState<string | null>(null)
  const [moviendoId, setMoviendoId] = useState<string | null>(null)
  const hoy = hoyAgenda()
  const sesiones = listado?.sesiones ?? []
  const visibles = dia === null ? sesiones : sesiones.filter((s) => s.agenda.fechaActual === dia)
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
  const grupos = resumenHoy
    ? [
        {
          titulo: "Entrenamientos pendientes",
          sesiones: visibles.filter((s) => s.enviadoEn === null),
        },
        {
          titulo: "Últimos entrenos de la semana",
          sesiones: visibles
            .filter((s) => s.enviadoEn !== null)
            .sort((a, b) => b.agenda.fechaActual.localeCompare(a.agenda.fechaActual)),
        },
      ]
    : [{ titulo: "Entrenamientos", sesiones: visibles }]
  return (
    <View style={s.contenedor}>
      {resumenHoy && estaSemana && listado && (
        <TarjetaHoy
          sesion={sesionHoy}
          sinSesion={
            sesiones.some((s) => s.agenda.fechaActual === hoy) ? "Trabajo completado" : "Descanso"
          }
          hoy={sesionHoy?.agenda.fechaActual ?? hoy}
          abrir={abrir}
          detalle={detalle}
          empezada={sesionHoy?.agenda.id === empezada?.agenda.id}
        />
      )}
      {resumenHoy && estaSemana ? (
        <TiraDeLaSemana
          semana={semana}
          hoy={hoy}
          sesiones={sesiones}
          deportes={deportes}
          abrir={abrir}
          empezadas={empezadas}
        />
      ) : (
        <>
          <View style={s.seccion}>
            <View style={s.fila}>
              <View style={s.titulos}>
                <Text accessibilityRole="header" style={s.titulo}>
                  {resumenHoy && estaSemana ? "Esta semana" : "Semana"}
                </Text>
                <Text style={s.secundario}>
                  {fechaLegible(semana)} — {fechaLegible(sumarDias(semana, 6))}
                </Text>
              </View>
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
            <View style={s.dias}>
              {DIAS.map((nombre, n) => {
                const fecha = sumarDias(semana, n)
                const delDia = sesiones.filter((sesion) => sesion.agenda.fechaActual === fecha)
                const seleccionado = dia === fecha
                return (
                  <Pressable
                    key={fecha}
                    style={[s.dia, (fecha === hoy || seleccionado) && s.diaMarcado]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: seleccionado }}
                    accessibilityLabel={`${fechaLegible(fecha)} · ${delDia.length} sesiones`}
                    onPress={() => setDia(seleccionado ? null : fecha)}
                  >
                    <Text style={s.letra}>{nombre}</Text>
                    <Text
                      style={[
                        s.numero,
                        fecha === hoy && s.numeroHoy,
                        delDia.length === 0 && s.numeroLibre,
                      ]}
                    >
                      {Number(fecha.slice(-2))}
                    </Text>
                    <View style={s.marcas}>
                      {delDia.slice(0, 2).map((sesion) => (
                        <View
                          key={sesion.agenda.id}
                          style={[
                            s.marca,
                            sesion.enviadoEn === null ? degradadoSesion : degradadoExito,
                          ]}
                        />
                      ))}
                    </View>
                  </Pressable>
                )
              })}
            </View>
            <View style={s.leyenda}>
              <View style={s.elementoLeyenda}>
                <View style={[s.marca, degradadoSesion]} />
                <Text style={s.secundario}>Pendiente</Text>
              </View>
              <View style={s.elementoLeyenda}>
                <View style={[s.marca, degradadoExito]} />
                <Text style={s.secundario}>Enviado</Text>
              </View>
            </View>
            {listado && (
              <Text style={s.secundario}>
                {sesiones.filter((s) => s.enviadoEn !== null).length} de {listado.total}{" "}
                entrenamientos enviados esta semana
              </Text>
            )}
          </View>
          {dia !== null && (
            <BotonSecundario texto="Ver toda la semana" onPress={() => setDia(null)} />
          )}
          {listado?.total === 0 && (
            <Text style={s.vacio}>No hay entrenamientos asignados esta semana.</Text>
          )}
          {listado !== null && listado.total > 0 && visibles.length === 0 && (
            <Text style={s.vacio}>No hay entrenamientos para este día.</Text>
          )}
          {grupos
            .filter((g) => g.sesiones.length > 0)
            .map((grupo) => (
              <View key={grupo.titulo} style={s.seccion}>
                <Text accessibilityRole="header" style={s.titulo}>
                  {grupo.titulo}
                </Text>
                <View style={s.lista}>
                  {grupo.sesiones.map((sesion, n) => {
                    const enviada = sesion.enviadoEn !== null
                    const enCurso = !enviada && Boolean(empezadas[sesion.agenda.id])
                    return (
                      <View
                        key={sesion.agenda.id}
                        style={n < grupo.sesiones.length - 1 && s.separado}
                      >
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`${enviada ? "Ver resumen de" : enCurso ? "Continuar" : "Empezar"} ${sesion.nombre}, ${fechaLegible(sesion.agenda.fechaActual)}, ${enviada ? "enviado" : enCurso ? "en curso" : "pendiente"}`}
                          onPress={() => abrir(sesion.agenda.id)}
                          style={({ pressed }) => [s.renglon, pressed && s.pulsado]}
                        >
                          <View style={s.informacion}>
                            <Text style={s.nombre}>{sesion.nombre}</Text>
                            <Text style={s.secundario}>
                              {fechaLegible(sesion.agenda.fechaActual)} ·{" "}
                              {enviada ? "Enviado" : enCurso ? "En curso" : "Pendiente"}
                            </Text>
                            {sesion.agenda.fechaActual !== sesion.agenda.fechaOriginal && (
                              <Text style={s.movido}>
                                Movido desde {fechaLegible(sesion.agenda.fechaOriginal)}
                              </Text>
                            )}
                          </View>
                          {enviada ? (
                            <View style={[s.hecho, degradadoExito]}>
                              <Icono nombre="hecho" color={tema.sobreExito} tamano={16} />
                            </View>
                          ) : (
                            <Icono nombre="adelante" color={tema.textoTenue} tamano={20} />
                          )}
                        </Pressable>
                        {api && actualizado && !enviada && sesion.agenda.estado === "abierta" && (
                          <BotonSecundario
                            texto={`Cambiar día de ${sesion.nombre}`}
                            onPress={() =>
                              setMoviendoId(
                                moviendoId === sesion.agenda.id ? null : sesion.agenda.id,
                              )
                            }
                          />
                        )}
                        {moviendoId === sesion.agenda.id && api && actualizado && (
                          <FechaSesion
                            agenda={sesion.agenda}
                            api={api}
                            actualizado={actualizado}
                            iniciarAbierta
                            onTerminar={() => setMoviendoId(null)}
                          />
                        )}
                      </View>
                    )
                  })}
                </View>
              </View>
            ))}
        </>
      )}
    </View>
  )
}

/**
 * «Esta semana» del Inicio, como en el diseño: un punto por sesión de fuerza y
 * un círculo por otro deporte. Tocar un día con sesión la abre.
 */
function TiraDeLaSemana({
  semana,
  hoy,
  sesiones,
  deportes,
  abrir,
  empezadas,
}: {
  semana: string
  hoy: string
  sesiones: ListadoSesiones["sesiones"]
  deportes: DeporteDelPlan[]
  abrir: (id: string) => void
  empezadas: Record<string, string>
}): React.JSX.Element {
  return (
    <View style={s.seccion}>
      <Text accessibilityRole="header" style={s.titulo}>
        Esta semana
      </Text>
      <View style={s.dias}>
        {DIAS.map((nombre, n) => {
          const fecha = sumarDias(semana, n)
          const delDia = sesiones.filter((sesion) => sesion.agenda.fechaActual === fecha)
          const otros = deportes.filter((d) => d.dias.includes(n + 1))
          const destino =
            delDia
              .filter((sesion) => sesion.enviadoEn === null)
              .sort((a, b) =>
                (empezadas[b.agenda.id] ?? "").localeCompare(empezadas[a.agenda.id] ?? ""),
              )[0] ?? delDia[0]
          const que = [
            ...delDia.map((sesion) => `${sesion.nombre}${sesion.enviadoEn ? ", hecha" : ""}`),
            ...otros.map((d) => d.nombre),
          ]
          return (
            <Pressable
              key={fecha}
              style={[s.dia, fecha === hoy && s.diaMarcado]}
              accessibilityRole={destino ? "button" : undefined}
              accessibilityLabel={`${fechaLegible(fecha)}${fecha === hoy ? ", hoy" : ""}: ${que.length > 0 ? que.join(", ") : "descanso"}`}
              disabled={!destino}
              onPress={() => destino && abrir(destino.agenda.id)}
            >
              <Text style={s.letra}>{nombre}</Text>
              <Text
                style={[s.numero, fecha === hoy && s.numeroHoy, que.length === 0 && s.numeroLibre]}
              >
                {Number(fecha.slice(-2))}
              </Text>
              <View style={s.marcas}>
                {delDia.slice(0, 2).map((sesion) => (
                  <View key={sesion.agenda.id} style={[s.marca, degradadoSesion]} />
                ))}
                {otros.slice(0, 2).map((d) => (
                  <View key={d.nombre} style={[s.marca, s.marcaHueca]} />
                ))}
              </View>
            </Pressable>
          )
        })}
      </View>
      <View style={s.leyenda} accessible={false}>
        <View style={s.elementoLeyenda}>
          <View style={[s.marca, degradadoSesion]} />
          <Text style={s.secundario}>Fuerza</Text>
        </View>
        <View style={s.elementoLeyenda}>
          <View style={[s.marca, s.marcaHueca]} />
          <Text style={s.secundario}>Otro deporte</Text>
        </View>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  contenedor: { gap: 32 },
  seccion: { gap: 12 },
  fila: { flexDirection: "row", alignItems: "center", gap: 8 },
  titulos: { flex: 1, gap: 2 },
  titulo: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 20 },
  secundario: { color: tema.textoTenue, fontSize: 13, fontFamily: tema.fuenteTexto },
  movido: { color: tema.aviso, fontSize: 13, fontFamily: tema.fuenteTexto },
  flecha: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: tema.superficie,
    alignItems: "center",
    justifyContent: "center",
  },
  dias: { flexDirection: "row", gap: 4 },
  dia: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    borderRadius: 14,
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 12,
    gap: 8,
  },
  diaMarcado: { backgroundColor: tema.superficieAlta },
  letra: { fontSize: 13, color: tema.textoTenue, fontFamily: tema.fuenteTexto },
  numero: { fontSize: 16, color: tema.texto, fontFamily: tema.fuenteSemi },
  numeroHoy: { fontFamily: tema.fuenteBoton },
  numeroLibre: { color: tema.textoTenue },
  marcas: { height: 12, flexDirection: "row", gap: 3 },
  marca: { width: 12, height: 12, borderRadius: 6 },
  marcaHueca: { borderWidth: 2, borderColor: tema.naranja },
  leyenda: { flexDirection: "row", gap: 20 },
  elementoLeyenda: { flexDirection: "row", alignItems: "center", gap: 8 },
  lista: { backgroundColor: tema.superficie, borderRadius: 20, paddingHorizontal: 20 },
  renglon: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14 },
  separado: { borderBottomWidth: 1, borderBottomColor: tema.borde },
  informacion: { flex: 1, gap: 4 },
  nombre: { color: tema.texto, fontFamily: tema.fuenteSemi, fontSize: 16 },
  hecho: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  pulsado: { opacity: 0.8 },
  vacio: {
    color: tema.textoTenue,
    fontFamily: tema.fuenteTexto,
    fontSize: 15,
    padding: 20,
    textAlign: "center",
  },
})
