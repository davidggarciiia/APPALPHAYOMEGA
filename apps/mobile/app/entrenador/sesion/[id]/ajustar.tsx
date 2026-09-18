import { useEffect, useState } from "react"
import { useLocalSearchParams, useRouter } from "expo-router"
import { Text } from "react-native"
import { randomUUID } from "expo-crypto"
import type { SesionEntrenador } from "@alpha-omega/shared"
import {
  AvisoDeError,
  BotonPrincipal,
  BotonSecundario,
  PantallaDeFormulario,
} from "../../../../src/componentes/formulario"
import { EditorSesion } from "../../../../src/entrenamiento-entrenador/editor-sesion"
import {
  agregarEjercicio,
  convertirSesion,
  desdeSesion,
  type SesionEditable,
} from "../../../../src/entrenamiento-entrenador/editor-modelo"
import { SelectorEjercicios } from "../../../../src/entrenamiento-entrenador/selector-ejercicios"
import { useEntrenamiento } from "../../../../src/entrenamiento/use-entrenamiento"
import { useCatalogo } from "../../../../src/catalogo-ejercicios/use-catalogo"
import { ErrorDelServidor } from "../../../../src/lib/http"
import { tema } from "../../../../src/tema"

export default function AjustarSesion(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>()
  const api = useEntrenamiento(),
    catalogo = useCatalogo(),
    router = useRouter()
  const [original, setOriginal] = useState<SesionEntrenador | null>(null)
  const [edicion, setEdicion] = useState<SesionEditable | null>(null)
  const [error, setError] = useState(""),
    [ocupado, setOcupado] = useState(false),
    [intento, setIntento] = useState(0)
  useEffect(() => {
    let vigente = true
    void api
      .leerEntrenador(id)
      .then((s) => {
        if (!vigente) return
        setOriginal(s)
        setEdicion(
          desdeSesion(
            {
              id: randomUUID(),
              nombre: s.prescripcion.nombre,
              diaSemana: 1,
              ejercicios: s.prescripcion.ejercicios.map(({ nombre: _nombre, ...e }) => e),
            },
            Object.fromEntries(s.prescripcion.ejercicios.map((e) => [e.ejercicioId, e.nombre])),
          ),
        )
        setError("")
      })
      .catch(() => {
        if (vigente) setError("No se pudo cargar la sesión.")
      })
    return () => {
      vigente = false
    }
  }, [api, id, intento])
  const guardar = async (): Promise<void> => {
    if (!edicion || !original || ocupado) return
    setOcupado(true)
    setError("")
    try {
      const datos = convertirSesion(edicion)
      await api.ajustar(id, {
        revisionPrescripcion: original.revisionPrescripcion,
        nombre: datos.nombre,
        ejercicios: datos.ejercicios,
      })
      router.back()
    } catch (e) {
      setError(
        e instanceof ErrorDelServidor && e.codigo === 409
          ? "La sesión cambió o el cliente ya empezó. Recarga la versión actual; tus cambios no se han aplicado."
          : "No se pudo confirmar el ajuste. Revisa los objetivos y recarga antes de reintentar.",
      )
    } finally {
      setOcupado(false)
    }
  }
  return (
    <PantallaDeFormulario>
      <Text style={{ color: tema.texto, fontSize: 26, fontWeight: "800" }}>
        Ajustar esta sesión
      </Text>
      <Text style={{ color: tema.textoTenue }}>
        El cambio afecta solo a esta fecha y se permite mientras el cliente no haya empezado.
      </Text>
      {original && !original.permiteAjuste ? (
        <Text style={{ color: tema.texto }}>Esta sesión ya no admite ajustes.</Text>
      ) : (
        edicion && (
          <>
            <EditorSesion valor={edicion} cambiar={setEdicion} mostrarDia={false} />
            {edicion.ejercicios.length < 40 && (
              <SelectorEjercicios
                api={catalogo}
                elegir={(e) => setEdicion(agregarEjercicio(edicion, e))}
              />
            )}
            <BotonPrincipal
              texto="Guardar ajuste"
              ocupado={ocupado}
              onPress={() => void guardar()}
            />
          </>
        )
      )}
      {error !== "" && (
        <>
          <AvisoDeError mensaje={error} />
          <BotonSecundario
            texto="Recargar versión actual"
            onPress={() => setIntento((n) => n + 1)}
          />
        </>
      )}
      <BotonSecundario texto="Volver" onPress={() => router.back()} />
    </PantallaDeFormulario>
  )
}
