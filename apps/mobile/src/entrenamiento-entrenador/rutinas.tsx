import { randomUUID } from "expo-crypto"
import { useFocusEffect, useRouter } from "expo-router"
import { useCallback, useEffect, useState } from "react"
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native"
import type { RutinaGuardada } from "@alpha-omega/shared"

import { ejerciciosPorId } from "../catalogo-ejercicios/api"
import {
  Aviso,
  BotonAtras,
  BotonOro,
  BotonSobrio,
  CampoDeTexto,
  FilaDeLista,
  Lista,
  Pantalla,
  contenidoCentrado,
  texto,
} from "../componentes/diseno"
import { faltaDe, type Falta } from "../lib/errores"
import { tema } from "../tema"

import { crearRutina, editarRutina, leerRutina, listarRutinas } from "./api"
import { EditorDeSesiones, type CrearEjercicioEnLinea } from "./editor-plan"
import {
  aPatron,
  desdePatron,
  resumenDeRutina,
  sesionNueva,
  type SesionEnEdicion,
} from "./plan-en-edicion"

/**
 * La biblioteca de rutinas: semanas tipo sin cliente ni fechas, para cargar en
 * un plan. Cargarla hace una copia; cambiar la rutina después no toca los
 * planes ya asignados.
 */
export function ListaDeRutinas(): React.JSX.Element {
  const router = useRouter()
  const [estado, setEstado] = useState<
    | { fase: "cargando" }
    | { fase: "lista"; rutinas: RutinaGuardada[] }
    | { fase: "error"; falta: Falta }
  >({ fase: "cargando" })
  const [intento, setIntento] = useState(0)

  useFocusEffect(
    useCallback(() => {
      let vigente = true
      listarRutinas()
        .then((listado) => {
          if (vigente) setEstado({ fase: "lista", rutinas: listado.rutinas })
        })
        .catch((error: unknown) => {
          if (vigente) {
            setEstado({
              fase: "error",
              falta: faltaDe(error, "No hemos podido cargar tus rutinas."),
            })
          }
        })
      return () => {
        vigente = false
      }
    }, [intento]),
  )

  return (
    <Pantalla>
      <ScrollView contentContainerStyle={[estilos.contenido, contenidoCentrado]}>
        <View style={estilos.barraSuperior}>
          <BotonAtras onPress={() => router.back()} />
        </View>
        <View style={estilos.encabezado}>
          <Text style={texto.titulo} accessibilityRole="header">
            Rutinas
          </Text>
          <Text style={texto.tenueMedio}>
            Semanas tipo para cargar en un plan. Al cargarlas se copian: cambiarlas aquí no toca lo
            ya asignado.
          </Text>
        </View>
        <BotonOro
          texto="Nueva rutina"
          onPress={() =>
            router.push({ pathname: "/entrenador/rutina/[id]", params: { id: "nueva" } })
          }
        />
        {estado.fase === "cargando" && <ActivityIndicator color={tema.oro} />}
        {estado.fase === "error" && (
          <View style={estilos.encabezado}>
            <Text style={texto.cuerpo}>{estado.falta.texto}</Text>
            {estado.falta.reintentable && (
              <BotonSobrio texto="Reintentar" onPress={() => setIntento((n) => n + 1)} />
            )}
          </View>
        )}
        {estado.fase === "lista" &&
          (estado.rutinas.length === 0 ? (
            <Text style={texto.tenueGrande}>Aún no tienes rutinas guardadas.</Text>
          ) : (
            <Lista>
              {estado.rutinas.map((rutina, indice) => (
                <FilaDeLista
                  key={rutina.id}
                  titulo={rutina.nombre}
                  subtitulo={resumenDeRutina(rutina)}
                  ultima={indice === estado.rutinas.length - 1}
                  onPress={() =>
                    router.push({ pathname: "/entrenador/rutina/[id]", params: { id: rutina.id } })
                  }
                />
              ))}
            </Lista>
          ))}
      </ScrollView>
    </Pantalla>
  )
}

type Edicion = { id: string | null; revision: number; nombre: string; sesiones: SesionEnEdicion[] }

