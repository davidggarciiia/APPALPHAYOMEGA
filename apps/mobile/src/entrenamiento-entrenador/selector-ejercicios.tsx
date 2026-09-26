import { useEffect, useState, type ReactNode } from "react"
import { ActivityIndicator, StyleSheet, Text, View } from "react-native"
import type { Ejercicio } from "@alpha-omega/shared"

import { buscarEjercicios } from "../catalogo-ejercicios/api"
import { CampoDeTexto, EnlaceOro, FilaDeLista, Lista, texto } from "../componentes/diseno"
import { faltaDe } from "../lib/errores"
import { tema } from "../tema"

/** Espera tras la última tecla antes de preguntar al servidor. */
const PAUSA_DE_BUSQUEDA_MS = 300

/**
 * Buscar en el catálogo y elegir un ejercicio sin salir del editor. Solo salen
 * los publicados: lo retirado no se prescribe en planes nuevos.
 *
 * `crear` es el hueco para dar de alta uno que no existe, también sin salir.
 */
export function SelectorDeEjercicios({
  alElegir,
  alCerrar,
  crear,
}: {
  alElegir: (ejercicio: Ejercicio) => void
  alCerrar: () => void
  crear?: (busqueda: string) => ReactNode
}): React.JSX.Element {
  const [busqueda, setBusqueda] = useState("")
  const [resultado, setResultado] = useState<
    | { fase: "cargando" }
    | { fase: "lista"; ejercicios: Ejercicio[]; total: number }
    | { fase: "error"; texto: string }
  >({ fase: "cargando" })

  useEffect(() => {
    let vigente = true
    const temporizador = setTimeout(() => {
      buscarEjercicios({ buscar: busqueda, estado: "publicado", limite: 20 })
        .then((listado) => {
          if (vigente) {
            setResultado({ fase: "lista", ejercicios: listado.ejercicios, total: listado.total })
          }
        })
        .catch((error: unknown) => {
          if (vigente) {
            setResultado({
              fase: "error",
              texto: faltaDe(error, "No hemos podido buscar en el catálogo.").texto,
            })
          }
        })
    }, PAUSA_DE_BUSQUEDA_MS)
    return () => {
      vigente = false
      clearTimeout(temporizador)
    }
  }, [busqueda])

  return (
    <View style={estilos.contenedor}>
      <CampoDeTexto
        etiqueta="Buscar en el catálogo"
        value={busqueda}
        onChangeText={setBusqueda}
        placeholder="Press, sentadilla, remo…"
        autoFocus
        autoCorrect={false}
        returnKeyType="search"
      />
      {resultado.fase === "cargando" && <ActivityIndicator color={tema.oro} />}
      {resultado.fase === "error" && <Text style={texto.cuerpo}>{resultado.texto}</Text>}
      {resultado.fase === "lista" &&
        (resultado.ejercicios.length === 0 ? (
          <Text style={texto.tenueMedio}>No hay ningún ejercicio publicado con ese nombre.</Text>
        ) : (
          <Lista destacada={false}>
            {resultado.ejercicios.map((ejercicio, indice) => (
              <FilaDeLista
                key={ejercicio.id}
                titulo={ejercicio.nombre}
                subtitulo={ejercicio.grupoPrincipal}
                ultima={indice === resultado.ejercicios.length - 1}
                onPress={() => alElegir(ejercicio)}
                accessibilityLabel={`Añadir ${ejercicio.nombre}`}
                derecha={<Text style={texto.oro}>Añadir</Text>}
              />
            ))}
          </Lista>
        ))}
      {resultado.fase === "lista" && resultado.total > resultado.ejercicios.length && (
        <Text style={texto.tenue}>
          {`Hay ${String(resultado.total)}: escribe más para afinar la búsqueda.`}
        </Text>
      )}
      {crear?.(busqueda)}
      <EnlaceOro texto="Cerrar la búsqueda" onPress={alCerrar} />
    </View>
  )
}

const estilos = StyleSheet.create({
  contenedor: { gap: 12 },
})
