import { Pressable, StyleSheet, Text, View } from "react-native"
import type {
  Comida,
  ComidaRegistrada,
  DiaDeSeguimiento,
  DocumentoDieta,
  Suplemento,
} from "@alpha-omega/shared"
import { tieneAlgunNumero } from "@alpha-omega/shared"

import { Icono } from "../componentes/iconos"
import { EntradaMarca } from "../componentes/entrada-marca"
import { BotonSecundario } from "../componentes/botones"
import { radio, tema, tipo as tipografia } from "../tema"
import { Objetivo } from "./dia-dieta"
import { comidaDeAhora, subtituloDeComida, suplementoTomado, tipoDelDia } from "./hoy-modelo"

function Check({ hecho }: { hecho: boolean }): React.JSX.Element {
  return (
    <View style={[s.check, hecho && s.checkHecho]} accessible={false}>
      {hecho && <Icono nombre="hecho" color={tema.sobreExito} tamano={16} />}
    </View>
  )
}

/**
 * «Nutrición» del diseño. Con comidas: el día con cada comida y su progreso.
 * El objetivo precede a las comidas y conserva solo las cifras prescritas.
 */
export function HoyNutricion({
  documento,
  deNutricionista,
  hoy,
  hora,
  registradas,
  dia,
  diaCargado,
  puedeTomar,
  abrirComida,
  tomarSuplemento,
  verSemana,
}: {
  documento: DocumentoDieta
  deNutricionista: boolean | null
  hoy: string
  /** «HH:MM» de ahora, para la comida de «Ahora». */
  hora: string
  registradas: ComidaRegistrada[] | null
  dia: DiaDeSeguimiento | null
  diaCargado: boolean
  /** Sin conexión no se apuntan suplementos. */
  puedeTomar: boolean
  abrirComida: (comida: Comida) => void
  tomarSuplemento: (suplemento: Suplemento, tomado: boolean) => void
  verSemana: () => void
}): React.JSX.Element {
  const tipo = tipoDelDia(documento, hoy)
  const comidas = tipo?.comidas ?? []
  const porComida = new Map((registradas ?? []).map((r) => [r.comidaId, r]))
  const hechas = new Set(comidas.filter((c) => porComida.has(c.id)).map((c) => c.id))
  const ahora = registradas === null ? null : comidaDeAhora(comidas, hechas, hora)
  const suplementos = documento.suplementos ?? []

  return (
    <View style={s.contenido}>
      <EntradaMarca indice={0}>
        {tipo?.objetivo && tieneAlgunNumero(tipo.objetivo) && (
          <View style={s.objetivo}>
            <Objetivo macros={tipo.objetivo} margenKcal={tipo.margenKcal} />
          </View>
        )}
      </EntradaMarca>
      <EntradaMarca indice={1} style={s.contenido}>
        {comidas.length > 0 && (
          <View style={s.grupo}>
            <View style={s.cabecera}>
              {registradas !== null && (
                <Text style={s.cuenta}>
                  {hechas.size} de {comidas.length}
                </Text>
              )}
            </View>
            {registradas === null ? (
              <Text style={s.tenue}>Registro de comidas no disponible</Text>
            ) : (
              <View
                style={s.pista}
                accessibilityRole="progressbar"
                accessibilityLabel="Comidas hechas"
                accessibilityValue={{ min: 0, max: comidas.length, now: hechas.size }}
              >
                <View style={[s.relleno, { width: `${(hechas.size / comidas.length) * 100}%` }]} />
              </View>
            )}
            <View style={s.lista}>
              {comidas.map((comida, n) => {
                const hecha = hechas.has(comida.id)
                const esAhora = comida.id === ahora
                const subtitulo = subtituloDeComida(comida, porComida.get(comida.id))
                return (
                  <Pressable
                    key={comida.id}
                    style={[s.fila, n > 0 && s.separada, esAhora && s.filaAhora]}
                    accessibilityRole="button"
                    accessibilityLabel={`${comida.nombre}${esAhora ? ", ahora" : ""}: ${subtitulo}`}
                    onPress={() => abrirComida(comida)}
                  >
                    {registradas !== null && <Check hecho={hecha} />}
                    <View style={s.cuerpoFila}>
                      <View style={s.textos}>
                        <View style={s.nombreFila}>
                          <Text style={[s.nombre, esAhora && s.nombreAhora]}>{comida.nombre}</Text>
                          {esAhora && (
                            <View style={s.ahora}>
                              <Text style={s.textoAhora}>Ahora</Text>
                            </View>
                          )}
                        </View>
                        <Text style={s.tenue} numberOfLines={1}>
                          {subtitulo}
                        </Text>
                      </View>
                      <Icono nombre="adelante" color={tema.textoTenue} tamano={18} />
                    </View>
                  </Pressable>
                )
              })}
            </View>
          </View>
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
                    accessibilityRole={diaCargado ? "checkbox" : "text"}
                    aria-checked={diaCargado ? tomado : undefined}
                    accessibilityLabel={
                      diaCargado
                        ? `${suplemento.nombre} tomada`
                        : `${suplemento.nombre}: registro no disponible`
                    }
                    accessibilityState={{
                      checked: diaCargado ? tomado : undefined,
                      disabled: !puedeTomar,
                    }}
                    disabled={!puedeTomar}
                    onPress={() => tomarSuplemento(suplemento, !tomado)}
                  >
                    {diaCargado && <Check hecho={tomado} />}
                    <View style={s.textos}>
                      <Text style={s.nombre}>
                        {suplemento.nombre}
                        {diaCargado ? " tomada" : ""}
                      </Text>
                      {!diaCargado && <Text style={s.tenue}>Registro no disponible</Text>}
                    </View>
                    {suplemento.dosis && <Text style={s.tenue}>{suplemento.dosis}</Text>}
                  </Pressable>
                )
              })}
            </View>
          </View>
        )}

        {documento.nota && <Text style={s.nota}>{documento.nota}</Text>}
        {documento.indicaciones.length > 0 && (
          <View style={s.grupo}>
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
        <BotonSecundario texto="Ver la semana completa" onPress={verSemana} />
        <Text style={s.tenue}>
          {deNutricionista === null
            ? "Dieta de tu profesional"
            : deNutricionista
              ? "Dieta de tu nutricionista"
              : "Dieta de tu entrenador"}
        </Text>
      </EntradaMarca>
    </View>
  )
}

