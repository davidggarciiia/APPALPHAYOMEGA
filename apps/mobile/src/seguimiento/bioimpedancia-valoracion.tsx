import { Pressable, StyleSheet, Text, View } from "react-native"
import type { DefinicionCorporal, UnidadCorporal } from "@alpha-omega/shared"

import { Campo } from "../componentes/formulario"
import { Fila, Tarjeta, Titulo } from "../entrenamiento/plan/piezas"
import { tema } from "../tema"
import { CAMPO_CORPORAL_VACIO, type CampoCorporal } from "./valoracion-modelo"

type CambiarCampo = (id: string, cambio: Partial<CampoCorporal>) => void

/** Un índice del fabricante no es kg ni %: se rotula como lo que es. */
const unidadVisible = (unidad: UnidadCorporal): string =>
  unidad === "indice" ? "índice del fabricante" : unidad

type Grupo = { instrumento: string | null; definiciones: DefinicionCorporal[] }

/** Una báscula por grupo, en el orden en que aparece en la plantilla de la visita. */
function agrupar(definiciones: DefinicionCorporal[]): Grupo[] {
  const grupos: Grupo[] = []
  for (const d of definiciones) {
    const grupo = grupos.find((g) => g.instrumento === d.instrumento)
    if (grupo) grupo.definiciones.push(d)
    else grupos.push({ instrumento: d.instrumento, definiciones: [d] })
  }
  return grupos
}

function CampoBascula({
  definicion: d,
  campo,
  bascula,
  primera,
  cambiar,
  bloqueado,
}: {
  definicion: DefinicionCorporal
  campo: CampoCorporal
  /** Se añade a cada etiqueta accesible: el peso de báscula no es el de Medidas. */
  bascula: string
  primera: boolean
  cambiar: (cambio: Partial<CampoCorporal>) => void
  bloqueado: boolean
}): React.JSX.Element {
  const nombre = [d.nombre, d.zona, d.lateralidad].filter(Boolean).join(" · ")
  const etiqueta = `${nombre} (${unidadVisible(d.unidad)})`
  const contexto = `${nombre}, ${bascula}`
  const editable = !bloqueado && !campo.noRealizado
  return (
    <Fila primera={primera}>
      <View style={s.textos}>
        <Campo
          etiqueta={etiqueta}
          accessibilityLabel={`${etiqueta}, ${bascula}`}
          accessibilityState={{ disabled: !editable }}
          value={campo.noRealizado ? "" : campo.texto}
          placeholder={campo.noRealizado ? "No realizado" : "Sin dato"}
          editable={editable}
          keyboardType="decimal-pad"
          maxLength={8}
          onChangeText={(texto) => cambiar({ texto })}
        />
        {campo.noRealizado && (
          <Campo
            etiqueta="Motivo (opcional)"
            accessibilityLabel={`Motivo — ${contexto}`}
            accessibilityState={{ disabled: bloqueado }}
            value={campo.motivo}
            editable={!bloqueado}
            maxLength={200}
            onChangeText={(motivo) => cambiar({ motivo })}
          />
        )}
        {d.protocolo && <Text style={s.tenue}>{d.protocolo}</Text>}
      </View>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={`No realizado — ${contexto}`}
        accessibilityState={{ checked: campo.noRealizado, disabled: bloqueado }}
        disabled={bloqueado}
        onPress={() => cambiar({ noRealizado: !campo.noRealizado })}
        style={[s.marca, campo.noRealizado && s.marcaActiva, bloqueado && s.apagada]}
      >
        <Text style={s.textoMarca}>No realizado</Text>
      </Pressable>
    </Fila>
  )
}

/**
 * Bloque de báscula de una visita: los campos que el entrenador habilitó en la
 * plantilla, agrupados por modelo de báscula y con su unidad explícita. Solo
 * recoge lo que marca la báscula; no calcula ni mezcla datos de otros métodos.
 */
export function BloqueBioimpedancia({
  definiciones,
  campos,
  cambiarCampo,
  bloqueado,
}: {
  definiciones: DefinicionCorporal[]
  campos: Record<string, CampoCorporal>
  cambiarCampo: CambiarCampo
  bloqueado: boolean
}): React.JSX.Element {
  return (
    <View style={s.bloque}>
      <Titulo>Bioimpedancia</Titulo>
      {definiciones.length === 0 ? (
        <Text style={s.tenue}>La plantilla de esta visita no tiene campos de bioimpedancia.</Text>
      ) : (
        <>
          <Text style={s.tenue}>Copia los valores tal como los muestra la báscula.</Text>
          {agrupar(definiciones).map((grupo) => (
            <View key={grupo.instrumento ?? ""} style={s.grupo}>
              <Text style={s.bascula} accessibilityRole="header">
                {grupo.instrumento ?? "Báscula sin identificar"}
              </Text>
              {grupo.instrumento === null && (
                <Text style={s.tenue}>
                  Indica el modelo en la plantilla para poder comparar visitas.
                </Text>
              )}
              <Tarjeta>
                {grupo.definiciones.map((d, n) => (
                  <CampoBascula
                    key={d.id}
                    definicion={d}
                    campo={campos[d.id] ?? CAMPO_CORPORAL_VACIO}
                    bascula={grupo.instrumento ?? "báscula sin identificar"}
                    primera={n === 0}
                    cambiar={(cambio) => cambiarCampo(d.id, cambio)}
                    bloqueado={bloqueado}
                  />
                ))}
              </Tarjeta>
            </View>
          ))}
        </>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  bloque: { gap: 12 },
  grupo: { gap: 8 },
  textos: { flex: 1, gap: 4 },
  bascula: { color: tema.acento, fontFamily: tema.fuenteSemi, fontSize: 15 },
  tenue: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 13, lineHeight: 18 },
  marca: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tema.bordeFuerte,
    justifyContent: "center",
  },
  marcaActiva: { borderColor: tema.acento, backgroundColor: tema.acentoSuave },
  apagada: { opacity: 0.5 },
  textoMarca: { color: tema.textoSecundario, fontFamily: tema.fuenteTexto, fontSize: 13 },
})
