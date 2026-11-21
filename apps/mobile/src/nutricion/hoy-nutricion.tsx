import { useState } from "react"
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
import { BotonSecundario } from "../componentes/botones"
import { Enlace } from "../entrenamiento/sesion/controles"
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
  puedeRegistrar = false,
  comidaOcupada = null,
  reciente = null,
  abrirComida,
  marcarComida,
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
  /** Con red y registro permitido, la casilla marca la comida como hecha con un toque. */
  puedeRegistrar?: boolean
  /** La comida que se está guardando: mientras tanto no se tocan las casillas. */
  comidaOcupada?: string | null
  /** La última marcada desde aquí, para ofrecer deshacer junto a la lista. */
  reciente?: Comida | null
  abrirComida: (comida: Comida) => void
  marcarComida?: (comida: Comida, hecha: boolean) => void
  tomarSuplemento: (suplemento: Suplemento, tomado: boolean) => void
  verSemana: () => void
}): React.JSX.Element {
  const [objetivoAbierto, setObjetivoAbierto] = useState(false)
  const tipo = tipoDelDia(documento, hoy)
  const comidas = tipo?.comidas ?? []
  const porComida = new Map((registradas ?? []).map((r) => [r.comidaId, r]))
  const hechas = new Set(comidas.filter((c) => porComida.has(c.id)).map((c) => c.id))
  const ahora = registradas === null ? null : comidaDeAhora(comidas, hechas, hora)
  const ordenadas = ahora
    ? [
        ...comidas.filter((comida) => comida.id === ahora),
        ...comidas.filter((comida) => comida.id !== ahora),
      ]
    : comidas
  const suplementos = documento.suplementos ?? []

  return (
    <View style={s.contenido}>
      <View style={s.contenido}>
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
              {ordenadas.map((comida, n) => {
                const hecha = hechas.has(comida.id)
                const esAhora = comida.id === ahora
                const momento = comida.hora !== null && comida.hora > hora ? "siguiente" : "ahora"
                const subtitulo = subtituloDeComida(comida, porComida.get(comida.id))
                return (
                  <View
                    key={comida.id}
                    style={[s.filaComida, n > 0 && s.separada, esAhora && s.filaAhora]}
                  >
                    {registradas !== null &&
                      (puedeRegistrar && marcarComida ? (
                        <Pressable
                          style={s.zonaCheck}
                          accessibilityRole="checkbox"
                          aria-checked={hecha}
                          accessibilityLabel={`Comida hecha: ${comida.nombre}`}
                          accessibilityState={{
                            checked: hecha,
                            disabled: comidaOcupada !== null,
                            busy: comidaOcupada === comida.id,
                          }}
                          disabled={comidaOcupada !== null}
                          onPress={() => marcarComida(comida, !hecha)}
                        >
                          <Check hecho={hecha} />
                        </Pressable>
                      ) : (
                        <View style={s.zonaCheck} accessible={false}>
                          <Check hecho={hecha} />
                        </View>
                      ))}
                    <Pressable
                      style={s.cuerpoFila}
                      accessibilityRole="button"
                      accessibilityLabel={`${comida.nombre}${esAhora ? `, ${momento}` : ""}${
                        hecha ? ", hecha" : ""
                      }${hecha && subtitulo === "Hecha" ? "" : `: ${subtitulo}`}`}
                      onPress={() => abrirComida(comida)}
                    >
                      <View style={s.textos}>
                        <View style={s.nombreFila}>
                          <Text style={[s.nombre, esAhora && s.nombreAhora]}>{comida.nombre}</Text>
                          {esAhora && (
                            <View style={s.ahora}>
                              <Text style={s.textoAhora}>
                                {momento === "ahora" ? "Ahora" : "Siguiente"}
                              </Text>
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
            {reciente && hechas.has(reciente.id) && marcarComida && (
              <View style={s.reciente} accessibilityLiveRegion="polite">
                <Text style={s.textoReciente}>Registrada: {reciente.nombre}</Text>
                <Enlace
                  texto="Deshacer"
                  etiqueta={`Deshacer ${reciente.nombre}`}
                  onPress={() => marcarComida(reciente, false)}
                />
              </View>
            )}
          </View>
        )}

        {tipo?.objetivo && tieneAlgunNumero(tipo.objetivo) && (
          <View style={s.grupo}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ver objetivo nutricional"
              accessibilityState={{ expanded: objetivoAbierto }}
              onPress={() => setObjetivoAbierto((abierto) => !abierto)}
              style={s.botonObjetivo}
            >
              <Text style={s.nombre}>Objetivo nutricional</Text>
              {/* No hay icono de desplegar: el de «adelante» girado apunta abajo o arriba. */}
              <View style={{ transform: [{ rotate: objetivoAbierto ? "-90deg" : "90deg" }] }}>
                <Icono nombre="adelante" color={tema.textoTenue} tamano={18} />
              </View>
            </Pressable>
            {objetivoAbierto && (
              <View style={s.objetivo}>
                <Objetivo macros={tipo.objetivo} margenKcal={tipo.margenKcal} />
              </View>
            )}
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
                        ? suplemento.nombre
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
                      <Text style={s.nombre}>{suplemento.nombre}</Text>
                      {suplemento.dosis && <Text style={s.tenue}>{suplemento.dosis}</Text>}
                      {!diaCargado && <Text style={s.tenue}>Registro no disponible</Text>}
                    </View>
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
      </View>
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
  filaComida: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: 6 },
  // Zona táctil de 44 con la casilla de 28 dentro; el margen negativo conserva la alineación.
  zonaCheck: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -8,
  },
  reciente: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 4,
  },
  textoReciente: { flex: 1, color: tema.acento, fontFamily: tema.fuenteBoton, fontSize: 15 },
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
  botonObjetivo: {
    minHeight: 48,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    backgroundColor: tema.superficie,
    borderRadius: radio.tarjeta,
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
