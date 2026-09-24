import { useState } from "react"
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native"
import { MAX_ALTERNATIVAS_POR_COMIDA } from "@alpha-omega/shared"
import { Campo } from "../componentes/formulario"
import { degradadoOro, tema } from "../tema"
import {
  copiarAlternativa,
  nuevaAlternativa,
  nuevaColumna,
  nuevoAlimento,
  nuevoGrupo,
  type AlimentoEditable,
  type AlternativaEditable,
  type ComidaEditable,
  type GeneradorDeIds,
  type MacrosEditables,
} from "./editor-modelo"

/** Acción secundaria compacta para editores largos: 44 px de alto y texto visible. */
export function Accion({
  texto,
  etiqueta = texto,
  onPress,
  deshabilitado = false,
}: {
  texto: string
  etiqueta?: string
  onPress: () => void
  deshabilitado?: boolean
}): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      accessibilityState={{ disabled: deshabilitado }}
      disabled={deshabilitado}
      onPress={onPress}
      style={({ pressed }) => [s.accion, (pressed || deshabilitado) && s.apagada]}
    >
      <Text style={s.textoAccion}>{texto}</Text>
    </Pressable>
  )
}

export function CamposMacros({
  valor,
  cambiar,
  prefijo,
}: {
  valor: MacrosEditables
  cambiar: (valor: MacrosEditables) => void
  prefijo: string
}): React.JSX.Element {
  const campos = [
    ["kcal", "Kcal"],
    ["proteinaG", "Proteína (g)"],
    ["hidratosG", "Hidratos (g)"],
    ["grasaG", "Grasas (g)"],
  ] as const
  return (
    <View style={s.fila}>
      {campos.map(([clave, etiqueta]) => (
        <View key={clave} style={s.celda}>
          <Campo
            etiqueta={etiqueta}
            accessibilityLabel={`${etiqueta} — ${prefijo}`}
            value={valor[clave]}
            onChangeText={(texto) => cambiar({ ...valor, [clave]: texto })}
            keyboardType="number-pad"
            maxLength={6}
            placeholder="—"
          />
        </View>
      ))}
    </View>
  )
}

function Alimentos({
  lista,
  cambiar,
  ids,
  prefijo,
  maximo,
}: {
  lista: AlimentoEditable[]
  cambiar: (lista: AlimentoEditable[]) => void
  ids: GeneradorDeIds
  prefijo: string
  maximo: number
}): React.JSX.Element {
  const editar = (clave: string, cambio: Partial<AlimentoEditable>): void =>
    cambiar(lista.map((a) => (a.clave === clave ? { ...a, ...cambio } : a)))
  return (
    <View style={s.alimentos}>
      {lista.map((a, n) => (
        <View key={a.clave} style={s.alimento}>
          <TextInput
            style={[s.entrada, s.nombreAlimento]}
            accessibilityLabel={`Alimento ${n + 1} — ${prefijo}`}
            placeholder="Alimento"
            placeholderTextColor={tema.textoTenue}
            value={a.nombre}
            maxLength={80}
            onChangeText={(nombre) => editar(a.clave, { nombre })}
          />
          <TextInput
            style={[s.entrada, s.cantidad]}
            accessibilityLabel={`Cantidad ${n + 1} — ${prefijo}`}
            placeholder="Cantidad"
            placeholderTextColor={tema.textoTenue}
            value={a.cantidad}
            maxLength={40}
            onChangeText={(cantidad) => editar(a.clave, { cantidad })}
          />
          <Accion
            texto="✕"
            etiqueta={`Quitar alimento ${n + 1} — ${prefijo}`}
            deshabilitado={lista.length === 1}
            onPress={() => cambiar(lista.filter((x) => x.clave !== a.clave))}
          />
        </View>
      ))}
      <Accion
        texto="+ Alimento"
        etiqueta={`Añadir alimento — ${prefijo}`}
        deshabilitado={lista.length >= maximo}
        onPress={() => cambiar([...lista, nuevoAlimento(ids)])}
      />
    </View>
  )
}

