import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import type { EjercicioPrescrito, Prescripcion, ResumenSesion } from "@alpha-omega/shared"

import { tema } from "../../tema"
import { tamanoDelNombre } from "../hoy-toca"
import { porSecciones } from "../sesion/modelo"
import {
  INICIALES_DE_DIA,
  NOMBRES_DE_DIA,
  detalleDeEjercicio,
  dosisDeEjercicio,
  minutosDeFinal,
} from "./modelo"
import { Fila, Tarjeta, Titulo } from "./piezas"

export type DiaDelPlan = { resumen: ResumenSesion; prescripcion: Prescripcion | null }

/** 1 = lunes … 7 = domingo. */
export function diaDeLaSemana(fecha: string): number {
  return ((new Date(`${fecha}T00:00:00Z`).getUTCDay() + 6) % 7) + 1
}

const PARTES = [
  { clave: "calentamiento", texto: "Calentar" },
  { clave: "fuerza", texto: "Fuerza" },
  { clave: "cardio", texto: "Cardio" },
  { clave: "calma", texto: "Calma" },
] as const

/** Pestaña «Rutina»: los días de la semana y lo que toca cada uno. */
export function RutinaDeLaSemana({
  dias,
  elegido,
  elegir,
  hoy,
  verTecnica,
  abrir,
}: {
  dias: DiaDelPlan[]
  elegido: string | null
  elegir: (id: string) => void
  hoy: string
  verTecnica: (ejercicio: EjercicioPrescrito) => void
  abrir: (id: string) => void
}): React.JSX.Element {
  const dia = dias.find((d) => d.resumen.agenda.id === elegido) ?? dias[0]
  if (!dia) return <Text style={s.vacio}>No tienes sesiones esta semana.</Text>
  const { resumen, prescripcion } = dia
  const numero = diaDeLaSemana(resumen.agenda.fechaActual)
  const partes = prescripcion?.partes
  const minutos = (clave: (typeof PARTES)[number]["clave"]): string | undefined => partes?.[clave]
  return (
    <View style={s.contenido}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.dias}
        accessibilityRole="tablist"
        accessibilityLabel="Días de la semana"
      >
        {dias.map((d) => {
          const activo = d === dia
          const n = diaDeLaSemana(d.resumen.agenda.fechaActual)
          return (
            <Pressable
              key={d.resumen.agenda.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: activo }}
              accessibilityLabel={`${NOMBRES_DE_DIA[n - 1]}: ${d.resumen.nombre}`}
              onPress={() => elegir(d.resumen.agenda.id)}
              style={[s.dia, activo && s.diaActivo]}
            >
              <Text style={[s.textoDia, activo && s.textoDiaActivo]}>
                {INICIALES_DE_DIA[n - 1]}
              </Text>
              {d.resumen.enviadoEn !== null && <View style={[s.hecho, activo && s.hechoActivo]} />}
            </Pressable>
          )
        })}
      </ScrollView>
      <View style={s.cabecera}>
        <Text style={s.nombreDia}>
          {NOMBRES_DE_DIA[numero - 1]}
          {resumen.agenda.fechaActual === hoy ? " · hoy" : ""}
          {resumen.enviadoEn !== null ? " · hecha" : ""}
        </Text>
        <Text
          style={[
            s.nombre,
            {
              fontSize: tamanoDelNombre(resumen.nombre),
              lineHeight: tamanoDelNombre(resumen.nombre) * 1.1,
            },
          ]}
          accessibilityRole="header"
        >
          {resumen.nombre}
        </Text>
      </View>
      {partes && PARTES.some((p) => minutos(p.clave)) && (
        <View style={s.partes}>
          {PARTES.filter((p) => minutos(p.clave)).map((p) => (
            <View
              key={p.clave}
              style={s.parte}
              accessible
              accessibilityLabel={`${p.texto}: ${minutos(p.clave)} minutos`}
            >
              <Text style={s.minutos}>
                {minutos(p.clave)}
                <Text style={s.min}> min</Text>
              </Text>
              <Text style={s.etiquetaParte}>{p.texto}</Text>
            </View>
          ))}
        </View>
      )}
      {prescripcion?.nota && <Text style={s.nota}>{prescripcion.nota}</Text>}
      {prescripcion === null ? (
        <Text style={s.vacio}>Sin conexión: abre la sesión cuando vuelvas a tener red.</Text>
      ) : (
        porSecciones(prescripcion).map((grupo) => {
          const titulo =
            grupo.seccion === "calentamiento"
              ? "Calentamiento"
              : grupo.seccion === "principal"
                ? "Parte principal"
                : grupo.seccion === "circuito"
                  ? (prescripcion.circuito?.nombre ?? "Circuito")
                  : "Final"
          const derecha =
            grupo.seccion === "calentamiento"
              ? partes?.calentamiento
              : grupo.seccion === "principal"
                ? partes?.fuerza
                : grupo.seccion === "final"
                  ? minutosDeFinal(partes)
                  : null
          return (
            <View key={grupo.seccion} style={s.seccion}>
              <Titulo
                grande
                derecha={
                  grupo.seccion === "circuito"
                    ? prescripcion.circuito
                      ? `${prescripcion.circuito.vueltas} vueltas`
                      : null
                    : derecha
                      ? `${derecha} min`
                      : null
                }
              >
                {titulo}
              </Titulo>
              <Tarjeta>
                {grupo.ejercicios.map((ejercicio, n) => {
                  const detalle = detalleDeEjercicio(ejercicio)
                  return (
                    <Pressable
                      key={ejercicio.id}
                      accessibilityRole="button"
                      accessibilityLabel={`${ejercicio.nombre}, ${dosisDeEjercicio(ejercicio)}${detalle ? `, ${detalle}` : ""}. Ver técnica`}
                      onPress={() => verTecnica(ejercicio)}
                    >
                      <Fila primera={n === 0}>
                        <Text style={s.numero}>{n + 1}</Text>
                        <Text style={s.ejercicio}>{ejercicio.nombre}</Text>
                        <View style={s.dosis}>
                          <Text style={s.textoDosis}>{dosisDeEjercicio(ejercicio)}</Text>
                          {detalle && <Text style={s.detalle}>{detalle}</Text>}
                        </View>
                      </Fila>
                    </Pressable>
                  )
                })}
              </Tarjeta>
            </View>
          )
        })
      )}
      <Pressable
        accessibilityRole="button"
        onPress={() => abrir(resumen.agenda.id)}
        style={({ pressed }) => [s.abrir, pressed && s.pulsado]}
      >
        <Text style={s.textoAbrir}>
          {resumen.enviadoEn !== null ? "Ver lo que hiciste" : "Abrir sesión"}
        </Text>
      </Pressable>
    </View>
  )
}

