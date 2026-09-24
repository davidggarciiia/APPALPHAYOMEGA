import { Pressable, StyleSheet, Text, View } from "react-native"
import type {
  Comida,
  ComidaRegistrada,
  DiaDeSeguimiento,
  DocumentoDieta,
  Suplemento,
} from "@alpha-omega/shared"

import { Icono } from "../componentes/iconos"
import { Enlace } from "../entrenamiento/sesion/controles"
import { miles } from "../seguimiento/modelo"
import { degradadoExito, degradadoOro, tema } from "../tema"
import {
  comidaDeAhora,
  repartoDeMacros,
  subtituloDeComida,
  suplementoTomado,
  tipoDelDia,
} from "./hoy-modelo"

const COLOR_MACRO = { hidratos: tema.acento, proteina: tema.textoSecundario, grasas: tema.naranja }

function Circulo({ hecho }: { hecho: boolean }): React.JSX.Element {
  return (
    <View style={[s.circulo, hecho && [s.circuloHecho, degradadoExito]]}>
      {hecho && <Icono nombre="hecho" color={tema.sobreExito} tamano={16} />}
    </View>
  )
}

/**
 * «Nutrición» del diseño. Con comidas: el día con cada comida y su progreso.
 * Sin comidas: el objetivo diario con su rango y el reparto de macros.
 */
