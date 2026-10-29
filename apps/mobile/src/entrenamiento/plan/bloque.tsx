import { StyleSheet, Text, View } from "react-native"
import type { PlanVigente } from "@alpha-omega/shared"

import { tema } from "../../tema"
import { diaDeLaSemana, type DiaDelPlan } from "./rutina"
import {
  INICIALES_DE_DIA,
  faseActual,
  fechasDelBloque,
  semanaDelBloque,
  textoDeDeporte,
  textoDeFase,
} from "./modelo"
import { Fila, Tarjeta, Titulo } from "./piezas"

const PARTES = [
  { clave: "calentamiento", texto: "Calentar" },
  { clave: "fuerza", texto: "Fuerza" },
  { clave: "cardio", texto: "Cardio" },
  { clave: "calma", texto: "Calma" },
] as const

/** El ejemplo fijo de la guía: cómo se ve la doble progresión semana a semana. */
const DOBLE_PROGRESION = [
  { semana: "Semana 1", reps: "9 / 8 / 8", carga: "misma carga", sube: false },
  { semana: "Semana 2", reps: "10 / 9 / 9", carga: "misma carga", sube: false },
  { semana: "Semana 3", reps: "10 / 10 / 10", carga: "misma carga", sube: false },
  { semana: "Semana 4", reps: "8–9 / 8–9 / 8", carga: "sube carga", sube: true },
]

