import { useCallback, useRef, useState } from "react"
import { useFocusEffect } from "expo-router"
import { StyleSheet, Text, View } from "react-native"
import type { ListadoRutinas, RutinaGuardada } from "@alpha-omega/shared"
import { duplicarRutina, type ApiRutinas } from "./api-rutinas"
import { AvisoDeError, BotonSecundario, Campo } from "../componentes/formulario"
import { Esqueleto, GrupoEsqueletos } from "../componentes/esqueleto"
import { tema } from "../tema"

/**
 * Las rutinas guardadas. `modo` dice qué significa pulsar una:
 * - `elegir` (por defecto): usarla como punto de partida de otra cosa, como un plan.
 * - `editar`: abrirla para editarla; en este modo también se puede duplicar.
 */
export function ListadoDeRutinas({
  api,
  elegir,
  modo = "elegir",
}: {
  api: ApiRutinas
  elegir: (r: RutinaGuardada) => void
  modo?: "elegir" | "editar"
}): React.JSX.Element {
  const [buscar, setBuscar] = useState(""),
    [pagina, setPagina] = useState(0),
    [intento, setIntento] = useState(0)
  const [datos, setDatos] = useState<ListadoRutinas | null>(null),
    [error, setError] = useState("")
  const [duplicando, setDuplicando] = useState<string | null>(null),
    [avisoCopia, setAvisoCopia] = useState(""),
    [errorCopia, setErrorCopia] = useState("")
  const enCurso = useRef(false)
  useFocusEffect(
    useCallback(() => {
      let vigente = true
      setDatos(null)
      setError("")
      const espera = setTimeout(() => {
        void api
          .listar(buscar, pagina * 10)
          .then((r) => {
            if (vigente) setDatos(r)
          })
          .catch(() => {
            if (vigente) setError("No se pudieron cargar las rutinas.")
          })
      }, 250)
      return () => {
        vigente = false
        clearTimeout(espera)
      }
    }, [api, buscar, pagina, intento]),
  )
  const duplicar = async (r: RutinaGuardada): Promise<void> => {
    // El POST no es idempotente: un segundo toque mientras tanto crearía otra copia.
    if (enCurso.current) return
    enCurso.current = true
    setDuplicando(r.id)
    setAvisoCopia("")
    setErrorCopia("")
    try {
      const copia = await duplicarRutina(api, r.id)
      setAvisoCopia(`Rutina duplicada: «${copia.nombre}».`)
      // Recarga la lista para que la copia aparezca donde le toque.
      setPagina(0)
      setIntento((n) => n + 1)
    } catch {
      setErrorCopia(
        `No se pudo duplicar «${r.nombre}». Comprueba que todos sus ejercicios siguen publicados y reintenta.`,
      )
    } finally {
      enCurso.current = false
      setDuplicando(null)
    }
  }
  return (
    <View style={{ gap: 10 }}>
      <Campo
        etiqueta="Buscar rutina"
        value={buscar}
        maxLength={120}
        onChangeText={(t) => {
          setBuscar(t)
          setPagina(0)
        }}
      />
      {avisoCopia !== "" && (
        <Text style={s.aviso} accessibilityLiveRegion="polite">
          {avisoCopia}
        </Text>
      )}
      {errorCopia !== "" && <AvisoDeError mensaje={errorCopia} />}
      {datos?.rutinas.map((r) => (
        <View key={r.id} style={s.tarjeta}>
          <Text style={{ color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 20 }}>
            {r.nombre}
          </Text>
          <Text style={{ fontFamily: tema.fuenteTexto, color: tema.textoTenue }}>
            {r.patron.sesiones.length} sesiones
          </Text>
          <View style={s.acciones}>
            <BotonSecundario
              texto={`${modo === "editar" ? "Editar" : "Elegir"} ${r.nombre}`}
              onPress={() => elegir(r)}
            />
            {modo === "editar" && (
              <BotonSecundario
                texto={`Duplicar ${r.nombre}`}
                ocupado={duplicando === r.id}
                deshabilitado={duplicando !== null}
                onPress={() => void duplicar(r)}
              />
            )}
          </View>
        </View>
      ))}
      {datos?.total === 0 && (
        <Text style={{ fontFamily: tema.fuenteTexto, color: tema.textoTenue }}>
          Aún no hay rutinas que coincidan.
        </Text>
      )}
      {!datos && !error && (
        <GrupoEsqueletos>
          <View
            style={s.carga}
            accessible
            accessibilityLabel="Cargando rutinas"
            accessibilityRole="progressbar"
          >
            {[0, 1, 2].map((n) => (
              <Esqueleto key={n} alto={96} radio={18} />
            ))}
          </View>
        </GrupoEsqueletos>
      )}
      {error !== "" && (
        <>
          <AvisoDeError mensaje={error} />
          <BotonSecundario texto="Reintentar rutinas" onPress={() => setIntento((n) => n + 1)} />
        </>
      )}
      {pagina > 0 && (
        <BotonSecundario texto="Rutinas anteriores" onPress={() => setPagina((n) => n - 1)} />
      )}
      {datos && (pagina + 1) * 10 < datos.total && (
        <BotonSecundario texto="Más rutinas" onPress={() => setPagina((n) => n + 1)} />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  tarjeta: {
    padding: 18,
    backgroundColor: tema.superficie,
    borderWidth: 1,
    borderColor: tema.borde,
    borderRadius: 18,
  },
  acciones: { flexDirection: "row", flexWrap: "wrap", columnGap: 12 },
  aviso: { fontFamily: tema.fuenteSemi, color: tema.acento, fontSize: 14 },
  carga: { gap: 10 },
})
