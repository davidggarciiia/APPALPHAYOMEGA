import { zodResolver } from "@hookform/resolvers/zod"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { Pressable, StyleSheet, Text } from "react-native"
import { z } from "zod"
import { ContrasenaNuevaSchema } from "@alpha-omega/shared"

import {
  AvisoDeError,
  BotonPrincipal,
  Campo,
  PantallaDeFormulario,
} from "../src/componentes/formulario"
import { restablecerContrasena } from "../src/lib/api"
import { faltaDe } from "../src/lib/errores"
import { tema } from "../src/tema"

const FormularioSchema = z
  .object({
    contrasena: ContrasenaNuevaSchema,
    repetida: z.string(),
  })
  .refine((datos) => datos.contrasena === datos.repetida, {
    message: "Las dos contraseñas no coinciden",
    path: ["repetida"],
  })

type Formulario = z.infer<typeof FormularioSchema>

/**
 * Donde aterriza el enlace de "he olvidado mi contrasena".
 *
 * Es gemela de la pantalla de activacion y aun asi vive aparte: alli se estrena
 * una cuenta y aqui se rescata una que ya existe, con sus sesiones abiertas por
 * el mundo. Fundirlas obligaria a la misma pantalla a explicar dos situaciones
 * que no se parecen en nada.
 */
export default function Restablecer(): React.JSX.Element {
  const parametros = useLocalSearchParams<{ token?: string | string[] }>()
  const router = useRouter()
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)
  const [hecho, setHecho] = useState(false)

  // El parametro llega de un enlace de fuera: puede faltar, venir vacio o venir
  // repetido, y entonces expo-router entrega un array.
  const token = Array.isArray(parametros.token) ? parametros.token[0] : parametros.token

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Formulario>({
    resolver: zodResolver(FormularioSchema),
    defaultValues: { contrasena: "", repetida: "" },
  })

  const enviar = handleSubmit(async ({ contrasena }) => {
    setErrorGeneral(null)

    if (token === undefined || token === "") {
      setErrorGeneral("Este enlace no es válido. Pide otro desde la pantalla de entrada.")
      return
    }

    try {
      await restablecerContrasena(token, contrasena)
      setHecho(true)
    } catch (error) {
      // Un enlace gastado, caducado o inventado responden igual, y la pantalla
      // no intenta adivinar cual de los tres es.
      setErrorGeneral(
        faltaDe(error, "Este enlace ya no vale. Pide otro desde la pantalla de entrada.").texto,
      )
    }
  })

  if (hecho) {
    return (
      <PantallaDeFormulario>
        <Text style={estilos.titulo}>Contraseña cambiada</Text>
        <Text style={estilos.detalle}>
          Ya puedes entrar con la nueva. Por seguridad hemos cerrado las sesiones que tuvieras
          abiertas en otros dispositivos.
        </Text>

        <BotonPrincipal
          texto="ENTRAR"
          onPress={() => {
            router.replace("/login")
          }}
        />
      </PantallaDeFormulario>
    )
  }

  return (
    <PantallaDeFormulario>
      <Text style={estilos.titulo}>Elige una contraseña nueva</Text>
      <Text style={estilos.detalle}>
        Una frase que recuerdes vale más que algo corto y retorcido. Al cambiarla se cerrarán tus
        sesiones abiertas.
      </Text>

      <Controller
        control={control}
        name="contrasena"
        render={({ field: { onChange, onBlur, value } }) => (
          <Campo
            etiqueta="Contraseña"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            secureTextEntry
            autoComplete="new-password"
            placeholder="al menos 10 caracteres"
            error={errors.contrasena?.message}
          />
        )}
      />

      <Controller
        control={control}
        name="repetida"
        render={({ field: { onChange, onBlur, value } }) => (
          <Campo
            etiqueta="Repítela"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            secureTextEntry
            autoComplete="new-password"
            returnKeyType="go"
            onSubmitEditing={() => void enviar()}
            error={errors.repetida?.message}
          />
        )}
      />

      {errorGeneral !== null && <AvisoDeError mensaje={errorGeneral} />}

      <BotonPrincipal
        texto="CAMBIAR MI CONTRASEÑA"
        onPress={() => void enviar()}
        ocupado={isSubmitting}
      />

      <Pressable
        style={estilos.volver}
        onPress={() => {
          router.replace("/login")
        }}
        accessibilityRole="button"
      >
        <Text style={estilos.textoVolver}>VOLVER A ENTRAR</Text>
      </Pressable>
    </PantallaDeFormulario>
  )
}

const estilos = StyleSheet.create({
  titulo: { color: tema.texto, fontSize: 18, fontWeight: "600" },
  detalle: { color: tema.textoTenue, fontSize: 12, marginTop: 8, lineHeight: 17 },
  volver: { alignItems: "center", marginTop: 16, paddingVertical: 12 },
  textoVolver: { color: tema.textoTenue, fontSize: 12, letterSpacing: 2 },
})