/** Crear (`id` = "nueva") o editar una rutina. */
export function EditorDeRutina({
  id,
  crearEjercicio,
}: {
  id: string
  crearEjercicio?: CrearEjercicioEnLinea
}): React.JSX.Element {
  const router = useRouter()
  const nueva = id === "nueva"
  const [edicion, setEdicion] = useState<Edicion | null>(
    nueva ? { id: null, revision: 0, nombre: "", sesiones: [sesionNueva(randomUUID, 1)] } : null,
  )
  const [falta, setFalta] = useState<Falta | null>(null)
  const [intento, setIntento] = useState(0)
  const [errores, setErrores] = useState<string[]>([])
  const [aviso, setAviso] = useState<{ texto: string; error: boolean } | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (nueva) return
    let vigente = true
    const cargar = async (): Promise<void> => {
      try {
        const rutina = await leerRutina(id)
        const ids = rutina.patron.sesiones.flatMap((s) => s.ejercicios.map((e) => e.ejercicioId))
        const { ejercicios } = await ejerciciosPorId(ids)
        if (!vigente) return
        const nombres = new Map(ejercicios.map((e) => [e.id, e.nombre]))
        setEdicion({
          id: rutina.id,
          revision: rutina.revision,
          nombre: rutina.nombre,
          sesiones: desdePatron(rutina.patron, nombres),
        })
        setFalta(null)
      } catch (error) {
        if (vigente) setFalta(faltaDe(error, "No hemos podido cargar la rutina."))
      }
    }
    void cargar()
    return () => {
      vigente = false
    }
  }, [id, nueva, intento])

  const guardar = async (): Promise<void> => {
    if (edicion === null) return
    setAviso(null)
    const patron = aPatron(edicion.sesiones)
    const faltas = [
      ...(edicion.nombre.trim() === "" ? ["Ponle nombre a la rutina."] : []),
      ...(patron.ok ? [] : patron.errores),
    ]
    setErrores(faltas)
    if (faltas.length > 0 || !patron.ok) return
    setGuardando(true)
    try {
      const datos = { nombre: edicion.nombre.trim(), patron: patron.valor }
      const guardada =
        edicion.id === null
          ? await crearRutina(datos)
          : await editarRutina(edicion.id, { ...datos, revision: edicion.revision })
      setEdicion({ ...edicion, id: guardada.id, revision: guardada.revision })
      setAviso({ texto: "Rutina guardada.", error: false })
    } catch (error) {
      // Si otro la cambió a la vez, el servidor responde «rutina_cambiada» con un
      // mensaje que ya dice qué hacer.
      setAviso({ texto: faltaDe(error, "No hemos podido guardar la rutina.").texto, error: true })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Pantalla>
      <ScrollView
        contentContainerStyle={[estilos.contenido, contenidoCentrado]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={estilos.barraSuperior}>
          <BotonAtras onPress={() => router.back()} />
        </View>
        <Text style={texto.titulo} accessibilityRole="header">
          {nueva && edicion?.id == null ? "Nueva rutina" : "Rutina"}
        </Text>

        {edicion === null && falta === null && <ActivityIndicator color={tema.oro} />}
        {edicion === null && falta !== null && (
          <View style={estilos.encabezado}>
            <Text style={texto.cuerpo}>{falta.texto}</Text>
            {falta.reintentable && (
              <BotonSobrio texto="Reintentar" onPress={() => setIntento((n) => n + 1)} />
            )}
          </View>
        )}

        {edicion !== null && (
          <>
            <CampoDeTexto
              etiqueta="Nombre de la rutina"
              value={edicion.nombre}
              onChangeText={(nombre) => setEdicion({ ...edicion, nombre })}
              placeholder="Fuerza 3 días"
              maxLength={120}
            />
            <EditorDeSesiones
              sesiones={edicion.sesiones}
              alCambiar={(sesiones) => setEdicion({ ...edicion, sesiones })}
              crearEjercicio={crearEjercicio}
            />
            {errores.length > 0 && (
              <Aviso tono="error">
                <Text style={texto.fuerte}>Falta algo</Text>
                {errores.map((error) => (
                  <Text key={error} style={texto.cuerpo}>{`· ${error}`}</Text>
                ))}
              </Aviso>
            )}
            {aviso !== null && (
              <Aviso tono={aviso.error ? "error" : "info"}>
                <Text style={texto.cuerpo}>{aviso.texto}</Text>
              </Aviso>
            )}
            <BotonOro texto="Guardar rutina" ocupado={guardando} onPress={() => void guardar()} />
          </>
        )}
      </ScrollView>
    </Pantalla>
  )
}

const estilos = StyleSheet.create({
  contenido: { padding: 20, paddingBottom: 64, gap: 24 },
  barraSuperior: { flexDirection: "row" },
  encabezado: { gap: 10 },
})
