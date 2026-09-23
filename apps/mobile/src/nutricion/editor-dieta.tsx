import { useEffect, useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { AvisoDeError, BotonPrincipal, BotonSecundario, Campo } from "../componentes/formulario"
import { ErrorDePeticion, ErrorDePermiso, ErrorDeRed } from "../lib/http"
import { tema } from "../tema"
import type { ApiNutricion } from "./api"
import { Accion } from "./editor-comida"
import {
  convertir,
  DIAS_SEMANA,
  desdeDocumento,
  duplicarTipo,
  mover,
  nuevaDieta,
  nuevoTipo,
  quitarTipo,
  type DietaEditable,
  type GeneradorDeIds,
} from "./editor-modelo"
import { EditorTipo } from "./editor-tipo"

export type OrigenDelEditor = "borrador" | "vigente" | "nueva"

type Guardado = "sin cambios" | "cambios" | "guardando" | "guardado" | "conflicto"

/**
 * Editor de la dieta de un cliente. Guarda el borrador con su revisión; nunca
 * publica: eso se hace desde la ficha de la dieta, después de guardar.
 */
export function EditorDieta({
  clienteId,
  api,
  origen,
  ids,
  volver,
}: {
  clienteId: string
  api: ApiNutricion
  origen: OrigenDelEditor
  ids: GeneradorDeIds
  volver: () => void
}): React.JSX.Element {
  const [dieta, setDieta] = useState<DietaEditable | null>(null)
  const [revision, setRevision] = useState(0)
  const [guardado, setGuardado] = useState<Guardado>("sin cambios")
  const [errores, setErrores] = useState<string[]>([])
  const [falloCarga, setFalloCarga] = useState("")
  const [saliendo, setSaliendo] = useState(false)
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    let vigente = true
    const cargar = async (): Promise<void> => {
      if (origen === "nueva" && recarga === 0) {
        setDieta(nuevaDieta(ids))
        setRevision(0)
        return
      }
      if (origen === "vigente" && recarga === 0) {
        const { dieta: publicada } = await api.vigente(clienteId)
        if (!vigente) return
        setDieta(publicada ? desdeDocumento(publicada.documento, ids) : nuevaDieta(ids))
        setRevision(0)
        return
      }
      const { borrador } = await api.borrador(clienteId)
      if (!vigente) return
      setDieta(borrador ? desdeDocumento(borrador.documento, ids) : nuevaDieta(ids))
      setRevision(borrador?.revision ?? 0)
      setGuardado("sin cambios")
    }
    cargar().catch(() => {
      if (vigente)
        setFalloCarga("No se pudo cargar la dieta. Revisa la conexión y vuelve a intentarlo.")
    })
    return () => {
      vigente = false
    }
  }, [api, clienteId, origen, ids, recarga])

  if (falloCarga !== "") {
    return (
      <View style={s.contenido}>
        <AvisoDeError mensaje={falloCarga} />
        <BotonSecundario texto="Volver" onPress={volver} />
      </View>
    )
  }
  if (dieta === null) return <Text style={s.tenue}>Cargando la dieta…</Text>

  const cambiar = (nueva: DietaEditable): void => {
    setDieta(nueva)
    setErrores([])
    if (guardado !== "conflicto") setGuardado("cambios")
  }

  const guardar = async (): Promise<void> => {
    const { documento, errores: problemas } = convertir(dieta)
    if (documento === null) {
      setErrores(problemas)
      return
    }
    setGuardado("guardando")
    try {
      const borrador = await api.guardar(clienteId, revision, documento)
      setRevision(borrador.revision)
      setGuardado("guardado")
    } catch (error) {
      if (error instanceof ErrorDePeticion && error.detalle.codigo === "revision_obsoleta") {
        setGuardado("conflicto")
        return
      }
      setGuardado("cambios")
      setErrores([
        error instanceof ErrorDeRed
          ? "No se pudo guardar: revisa la conexión. Tus cambios siguen en pantalla."
          : error instanceof ErrorDePermiso
            ? "Ya no tienes acceso a este cliente."
            : error instanceof ErrorDePeticion
              ? error.message
              : "No se pudo guardar el borrador.",
      ])
    }
  }

  const estadoGuardado: Record<Guardado, string> = {
    "sin cambios": revision === 0 ? "Sin guardar todavía" : "Borrador guardado",
    cambios: "Cambios sin guardar",
    guardando: "Guardando…",
    guardado: "Guardado",
    conflicto: "Otra persona ha guardado esta dieta mientras la editabas",
  }

  return (
    <View style={s.contenido}>
      <Text style={s.estado} accessibilityLiveRegion="polite">
        {estadoGuardado[guardado]}
      </Text>
      {guardado === "conflicto" && (
        <View style={s.aviso}>
          <AvisoDeError mensaje="Tu copia sigue en pantalla, pero no se ha guardado. Carga la versión guardada para continuar desde ella: perderás lo que has escrito aquí." />
          <BotonSecundario
            texto="Cargar la versión guardada"
            onPress={() => setRecarga((n) => n + 1)}
          />
        </View>
      )}
      <Campo
        etiqueta="Nombre de la dieta"
        value={dieta.nombre}
        maxLength={120}
        onChangeText={(nombre) => cambiar({ ...dieta, nombre })}
        placeholder="Plan de octubre"
      />

      <Text style={s.seccion} accessibilityRole="header">
        Semana
      </Text>
      {DIAS_SEMANA.map((dia, n) => (
        <View key={dia} style={s.dia}>
          <Text style={s.nombreDia}>{dia}</Text>
          <View style={s.opciones}>
            {dieta.tipos.map((tipo) => {
              const elegido = dieta.semana[n] === tipo.id
              return (
                <Pressable
                  key={tipo.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: elegido }}
                  accessibilityLabel={`${dia}: ${tipo.nombre || "tipo sin nombre"}`}
                  onPress={() =>
                    cambiar({
                      ...dieta,
                      semana: dieta.semana.map((id, i) => (i === n ? tipo.id : id)),
                    })
                  }
                  style={[s.opcion, elegido && s.opcionActiva]}
                >
                  <Text style={[s.textoOpcion, elegido && s.textoActivo]}>
                    {tipo.nombre || "Sin nombre"}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </View>
      ))}

      <Text style={s.seccion} accessibilityRole="header">
        Tipos de día
      </Text>
      {dieta.tipos.map((tipo) => (
        <EditorTipo
          key={tipo.id}
          valor={tipo}
          ids={ids}
          cambiar={(nuevo) =>
            cambiar({ ...dieta, tipos: dieta.tipos.map((t) => (t.id === nuevo.id ? nuevo : t)) })
          }
          duplicar={
            dieta.tipos.length < 7 ? () => cambiar(duplicarTipo(dieta, tipo.id, ids)) : null
          }
          quitar={dieta.tipos.length > 1 ? () => cambiar(quitarTipo(dieta, tipo.id)) : null}
        />
      ))}
      <Accion
        texto="+ Tipo de día"
        deshabilitado={dieta.tipos.length >= 7}
        onPress={() => cambiar({ ...dieta, tipos: [...dieta.tipos, nuevoTipo(ids)] })}
      />

      <Text style={s.seccion} accessibilityRole="header">
        Indicaciones
      </Text>
      {dieta.indicaciones.map((indicacion, n) => {
        const editar = (cambio: Partial<typeof indicacion>): void =>
          cambiar({
            ...dieta,
            indicaciones: dieta.indicaciones.map((i) =>
              i.clave === indicacion.clave ? { ...i, ...cambio } : i,
            ),
          })
        return (
          <View key={indicacion.clave} style={s.indicacion}>
            <Campo
              etiqueta={`Título de la indicación ${n + 1}`}
              value={indicacion.titulo}
              maxLength={60}
              onChangeText={(titulo) => editar({ titulo })}
              placeholder="Cómo seguir el plan"
            />
            <Campo
              etiqueta={`Texto de la indicación ${n + 1}`}
              value={indicacion.texto}
              maxLength={3000}
              multiline
              onChangeText={(texto) => editar({ texto })}
            />
            <View style={s.opciones}>
              {n > 0 && (
                <Accion
                  texto="↑ Subir"
                  etiqueta={`Subir indicación ${n + 1}`}
                  onPress={() =>
                    cambiar({ ...dieta, indicaciones: mover(dieta.indicaciones, n, -1) })
                  }
                />
              )}
              <Accion
                texto="Quitar"
                etiqueta={`Quitar indicación ${n + 1}`}
                onPress={() =>
                  cambiar({
                    ...dieta,
                    indicaciones: dieta.indicaciones.filter((i) => i.clave !== indicacion.clave),
                  })
                }
              />
            </View>
          </View>
        )
      })}
      <Accion
        texto="+ Indicación"
        deshabilitado={dieta.indicaciones.length >= 10}
        onPress={() =>
          cambiar({
            ...dieta,
            indicaciones: [...dieta.indicaciones, { clave: ids(), titulo: "", texto: "" }],
          })
        }
      />

      {errores.map((error) => (
        <AvisoDeError key={error} mensaje={error} />
      ))}
      <BotonPrincipal
        texto="Guardar borrador"
        ocupado={guardado === "guardando"}
        onPress={() => void guardar()}
      />
      {saliendo ? (
        <View style={s.aviso}>
          <AvisoDeError mensaje="Tienes cambios sin guardar. Si sales ahora se perderán." />
          <BotonSecundario texto="Seguir editando" onPress={() => setSaliendo(false)} />
          <BotonSecundario texto="Salir sin guardar" onPress={volver} />
        </View>
      ) : (
        <BotonSecundario
          texto="Volver a la dieta"
          onPress={() =>
            guardado === "cambios" || guardado === "conflicto" ? setSaliendo(true) : volver()
          }
        />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  contenido: { gap: 12 },
  tenue: { color: tema.textoTenue, fontFamily: tema.fuenteTexto },
  estado: { color: tema.textoTenue, fontFamily: tema.fuenteBoton, fontSize: 13 },
  aviso: { backgroundColor: tema.acentoSuave, borderRadius: 14, padding: 12 },
  seccion: {
    color: tema.texto,
    fontFamily: tema.fuenteTitulo,
    fontSize: 24,
    textTransform: "uppercase",
    marginTop: 12,
  },
  dia: { gap: 6 },
  nombreDia: {
    color: tema.textoSecundario,
    fontFamily: tema.fuenteBoton,
    fontSize: 14,
    textTransform: "capitalize",
  },
  opciones: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  opcion: {
    minHeight: 40,
    borderRadius: 20,
    borderColor: tema.bordeFuerte,
    borderWidth: 1,
    paddingHorizontal: 14,
    justifyContent: "center",
    backgroundColor: tema.superficie,
  },
  opcionActiva: { backgroundColor: tema.texto, borderColor: tema.texto },
  textoOpcion: { color: tema.textoSecundario, fontFamily: tema.fuenteBoton, fontSize: 13 },
  textoActivo: { color: tema.sobreAcento },
  indicacion: {
    backgroundColor: tema.superficie,
    borderColor: tema.borde,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
  },
})
