import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "expo-router"
import { useEffect, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native"
import { CambiosDePerfilSchema, type CambiosDePerfil } from "@alpha-omega/shared"

import {
  AvisoDeError,
  BotonPrincipal,
  Campo,
  PantallaDeFormulario,
} from "../src/componentes/formulario"
import { ErrorDeRed, guardarPerfil, leerPerfil } from "../src/lib/api"
import { useSesion } from "../src/sesion"
import { tema } from "../src/tema"

type Fase = "cargando" | "listo" | "guardado" | "error"

export default function Perfil(): React.JSX.Element {
  const { estado } = useSesion()
  const router = useRouter()
  const [fase, setFase] = useState<Fase>("cargando")
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)
  const [correo, setCorreo] = useState("")

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CambiosDePerfil>({
    resolver: zodResolver(CambiosDePerfilSchema),
    defaultValues: { nombre: "", apellidos: "", telefono: "", fechaNacimiento: null },
  })

  const tokenAcceso = estado.fase === "dentro" ? estado.tokenAcceso : null

  useEffect(() => {
    if (tokenAcceso === null) {
      return
    }

    let vigente = true

    leerPerfil(tokenAcceso)
      .then((perfil) => {
        if (!vigente) return

        setCorreo(perfil.email)
        // Los nulos del servidor se convierten en texto vacio: un campo de
        // formulario no sabe que hacer con null y React avisaria de que el campo
        // pasa de no controlado a controlado.
        reset({
          nombre: perfil.nombre,
          apellidos: perfil.apellidos ?? "",
          telefono: perfil.telefono ?? "",
          fechaNacimiento: perfil.fechaNacimiento,
        })
        setFase("listo")
      })
      .catch(() => {
        if (vigente) setFase("error")
      })

    return () => {
      vigente = false
    }
  }, [tokenAcceso, reset])

  const enviar = handleSubmit(async (cambios) => {
    if (tokenAcceso === null) return

    setErrorGeneral(null)

    try {
      // Lo que el formulario deja vacio se envia como nulo, que es como el
      // servidor entiende "esto ya no lo quiero".
      await guardarPerfil(tokenAcceso, {
        nombre: cambios.nombre,
        apellidos: cambios.apellidos === "" ? null : cambios.apellidos,
        telefono: cambios.telefono === "" ? null : cambios.telefono,
        fechaNacimiento: cambios.fechaNacimiento === "" ? null : cambios.fechaNacimiento,
      })
      setFase("guardado")
    } catch (error) {
      setErrorGeneral(
        error instanceof ErrorDeRed
          ? "No hemos podido conectar. Revisa tu conexión."
          : "No se han podido guardar los cambios.",
      )
    }
  })

  if (fase === "cargando") {
    return (
      <View style={estilos.centrado}>
        <ActivityIndicator color={tema.oro} accessibilityLabel="Cargando tu perfil" />
      </View>
    )
  }

  if (fase === "error") {
    return (
      <PantallaDeFormulario>
        <Text style={estilos.titulo}>No hemos podido cargar tu perfil</Text>
        <Text style={estilos.detalle}>Comprueba tu conexión y vuelve a entrar.</Text>
      </PantallaDeFormulario>
    )
  }

  return (
    <PantallaDeFormulario>
      <Text style={estilos.titulo}>Tu perfil</Text>

      <Text style={estilos.etiquetaFija}>CORREO</Text>
      <Text style={estilos.valorFijo}>{correo}</Text>
      <Text style={estilos.detalle}>
        El correo no se cambia desde aquí. Pídeselo a tu entrenador.
      </Text>

      <Controller
        control={control}
        name="nombre"
        render={({ field: { onChange, onBlur, value } }) => (
          <Campo
            etiqueta="Nombre"
            value={value ?? ""}
            onChangeText={onChange}
            onBlur={onBlur}
            error={errors.nombre !== undefined ? "Escribe tu nombre" : undefined}
          />
        )}
      />

      <Controller
        control={control}
        name="apellidos"
        render={({ field: { onChange, onBlur, value } }) => (
          <Campo
            etiqueta="Apellidos"
            value={value ?? ""}
            onChangeText={onChange}
            onBlur={onBlur}
            error={errors.apellidos?.message}
          />
        )}
      />

      <Controller
        control={control}
        name="telefono"
        render={({ field: { onChange, onBlur, value } }) => (
          <Campo
            etiqueta="Teléfono"
            value={value ?? ""}
            onChangeText={onChange}
            onBlur={onBlur}
            keyboardType="phone-pad"
            placeholder="+34 600 00 00 00"
            error={errors.telefono?.message}
          />
        )}
      />

      <Controller
        control={control}
        name="fechaNacimiento"
        render={({ field: { onChange, onBlur, value } }) => (
          <Campo
            etiqueta="Fecha de nacimiento"
            value={value ?? ""}
            onChangeText={(texto) => onChange(texto === "" ? null : texto)}
            onBlur={onBlur}
            keyboardType="numbers-and-punctuation"
            placeholder="AAAA-MM-DD"
            error={errors.fechaNacimiento?.message}
          />
        )}
      />

      {errorGeneral !== null && <AvisoDeError mensaje={errorGeneral} />}

      {fase === "guardado" && errorGeneral === null && (
        <Text style={estilos.confirmacion} accessibilityLiveRegion="polite">
          Guardado
        </Text>
      )}

      <BotonPrincipal texto="GUARDAR" onPress={() => void enviar()} ocupado={isSubmitting} />

      <Pressable
        style={estilos.volver}
        onPress={() => {
          router.back()
        }}
        accessibilityRole="button"
      >
        <Text style={estilos.textoVolver}>VOLVER</Text>
      </Pressable>
    </PantallaDeFormulario>
  )
}

const estilos = StyleSheet.create({
  centrado: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tema.fondo,
  },
  titulo: { color: tema.texto, fontSize: 18, fontWeight: "600" },
  detalle: { color: tema.textoTenue, fontSize: 12, marginTop: 6, lineHeight: 17 },
  etiquetaFija: { color: tema.oroSuave, fontSize: 11, letterSpacing: 2, marginTop: 20 },
  valorFijo: { color: tema.texto, fontSize: 16, marginTop: 6 },
  confirmacion: { color: tema.oroSuave, fontSize: 14, textAlign: "center", marginTop: 16 },
  volver: { alignItems: "center", marginTop: 16, paddingVertical: 12 },
  textoVolver: { color: tema.textoTenue, fontSize: 12, letterSpacing: 2 },
})