const s = StyleSheet.create({
  contenido: { gap: 28 },
  grupo: { gap: 12 },
  cabecera: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  titulo: { ...tipografia.titulo, color: tema.texto },
  cuenta: { color: tema.acento, fontFamily: tema.fuenteBoton, fontSize: 15 },
  tenue: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 13 },
  nota: { color: tema.textoSecundario, fontFamily: tema.fuenteTexto, fontSize: 15, lineHeight: 21 },
  pista: { height: 8, borderRadius: 4, backgroundColor: tema.superficieAlta, overflow: "hidden" },
  relleno: { height: 8, backgroundColor: tema.acento },
  lista: {
    backgroundColor: tema.superficie,
    borderRadius: 20,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: tema.bordeDestacado,
  },
  fila: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: 14 },
  filaAhora: { backgroundColor: "rgba(255,195,76,.04)" },
  separada: { borderTopWidth: 1, borderTopColor: tema.borde },
  cuerpoFila: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, minHeight: 64 },
  textos: { flex: 1, gap: 2, minWidth: 0 },
  nombreFila: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  nombre: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 16 },
  nombreAhora: { color: tema.acento },
  ahora: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: tema.acentoSuave,
    borderWidth: 1,
    borderColor: tema.acento,
  },
  textoAhora: { color: tema.acento, fontFamily: tema.fuenteSemi, fontSize: 11 },
  check: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: tema.bordeFuerte,
    alignItems: "center",
    justifyContent: "center",
  },
  checkHecho: { borderColor: tema.exito, backgroundColor: tema.exito },
  objetivo: {
    backgroundColor: tema.superficie,
    borderRadius: radio.tarjeta,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: tema.bordeDestacado,
  },
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
