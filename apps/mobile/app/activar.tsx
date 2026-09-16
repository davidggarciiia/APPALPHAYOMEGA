import { zodResolver } from "@hookform/resolvers/zod"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { Text, StyleSheet } from "react-native"
import { z } from "zod"
import { ContrasenaNuevaSchema } from "@alpha-omega/shared"

import {
  AvisoDeError,
  BotonPrincipal,
  Campo,
  PantallaDeFormulario,
} from "../src/componentes/formulario"
import { ErrorDeRed, activarCuenta } from "../src/lib/api"
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
 * Donde aterriza el enlace del correo de activacion.
 *
 * Es el primer contacto de cada cliente con el producto. Antes esta pantalla no
 * existia: el enlace abria la app y mostraba un error de ruta no encontrada, asi
 * que activar una cuenta era literalmente imposible desde un movil.
 */
export default function Activar(): React.JSX.Element {
  const { token } = useLocalSearchParams<{ token?: string }>()
  const router = useRouter()
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)
  const [hecho, setHecho] = useState(false)

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
      setErrorGeneral("Este enlace no es válido. Pídele otro a tu entrenador.")
      return
    }

    try {
      await activarCuenta(token, contrasena)
      setHecho(true)
      router.replace("/login")
    } catch (error) {
      if (error instanceof ErrorDeRed) {
        setErrorGeneral("No hemos podido conectar. Revisa tu conexión.")
      } else {
        // El servidor no distingue enlace inexistente, usado o caducado, y la
        // app tampoco debe hacerlo.
        setErrorGeneral("Este enlace ya no sirve. Pídele otro a tu entrenador.")
      }
    }
  })

  if (token === undefined || token === "") {
    return (
      <PantallaDeFormulario>
        <Text style={estilos.titulo}>Enlace incompleto</Text>
        <Text style={estilos.detalle}>
          Abre el enlace desde el correo que te enviamos, sin copiarlo a mano.
        </Text>
      </PantallaDeFormulario>
    )
  }

  return (
    <PantallaDeFormulario>
      <Text style={estilos.titulo}>Elige tu contraseña</Text>
      <Text style={estilos.detalle}>
        Con ella entrarás a partir de ahora. Una frase que recuerdes vale más que algo corto y
        retorcido.
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
        texto={hecho ? "LISTO" : "ACTIVAR MI CUENTA"}
        onPress={() => void enviar()}
        ocupado={isSubmitting}
      />
    </PantallaDeFormulario>
  )
}

const estilos = StyleSheet.create({
  titulo: { color: tema.texto, fontSize: 18, fontWeight: "600" },
  detalle: { color: tema.textoTenue, fontSize: 13, lineHeight: 19, marginTop: 8 },
})
