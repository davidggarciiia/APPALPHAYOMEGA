import { useState } from "react"
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import type { ListadoSesiones } from "@alpha-omega/shared"
import { fechaLegible, hoyAgenda, lunesDeSemana, sumarDias } from "./fechas"
import { BotonSecundario } from "../componentes/formulario"
import { tema } from "../tema"
import entrenamiento from "../../assets/entrenamiento.webp"

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
  const sesionHoy =
    resumenHoy && semana === lunesDeSemana(hoy)
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
      {resumenHoy && semana === lunesDeSemana(hoy) && listado && (
        <View style={s.destacado}>
          {sesionHoy && <Image source={entrenamiento} style={s.imagen} accessible={false} />}
          <Text style={s.leyendaClara}>HOY · {fechaLegible(hoy).toUpperCase()}</Text>
          <Text style={s.tituloClaro}>
            {sesionHoy?.nombre ??
              (sesiones.some((s) => s.agenda.fechaActual === hoy)
                ? "Trabajo completado"
                : "Día de descanso")}
          </Text>
          <Text style={s.ayudaClara}>
            {sesionHoy
              ? "Tu sesión está preparada. Entrena a tu ritmo."
              : "Consulta tu semana y organiza tus entrenamientos."}
          </Text>
          {sesionHoy && (
            <Pressable
              style={s.accionClara}
              accessibilityRole="button"
              accessibilityLabel={`Empezar ${sesionHoy.nombre}`}
              onPress={() => abrir(sesionHoy.agenda.id)}
            >
              <Text style={s.textoAccion}>Empezar entreno</Text>
            </Pressable>
          )}
          {sesionHoy && sesionHoy.agenda.fechaActual !== sesionHoy.agenda.fechaOriginal && (
            <Text style={s.secundario}>
              Movido desde {fechaLegible(sesionHoy.agenda.fechaOriginal)}. Tu entrenador ve el
              cambio.
            </Text>
          )}
        </View>
      )}
      <View style={s.fila}>
        <View style={{ flex: 1 }}>
          <Text accessibilityRole="header" style={s.titulo}>
            {resumenHoy ? "Esta semana" : "Agenda semanal"}
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
          <Text style={s.numero}>‹</Text>
        </Pressable>
        <Pressable
          style={s.flecha}
          accessibilityRole="button"
          accessibilityLabel="Semana siguiente"
          onPress={() => cambiarSemana(7)}
        >
          <Text style={s.numero}>›</Text>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.dias}>
        {["L", "M", "X", "J", "V", "S", "D"].map((nombre, n) => {
          const fecha = sumarDias(semana, n)
          const cantidad = sesiones.filter((s) => s.agenda.fechaActual === fecha).length
          const seleccionado = dia === fecha
          return (
            <Pressable
              key={fecha}
              style={[s.dia, fecha === hoy && s.hoy, seleccionado && s.seleccionado]}
              accessibilityRole="button"
              accessibilityState={{ selected: seleccionado }}
              accessibilityLabel={`${fechaLegible(fecha)} · ${cantidad} sesiones`}
              onPress={() => setDia(seleccionado ? null : fecha)}
            >
              <Text style={[s.diaNombre, seleccionado && s.claro]}>{nombre}</Text>
              <Text style={[s.numero, seleccionado && s.claro]}>{Number(fecha.slice(-2))}</Text>
              <Text style={[s.punto, seleccionado && s.claro]}>{cantidad > 0 ? "●" : "·"}</Text>
            </Pressable>
          )
        })}
      </ScrollView>
      {listado && (
        <Text style={s.secundario}>
          {sesiones.filter((s) => s.enviadoEn !== null).length} de {listado.total} entrenamientos
          enviados esta semana
        </Text>
      )}
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
          <View key={grupo.titulo} style={s.grupo}>
            <Text accessibilityRole="header" style={s.titulo}>
              {grupo.titulo}
            </Text>
            {grupo.sesiones.map((sesion) => (
              <Pressable
                key={sesion.agenda.id}
                accessibilityRole="button"
                accessibilityLabel={`Abrir ${sesion.nombre}, ${fechaLegible(sesion.agenda.fechaActual)}, ${sesion.enviadoEn === null ? "pendiente" : "enviado"}`}
                onPress={() => abrir(sesion.agenda.id)}
                style={({ pressed }) => [s.tarjeta, pressed && { opacity: 0.7 }]}
              >
                <View style={s.informacion}>
                  <Text style={s.nombre}>{sesion.nombre}</Text>
                  <Text style={s.fecha}>
                    {fechaLegible(sesion.agenda.fechaActual)} ·{" "}
                    {sesion.enviadoEn === null ? "Pendiente" : "Enviado"}
                  </Text>
                  {sesion.agenda.fechaActual !== sesion.agenda.fechaOriginal && (
                    <Text style={s.secundario}>
                      Movido desde {fechaLegible(sesion.agenda.fechaOriginal)}
                    </Text>
                  )}
                </View>
                <Text style={s.flechaTarjeta}>{sesion.enviadoEn === null ? "›" : "✓"}</Text>
              </Pressable>
            ))}
          </View>
        ))}
    </View>
  )
}
const s = StyleSheet.create({
  contenedor: { gap: 14 },
  fila: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  titulo: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 15 },
  grupo: { gap: 10 },
  secundario: { color: tema.textoTenue, fontSize: 13, fontFamily: tema.fuenteTexto },
  flecha: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: tema.superficie,
    borderWidth: 1,
    borderColor: tema.borde,
    alignItems: "center",
    justifyContent: "center",
  },
  dias: { flexDirection: "row", flexGrow: 1, gap: 4 },
  dia: {
    flex: 1,
    minHeight: 80,
    minWidth: 44,
    backgroundColor: tema.superficie,
    borderRadius: 14,
    borderColor: tema.borde,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  hoy: { borderColor: tema.texto },
  seleccionado: { backgroundColor: tema.acento },
  diaNombre: { fontSize: 11, color: tema.textoTenue, fontFamily: tema.fuenteBoton },
  numero: { fontSize: 18, color: tema.texto, fontFamily: tema.fuenteBoton },
  punto: { color: tema.texto, fontSize: 10, height: 12 },
  claro: { color: tema.sobreAcento },
  tarjeta: {
    backgroundColor: tema.superficie,
    borderColor: tema.borde,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  informacion: { flex: 1, gap: 5 },
  fecha: { color: tema.textoTenue, fontSize: 13, fontFamily: tema.fuenteTexto },
  nombre: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 15 },
  flechaTarjeta: { color: tema.textoTenue, fontSize: 24 },
  vacio: {
    color: tema.textoTenue,
    fontFamily: tema.fuenteTexto,
    fontSize: 15,
    padding: 20,
    textAlign: "center",
  },
  destacado: {
    borderRadius: 22,
    backgroundColor: tema.superficie,
    borderWidth: 1,
    borderColor: tema.borde,
    padding: 20,
    gap: 12,
  },
  imagen: {
    width: "100%",
    height: 140,
    borderRadius: 14,
    resizeMode: "cover",
    filter: "grayscale(100%)",
  },
  leyendaClara: {
    color: tema.textoTenue,
    fontSize: 12,
    letterSpacing: 1.5,
    fontFamily: tema.fuenteBoton,
  },
  tituloClaro: {
    color: tema.texto,
    fontSize: 38,
    lineHeight: 40,
    fontFamily: tema.fuenteTitulo,
    textTransform: "uppercase",
  },
  ayudaClara: {
    color: tema.textoTenue,
    fontFamily: tema.fuenteTexto,
    fontSize: 14,
    lineHeight: 20,
  },
  accionClara: {
    minHeight: 56,
    borderRadius: 14,
    backgroundColor: tema.acento,
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
  },
  textoAccion: {
    color: tema.sobreAcento,
    fontFamily: tema.fuenteBoton,
    fontSize: 17,
  },
})
