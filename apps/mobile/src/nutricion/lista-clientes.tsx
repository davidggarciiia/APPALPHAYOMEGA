import { useState } from "react"
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native"
import type { ResumenUsuario } from "@alpha-omega/shared"

import { Campo } from "../componentes/formulario"
import { InsigniaDeEstado } from "../componentes/insignia-estado"
import { tema } from "../tema"

/** Con pocos clientes la búsqueda estorba más que ayuda. */
const MINIMO_PARA_BUSCAR = 6

/** Minúsculas y sin tildes, para que «Maria» encuentre a «María». */
function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
}

export function nombreCompleto(cliente: ResumenUsuario): string {
  return [cliente.nombre, cliente.apellidos].filter(Boolean).join(" ")
}

/** Los clientes que contienen el texto buscado en su nombre, apellidos o correo. */
export function filtrarClientes(clientes: ResumenUsuario[], busqueda: string): ResumenUsuario[] {
  const buscado = normalizar(busqueda.trim())
  if (buscado === "") return clientes
  return clientes.filter((cliente) =>
    normalizar(`${nombreCompleto(cliente)} ${cliente.email}`).includes(buscado),
  )
}

/** Los clientes asignados al nutricionista, con búsqueda en el dispositivo. */
export function ListaClientes({
  clientes,
  abrir,
}: {
  clientes: ResumenUsuario[]
  abrir: (cliente: ResumenUsuario) => void
}): React.JSX.Element {
  const [busqueda, setBusqueda] = useState("")
  const visibles = filtrarClientes(clientes, busqueda)
  const buscando = busqueda.trim() !== ""
  return (
    <View style={estilos.contenedor}>
      {clientes.length >= MINIMO_PARA_BUSCAR && (
        <View style={estilos.busqueda}>
          <Campo
            etiqueta="Buscar cliente"
            soloPlaceholder
            value={busqueda}
            onChangeText={setBusqueda}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {buscando && (
            <Text style={estilos.cuenta} accessibilityLiveRegion="polite">
              {visibles.length} de {clientes.length}
            </Text>
          )}
        </View>
      )}
      <FlatList
        data={visibles}
        keyExtractor={(cliente) => cliente.id}
        contentContainerStyle={estilos.lista}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => {
          const nombre = nombreCompleto(item)
          return (
            <Pressable
              style={({ pressed }) => [estilos.fila, pressed && estilos.filaPulsada]}
              accessibilityRole="button"
              accessibilityLabel={`${nombre}. ${item.email}`}
              accessibilityHint="Abre su dieta"
              onPress={() => abrir(item)}
            >
              <View style={estilos.datos}>
                <Text style={estilos.nombre} numberOfLines={1}>
                  {nombre}
                </Text>
                <Text style={estilos.correo} numberOfLines={1}>
                  {item.email}
                </Text>
              </View>
              <InsigniaDeEstado estado={item.estado} />
            </Pressable>
          )
        }}
        ListEmptyComponent={
          <Text style={estilos.vacio}>
            {buscando
              ? "Ningún cliente coincide con lo que buscas."
              : "El entrenador todavía no te ha asignado ningún cliente. Cuando lo haga aparecerán aquí."}
          </Text>
        }
      />
    </View>
  )
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1 },
  busqueda: { paddingHorizontal: 20, paddingTop: 12, gap: 6 },
  cuenta: { fontFamily: tema.fuenteTexto, color: tema.textoTenue, fontSize: 13 },
  lista: { padding: 20, gap: 10 },
  fila: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 64,
    backgroundColor: tema.superficie,
    borderColor: tema.borde,
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    gap: 12,
  },
  filaPulsada: { borderColor: tema.acento },
  datos: { flex: 1, gap: 3 },
  nombre: { fontFamily: tema.fuenteTexto, color: tema.texto, fontSize: 16 },
  correo: { fontFamily: tema.fuenteTexto, color: tema.textoTenue, fontSize: 13 },
  vacio: {
    fontFamily: tema.fuenteTexto,
    color: tema.textoTenue,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginTop: 40,
  },
})
