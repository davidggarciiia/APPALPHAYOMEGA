import { Pressable, StyleSheet, Text, View } from "react-native"
import type { DefinicionCorporal } from "@alpha-omega/shared"

import { BotonSecundario, Campo } from "../componentes/formulario"
import { Fila, Tarjeta, Titulo } from "../entrenamiento/plan/piezas"
import { tema } from "../tema"
import { CAMPO_CORPORAL_VACIO, type CampoCorporal, type CampoGrasa } from "./valoracion-modelo"

/** Lecturas originales por punto: el contrato no admite más. */
const MAX_LECTURAS = 5

/** Acción pequeña de una lectura: «Adoptar», «Quitar». */
function Accion({
  texto,
  etiqueta,
  deshabilitado,
  onPress,
}: {
  texto: string
  etiqueta: string
  deshabilitado: boolean
  onPress: () => void
}): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      accessibilityState={{ disabled: deshabilitado }}
      disabled={deshabilitado}
      onPress={onPress}
      style={[s.accion, deshabilitado && s.apagado]}
    >
      <Text style={s.textoAccion}>{texto}</Text>
    </Pressable>
  )
}

/**
 * Un punto del plicómetro: lecturas originales opcionales y el valor que el
 * profesional adopta. La app nunca rellena ese valor por su cuenta.
 */
function PuntoPliegue({
  d,
  campo,
  cambiar,
  bloqueado,
  primera,
}: {
  d: DefinicionCorporal
  campo: CampoCorporal
  cambiar: (cambio: Partial<CampoCorporal>) => void
  bloqueado: boolean
  primera: boolean
}): React.JSX.Element {
  const partes = [d.nombre, d.zona, d.lateralidad].filter((p): p is string => Boolean(p))
  const quien = partes.join(", ")
  const sinValor = bloqueado || campo.noRealizado
  const { lecturas } = campo
  const lleno = lecturas.length >= MAX_LECTURAS
  const ficha = [`Unidad: ${d.unidad}`, d.instrumento && `Instrumento: ${d.instrumento}`]
    .filter(Boolean)
    .join(" · ")

  return (
    <Fila primera={primera}>
      <View style={s.punto}>
        <View style={s.cabecera}>
          <View style={s.textos}>
            <Text style={s.nombre}>{partes.join(" · ")}</Text>
            <Text style={s.tenue}>{ficha}</Text>
            {d.protocolo && <Text style={s.tenue}>Protocolo: {d.protocolo}</Text>}
          </View>
          <Pressable
            accessibilityRole="checkbox"
            aria-checked={campo.noRealizado}
            accessibilityLabel={`No realizado — ${quien}`}
            accessibilityState={{ checked: campo.noRealizado, disabled: bloqueado }}
            disabled={bloqueado}
            onPress={() => cambiar({ noRealizado: !campo.noRealizado })}
            style={[s.accion, campo.noRealizado && s.marcada, bloqueado && s.apagado]}
          >
            <Text style={s.textoAccion}>No realizado</Text>
          </Pressable>
        </View>

        {lecturas.map((texto, n) => (
          <View key={n} style={s.lectura}>
            <View style={s.campoLectura}>
              <Campo
                etiqueta={`Lectura ${n + 1} (${d.unidad})`}
                accessibilityLabel={`Lectura ${n + 1} (${d.unidad}) — ${quien}`}
                value={texto}
                placeholder="Sin dato"
                editable={!sinValor}
                keyboardType="decimal-pad"
                maxLength={8}
                onChangeText={(nuevo) =>
                  cambiar({ lecturas: lecturas.map((l, i) => (i === n ? nuevo : l)) })
                }
              />
            </View>
            <View style={s.acciones}>
              <Accion
                texto="Adoptar"
                etiqueta={`Adoptar lectura ${n + 1} — ${quien}`}
                deshabilitado={sinValor || texto.trim() === ""}
                onPress={() => cambiar({ texto })}
              />
              <Accion
                texto="Quitar"
                etiqueta={`Quitar lectura ${n + 1} — ${quien}`}
                deshabilitado={bloqueado}
                onPress={() => cambiar({ lecturas: lecturas.filter((_, i) => i !== n) })}
              />
            </View>
          </View>
        ))}
        <BotonSecundario
          texto="Añadir lectura"
          etiquetaAccesible={`Añadir lectura — ${quien}`}
          deshabilitado={sinValor || lleno}
          onPress={() => cambiar({ lecturas: [...lecturas, ""] })}
        />
        {lleno && <Text style={s.tenue}>Máximo {MAX_LECTURAS} lecturas por punto.</Text>}

        <Campo
          etiqueta={`Valor adoptado (${d.unidad})`}
          accessibilityLabel={`Valor adoptado (${d.unidad}) — ${quien}`}
          value={campo.noRealizado ? "" : campo.texto}
          placeholder={campo.noRealizado ? "No realizado" : "Sin dato"}
          editable={!sinValor}
          keyboardType="decimal-pad"
          maxLength={8}
          onChangeText={(texto) => cambiar({ texto })}
        />
        <Text style={s.tenue}>Lo decides tú: escríbelo o adopta una lectura.</Text>

        {campo.noRealizado && (
          <>
            <Campo
              etiqueta="Motivo (opcional)"
              accessibilityLabel={`Motivo (opcional) — ${quien}`}
              value={campo.motivo}
              editable={!bloqueado}
              maxLength={200}
              onChangeText={(motivo) => cambiar({ motivo })}
            />
            {lecturas.length > 0 && (
              <Text style={s.aviso}>
                Mientras esté como no realizado, las lecturas no se guardan. Quítalas o desmarca «No
                realizado».
              </Text>
            )}
          </>
        )}
      </View>
    </Fila>
  )
}

