import { useCallback, useRef, useState } from "react"
import { useFocusEffect } from "expo-router"
import { Pressable, StyleSheet, Text, View } from "react-native"
import type { NovedadEntrenamiento } from "@alpha-omega/shared"
import type { ApiEntrenamiento } from "./api"
import { AvisoDeError, BotonEnlace } from "../componentes/formulario"
import { espacio, radio, tema, tipo } from "../tema"

function cuando(fecha: string): string {
  const minutos = Math.max(0, Math.floor((Date.now() - Date.parse(fecha)) / 60_000))
  const formato = new Intl.RelativeTimeFormat("es", { numeric: "auto" })
  if (minutos < 60) return formato.format(-minutos, "minute")
  if (minutos < 1440) return formato.format(-Math.floor(minutos / 60), "hour")
  return formato.format(-Math.floor(minutos / 1440), "day")
}

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
      <Text style={s.anuncio} accessibilityLiveRegion="polite">
        {sinLeer > 0 ? `${sinLeer} novedades sin leer` : "Sin novedades pendientes de leer"}
      </Text>
      {error !== "" && <AvisoDeError mensaje={error} />}
      {novedades.map((novedad) => (
        <Pressable
          key={novedad.id}
          accessibilityRole="button"
          accessibilityLabel={`${descripcion(novedad)}${novedad.leidaEn ? "" : ", sin leer"}`}
          style={[s.fila, !novedad.leidaEn && s.nueva]}
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
                } catch {
                  if (visita !== foco.current) return
                  setError("No se pudo guardar la lectura. Podrás reintentarlo después.")
                }
              }
              if (visita === foco.current) abrir(novedad.sesionId)
            })()
          }}
        >
          <View style={s.textos}>
            <Text style={s.texto}>{descripcion(novedad)}</Text>
            <Text style={s.atribucion}>
              {novedad.autor.rol === "entrenador" ? "Tu entrenador" : novedad.autor.nombre} ·{" "}
              {cuando(novedad.creadaEn)}
            </Text>
          </View>
          {!novedad.leidaEn && <View style={s.indicador} />}
        </Pressable>
      ))}
      {novedades.length < total && (
        <BotonEnlace
          texto="Ver más novedades"
          ocupado={cargando}
          onPress={() => void cargarMas()}
        />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  contenedor: { gap: espacio[12] },
  fila: {
    backgroundColor: tema.superficie,
    borderRadius: radio.tarjeta,
    minHeight: 64,
    padding: espacio[16],
    flexDirection: "row",
    alignItems: "center",
    gap: espacio[12],
  },
  nueva: { borderWidth: 1, borderColor: tema.bordeDestacado },
  textos: { flex: 1, gap: espacio[8] },
  texto: { ...tipo.cuerpo, color: tema.texto },
  atribucion: tipo.secundario,
  indicador: { width: 8, height: 8, borderRadius: 2, backgroundColor: tema.acento },
  anuncio: { position: "absolute", left: -10000, width: 1, height: 1, overflow: "hidden" },
})
