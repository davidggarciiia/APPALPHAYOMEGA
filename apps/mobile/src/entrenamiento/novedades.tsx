import { useCallback, useRef, useState } from "react"
import { useFocusEffect } from "expo-router"
import { Pressable, StyleSheet, Text, View } from "react-native"
import type { ListadoNovedades, NovedadEntrenamiento } from "@alpha-omega/shared"
import type { ApiEntrenamiento } from "./api"
import { AvisoDeError, BotonEnlace } from "../componentes/formulario"
import { tiempoRelativo } from "../lib/tiempo-relativo"
import { espacio, radio, tema, tipo } from "../tema"

function descripcion(novedad: NovedadEntrenamiento): string {
  const sesion = novedad.sesionNombre
  switch (novedad.tipo) {
    case "entrenamiento_enviado":
      return `${novedad.autor.nombre} envió ${sesion}`
    case "sesion_revisada":
      return ""
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
  inicial,
  alLeer,
}: {
  clienteId: string
  api: ApiEntrenamiento
  abrir: (sesionId: string) => void
  inicial?: ListadoNovedades
  alLeer?: (novedadId: string) => void
}): React.JSX.Element | null {
  const [novedades, setNovedades] = useState<NovedadEntrenamiento[]>([])
  const [total, setTotal] = useState(0)
  const [sinLeer, setSinLeer] = useState(0)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState("")
  const consulta = useRef(0)
  const abriendo = useRef(false)
  const foco = useRef(0)
  useFocusEffect(
    useCallback(() => {
      abriendo.current = false
      foco.current += 1
      return () => {
        foco.current += 1
      }
    }, []),
  )
  useFocusEffect(
    useCallback(() => {
      let vigente = true
      consulta.current += 1
      setNovedades([])
      setTotal(0)
      setCargando(false)
      void (inicial ? Promise.resolve(inicial) : api.novedades(clienteId, 0))
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
    }, [api, clienteId, inicial]),
  )

  const cargarMas = async (): Promise<void> => {
    if (cargando || novedades.length >= total) return
    const vigente = consulta.current
    setCargando(true)
    setError("")
    try {
      const pagina = await api.novedades(
        clienteId,
        novedades.filter((n) => n.tipo !== "sesion_revisada").length,
      )
      if (vigente !== consulta.current) return
      setNovedades((actual) => [
        ...actual.filter((n) => n.tipo !== "sesion_revisada"),
        ...pagina.novedades,
      ])
      setTotal(pagina.total)
      setSinLeer(pagina.sinLeer)
    } catch {
      if (vigente === consulta.current)
        setError("No se pudieron cargar más novedades. Puedes reintentarlo.")
    } finally {
      if (vigente === consulta.current) setCargando(false)
    }
  }

  const visibles = novedades.filter((novedad) => novedad.tipo !== "sesion_revisada")
  const sinLeerVisibles = Math.max(
    0,
    sinLeer - novedades.filter((n) => n.tipo === "sesion_revisada" && !n.leidaEn).length,
  )
  if (visibles.length === 0 && novedades.length >= total && !error) return null
  return (
    <View style={s.contenedor}>
      <Text style={s.anuncio} accessibilityLiveRegion="polite">
        {sinLeerVisibles > 0
          ? `${sinLeerVisibles} novedades sin leer`
          : "Sin novedades pendientes de leer"}
      </Text>
      {error !== "" && <AvisoDeError mensaje={error} />}
      <View testID="tarjeta-novedades" style={s.tarjeta}>
        {visibles.map((novedad, indice) => (
          <View key={novedad.id} style={indice > 0 && s.separada}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${descripcion(novedad)}${novedad.leidaEn ? "" : ", sin leer"}`}
              accessibilityHint="Abrir entrenamiento"
              style={s.fila}
              onPress={() => {
                if (abriendo.current) return
                abriendo.current = true
                const visita = foco.current
                void (async () => {
                  if (!novedad.leidaEn) {
                    try {
                      await api.leerNovedades(novedad.sesionId, { novedadIds: [novedad.id] })
                      if (visita !== foco.current) return
                      setNovedades((actual) =>
                        actual.map((item) =>
                          item.id === novedad.id
                            ? { ...item, leidaEn: new Date().toISOString() }
                            : item,
                        ),
                      )
                      setSinLeer((total) => Math.max(0, total - 1))
                      alLeer?.(novedad.id)
                    } catch {
                      if (visita !== foco.current) return
                      setError("No se pudo guardar la lectura. Podrás reintentarlo después.")
                    }
                  }
                  if (visita === foco.current) abrir(novedad.sesionId)
                })()
              }}
            >
              {!novedad.leidaEn && (
                <View testID={`punto-novedad-${novedad.id}`} style={s.indicador} />
              )}
              <View style={s.textos}>
                <Text style={s.texto} numberOfLines={1}>
                  {descripcion(novedad)}
                </Text>
                <Text style={s.atribucion} numberOfLines={1}>
                  {novedad.autor.rol === "entrenador" ? "Tu entrenador" : novedad.autor.nombre} ·{" "}
                  {tiempoRelativo(novedad.creadaEn, Date.now())}
                </Text>
              </View>
            </Pressable>
          </View>
        ))}
        {novedades.length < total && (
          <BotonEnlace
            texto="Ver más novedades"
            ocupado={cargando}
            onPress={() => void cargarMas()}
          />
        )}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  contenedor: { gap: espacio[12] },
  tarjeta: {
    backgroundColor: tema.superficie,
    borderRadius: radio.tarjeta,
    paddingHorizontal: espacio[16],
  },
  fila: {
    minHeight: 56,
    paddingVertical: espacio[8],
    flexDirection: "row",
    alignItems: "center",
    gap: espacio[12],
  },
  separada: { borderTopWidth: 1, borderTopColor: tema.borde },
  textos: { flex: 1, gap: 2 },
  texto: { ...tipo.cuerpo, color: tema.texto },
  atribucion: tipo.secundario,
  indicador: { width: 8, height: 8, borderRadius: 2, backgroundColor: tema.acento },
  anuncio: { position: "absolute", left: -10000, width: 1, height: 1, overflow: "hidden" },
})
