import { StyleSheet, Text, View } from "react-native"
import {
  tieneAlgunNumero,
  type Alimento,
  type Comida,
  type Macros,
  type TipoDeDia,
} from "@alpha-omega/shared"
import { tema } from "../tema"

const miles = new Intl.NumberFormat("es-ES")

/** Como en el diseño: hidratos en dorado, proteína en crema y grasas en naranja. */
const MACROS = [
  { clave: "hidratosG", nombre: "Hidratos", color: tema.acento },
  { clave: "proteinaG", nombre: "Proteína", color: tema.texto },
  { clave: "grasaG", nombre: "Grasas", color: tema.naranja },
] as const

/** Los números tal cual los escribió el profesional; los ausentes no se muestran. */
export function Objetivo({
  macros,
  compacto = false,
}: {
  macros: Macros
  compacto?: boolean
}): React.JSX.Element {
  const presentes = MACROS.filter((m) => macros[m.clave] !== null)
  if (compacto) {
    return (
      <Text style={s.compacto}>
        {[
          ...(macros.kcal !== null ? [`${miles.format(macros.kcal)} kcal`] : []),
          ...presentes.map((m) => `${m.nombre} ${miles.format(macros[m.clave] ?? 0)} g`),
        ].join(" · ")}
      </Text>
    )
  }
  return (
    <View style={s.objetivo}>
      {macros.kcal !== null && (
        <View style={s.kcalBloque}>
          <Text style={s.kcal}>{miles.format(macros.kcal)}</Text>
          <Text style={s.unidad}>kcal al día</Text>
        </View>
      )}
      {presentes.length > 0 && (
        <View style={s.macros}>
          {presentes.map((m) => (
            <View key={m.clave} style={s.macro}>
              <View style={[s.linea, { backgroundColor: m.color }]} />
              <Text style={s.nombreMacro}>{m.nombre}</Text>
              <Text style={s.gramos}>{miles.format(macros[m.clave] ?? 0)} g</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

/** Un alimento como en los mosaicos del diseño: nombre y, debajo, la cantidad en dorado. */
function Mosaico({ alimento }: { alimento: Alimento }): React.JSX.Element {
  return (
    <View style={s.mosaico}>
      <Text style={s.nombreAlimento}>{alimento.nombre}</Text>
      {alimento.cantidad !== null && alimento.cantidad !== "" && (
        <Text style={s.cantidad}>{alimento.cantidad}</Text>
      )}
    </View>
  )
}

function ComidaDeLaDieta({ comida }: { comida: Comida }): React.JSX.Element {
  const opciones =
    comida.forma === "alternativas"
      ? comida.grupos.reduce((total, grupo) => total + grupo.alternativas.length, 0)
      : null
  return (
    <View style={s.tarjeta}>
      <View style={s.cabeceraComida}>
        <View style={s.titulosComida}>
          <Text style={s.nombreComida} accessibilityRole="header">
            {comida.nombre}
          </Text>
          <Text style={s.resumen}>
            {[
              comida.hora,
              opciones === null
                ? "Elige uno de cada"
                : `${opciones} ${opciones === 1 ? "opción" : "opciones"}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        </View>
      </View>
      {comida.indicacion !== null && comida.indicacion !== "" && (
        <Text style={s.indicacion}>{comida.indicacion}</Text>
      )}
      {comida.forma === "alternativas" ? (
        comida.grupos.map((grupo, g) => (
          <View key={`grupo-${g}`} style={s.grupo}>
            {grupo.nombre !== null && grupo.nombre !== "" && (
              <Text style={s.nombreGrupo}>{grupo.nombre}</Text>
            )}
            {grupo.alternativas.map((alternativa) => (
              <View key={alternativa.id} style={s.alternativa}>
                <Text style={s.tituloAlternativa}>{alternativa.titulo}</Text>
                <View style={s.lista}>
                  {alternativa.alimentos.map((alimento, n) => (
                    <View key={`${alimento.nombre}-${n}`} style={s.renglon}>
                      <Text style={s.alimento}>{alimento.nombre}</Text>
                      {alimento.cantidad !== null && alimento.cantidad !== "" && (
                        <Text style={s.cantidad}>{alimento.cantidad}</Text>
                      )}
                    </View>
                  ))}
                </View>
                {alternativa.nota !== null && alternativa.nota !== "" && (
                  <Text style={s.nota}>{alternativa.nota}</Text>
                )}
                {tieneAlgunNumero(alternativa.macros) && alternativa.macros && (
                  <Objetivo macros={alternativa.macros} compacto />
                )}
              </View>
            ))}
          </View>
        ))
      ) : (
        <>
          <Text style={s.ayuda}>Elige un alimento de cada columna y combínalos.</Text>
          {comida.columnas.map((columna, c) => (
            <View key={`columna-${c}`} style={s.grupo}>
              <Text style={s.nombreGrupo}>{columna.nombre}</Text>
              <View style={s.rejilla}>
                {columna.alimentos.map((alimento, n) => (
                  <Mosaico key={`${alimento.nombre}-${n}`} alimento={alimento} />
                ))}
              </View>
            </View>
          ))}
        </>
      )}
    </View>
  )
}

/** Un tipo de día completo: su objetivo, si lo tiene, y sus comidas. */
export function DiaDieta({ tipo }: { tipo: TipoDeDia }): React.JSX.Element {
  return (
    <View style={s.dia}>
      {tieneAlgunNumero(tipo.objetivo) && tipo.objetivo && (
        <View style={s.tarjetaObjetivo}>
          <Objetivo macros={tipo.objetivo} />
        </View>
      )}
      {tipo.comidas.map((comida) => (
        <ComidaDeLaDieta key={comida.id} comida={comida} />
      ))}
    </View>
  )
}

const s = StyleSheet.create({
  dia: { gap: 12 },
  tarjetaObjetivo: {
    backgroundColor: tema.superficie,
    borderColor: tema.bordeDestacado,
    borderWidth: 1,
    borderRadius: 20,
    padding: 20,
  },
  objetivo: { gap: 20 },
  kcalBloque: { alignItems: "center", gap: 4 },
  kcal: { color: tema.acento, fontFamily: tema.fuenteTitulo, fontSize: 72, lineHeight: 80 },
  unidad: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 15 },
  macros: { flexDirection: "row", gap: 12 },
  macro: { flex: 1, gap: 6 },
  linea: { height: 3, borderRadius: 2 },
  nombreMacro: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 13 },
  gramos: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 22 },
  compacto: { color: tema.textoTenue, fontFamily: tema.fuenteSemi, fontSize: 13, marginTop: 4 },
  tarjeta: { backgroundColor: tema.superficie, borderRadius: 20, padding: 16, gap: 12 },
  cabeceraComida: { flexDirection: "row", alignItems: "center", gap: 12 },
  titulosComida: { flex: 1, gap: 2 },
  nombreComida: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 20 },
  resumen: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 13 },
  indicacion: {
    color: tema.textoSecundario,
    fontFamily: tema.fuenteTexto,
    fontSize: 14,
    lineHeight: 20,
  },
  ayuda: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 13 },
  grupo: { gap: 8 },
  nombreGrupo: { color: tema.acento, fontFamily: tema.fuenteBoton, fontSize: 15 },
  alternativa: {
    borderWidth: 1,
    borderColor: tema.borde,
    borderRadius: 14,
    padding: 12,
    gap: 6,
  },
  tituloAlternativa: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 15 },
  lista: { gap: 4 },
  renglon: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  alimento: { flex: 1, color: tema.texto, fontFamily: tema.fuenteTexto, fontSize: 15 },
  cantidad: { color: tema.acento, fontFamily: tema.fuenteBoton, fontSize: 15 },
  nota: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 13, fontStyle: "italic" },
  rejilla: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  mosaico: {
    flexGrow: 1,
    flexBasis: 140,
    borderWidth: 1,
    borderColor: tema.borde,
    borderRadius: 14,
    padding: 12,
    gap: 2,
  },
  nombreAlimento: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 15 },
})