const s = StyleSheet.create({
  contenido: { gap: 24 },
  vacio: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 15, lineHeight: 22 },
  dias: { flexDirection: "row", flexGrow: 1, gap: 8 },
  dia: {
    flex: 1,
    minWidth: 44,
    height: 46,
    maxWidth: 80,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tema.bordeFuerte,
    backgroundColor: tema.superficie,
    alignItems: "center",
    justifyContent: "center",
  },
  diaActivo: { borderColor: tema.acento, backgroundColor: tema.acentoSuave },
  textoDia: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 15 },
  textoDiaActivo: { color: tema.acento },
  hecho: {
    position: "absolute",
    bottom: 6,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: tema.exito,
  },
  hechoActivo: { backgroundColor: tema.exito },
  cabecera: { gap: 2 },
  nombreDia: {
    color: tema.textoTenue,
    fontFamily: tema.fuenteSemi,
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  nombre: { color: tema.acento, fontFamily: tema.fuenteTitulo, textTransform: "uppercase" },
  partes: { flexDirection: "row", gap: 8 },
  parte: {
    flex: 1,
    backgroundColor: tema.superficie,
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: "center",
    gap: 2,
  },
  minutos: { color: tema.acento, fontFamily: tema.fuenteBoton, fontSize: 17 },
  min: { fontSize: 12 },
  etiquetaParte: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 12 },
  nota: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 13, lineHeight: 18 },
  seccion: { gap: 12 },
  numero: {
    width: 18,
    color: tema.acento,
    fontFamily: tema.fuenteBoton,
    fontSize: 13,
    marginTop: 2,
  },
  ejercicio: {
    flex: 1,
    color: tema.texto,
    fontFamily: tema.fuenteTexto,
    fontSize: 15,
    lineHeight: 21,
  },
  dosis: { alignItems: "flex-end", gap: 2, maxWidth: "45%" },
  textoDosis: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 15, textAlign: "right" },
  detalle: {
    color: tema.textoTenue,
    fontFamily: tema.fuenteTexto,
    fontSize: 12,
    textAlign: "right",
  },
  abrir: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tema.bordeFuerte,
    alignItems: "center",
    justifyContent: "center",
  },
  pulsado: { opacity: 0.8 },
  textoAbrir: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 15 },
})
