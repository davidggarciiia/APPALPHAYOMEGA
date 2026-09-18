import { useCallback, useState } from "react"
import { useFocusEffect } from "expo-router"
import { Text, View } from "react-native"
import type { ListadoRutinas, RutinaGuardada } from "@alpha-omega/shared"
import type { ApiRutinas } from "./api-rutinas"
import { AvisoDeError, BotonSecundario, Campo } from "../componentes/formulario"
import { tema } from "../tema"

export function ListadoDeRutinas({
  api,
  elegir,
}: {
  api: ApiRutinas
  elegir: (r: RutinaGuardada) => void
}): React.JSX.Element {
  const [buscar, setBuscar] = useState(""),
    [pagina, setPagina] = useState(0),
    [intento, setIntento] = useState(0)
  const [datos, setDatos] = useState<ListadoRutinas | null>(null),
    [error, setError] = useState("")
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
      {datos?.rutinas.map((r) => (
        <View
          key={r.id}
          style={{
            padding: 18,
            backgroundColor: tema.superficie,
            borderWidth: 1,
            borderColor: tema.borde,
            borderRadius: 18,
          }}
        >
          <Text style={{ color: tema.texto, fontFamily: tema.fuenteTitulo, fontSize: 28 }}>
            {r.nombre}
          </Text>
          <Text style={{ color: tema.textoTenue }}>{r.patron.sesiones.length} sesiones</Text>
          <BotonSecundario texto={`Elegir ${r.nombre}`} onPress={() => elegir(r)} />
        </View>
      ))}
      {datos?.total === 0 && (
        <Text style={{ color: tema.textoTenue }}>Aún no hay rutinas que coincidan.</Text>
      )}
      {!datos && !error && <Text style={{ color: tema.textoTenue }}>Cargando rutinas…</Text>}
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