export function HoyNutricion({
  documento,
  deNutricionista,
  hoy,
  hora,
  registradas,
  dia,
  puedeMarcar,
  puedeTomar,
  abrirComida,
  marcarComida,
  tomarSuplemento,
  verSemana,
}: {
  documento: DocumentoDieta
  deNutricionista: boolean
  hoy: string
  /** «HH:MM» de ahora, para la comida de «Ahora». */
  hora: string
  registradas: ComidaRegistrada[]
  dia: DiaDeSeguimiento | null
  /** Sin conexión o sin registro de comidas no se marcan comidas. */
  puedeMarcar: boolean
  /** Sin conexión no se apuntan suplementos. */
  puedeTomar: boolean
  abrirComida: (comida: Comida) => void
  marcarComida: (comida: Comida, hecha: boolean) => void
  tomarSuplemento: (suplemento: Suplemento, tomado: boolean) => void
  verSemana: () => void
}): React.JSX.Element {
  const tipo = tipoDelDia(documento, hoy)
  const comidas = tipo?.comidas ?? []
  const porComida = new Map(registradas.map((r) => [r.comidaId, r]))
  const hechas = new Set(comidas.filter((c) => porComida.has(c.id)).map((c) => c.id))
  const ahora = comidaDeAhora(comidas, hechas, hora)
  const reparto = repartoDeMacros(tipo?.objetivo ?? null)
  const kcal = tipo?.objetivo?.kcal ?? null
  const margen = tipo?.margenKcal
  const suplementos = documento.suplementos ?? []

  return (
    <View style={s.contenido}>
      <Text style={s.tenue}>
        {deNutricionista ? "Dieta de tu nutricionista" : "Dieta de tu entrenador"}
      </Text>
      {documento.nota && <Text style={s.nota}>{documento.nota}</Text>}

      {comidas.length > 0 ? (
        <View style={s.grupo}>
          <View style={s.cabecera}>
            <Text style={s.titulo} accessibilityRole="header">
              Hoy
            </Text>
            <Text style={s.cuenta}>
              {hechas.size} de {comidas.length}
            </Text>
          </View>
          <View
            style={s.pista}
            accessibilityRole="progressbar"
            accessibilityLabel="Comidas hechas"
            accessibilityValue={{ min: 0, max: comidas.length, now: hechas.size }}
          >
            <View
              style={[
                s.relleno,
                degradadoOro,
                { width: `${(hechas.size / comidas.length) * 100}%` },
              ]}
            />
          </View>
          <View style={s.lista}>
            {comidas.map((comida, n) => {
              const hecha = hechas.has(comida.id)
              const esAhora = comida.id === ahora
              const subtitulo = subtituloDeComida(comida, porComida.get(comida.id))
              return (
                <View key={comida.id} style={[s.fila, n > 0 && s.separada]}>
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityLabel={`${comida.nombre} hecha`}
                    accessibilityState={{ checked: hecha, disabled: !puedeMarcar }}
                    disabled={!puedeMarcar}
                    onPress={() => marcarComida(comida, !hecha)}
                    hitSlop={8}
                  >
                    <Circulo hecho={hecha} />
                  </Pressable>
                  <Pressable
                    style={s.cuerpoFila}
                    accessibilityRole="button"
                    accessibilityLabel={`${comida.nombre}${esAhora ? ", ahora" : ""}: ${subtitulo}`}
                    onPress={() => abrirComida(comida)}
                  >
                    <View style={s.textos}>
                      <View style={s.nombreFila}>
                        <Text style={[s.nombre, esAhora && s.nombreAhora]}>{comida.nombre}</Text>
                        {esAhora && (
                          <View style={[s.ahora, degradadoOro]}>
                            <Text style={s.textoAhora}>Ahora</Text>
                          </View>
                        )}
                      </View>
                      <Text style={s.tenue} numberOfLines={1}>
                        {subtitulo}
                      </Text>
                    </View>
                    <Icono nombre="adelante" color={tema.textoTenue} tamano={18} />
                  </Pressable>
                </View>
              )
            })}
          </View>
        </View>
      ) : (
        kcal !== null && (
          <View style={s.objetivo}>
            <Text style={s.kcal} accessibilityLabel={`${kcal} kilocalorías al día`}>
              {miles(kcal)}
            </Text>
            <Text style={[s.tenue, s.centrado]}>
              kcal al día
              {margen ? ` · entre ${miles(kcal - margen)} y ${miles(kcal + margen)}` : ""}
            </Text>
            {reparto && (
              <>
                <View style={s.barra} accessible={false}>
                  {reparto.map((m) => (
                    <View
                      key={m.clave}
                      style={[s.tramo, { flex: m.pct, backgroundColor: COLOR_MACRO[m.clave] }]}
                    />
                  ))}
                </View>
                <View style={s.macros}>
                  {reparto.map((m) => (
                    <View
                      key={m.clave}
                      style={s.macro}
                      accessible
                      accessibilityLabel={`${m.nombre}: ${m.gramos} gramos, ${m.pct} por ciento`}
                    >
                      <View style={[s.rayita, { backgroundColor: COLOR_MACRO[m.clave] }]} />
                      <Text style={s.tenue}>{m.nombre}</Text>
                      <Text style={s.gramos}>{m.gramos} g</Text>
                      <Text style={s.pct}>{m.pct} %</Text>
                    </View>
                  ))}
                </View>
              </>
            )}
          </View>
        )
      )}

      {suplementos.length > 0 && (
        <View style={s.grupo}>
          <Text style={s.titulo} accessibilityRole="header">
            Suplementos
          </Text>
          <View style={s.lista}>
            {suplementos.map((suplemento, n) => {
              const tomado = suplementoTomado(suplemento, dia)
              return (
                <Pressable
                  key={suplemento.nombre}
                  style={[s.fila, n > 0 && s.separada]}
                  accessibilityRole="checkbox"
                  accessibilityLabel={`${suplemento.nombre} tomada`}
                  accessibilityState={{ checked: tomado, disabled: !puedeTomar }}
                  disabled={!puedeTomar}
                  onPress={() => tomarSuplemento(suplemento, !tomado)}
                >
                  <Circulo hecho={tomado} />
                  <Text style={[s.nombre, s.textos]}>{suplemento.nombre} tomada</Text>
                  {suplemento.dosis && <Text style={s.tenue}>{suplemento.dosis}</Text>}
                </Pressable>
              )
            })}
          </View>
        </View>
      )}

      {documento.indicaciones.length > 0 && (
        <View style={s.grupo}>
          <Text style={s.titulo} accessibilityRole="header">
            Pautas
          </Text>
          <View style={s.pautas}>
            {documento.indicaciones.map((indicacion, n) => (
              <View key={`${indicacion.titulo}-${n}`} style={s.pauta}>
                <Text style={s.tituloPauta}>{indicacion.titulo}</Text>
                <Text style={s.tenue}>{indicacion.texto}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
      <Enlace texto="Ver la dieta de la semana" onPress={verSemana} />
    </View>
  )
}

const s = StyleSheet.create({
  contenido: { gap: 28 },
  grupo: { gap: 12 },
  cabecera: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  titulo: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 20 },
  cuenta: { color: tema.acento, fontFamily: tema.fuenteBoton, fontSize: 15 },
  tenue: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 13 },
  nota: { color: tema.textoSecundario, fontFamily: tema.fuenteTexto, fontSize: 15, lineHeight: 21 },
  pista: { height: 4, borderRadius: 2, backgroundColor: tema.superficieAlta, overflow: "hidden" },
  relleno: { height: 4 },
  lista: {
    backgroundColor: tema.superficie,
    borderRadius: 20,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: tema.bordeDestacado,
  },
  fila: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: 14 },
  separada: { borderTopWidth: 1, borderTopColor: tema.borde },
  cuerpoFila: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, minHeight: 64 },
  textos: { flex: 1, gap: 2 },
  nombreFila: { flexDirection: "row", alignItems: "center", gap: 8 },
  nombre: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 16 },
  nombreAhora: { color: tema.acento },
  ahora: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  textoAhora: { color: tema.sobreAcento, fontFamily: tema.fuenteBoton, fontSize: 11 },
  circulo: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: tema.bordeFuerte,
    alignItems: "center",
    justifyContent: "center",
  },
  circuloHecho: { borderColor: "transparent" },
  objetivo: {
    backgroundColor: tema.superficie,
    borderRadius: 24,
    padding: 20,
    gap: 10,
    borderWidth: 1,
    borderColor: tema.bordeDestacado,
  },
  kcal: {
    color: tema.acento,
    fontFamily: tema.fuenteTitulo,
    fontSize: 72,
    lineHeight: 80,
    textAlign: "center",
  },
  centrado: { textAlign: "center" },
  barra: { flexDirection: "row", gap: 3, height: 8, marginTop: 12 },
  tramo: { borderRadius: 4 },
  macros: { flexDirection: "row", gap: 12 },
  macro: { flex: 1, gap: 4 },
  rayita: { height: 3, borderRadius: 2, marginBottom: 4 },
  gramos: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 20 },
  pct: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 12 },
  pautas: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pauta: {
    flexGrow: 1,
    flexBasis: 140,
    backgroundColor: tema.superficie,
    borderRadius: 14,
    padding: 14,
    gap: 4,
  },
  tituloPauta: { color: tema.acento, fontFamily: tema.fuenteBoton, fontSize: 17 },
})
