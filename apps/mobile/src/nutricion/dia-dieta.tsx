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

/** Los números tal cual los escribió el profesional; los ausentes no se muestran. */
export function Objetivo({
  macros,
  compacto = false,
}: {
  macros: Macros
  compacto?: boolean
}): React.JSX.Element {
  const partes = [
    ["Proteína", macros.proteinaG],
    ["Hidratos", macros.hidratosG],
    ["Grasas", macros.grasaG],
  ] as const
  return (
    <View style={compacto ? s.objetivoCompacto : s.objetivo}>
      {macros.kcal !== null && (
        <Text style={compacto ? s.kcalCompacto : s.kcal}>{miles.format(macros.kcal)} kcal</Text>
      )}
      <View style={s.macros}>
        {partes
          .filter(([, gramos]) => gramos !== null)
          .map(([nombre, gramos]) => (
            <Text key={nombre} style={s.macro}>
              {nombre} <Text style={s.cifra}>{miles.format(gramos ?? 0)} g</Text>
            </Text>
          ))}
      </View>
    </View>
  )
}

function ListaDeAlimentos({ alimentos }: { alimentos: Alimento[] }): React.JSX.Element {
  return (
    <View style={s.alimentos}>
      {alimentos.map((alimento, n) => (
        <View key={`${alimento.nombre}-${n}`} style={s.alimento}>
          <Text style={s.nombreAlimento}>{alimento.nombre}</Text>
          {alimento.cantidad !== null && alimento.cantidad !== "" && (
            <Text style={s.cantidad}>{alimento.cantidad}</Text>
          )}
        </View>
      ))}
    </View>
  )
}

function ComidaDeLaDieta({ comida }: { comida: Comida }): React.JSX.Element {
  return (
    <View style={s.tarjeta}>
      <View style={s.cabeceraComida}>
        <Text style={s.nombreComida} accessibilityRole="header">
          {comida.nombre}
        </Text>
        {comida.hora !== null && <Text style={s.hora}>{comida.hora}</Text>}
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
                <ListaDeAlimentos alimentos={alternativa.alimentos} />
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
          <View style={s.columnas}>
            {comida.columnas.map((columna, c) => (
              <View key={`columna-${c}`} style={s.columna}>
                <Text style={s.nombreGrupo}>{columna.nombre}</Text>
                <ListaDeAlimentos alimentos={columna.alimentos} />
              </View>
            ))}
          </View>
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
          <Text style={s.leyenda}>OBJETIVO DEL DÍA</Text>
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
  dia: { gap: 14 },
  tarjetaObjetivo: {
    backgroundColor: tema.superficie,
    borderColor: tema.borde,
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
    gap: 6,
  },
  leyenda: { color: tema.acento, fontFamily: tema.fuenteBoton, fontSize: 12, letterSpacing: 2.4 },
  objetivo: { gap: 8 },
  objetivoCompacto: { gap: 4, marginTop: 4 },
  kcal: { color: tema.texto, fontFamily: tema.fuenteTitulo, fontSize: 40, lineHeight: 42 },
  kcalCompacto: { color: tema.textoSecundario, fontFamily: tema.fuenteBoton, fontSize: 14 },
  macros: { flexDirection: "row", flexWrap: "wrap", columnGap: 16, rowGap: 4 },
  macro: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 14 },
  cifra: { color: tema.texto, fontFamily: tema.fuenteBoton },
  tarjeta: {
    backgroundColor: tema.superficie,
    borderColor: tema.borde,
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 10,
  },
  cabeceraComida: { flexDirection: "row", alignItems: "baseline", gap: 10 },
  nombreComida: { flex: 1, color: tema.texto, fontFamily: tema.fuenteTitulo, fontSize: 26 },
  hora: { color: tema.textoTenue, fontFamily: tema.fuenteBoton, fontSize: 14 },
  indicacion: {
    color: tema.textoSecundario,
    fontFamily: tema.fuenteTexto,
    fontSize: 14,
    lineHeight: 20,
  },
  ayuda: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 13 },
  grupo: { gap: 8 },
  nombreGrupo: {
    color: tema.acento,
    fontFamily: tema.fuenteBoton,
    fontSize: 12,
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  alternativa: {
    backgroundColor: tema.suave,
    borderRadius: 14,
    padding: 12,
    gap: 6,
  },
  tituloAlternativa: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 16 },
  alimentos: { gap: 4 },
  alimento: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  nombreAlimento: { flex: 1, color: tema.texto, fontFamily: tema.fuenteTexto, fontSize: 15 },
  cantidad: { color: tema.textoSecundario, fontFamily: tema.fuenteBoton, fontSize: 15 },
  nota: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 13, fontStyle: "italic" },
  columnas: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  columna: {
    flexGrow: 1,
    flexBasis: 220,
    backgroundColor: tema.suave,
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
})
