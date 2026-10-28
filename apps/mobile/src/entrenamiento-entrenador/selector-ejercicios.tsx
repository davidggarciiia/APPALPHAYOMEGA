import { useEffect, useState } from "react"
import { Text, View } from "react-native"
import type { Ejercicio, ListadoEjercicios } from "@alpha-omega/shared"
import type { ApiDeCatalogo } from "../catalogo-ejercicios/api"
import { AvisoDeError, BotonSecundario, Campo } from "../componentes/formulario"
import { tema } from "../tema"

export function SelectorEjercicios({
  api,
  elegir,
}: {
  api: ApiDeCatalogo
  elegir: (ejercicio: Ejercicio) => void
}): React.JSX.Element {
  const [buscar, setBuscar] = useState("")
  const [pagina, setPagina] = useState(0)
  const [resultado, setResultado] = useState<ListadoEjercicios | null>(null)
  const [error, setError] = useState(false)
  const [intento, setIntento] = useState(0)
  useEffect(() => {
    let vigente = true
    setResultado(null)
    setError(false)
    const temporizador = setTimeout(() => {
      void api
        .buscar({ buscar, estado: "publicado", limite: 10, desplazamiento: pagina * 10 })
        .then((datos) => {
          if (vigente) setResultado(datos)
        })
        .catch(() => {
          if (vigente) setError(true)
        })
    }, 250)
    return () => {
      vigente = false
      clearTimeout(temporizador)
    }
  }, [api, buscar, pagina, intento])
  return (
    <View>
      <Campo
        etiqueta="Buscar ejercicio para añadir"
        value={buscar}
        maxLength={120}
        onChangeText={(texto) => {
          setBuscar(texto.slice(0, 120))
          setPagina(0)
        }}
      />
      {error ? (
        <>
          <AvisoDeError mensaje="No se pudo cargar el catálogo." />
          <BotonSecundario texto="Reintentar catálogo" onPress={() => setIntento((n) => n + 1)} />
        </>
      ) : resultado === null ? (
        <Text style={{ fontFamily: tema.fuenteTexto, color: tema.textoTenue }}>
          Buscando ejercicios…
        </Text>
      ) : (
        <>
          {resultado.ejercicios.length === 0 && (
            <Text style={{ fontFamily: tema.fuenteTexto, color: tema.textoTenue }}>
              No hay ejercicios publicados con esa búsqueda.
            </Text>
          )}
          {resultado.ejercicios.map((e) => (
            <BotonSecundario key={e.id} texto={`Añadir ${e.nombre}`} onPress={() => elegir(e)} />
          ))}
          {pagina > 0 && (
            <BotonSecundario
              texto="Ejercicios anteriores"
              onPress={() => setPagina((n) => n - 1)}
            />
          )}
          {(pagina + 1) * 10 < resultado.total && (
            <BotonSecundario texto="Más ejercicios" onPress={() => setPagina((n) => n + 1)} />
          )}
        </>
      )}
    </View>
  )
}