/** Porcentaje que ya calculó el profesional; aquí solo se anota. */
function GrasaPorPliegues({
  grasa,
  cambiar,
  bloqueado,
}: {
  grasa: CampoGrasa
  cambiar: (grasa: CampoGrasa) => void
  bloqueado: boolean
}): React.JSX.Element {
  return (
    <View style={s.grupo}>
      <Text style={s.subtitulo} accessibilityRole="header">
        Porcentaje de grasa por pliegues
      </Text>
      <Text style={s.tenue}>
        Si ya calculaste el porcentaje con tu método, anótalo con el método y la fecha. La app no lo
        calcula.
      </Text>
      <Tarjeta>
        <View style={s.relleno}>
          <Campo
            etiqueta="Porcentaje de grasa (%)"
            value={grasa.texto}
            placeholder="Sin dato"
            editable={!bloqueado}
            keyboardType="decimal-pad"
            maxLength={6}
            onChangeText={(texto) => cambiar({ ...grasa, texto })}
          />
          <Campo
            etiqueta="Método que usaste"
            value={grasa.metodo}
            editable={!bloqueado}
            maxLength={120}
            onChangeText={(metodo) => cambiar({ ...grasa, metodo })}
          />
          <Campo
            etiqueta="Fecha del cálculo (AAAA-MM-DD)"
            value={grasa.fecha}
            editable={!bloqueado}
            maxLength={10}
            onChangeText={(fecha) => cambiar({ ...grasa, fecha })}
          />
        </View>
      </Tarjeta>
    </View>
  )
}

/**
 * Bloque de plicómetro del editor de la visita. Controlado: recibe solo las
 * definiciones del bloque «pliegues», en su orden, y avisa de cada cambio.
 */
export function BloquePliegues({
  definiciones,
  campos,
  grasa,
  cambiarCampo,
  cambiarGrasa,
  bloqueado,
}: {
  definiciones: DefinicionCorporal[]
  campos: Record<string, CampoCorporal>
  grasa: CampoGrasa
  cambiarCampo: (id: string, cambio: Partial<CampoCorporal>) => void
  cambiarGrasa: (grasa: CampoGrasa) => void
  bloqueado: boolean
}): React.JSX.Element {
  return (
    <View style={s.bloque}>
      <View style={s.grupo}>
        <Titulo>Pliegues</Titulo>
        {definiciones.length === 0 ? (
          <Text style={s.tenue}>La plantilla de esta visita no tiene puntos de pliegues.</Text>
        ) : (
          <Tarjeta>
            {definiciones.map((d, n) => (
              <PuntoPliegue
                key={d.id}
                d={d}
                campo={campos[d.id] ?? CAMPO_CORPORAL_VACIO}
                cambiar={(cambio) => cambiarCampo(d.id, cambio)}
                bloqueado={bloqueado}
                primera={n === 0}
              />
            ))}
          </Tarjeta>
        )}
      </View>
      <GrasaPorPliegues grasa={grasa} cambiar={cambiarGrasa} bloqueado={bloqueado} />
    </View>
  )
}

const s = StyleSheet.create({
  bloque: { gap: 20 },
  grupo: { gap: 12 },
  punto: { flex: 1, minWidth: 0, gap: 4 },
  cabecera: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  textos: { flex: 1, minWidth: 0, gap: 4 },
  nombre: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 16 },
  subtitulo: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 16 },
  tenue: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 13, lineHeight: 18 },
  aviso: { color: tema.aviso, fontFamily: tema.fuenteTexto, fontSize: 13, lineHeight: 18 },
  lectura: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end", gap: 8 },
  campoLectura: { flexGrow: 1, flexBasis: 140, minWidth: 0 },
  acciones: { flexDirection: "row", gap: 8 },
  accion: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tema.bordeFuerte,
    alignItems: "center",
    justifyContent: "center",
  },
  marcada: { borderColor: tema.acento, backgroundColor: tema.acentoSuave },
  apagado: { opacity: 0.5 },
  textoAccion: { color: tema.textoSecundario, fontFamily: tema.fuenteSemi, fontSize: 14 },
  relleno: { paddingBottom: 16 },
})
