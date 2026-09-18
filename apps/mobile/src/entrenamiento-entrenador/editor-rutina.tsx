import { useEffect, useRef, useState } from "react"
import { Text, View } from "react-native"
import { GuardarRutinaSchema } from "@alpha-omega/shared"
import type { ApiRutinas } from "./api-rutinas"
import type { ApiDeCatalogo } from "../catalogo-ejercicios/api"
import { nuevaSesion, convertirSesion } from "./editor-modelo"
import { cargarRutina } from "./cargar-rutina"
import { EditorPatron } from "./editor-patron"
import { AvisoDeError, BotonPrincipal, BotonSecundario, Campo } from "../componentes/formulario"
import { tema } from "../tema"

export function EditorRutina({
  id,
  api,
  catalogo,
  terminado,
}: {
  id: string
  api: ApiRutinas
  catalogo: ApiDeCatalogo
  terminado: () => void
}): React.JSX.Element {
  const [nombre, setNombre] = useState("")
  const vigente = useRef(true),
    enCurso = useRef(false)
  useEffect(() => {
    vigente.current = true
    return () => {
      vigente.current = false
    }
  }, [])
  const [sesiones, setSesiones] = useState(() => [nuevaSesion()])
  const [revision, setRevision] = useState(0),
    [intento, setIntento] = useState(0)
  const [cargando, setCargando] = useState(id !== "nueva"),
    [ocupado, setOcupado] = useState(false),
    [error, setError] = useState("")
  useEffect(() => {
    if (id === "nueva") return
    let vigente = true
    setCargando(true)
    setError("")
    void api
      .leer(id)
      .then(async (rutina) => {
        const copia = await cargarRutina(rutina.patron, catalogo)
        if (!vigente) return
        setNombre(rutina.nombre)
        setRevision(rutina.revision)
        setSesiones(copia.sesiones)
        setCargando(false)
        if (copia.retirados.length)
          setError(`Sustituye los ejercicios retirados para guardar: ${copia.retirados.join(", ")}`)
      })
      .catch(() => {
        if (vigente) setError("No se pudo cargar la rutina. Reintenta.")
      })
    return () => {
      vigente = false
    }
  }, [id, api, catalogo, intento])
  const guardar = async (): Promise<void> => {
    if (enCurso.current) return
    enCurso.current = true
    setOcupado(true)
    setError("")
    try {
      const datos = GuardarRutinaSchema.parse({
        nombre,
        patron: { sesiones: sesiones.map(convertirSesion) },
      })
      if (id === "nueva") await api.crear(datos)
      else await api.editar(id, { ...datos, revision })
      if (vigente.current) terminado()
    } catch {
      if (vigente.current)
        setError(
          id === "nueva"
            ? "No se pudo confirmar el guardado. Revisa los objetivos y comprueba la biblioteca antes de reintentar si perdiste la conexión."
            : "No se pudo guardar. Revisa los objetivos; si la rutina cambió en otro dispositivo, recarga su versión actual.",
        )
    } finally {
      enCurso.current = false
      if (vigente.current) setOcupado(false)
    }
  }
  return (
    <View style={{ gap: 12 }}>
      <Text style={{ color: tema.texto, fontSize: 28, fontWeight: "800" }}>
        {id === "nueva" ? "Nueva rutina" : "Editar rutina"}
      </Text>
      <Text style={{ color: tema.textoTenue }}>
        Las rutinas son plantillas. Guardar aquí no cambia los entrenamientos ya asignados.
      </Text>
      {cargando ? (
        <Text style={{ color: tema.texto }}>Cargando…</Text>
      ) : ocupado ? (
        <Text style={{ color: tema.texto }}>Guardando rutina…</Text>
      ) : (
        <>
          <Campo
            etiqueta="Nombre de la rutina"
            value={nombre}
            onChangeText={setNombre}
            maxLength={120}
          />
          <EditorPatron sesiones={sesiones} cambiar={setSesiones} catalogo={catalogo} />
          <BotonPrincipal texto="Guardar rutina" onPress={() => void guardar()} />
        </>
      )}
      {error !== "" && (
        <>
          <AvisoDeError mensaje={error} />
          {id !== "nueva" && (
            <BotonSecundario
              texto="Recargar rutina del servidor"
              onPress={() => setIntento((n) => n + 1)}
            />
          )}
        </>
      )}
    </View>
  )
}