/** Pestaña «Bloque»: en qué semana estás, qué buscamos, fases, tu semana y notas. */
export function BloqueDelPlan({
  plan,
  lunes,
  dias,
  hoy,
}: {
  plan: PlanVigente | null
  lunes: string
  dias: DiaDelPlan[]
  hoy: string
}): React.JSX.Element {
  if (plan === null)
    return (
      <Text style={s.vacio}>
        Esta semana no forma parte de ningún bloque. Tu entrenador te lo preparará.
      </Text>
    )
  const semana = semanaDelBloque(plan, lunes)
  const bloque = plan.bloque
  const actual = bloque ? faseActual(bloque.fases, semana) : -1
  const conPartes = dias.filter((d) => d.prescripcion?.partes)
  return (
    <View style={s.contenido}>
      <View style={s.grupoCorto}>
        <Text style={s.titular} accessibilityRole="header">
          {plan.nombre} · semana {semana} de {plan.semanas}
        </Text>
        <Text style={s.tenue}>{fechasDelBloque(plan)}</Text>
        <View
          style={s.progreso}
          accessibilityRole="progressbar"
          accessibilityLabel="Semanas del bloque"
          accessibilityValue={{ min: 1, max: plan.semanas, now: semana }}
        >
          {Array.from({ length: plan.semanas }, (_, n) => (
            <View key={n} style={[s.tramo, n < semana && { backgroundColor: tema.acento }]} />
          ))}
        </View>
      </View>
      {bloque && bloque.objetivos.length > 0 && (
        <View style={s.grupo}>
          <Titulo>Qué buscamos</Titulo>
          {bloque.objetivos.map((objetivo) => (
            <Text key={objetivo} style={s.linea}>
              {objetivo}
            </Text>
          ))}
        </View>
      )}
      {bloque && bloque.fases.length > 0 && (
        <Tarjeta>
          {bloque.fases.map((fase, n) => {
            const ahora = n === actual
            return (
              <Fila key={`${fase.desde}-${fase.nombre}`} primera={n === 0}>
                <Text style={[s.semanas, ahora && s.semanasAhora]}>{textoDeFase(fase)}</Text>
                <View style={s.textos}>
                  <View style={s.nombreFase}>
                    <Text style={s.fuerte}>{fase.nombre}</Text>
                    {ahora && (
                      <View style={s.ahora}>
                        <Text style={s.textoAhora}>Ahora</Text>
                      </View>
                    )}
                  </View>
                  {fase.detalle && <Text style={s.tenue}>{fase.detalle}</Text>}
                </View>
              </Fila>
            )
          })}
        </Tarjeta>
      )}
      {(conPartes.length > 0 || (bloque && bloque.deportes.length > 0)) && (
        <View style={s.grupo}>
          <Titulo derecha={bloque?.deportes.map(textoDeDeporte).join(" · ") || null}>
            Tu semana
          </Titulo>
          {conPartes.length > 0 && (
            <Tarjeta>
              <View style={[s.filaTabla, s.cabeceraTabla]}>
                <Text style={s.celdaEtiqueta} />
                {conPartes.map((d) => {
                  const esHoy = d.resumen.agenda.fechaActual === hoy
                  return (
                    <Text key={d.resumen.agenda.id} style={[s.celda, s.dia, esHoy && s.diaHoy]}>
                      {INICIALES_DE_DIA[diaDeLaSemana(d.resumen.agenda.fechaActual) - 1]}
                    </Text>
                  )
                })}
              </View>
              {PARTES.map((parte) => (
                <View key={parte.clave} style={[s.filaTabla, s.separada]}>
                  <Text style={s.celdaEtiqueta}>{parte.texto}</Text>
                  {conPartes.map((d) => {
                    const esHoy = d.resumen.agenda.fechaActual === hoy
                    return (
                      <Text key={d.resumen.agenda.id} style={[s.celda, esHoy && s.celdaHoy]}>
                        {d.prescripcion?.partes?.[parte.clave] ?? "—"}
                      </Text>
                    )
                  })}
                </View>
              ))}
              <Text style={s.pie}>Minutos de cada parte, por día</Text>
            </Tarjeta>
          )}
        </View>
      )}
      <View style={s.grupo}>
        <Titulo derecha="Ejemplo: remo en T">Doble progresión</Titulo>
        <Tarjeta>
          {DOBLE_PROGRESION.map((fila, n) => (
            <Fila key={fila.semana} primera={n === 0}>
              <Text style={s.semanas}>{fila.semana}</Text>
              <Text style={[s.fuerte, s.textos]}>{fila.reps}</Text>
              <Text style={fila.sube ? s.sube : s.tenue}>{fila.carga}</Text>
            </Fila>
          ))}
        </Tarjeta>
      </View>
      {bloque && bloque.notas.length > 0 && (
        <View style={s.grupo}>
          <Titulo>De tu entrenador</Titulo>
          {bloque.notas.map((nota) => (
            <Text key={nota} style={s.linea}>
              {nota}
            </Text>
          ))}
        </View>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  contenido: { gap: 28 },
  vacio: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 15, lineHeight: 22 },
  grupoCorto: { gap: 6 },
  grupo: { gap: 14 },
  titular: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 20 },
  tenue: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 13 },
  progreso: { flexDirection: "row", gap: 6, marginTop: 8 },
  tramo: { flex: 1, height: 5, borderRadius: 3, backgroundColor: tema.superficieAlta },
  linea: {
    color: tema.textoSecundario,
    fontFamily: tema.fuenteTexto,
    fontSize: 15,
    lineHeight: 21,
  },
  semanas: {
    width: 92,
    color: tema.textoTenue,
    fontFamily: tema.fuenteTexto,
    fontSize: 13,
    marginTop: 1,
  },
  semanasAhora: { color: tema.acento, fontFamily: tema.fuenteBoton },
  textos: { flex: 1, gap: 2 },
  nombreFase: { flexDirection: "row", alignItems: "center", gap: 8 },
  fuerte: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 15 },
  ahora: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
    backgroundColor: tema.acentoSuave,
    borderWidth: 1,
    borderColor: tema.acento,
  },
  textoAhora: { color: tema.acento, fontFamily: tema.fuenteBoton, fontSize: 11 },
  filaTabla: { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
  cabeceraTabla: { paddingTop: 14 },
  separada: { borderTopWidth: 1, borderTopColor: tema.borde },
  celdaEtiqueta: { width: 72, color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 13 },
  celda: {
    flex: 1,
    textAlign: "center",
    color: tema.textoSecundario,
    fontFamily: tema.fuenteTexto,
    fontSize: 13,
  },
  dia: { color: tema.textoTenue, fontFamily: tema.fuenteBoton },
  diaHoy: { color: tema.acento, textDecorationLine: "underline" },
  celdaHoy: { color: tema.texto, fontFamily: tema.fuenteBoton },
  pie: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 12, paddingBottom: 14 },
  sube: { color: tema.acento, fontFamily: tema.fuenteBoton, fontSize: 13 },
})
