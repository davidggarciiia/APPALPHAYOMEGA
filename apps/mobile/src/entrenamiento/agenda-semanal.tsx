import { useState } from "react"
import { Image, Pressable, StyleSheet, Text, View } from "react-native"
import type { ListadoSesiones } from "@alpha-omega/shared"
import { fechaLegible, hoyAgenda, lunesDeSemana, sumarDias } from "./fechas"
import { BotonSecundario } from "../componentes/formulario"
import { Icono } from "../componentes/iconos"
import { degradadoExito, degradadoOro, degradadoSesion, tema } from "../tema"
import entrenamiento from "../../assets/entrenamiento.webp"

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
}: {
  semana: string
  listado: ListadoSesiones | null
  cambiarSemana: (dias: number) => void
  abrir: (id: string) => void
  resumenHoy: boolean
}): React.JSX.Element {
  const [dia, setDia] = useState<string | null>(null)
  const hoy = hoyAgenda()
  const sesiones = listado?.sesiones ?? []
  const visibles = dia === null ? sesiones : sesiones.filter((s) => s.agenda.fechaActual === dia)
  const estaSemana = semana === lunesDeSemana(hoy)
  const sesionHoy =
    resumenHoy && estaSemana
      ? sesiones.find((s) => s.agenda.fechaActual === hoy && s.enviadoEn === null)
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
        <View style={s.destacado}>
          {sesionHoy && (
            <View style={s.medio}>
              <Image source={entrenamiento} style={s.imagen} accessible={false} />
            </View>
          )}
          <View style={s.cuerpo}>
            <View style={s.bloque}>
              <Text accessibilityRole="header" style={s.hoyToca}>
                Hoy toca:
              </Text>
              <Text style={s.nombreHoy}>
                {sesionHoy?.nombre ??
                  (sesiones.some((s) => s.agenda.fechaActual === hoy)
                    ? "Trabajo completado"
                    : "Descanso")}
              </Text>
              <Text style={s.detalleHoy}>{fechaLegible(hoy)}</Text>
              {sesionHoy && sesionHoy.agenda.fechaActual !== sesionHoy.agenda.fechaOriginal && (
                <Text style={s.detalleHoy}>
                  Movido desde {fechaLegible(sesionHoy.agenda.fechaOriginal)}. Tu entrenador ve el
                  cambio.
                </Text>
              )}
            </View>
            {sesionHoy && (
              <Pressable
                style={({ pressed }) => [s.accion, pressed && s.pulsado]}
                accessibilityRole="button"
                accessibilityLabel={`Empezar ${sesionHoy.nombre}`}
                onPress={() => abrir(sesionHoy.agenda.id)}
              >
                <Text style={s.textoAccion}>Empezar entreno</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}
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
            {sesiones.filter((s) => s.enviadoEn !== null).length} de {listado.total} entrenamientos
            enviados esta semana
          </Text>
        )}
      </View>
      {dia !== null && <BotonSecundario texto="Ver toda la semana" onPress={() => setDia(null)} />}
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
                return (
                  <Pressable
                    key={sesion.agenda.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Abrir ${sesion.nombre}, ${fechaLegible(sesion.agenda.fechaActual)}, ${enviada ? "enviado" : "pendiente"}`}
                    onPress={() => abrir(sesion.agenda.id)}
                    style={({ pressed }) => [
                      s.renglon,
                      n < grupo.sesiones.length - 1 && s.separado,
                      pressed && s.pulsado,
                    ]}
                  >
                    <View style={s.informacion}>
                      <Text style={s.nombre}>{sesion.nombre}</Text>
                      <Text style={s.secundario}>
                        {fechaLegible(sesion.agenda.fechaActual)} ·{" "}
                        {enviada ? "Enviado" : "Pendiente"}
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
                )
              })}
            </View>
          </View>
        ))}
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
  vacio: {
    color: tema.textoTenue,
    fontFamily: tema.fuenteTexto,
    fontSize: 15,
    padding: 20,
    textAlign: "center",
  },
  destacado: {
    borderRadius: 20,
    backgroundColor: tema.superficie,
    borderWidth: 1,
    borderColor: tema.bordeDestacado,
    padding: 12,
    gap: 20,
  },
  medio: { height: 184, borderRadius: 14, backgroundColor: tema.hundido, overflow: "hidden" },
  imagen: { width: "100%", height: "100%", resizeMode: "cover" },
  cuerpo: { paddingHorizontal: 8, paddingBottom: 8, gap: 20 },
  bloque: { gap: 6 },
  hoyToca: {
    color: tema.acento,
    fontFamily: tema.fuenteTitulo,
    fontSize: 48,
    lineHeight: 52,
    textTransform: "uppercase",
  },
  nombreHoy: { color: tema.texto, fontFamily: tema.fuenteTexto, fontSize: 44, lineHeight: 50 },
  detalleHoy: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 16 },
  accion: {
    ...degradadoOro,
    minHeight: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
  },
  pulsado: { opacity: 0.8 },
  textoAccion: { color: tema.sobreAcento, fontFamily: tema.fuenteBoton, fontSize: 16 },
})