function Alternativa({
  valor,
  cambiar,
  quitar,
  duplicar,
  ids,
  puedeCrecer,
}: {
  valor: AlternativaEditable
  cambiar: (valor: AlternativaEditable) => void
  quitar: (() => void) | null
  duplicar: () => void
  ids: GeneradorDeIds
  puedeCrecer: boolean
}): React.JSX.Element {
  const [conMacros, setConMacros] = useState(Object.values(valor.macros).some((v) => v !== ""))
  const nombre = valor.titulo || "alternativa sin título"
  return (
    <View style={s.alternativa}>
      <Campo
        etiqueta="Título de la alternativa"
        value={valor.titulo}
        maxLength={80}
        onChangeText={(titulo) => cambiar({ ...valor, titulo })}
        placeholder="Tostadas con fruta"
      />
      <Alimentos
        lista={valor.alimentos}
        cambiar={(alimentos) => cambiar({ ...valor, alimentos })}
        ids={ids}
        prefijo={nombre}
        maximo={20}
      />
      <Campo
        etiqueta="Nota (opcional)"
        accessibilityLabel={`Nota — ${nombre}`}
        value={valor.nota}
        maxLength={300}
        onChangeText={(nota) => cambiar({ ...valor, nota })}
      />
      {conMacros ? (
        <CamposMacros
          valor={valor.macros}
          prefijo={nombre}
          cambiar={(macros) => cambiar({ ...valor, macros })}
        />
      ) : (
        <Accion
          texto="+ Kcal y macros"
          etiqueta={`Añadir kcal y macros — ${nombre}`}
          onPress={() => setConMacros(true)}
        />
      )}
      <View style={s.acciones}>
        <Accion
          texto="Duplicar"
          etiqueta={`Duplicar ${nombre}`}
          deshabilitado={!puedeCrecer}
          onPress={duplicar}
        />
        {quitar && <Accion texto="Quitar" etiqueta={`Quitar ${nombre}`} onPress={quitar} />}
      </View>
    </View>
  )
}

