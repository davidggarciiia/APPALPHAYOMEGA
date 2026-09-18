import { useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import type { ListadoSesiones } from "@alpha-omega/shared"
import { fechaLegible, hoyAgenda, lunesDeSemana, sumarDias } from "./fechas"
import { BotonSecundario } from "../componentes/formulario"
import { tema } from "../tema"

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
  return (
    <View style={s.contenedor}>
      {resumenHoy && semana === lunesDeSemana(hoy) && listado && (
        <View style={s.destacado}>
          <Text style={s.leyendaClara}>HOY · {fechaLegible(hoy).toUpperCase()}</Text>
          <Text style={s.tituloClaro}>
            {sesionHoy?.nombre ??
              (sesiones.some((s) => s.agenda.fechaActual === hoy)
                ? "Trabajo completado"
                : "Tu próximo paso")}
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
              <Text style={s.textoAccion}>EMPEZAR ENTRENO →</Text>
            </Pressable>
          )}
        </View>
      )}
      <View style={s.fila}>
        <View style={{ flex: 1 }}>
          <Text style={s.titulo}>Agenda semanal</Text>
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
      <View style={s.dias}>
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
      </View>
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
      {visibles.map((sesion) => (
        <Pressable
          key={sesion.agenda.id}
          accessibilityRole="button"
          accessibilityLabel={`Abrir ${sesion.nombre}`}
          onPress={() => abrir(sesion.agenda.id)}
          style={({ pressed }) => [s.tarjeta, pressed && { opacity: 0.7 }]}
        >
          <View style={s.fila}>
            <Text style={s.fecha}>{fechaLegible(sesion.agenda.fechaActual).toUpperCase()}</Text>
            <Text style={s.estado}>{sesion.enviadoEn === null ? "PENDIENTE" : "✓ ENVIADO"}</Text>
          </View>
          <Text style={s.nombre}>{sesion.nombre}</Text>
          {sesion.agenda.fechaActual !== sesion.agenda.fechaOriginal && (
            <Text style={s.secundario}>
              Movido desde {fechaLegible(sesion.agenda.fechaOriginal)}
            </Text>
          )}
          <Text style={s.enlace}>
            {sesion.enviadoEn === null ? "VER ENTRENAMIENTO" : "VER RESULTADO"} →
          </Text>
        </Pressable>
      ))}
    </View>
  )
}
const s = StyleSheet.create({
  contenedor: { gap: 14 },
  fila: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  titulo: { color: tema.texto, fontFamily: tema.fuenteTitulo, fontSize: 28 },
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
  dias: { flexDirection: "row", gap: 4 },
  dia: {
    flex: 1,
    minHeight: 80,
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
  numero: { fontSize: 22, color: tema.texto, fontFamily: tema.fuenteTitulo },
  punto: { color: tema.texto, fontSize: 10, height: 12 },
  claro: { color: tema.sobreAcento },
  tarjeta: {
    backgroundColor: tema.superficie,
    borderColor: tema.borde,
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
    gap: 10,
  },
  fecha: { color: tema.textoTenue, fontSize: 11, fontFamily: tema.fuenteTexto, flex: 1 },
  estado: {
    color: tema.texto,
    fontSize: 10,
    fontFamily: tema.fuenteBoton,
    backgroundColor: tema.fondo,
    padding: 6,
    borderRadius: 6,
  },
  nombre: { color: tema.texto, fontFamily: tema.fuenteTitulo, fontSize: 28 },
  enlace: {
    color: tema.texto,
    fontFamily: tema.fuenteBoton,
    fontSize: 11,
    marginTop: 4,
    letterSpacing: 0.7,
  },
  vacio: {
    color: tema.textoTenue,
    fontFamily: tema.fuenteTexto,
    fontSize: 15,
    padding: 20,
    textAlign: "center",
  },
  destacado: { borderRadius: 18, backgroundColor: tema.acento, padding: 22, gap: 14 },
  leyendaClara: { color: "#BDBDBD", fontSize: 11, letterSpacing: 1, fontFamily: tema.fuenteTexto },
  tituloClaro: {
    color: tema.sobreAcento,
    fontSize: 38,
    lineHeight: 40,
    fontFamily: tema.fuenteTitulo,
  },
  ayudaClara: { color: "#DADADA", fontFamily: tema.fuenteTexto, fontSize: 15, lineHeight: 21 },
  accionClara: {
    minHeight: 50,
    borderRadius: 12,
    backgroundColor: tema.superficie,
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
  },
  textoAccion: {
    color: tema.texto,
    fontFamily: tema.fuenteBoton,
    letterSpacing: 0.7,
    fontSize: 13,
  },
})
