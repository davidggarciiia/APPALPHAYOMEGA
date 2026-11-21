import { useEffect, useRef, useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import type { Ejercicio, GrupoMuscular } from "@alpha-omega/shared"
import type { ApiDeCatalogo } from "../catalogo-ejercicios/api"
import { FiltroDeGrupo } from "../catalogo-ejercicios/filtro-de-grupo"
import { ETIQUETA_DE_GRUPO } from "../catalogo-ejercicios/grupos"
import { AvisoDeError, BotonSecundario, Campo } from "../componentes/formulario"
import { alto, tema } from "../tema"

/** Cuántos ejercicios se piden de una vez: el catálogo tiene más de mil. */
const POR_PAGINA = 30

type Lista = { clave: string; ejercicios: Ejercicio[]; total: number }

const claveDe = (buscar: string, grupo: GrupoMuscular | null): string =>
  JSON.stringify([buscar, grupo])

/**
 * Busca en el catálogo publicado por nombre y por grupo muscular, y va sumando
 * páginas con «Cargar más ejercicios».
 *
 * Sin `alTerminar`, cada pulsación avisa con `elegir` y el contenedor decide. Con
 * `alTerminar` se puede añadir uno tras otro sin cerrar: cada fila marca cuántas
 * veces se ha añadido y «Hecho» cierra.
 */
export function SelectorEjercicios({
  api,
  elegir,
  alTerminar,
}: {
  api: ApiDeCatalogo
  elegir: (ejercicio: Ejercicio) => void
  alTerminar?: () => void
}): React.JSX.Element {
  const [buscar, setBuscar] = useState("")
  const [grupo, setGrupo] = useState<GrupoMuscular | null>(null)
  const [lista, setLista] = useState<Lista | null>(null)
  const [cargando, setCargando] = useState(true)
  const [cargandoMas, setCargandoMas] = useState(false)
  const [error, setError] = useState(false)
  const [errorMas, setErrorMas] = useState(false)
  const [intento, setIntento] = useState(0)
  const [anadidos, setAnadidos] = useState<Record<string, number>>({})
  const [ultimo, setUltimo] = useState("")
  const claveActual = useRef(claveDe(buscar, grupo))
  claveActual.current = claveDe(buscar, grupo)

  useEffect(() => {
    let vigente = true
    const clave = claveDe(buscar, grupo)
    setCargando(true)
    setError(false)
    setErrorMas(false)
    const temporizador = setTimeout(() => {
      void api
        .buscar({
          buscar,
          ...(grupo !== null && { grupo }),
          estado: "publicado",
          limite: POR_PAGINA,
          desplazamiento: 0,
        })
        .then((datos) => {
          if (!vigente) return
          setLista({ clave, ejercicios: datos.ejercicios, total: datos.total })
          setCargandoMas(false)
        })
        .catch(() => {
          if (vigente) setError(true)
        })
        .finally(() => {
          if (vigente) setCargando(false)
        })
    }, 250)
    return () => {
      vigente = false
      clearTimeout(temporizador)
    }
  }, [api, buscar, grupo, intento])

  const cargarMas = (): void => {
    if (lista === null || cargandoMas || cargando) return
    const { clave } = lista
    setCargandoMas(true)
    setErrorMas(false)
    void api
      .buscar({
        buscar,
        ...(grupo !== null && { grupo }),
        estado: "publicado",
        limite: POR_PAGINA,
        desplazamiento: lista.ejercicios.length,
      })
      .then((datos) => {
        // Una respuesta de otra búsqueda no se mezcla con la lista actual.
        setLista((actual) => {
          if (actual === null || actual.clave !== clave) return actual
          const vistos = new Set(actual.ejercicios.map((e) => e.id))
          const nuevos = datos.ejercicios.filter((e) => !vistos.has(e.id))
          return {
            clave,
            ejercicios: [...actual.ejercicios, ...nuevos],
            // Sin ejercicios nuevos no se vuelve a pedir: evita un bucle si el total miente.
            total: nuevos.length === 0 ? actual.ejercicios.length : datos.total,
          }
        })
      })
      .catch(() => {
        if (claveActual.current === clave) setErrorMas(true)
      })
      .finally(() => {
        if (claveActual.current === clave) setCargandoMas(false)
      })
  }

  const total = Object.values(anadidos).reduce((suma, n) => suma + n, 0)
  const anadir = (ejercicio: Ejercicio): void => {
    elegir(ejercicio)
    setAnadidos((actual) => ({ ...actual, [ejercicio.id]: (actual[ejercicio.id] ?? 0) + 1 }))
    setUltimo(ejercicio.nombre)
  }

  return (
    <View>
      {alTerminar !== undefined && total > 0 && (
        <View style={s.barra}>
          <Text style={s.confirmacion} accessibilityLiveRegion="polite">
            {`«${ultimo}» añadido. ${total === 1 ? "1 ejercicio añadido" : `${String(total)} ejercicios añadidos`}.`}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Hecho"
            onPress={alTerminar}
            style={s.hecho}
          >
            <Text style={s.textoHecho}>Hecho</Text>
          </Pressable>
        </View>
      )}
      <Campo
        etiqueta="Buscar ejercicio para añadir"
        value={buscar}
        maxLength={120}
        onChangeText={(texto) => setBuscar(texto.slice(0, 120))}
      />
      <FiltroDeGrupo grupo={grupo} cambiar={setGrupo} />
      {error ? (
        <>
          <AvisoDeError mensaje="No se pudieron cargar los ejercicios." />
          <BotonSecundario texto="Reintentar" onPress={() => setIntento((n) => n + 1)} />
        </>
      ) : lista === null ? (
        <Text style={s.tenue}>Buscando ejercicios…</Text>
      ) : (
        <View style={s.filas}>
          {lista.ejercicios.length === 0 && (
            <Text style={s.tenue}>
              {grupo === null
                ? "No hay ejercicios publicados con esa búsqueda."
                : `No hay ejercicios publicados de ${ETIQUETA_DE_GRUPO[grupo].toLowerCase()} con esa búsqueda.`}
            </Text>
          )}
          {lista.ejercicios.map((e) => {
            const veces = anadidos[e.id] ?? 0
            return (
              <Pressable
                key={e.id}
                accessibilityRole="button"
                accessibilityLabel={`Añadir ${e.nombre}`}
                accessibilityHint={`Grupo: ${ETIQUETA_DE_GRUPO[e.grupoPrincipal]}`}
                accessibilityValue={veces > 0 ? { text: `Añadido ${String(veces)}` } : undefined}
                onPress={() => anadir(e)}
                style={({ pressed }) => [s.fila, veces > 0 && s.filaAnadida, pressed && s.pulsada]}
              >
                <View style={s.textos}>
                  <Text style={s.nombre}>{e.nombre}</Text>
                  <Text style={s.grupo}>{ETIQUETA_DE_GRUPO[e.grupoPrincipal]}</Text>
                </View>
                <Text style={[s.marca, veces > 0 && s.marcaAnadida]}>
                  {veces === 0 ? "+" : veces === 1 ? "✓ Añadido" : `✓ ×${String(veces)}`}
                </Text>
              </Pressable>
            )
          })}
          {lista.ejercicios.length < lista.total && (
            <>
              <Text style={s.tenue}>
                {`Mostrando ${String(lista.ejercicios.length)} de ${String(lista.total)}.`}
              </Text>
              {errorMas && <AvisoDeError mensaje="No se pudieron cargar más ejercicios." />}
              <BotonSecundario
                texto={errorMas ? "Reintentar cargar más" : "Cargar más ejercicios"}
                deshabilitado={cargando || cargandoMas}
                onPress={cargarMas}
              />
            </>
          )}
        </View>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  tenue: { fontFamily: tema.fuenteTexto, color: tema.textoTenue },
  barra: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 4,
  },
  confirmacion: { flex: 1, fontFamily: tema.fuenteSemi, color: tema.acento, fontSize: 14 },
  hecho: {
    minHeight: alto.tactil,
    minWidth: alto.tactil,
    paddingHorizontal: 16,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tema.acento,
  },
  textoHecho: { fontFamily: tema.fuenteBoton, color: tema.acento, fontSize: 14 },
  filas: { gap: 8, paddingTop: 8 },
  fila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tema.borde,
    backgroundColor: tema.superficie,
  },
  filaAnadida: { borderColor: tema.acento, backgroundColor: tema.acentoSuave },
  pulsada: { opacity: 0.7 },
  textos: { flex: 1, minWidth: 0 },
  nombre: { fontFamily: tema.fuenteBoton, color: tema.texto, fontSize: 15 },
  grupo: { fontFamily: tema.fuenteTexto, color: tema.textoTenue, fontSize: 12 },
  marca: { fontFamily: tema.fuenteSemi, color: tema.textoTenue, fontSize: 18 },
  marcaAnadida: { color: tema.acento, fontSize: 13 },
})
