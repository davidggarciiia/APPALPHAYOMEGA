import { useLocalSearchParams, useRouter } from "expo-router"
import { useEffect, useState } from "react"
import { Text, View } from "react-native"
import type { SesionEntrenador } from "@alpha-omega/shared"
import {
  AvisoDeError,
  BotonSecundario,
  PantallaDeFormulario,
} from "../../src/componentes/formulario"
import { useEntrenamiento } from "../../src/entrenamiento/use-entrenamiento"
import { fechaLegible } from "../../src/entrenamiento/fechas"
import { useSesion } from "../../src/sesion"
import { tema } from "../../src/tema"

export default function DetalleEntrenamiento(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { estado } = useSesion()
  const api = useEntrenamiento()
  const router = useRouter()
  const [sesion, setSesion] = useState<SesionEntrenador | null>(null)
  const [error, setError] = useState("")
  const [intento, setIntento] = useState(0)
  const rol = estado.fase === "dentro" ? estado.usuario.rol : null
  useEffect(() => {
    let vigente = true
    setSesion(null)
    setError("")
    const leer = rol === "cliente" ? api.leerCliente : api.leerEntrenador
    void leer(id)
      .then((datos) => {
        if (vigente) setSesion(datos)
      })
      .catch(() => {
        if (vigente) setError("No se pudo abrir este entrenamiento.")
      })
    return () => {
      vigente = false
    }
  }, [id, api, rol, intento])
  return (
    <PantallaDeFormulario>
      {error ? (
        <>
          <AvisoDeError mensaje={error} />
          <BotonSecundario texto="Reintentar" onPress={() => setIntento((n) => n + 1)} />
        </>
      ) : !sesion ? (
        <Text style={{ color: tema.texto }}>Cargando…</Text>
      ) : (
        <View style={{ gap: 14 }}>
          <Text style={{ color: tema.texto, fontSize: 26, fontWeight: "700" }}>
            {sesion.prescripcion.nombre}
          </Text>
          <Text style={{ color: tema.textoTenue }}>{fechaLegible(sesion.agenda.fechaActual)}</Text>
          {sesion.prescripcion.ejercicios.map((e) => (
            <View key={e.id} style={{ gap: 8 }}>
              <Text style={{ color: tema.texto, fontSize: 20, fontWeight: "700" }}>{e.nombre}</Text>
              {e.indicaciones && <Text style={{ color: tema.textoTenue }}>{e.indicaciones}</Text>}
              {e.series.map((s, n) => (
                <Text key={s.id} style={{ color: tema.texto }}>
                  Serie {n + 1}:{" "}
                  {s.tipoMedicion === "tiempo" ? `${s.segundos} s` : `${s.repeticiones} rep`}
                  {s.pesoKg === null ? "" : ` · ${s.pesoKg} kg`}
                </Text>
              ))}
            </View>
          ))}
        </View>
      )}
      <BotonSecundario texto="Volver" onPress={() => router.back()} />
    </PantallaDeFormulario>
  )
}