/** Una comida del editor, plegable para que una dieta larga siga siendo manejable. */
export function EditorComida({
  valor,
  cambiar,
  quitar,
  duplicar,
  subir,
  ids,
}: {
  valor: ComidaEditable
  cambiar: (valor: ComidaEditable) => void
  quitar: () => void
  duplicar: (() => void) | null
  subir: (() => void) | null
  ids: GeneradorDeIds
}): React.JSX.Element {
  const [abierta, setAbierta] = useState(valor.nombre === "")
  const nombre = valor.nombre || "Comida sin nombre"
  const total = valor.grupos.reduce((suma, g) => suma + g.alternativas.length, 0)
  const puedeCrecer = total < MAX_ALTERNATIVAS_POR_COMIDA
  return (
    <View style={s.comida}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: abierta }}
        accessibilityLabel={`${nombre}, ${abierta ? "plegar" : "desplegar"}`}
        onPress={() => setAbierta(!abierta)}
        style={s.cabecera}
      >
        <Text style={s.titulo}>{nombre}</Text>
        <Text style={s.resumen}>
          {valor.forma === "alternativas"
            ? `${total} alternativas`
            : `${valor.columnas.length} columnas`}
          {valor.hora ? ` · ${valor.hora}` : ""} {abierta ? "▴" : "▾"}
        </Text>
      </Pressable>
      {abierta && (
        <View style={s.cuerpo}>
          <View style={s.fila}>
            <View style={[s.celda, s.ancha]}>
              <Campo
                etiqueta="Nombre de la comida"
                value={valor.nombre}
                maxLength={40}
                onChangeText={(texto) => cambiar({ ...valor, nombre: texto })}
                placeholder="Desayuno"
              />
            </View>
            <View style={s.celda}>
              <Campo
                etiqueta="Hora (opcional)"
                accessibilityLabel={`Hora — ${nombre}`}
                value={valor.hora}
                maxLength={5}
                onChangeText={(hora) => cambiar({ ...valor, hora })}
                placeholder="08:30"
              />
            </View>
          </View>
          <Campo
            etiqueta="Indicación (opcional)"
            accessibilityLabel={`Indicación — ${nombre}`}
            value={valor.indicacion}
            maxLength={500}
            multiline
            onChangeText={(indicacion) => cambiar({ ...valor, indicacion })}
            placeholder="Elige una de estas alternativas."
          />
          <View style={s.formas} accessibilityRole="radiogroup">
            {(["alternativas", "intercambio"] as const).map((forma) => (
              <Pressable
                key={forma}
                accessibilityRole="radio"
                accessibilityState={{ checked: valor.forma === forma }}
                onPress={() => cambiar({ ...valor, forma })}
                style={[s.forma, valor.forma === forma && s.formaActiva]}
              >
                <Text style={[s.textoForma, valor.forma === forma && s.textoFormaActiva]}>
                  {forma === "alternativas" ? "Alternativas" : "Tabla de intercambio"}
                </Text>
              </Pressable>
            ))}
          </View>
          {valor.forma === "alternativas" ? (
            <>
              {valor.grupos.map((grupo, g) => (
                <View key={grupo.clave} style={s.grupo}>
                  <Campo
                    etiqueta="Grupo (opcional)"
                    accessibilityLabel={`Nombre del grupo ${g + 1} — ${nombre}`}
                    value={grupo.nombre}
                    maxLength={40}
                    placeholder="Opciones dulces"
                    onChangeText={(texto) =>
                      cambiar({
                        ...valor,
                        grupos: valor.grupos.map((x) =>
                          x.clave === grupo.clave ? { ...x, nombre: texto } : x,
                        ),
                      })
                    }
                  />
                  {grupo.alternativas.map((alternativa, n) => {
                    const cambiarGrupo = (alternativas: AlternativaEditable[]): void =>
                      cambiar({
                        ...valor,
                        grupos: valor.grupos
                          .map((x) => (x.clave === grupo.clave ? { ...x, alternativas } : x))
                          .filter((x) => x.alternativas.length > 0),
                      })
                    return (
                      <Alternativa
                        key={alternativa.id}
                        valor={alternativa}
                        ids={ids}
                        puedeCrecer={puedeCrecer}
                        cambiar={(nueva) =>
                          cambiarGrupo(
                            grupo.alternativas.map((a) => (a.id === nueva.id ? nueva : a)),
                          )
                        }
                        duplicar={() =>
                          cambiarGrupo([
                            ...grupo.alternativas.slice(0, n + 1),
                            copiarAlternativa(alternativa, ids),
                            ...grupo.alternativas.slice(n + 1),
                          ])
                        }
                        quitar={
                          total > 1
                            ? () =>
                                cambiarGrupo(
                                  grupo.alternativas.filter((a) => a.id !== alternativa.id),
                                )
                            : null
                        }
                      />
                    )
                  })}
                  <Accion
                    texto="+ Alternativa en este grupo"
                    deshabilitado={!puedeCrecer}
                    onPress={() =>
                      cambiar({
                        ...valor,
                        grupos: valor.grupos.map((x) =>
                          x.clave === grupo.clave
                            ? { ...x, alternativas: [...x.alternativas, nuevaAlternativa(ids)] }
                            : x,
                        ),
                      })
                    }
                  />
                </View>
              ))}
              <Accion
                texto="+ Grupo de alternativas"
                deshabilitado={valor.grupos.length >= 6 || !puedeCrecer}
                onPress={() => cambiar({ ...valor, grupos: [...valor.grupos, nuevoGrupo(ids)] })}
              />
            </>
          ) : (
            <>
              {valor.columnas.map((columna, c) => (
                <View key={columna.clave} style={s.grupo}>
                  <Campo
                    etiqueta="Columna"
                    accessibilityLabel={`Nombre de la columna ${c + 1} — ${nombre}`}
                    value={columna.nombre}
                    maxLength={40}
                    onChangeText={(texto) =>
                      cambiar({
                        ...valor,
                        columnas: valor.columnas.map((x) =>
                          x.clave === columna.clave ? { ...x, nombre: texto } : x,
                        ),
                      })
                    }
                  />
                  <Alimentos
                    lista={columna.alimentos}
                    ids={ids}
                    prefijo={columna.nombre || `columna ${c + 1}`}
                    maximo={40}
                    cambiar={(alimentos) =>
                      cambiar({
                        ...valor,
                        columnas: valor.columnas.map((x) =>
                          x.clave === columna.clave ? { ...x, alimentos } : x,
                        ),
                      })
                    }
                  />
                  <Accion
                    texto="Quitar columna"
                    etiqueta={`Quitar columna ${columna.nombre || c + 1}`}
                    deshabilitado={valor.columnas.length === 1}
                    onPress={() =>
                      cambiar({
                        ...valor,
                        columnas: valor.columnas.filter((x) => x.clave !== columna.clave),
                      })
                    }
                  />
                </View>
              ))}
              <Accion
                texto="+ Columna"
                deshabilitado={valor.columnas.length >= 6}
                onPress={() =>
                  cambiar({ ...valor, columnas: [...valor.columnas, nuevaColumna(ids)] })
                }
              />
            </>
          )}
          <View style={s.acciones}>
            {subir && <Accion texto="↑ Subir" etiqueta={`Subir ${nombre}`} onPress={subir} />}
            {duplicar && (
              <Accion texto="Duplicar comida" etiqueta={`Duplicar ${nombre}`} onPress={duplicar} />
            )}
            <Accion texto="Quitar comida" etiqueta={`Quitar ${nombre}`} onPress={quitar} />
          </View>
        </View>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  accion: { minHeight: 44, justifyContent: "center", paddingHorizontal: 10 },
  apagada: { opacity: 0.4 },
  textoAccion: { color: tema.acento, fontFamily: tema.fuenteBoton, fontSize: 14 },
  fila: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  celda: { flexGrow: 1, flexBasis: 120 },
  ancha: { flexBasis: 200 },
  alimentos: { gap: 6, marginTop: 8 },
  alimento: { flexDirection: "row", alignItems: "center", gap: 6 },
  entrada: {
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: tema.suave,
    borderColor: tema.borde,
    borderWidth: 1,
    color: tema.texto,
    fontFamily: tema.fuenteTexto,
    fontSize: 15,
    paddingHorizontal: 10,
  },
  nombreAlimento: { flex: 2, minWidth: 0 },
  cantidad: { flex: 1, minWidth: 0 },
  alternativa: {
    backgroundColor: tema.superficie,
    borderColor: tema.borde,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  acciones: { flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end" },
  comida: {
    borderColor: tema.borde,
    borderWidth: 1,
    borderRadius: 16,
    backgroundColor: tema.suave,
  },
  cabecera: { minHeight: 52, paddingHorizontal: 14, paddingVertical: 10, gap: 2 },
  titulo: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 17 },
  resumen: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 13 },
  cuerpo: { paddingHorizontal: 12, paddingBottom: 12, gap: 10 },
  formas: { flexDirection: "row", gap: 6, marginTop: 8 },
  forma: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderColor: tema.bordeFuerte,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  formaActiva: { ...degradadoOro, borderColor: "transparent" },
  textoForma: {
    color: tema.textoSecundario,
    fontFamily: tema.fuenteBoton,
    fontSize: 13,
    textAlign: "center",
  },
  textoFormaActiva: { color: tema.sobreAcento },
  grupo: { gap: 8, borderLeftColor: tema.acentoClaro, borderLeftWidth: 3, paddingLeft: 10 },
})
