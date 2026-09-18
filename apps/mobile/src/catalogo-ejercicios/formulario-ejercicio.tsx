import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useState } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native"
import {
  CrearEjercicioSchema,
  GRUPOS_MUSCULARES,
  type CrearEjercicio,
  type Ejercicio,
} from "@alpha-omega/shared"

import {
  AvisoDeError,
  BotonDestructivo,
  BotonPrincipal,
  BotonSecundario,
  Campo,
  PantallaDeFormulario,
} from "../componentes/formulario"
import { faltaDe, type Falta } from "../lib/errores"
import { tema } from "../tema"

import { ErrorDeNombreDuplicado, type ApiDeCatalogo } from "./api"
import { ETIQUETA_DE_GRUPO } from "./catalogo"

type Carga = { fase: "cargando" } | { fase: "lista" } | { fase: "error"; fallo: Falta }

/**
 * Alta y edición de un ejercicio: la misma ficha de texto en los dos casos.
 *
 * Con `id` abre el ejercicio existente y guarda sobre él; sin `id` crea uno. No
 * hay figura ni vídeo que rellenar: un ejercicio sin medios es un ejercicio
 * completo, y el catálogo tiene que poder poblarse tecleando nombres.
 */
export function FormularioDeEjercicio({
  api,
  id,
  onGuardado,
  onCancelar,
}: {
  api: ApiDeCatalogo
  id?: string
  onGuardado: (ejercicio: Ejercicio) => void
  onCancelar: () => void
}): React.JSX.Element {
  const [carga, setCarga] = useState<Carga>({ fase: id === undefined ? "lista" : "cargando" })
  const [intento, setIntento] = useState(0)
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)
  // `null` mientras no hay ejercicio guardado: el alta no tiene nada que retirar.
  const [estado, setEstado] = useState<Ejercicio["estado"] | null>(null)
  const [confirmandoRetirada, setConfirmandoRetirada] = useState(false)
  const [cambiandoEstado, setCambiandoEstado] = useState(false)

  const {
    control,
    getValues,
    handleSubmit,
    reset,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CrearEjercicio>({
    resolver: zodResolver(CrearEjercicioSchema),
    defaultValues: { nombre: "", gruposSecundarios: [], instrucciones: "" },
  })

  const principal = useWatch({ control, name: "grupoPrincipal" })

  useEffect(() => {
    if (id === undefined) return

    let vigente = true

    api
      .leer(id)
      .then((ejercicio) => {
        if (!vigente) return

        reset({
          nombre: ejercicio.nombre,
          grupoPrincipal: ejercicio.grupoPrincipal,
          gruposSecundarios: ejercicio.gruposSecundarios,
          instrucciones: ejercicio.instrucciones,
        })
        setEstado(ejercicio.estado)
        setCarga({ fase: "lista" })
      })
      .catch((error: unknown) => {
        if (!vigente) return

        setCarga({ fase: "error", fallo: faltaDe(error, "No hemos podido abrir el ejercicio.") })
      })

    return () => {
      vigente = false
    }
  }, [api, id, intento, reset])

  const enviar = handleSubmit(async (datos) => {
    setErrorGeneral(null)

    try {
      onGuardado(id === undefined ? await api.crear(datos) : await api.editar(id, datos))
    } catch (error) {
      if (error instanceof ErrorDeNombreDuplicado) {
        setError("nombre", { type: "duplicado" })
        return
      }

      setErrorGeneral(faltaDe(error, "No hemos podido guardar el ejercicio.").texto)
    }
  })

  async function cambiarEstado(operacion: "retirar" | "reponer"): Promise<void> {
    if (id === undefined) return

    setErrorGeneral(null)
    setConfirmandoRetirada(false)
    setCambiandoEstado(true)

    try {
      // Se pinta lo que contesta el servidor, no lo que se pidió.
      setEstado((await api[operacion](id)).estado)
    } catch (error) {
      setErrorGeneral(
        faltaDe(
          error,
          operacion === "retirar"
            ? "No hemos podido retirar el ejercicio."
            : "No hemos podido reponer el ejercicio.",
        ).texto,
      )
    } finally {
      setCambiandoEstado(false)
    }
  }

  const titulo = id === undefined ? "Nuevo ejercicio" : "Editar ejercicio"

  if (carga.fase !== "lista") {
    return (
      <PantallaDeFormulario>
        <Text style={estilos.titulo}>{titulo}</Text>
        {carga.fase === "cargando" ? (
          <ActivityIndicator
            color={tema.oro}
            style={estilos.espera}
            accessibilityLabel="Cargando el ejercicio"
          />
        ) : (
          <>
            <AvisoDeError mensaje={carga.fallo.texto} />
            {carga.fallo.reintentable && (
              <BotonPrincipal
                texto="REINTENTAR"
                onPress={() => {
                  setCarga({ fase: "cargando" })
                  setIntento((n) => n + 1)
                }}
              />
            )}
          </>
        )}
        <BotonSecundario texto="VOLVER" onPress={onCancelar} />
      </PantallaDeFormulario>
    )
  }

  return (
    <PantallaDeFormulario>
      <Text style={estilos.titulo}>{titulo}</Text>
      {estado === "retirado" && (
        <Text style={estilos.avisoRetirado}>
          Este ejercicio está retirado: no sale en la búsqueda ni se puede elegir en rutinas nuevas.
          Los entrenos que ya lo usan lo conservan.
        </Text>
      )}

      <Controller
        control={control}
        name="nombre"
        render={({ field: { onChange, onBlur, value } }) => (
          <Campo
            etiqueta="Nombre"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            maxLength={120}
            placeholder="Press de banca"
            error={
              errors.nombre === undefined
                ? undefined
                : errors.nombre.type === "duplicado"
                  ? "Ya existe un ejercicio con ese nombre"
                  : "Escribe el nombre del ejercicio"
            }
          />
        )}
      />

      <Text style={estilos.etiqueta}>GRUPO PRINCIPAL</Text>
      <Controller
        control={control}
        name="grupoPrincipal"
        render={({ field: { onChange, value } }) => (
          <View style={estilos.opciones} accessibilityRole="radiogroup">
            {GRUPOS_MUSCULARES.map((grupo) => (
              <Opcion
                key={grupo}
                rol="radio"
                etiqueta={ETIQUETA_DE_GRUPO[grupo]}
                marcada={grupo === value}
                onPress={() => {
                  onChange(grupo)
                  // El contrato rechaza el principal repetido entre los secundarios.
                  setValue(
                    "gruposSecundarios",
                    getValues("gruposSecundarios").filter((otro) => otro !== grupo),
                  )
                }}
              />
            ))}
          </View>
        )}
      />
      {errors.grupoPrincipal !== undefined && (
        <Text style={estilos.error} accessibilityRole="alert">
          Elige el grupo principal
        </Text>
      )}

      <Text style={estilos.etiqueta}>GRUPOS SECUNDARIOS (OPCIONAL)</Text>
      <Controller
        control={control}
        name="gruposSecundarios"
        render={({ field: { onChange, value } }) => (
          <View style={estilos.opciones}>
            {GRUPOS_MUSCULARES.map((grupo) => (
              <Opcion
                key={grupo}
                rol="checkbox"
                etiqueta={ETIQUETA_DE_GRUPO[grupo]}
                marcada={value.includes(grupo)}
                desactivada={grupo === principal}
                onPress={() => {
                  onChange(
                    value.includes(grupo)
                      ? value.filter((otro) => otro !== grupo)
                      : [...value, grupo],
                  )
                }}
              />
            ))}
          </View>
        )}
      />

      <Controller
        control={control}
        name="instrucciones"
        render={({ field: { onChange, onBlur, value } }) => (
          <Campo
            etiqueta="Instrucciones"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            maxLength={4000}
            placeholder="Cómo se hace, en pocas frases"
            error={errors.instrucciones !== undefined ? "Escribe las instrucciones" : undefined}
          />
        )}
      />

      {errorGeneral !== null && <AvisoDeError mensaje={errorGeneral} />}

      <BotonPrincipal texto="GUARDAR" onPress={() => void enviar()} ocupado={isSubmitting} />
      <BotonSecundario texto="CANCELAR" onPress={onCancelar} />

      {estado === "retirado" ? (
        <BotonSecundario
          texto="REPONER"
          ocupado={cambiandoEstado}
          onPress={() => void cambiarEstado("reponer")}
        />
      ) : estado === "publicado" && confirmandoRetirada ? (
        <View style={estilos.panel} accessibilityLiveRegion="polite">
          <Text style={estilos.textoPanel}>
            Dejará de salir en la búsqueda y en el selector de rutinas. No se borra nada y puedes
            reponerlo cuando quieras.
          </Text>
          <BotonDestructivo
            texto="CONFIRMAR RETIRADA"
            onPress={() => void cambiarEstado("retirar")}
          />
          <BotonSecundario
            texto="NO RETIRAR"
            onPress={() => {
              setConfirmandoRetirada(false)
            }}
          />
        </View>
      ) : estado === "publicado" ? (
        // Lejos de GUARDAR y en rojo: no es la acción de todos los días.
        <View style={estilos.zonaRetirada}>
          <BotonDestructivo
            texto="RETIRAR"
            ocupado={cambiandoEstado}
            onPress={() => {
              setConfirmandoRetirada(true)
            }}
          />
        </View>
      ) : null}
    </PantallaDeFormulario>
  )
}

