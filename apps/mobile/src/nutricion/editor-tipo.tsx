import { StyleSheet, Text, View } from "react-native"
import { Campo } from "../componentes/formulario"
import { tema } from "../tema"
import { Accion, CamposMacros, EditorComida } from "./editor-comida"
import {
  copiarComida,
  mover,
  nuevaComida,
  type GeneradorDeIds,
  type TipoEditable,
} from "./editor-modelo"

/** Un tipo de día: su nombre, su objetivo opcional y sus comidas. */
export function EditorTipo({
  valor,
  cambiar,
  duplicar,
  quitar,
  ids,
}: {
  valor: TipoEditable
  cambiar: (valor: TipoEditable) => void
  duplicar: (() => void) | null
  quitar: (() => void) | null
  ids: GeneradorDeIds
}): React.JSX.Element {
  const nombre = valor.nombre || "Tipo de día sin nombre"
  return (
    <View style={s.tipo}>
      <Text style={s.titulo} accessibilityRole="header">
        {nombre}
      </Text>
      <Campo
        etiqueta="Nombre del tipo de día"
        value={valor.nombre}
        maxLength={40}
        onChangeText={(texto) => cambiar({ ...valor, nombre: texto })}
        placeholder="Entreno"
      />
      <Text style={s.leyenda}>Objetivo del día (opcional)</Text>
      <CamposMacros
        valor={valor.objetivo}
        prefijo={`objetivo de ${nombre}`}
        cambiar={(objetivo) => cambiar({ ...valor, objetivo })}
      />
      <Text style={s.leyenda}>Comidas</Text>
      {valor.comidas.length === 0 && (
        <Text style={s.ayuda}>
          Sin comidas, el cliente verá solo el objetivo. Sirve para quien no tiene dieta contratada.
        </Text>
      )}
      {valor.comidas.map((comida, n) => (
        <EditorComida
          key={comida.id}
          valor={comida}
          ids={ids}
          cambiar={(nueva) =>
            cambiar({
              ...valor,
              comidas: valor.comidas.map((c) => (c.id === nueva.id ? nueva : c)),
            })
          }
          quitar={() =>
            cambiar({ ...valor, comidas: valor.comidas.filter((c) => c.id !== comida.id) })
          }
          duplicar={
            valor.comidas.length < 10
              ? () =>
                  cambiar({
                    ...valor,
                    comidas: [
                      ...valor.comidas.slice(0, n + 1),
                      copiarComida(comida, ids),
                      ...valor.comidas.slice(n + 1),
                    ],
                  })
              : null
          }
          subir={n > 0 ? () => cambiar({ ...valor, comidas: mover(valor.comidas, n, -1) }) : null}
        />
      ))}
      <View style={s.acciones}>
        <Accion
          texto="+ Comida con alternativas"
          deshabilitado={valor.comidas.length >= 10}
          onPress={() =>
            cambiar({ ...valor, comidas: [...valor.comidas, nuevaComida(ids, "alternativas")] })
          }
        />
        <Accion
          texto="+ Comida con tabla de intercambio"
          deshabilitado={valor.comidas.length >= 10}
          onPress={() =>
            cambiar({ ...valor, comidas: [...valor.comidas, nuevaComida(ids, "intercambio")] })
          }
        />
      </View>
      <View style={s.acciones}>
        {duplicar && (
          <Accion texto="Duplicar tipo de día" etiqueta={`Duplicar ${nombre}`} onPress={duplicar} />
        )}
        {quitar && (
          <Accion texto="Quitar tipo de día" etiqueta={`Quitar ${nombre}`} onPress={quitar} />
        )}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  tipo: {
    backgroundColor: tema.superficie,
    borderColor: tema.borde,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    gap: 8,
  },
  titulo: {
    color: tema.texto,
    fontFamily: tema.fuenteTitulo,
    fontSize: 26,
    textTransform: "uppercase",
  },
  leyenda: {
    color: tema.acento,
    fontFamily: tema.fuenteBoton,
    fontSize: 12,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    marginTop: 10,
  },
  ayuda: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 13 },
  acciones: { flexDirection: "row", flexWrap: "wrap" },
})
