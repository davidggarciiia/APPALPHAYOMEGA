import { useCallback, useRef, useState } from "react"
import { useFocusEffect } from "expo-router"
import { Pressable, StyleSheet, Text, View } from "react-native"
import type { NovedadEntrenamiento } from "@alpha-omega/shared"
import type { ApiEntrenamiento } from "./api"
import { tema } from "../tema"

function descripcion(novedad: NovedadEntrenamiento): string {
  const sesion = novedad.sesionNombre
  switch (novedad.tipo) {
    case "entrenamiento_enviado":
      return `${novedad.autor.nombre} envió ${sesion}`
    case "sesion_revisada":
      return `${novedad.autor.nombre} revisó ${sesion}`
    case "comentario":
      return `${novedad.autor.nombre} comentó ${sesion}`
    case "molestia":
      return `${novedad.autor.nombre} comunicó una molestia en ${sesion}`
    case "molestia_atendida":
      return `${novedad.autor.nombre} respondió a una molestia en ${sesion}`
    case "fecha_cambiada":
      return `${novedad.autor.nombre} cambió el día de ${sesion}`
  }
}

/** Lectura por usuario: abrir una novedad confirma únicamente esa lectura. */
export function NovedadesEntrenamiento({
  clienteId,
  api,
  abrir,
}: {
  clienteId: string
  api: ApiEntrenamiento
  abrir: (sesionId: string) => void
}): React.JSX.Element | null {
  const [novedades, setNovedades] = useState<NovedadEntrenamiento[]>([])
  const [total, setTotal] = useState(0)
  const [sinLeer, setSinLeer] = useState(0)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState("")
  const consulta = useRef(0)
  useFocusEffect(
    useCallback(() => {
      let vigente = true
      consulta.current += 1
      setNovedades([])
      setTotal(0)
      setCargando(false)
      void api
        .novedades(clienteId, 0)
        .then((lista) => {
          if (!vigente) return
          setNovedades(lista.novedades)
          setTotal(lista.total)
          setSinLeer(lista.sinLeer)
          setError("")
        })
        .catch(() => {
          if (vigente) setError("No se pudieron actualizar las novedades.")
        })
      return () => {
        vigente = false
        consulta.current += 1
      }
    }, [api, clienteId]),
  )

  const cargarMas = async (): Promise<void> => {
    if (cargando || novedades.length >= total) return
    const vigente = consulta.current
    setCargando(true)
    setError("")
    try {
      const pagina = await api.novedades(clienteId, novedades.length)
      if (vigente !== consulta.current) return
      setNovedades((actual) => [...actual, ...pagina.novedades])
      setTotal(pagina.total)
      setSinLeer(pagina.sinLeer)
    } catch {
      if (vigente === consulta.current)
        setError("No se pudieron cargar más novedades. Puedes reintentarlo.")
    } finally {
      if (vigente === consulta.current) setCargando(false)
    }
  }

  if (novedades.length === 0 && !error) return null
  return (
    <View style={s.contenedor}>
      <Text style={s.titulo} accessibilityRole="header">
        Novedades{sinLeer > 0 ? ` · ${sinLeer} sin leer` : ""}
      </Text>
      {error !== "" && <Text style={s.error}>{error}</Text>}
      {novedades.map((novedad) => (
        <Pressable
          key={novedad.id}
          accessibilityRole="button"
          accessibilityLabel={`${descripcion(novedad)}${novedad.leidaEn ? "" : ", sin leer"}`}
          style={[s.fila, !novedad.leidaEn && s.nueva]}
          onPress={() => {
            void (async () => {
              if (!novedad.leidaEn) {
                try {
                  await api.leerNovedades(novedad.sesionId, { novedadIds: [novedad.id] })
                  setNovedades((actual) =>
                    actual.map((item) =>
                      item.id === novedad.id
                        ? { ...item, leidaEn: new Date().toISOString() }
                        : item,
                    ),
                  )
                  setSinLeer((total) => Math.max(0, total - 1))
                } catch {
                  setError("No se pudo guardar la lectura. Podrás reintentarlo después.")
                }
              }
              abrir(novedad.sesionId)
            })()
          }}
        >
          <Text style={s.texto}>{descripcion(novedad)}</Text>
          {!novedad.leidaEn && <Text style={s.indicador}>Nueva</Text>}
        </Pressable>
      ))}
      {novedades.length < total && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ver más novedades"
          accessibilityState={{ disabled: cargando, busy: cargando }}
          disabled={cargando}
          onPress={() => void cargarMas()}
          style={s.mas}
        >
          <Text style={s.textoMas}>{cargando ? "Cargando…" : "Ver más novedades"}</Text>
        </Pressable>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  contenedor: { gap: 8 },
  titulo: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 20 },
  fila: {
    backgroundColor: tema.superficie,
    borderRadius: 14,
    minHeight: 48,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  nueva: { borderWidth: 1, borderColor: tema.bordeDestacado },
  texto: { color: tema.texto, fontFamily: tema.fuenteTexto, fontSize: 14, flex: 1 },
  indicador: { color: tema.acento, fontFamily: tema.fuenteSemi, fontSize: 12 },
  error: { color: tema.aviso, fontFamily: tema.fuenteTexto, fontSize: 13 },
  mas: { alignSelf: "flex-start", paddingVertical: 10, paddingHorizontal: 4 },
  textoMas: { color: tema.acento, fontFamily: tema.fuenteBoton, fontSize: 14 },
})