function Opcion({
  rol,
  etiqueta,
  marcada,
  desactivada = false,
  onPress,
}: {
  rol: "radio" | "checkbox"
  etiqueta: string
  marcada: boolean
  desactivada?: boolean
  onPress: () => void
}): React.JSX.Element {
  return (
    <Pressable
      style={[
        estilos.opcion,
        marcada && estilos.opcionMarcada,
        desactivada && estilos.opcionApagada,
      ]}
      onPress={onPress}
      disabled={desactivada}
      accessibilityRole={rol}
      accessibilityLabel={etiqueta}
      accessibilityState={{ checked: marcada, disabled: desactivada }}
      hitSlop={4}
    >
      <Text style={[estilos.textoOpcion, marcada && estilos.textoOpcionMarcada]}>{etiqueta}</Text>
    </Pressable>
  )
}

const estilos = StyleSheet.create({
  titulo: { color: tema.texto, fontSize: 18, fontWeight: "600" },
  espera: { marginTop: 24 },
  etiqueta: {
    color: tema.oroSuave,
    fontSize: 11,
    letterSpacing: 2,
    marginBottom: 8,
    marginTop: 16,
  },
  opciones: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  opcion: {
    borderColor: tema.borde,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  opcionMarcada: { backgroundColor: tema.oro, borderColor: tema.oro },
  opcionApagada: { opacity: 0.35 },
  textoOpcion: { color: tema.texto, fontSize: 13 },
  textoOpcionMarcada: { color: tema.fondo, fontWeight: "700" },
  error: { color: tema.error, fontSize: 12, marginTop: 6 },
  avisoRetirado: { color: tema.oroSuave, fontSize: 13, lineHeight: 19, marginTop: 8 },
  zonaRetirada: { marginTop: 20 },
  panel: {
    borderColor: tema.error,
    borderWidth: 1,
    borderRadius: 8,
    marginTop: 20,
    padding: 14,
  },
  textoPanel: { color: tema.texto, fontSize: 13, lineHeight: 19 },
})
