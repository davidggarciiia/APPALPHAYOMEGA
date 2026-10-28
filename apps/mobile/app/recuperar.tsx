import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "expo-router"
import { useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { StyleSheet, Text } from "react-native"
import { SolicitudRecuperacionSchema, type SolicitudRecuperacion } from "@alpha-omega/shared"

import {
  AvisoDeError,
  BotonEnlace,
  BotonPrincipal,
  Campo,
  PantallaDeFormulario,
} from "../src/componentes/formulario"
import { pedirEnlaceDeRecuperacion } from "../src/lib/api"
import { useEnvioUnico } from "../src/lib/envio-unico"
import { faltaDe } from "../src/lib/errores"
import { tema } from "../src/tema"

/**
 * "He olvidado mi contrasena".
 *
 * La pantalla dice lo mismo tanto si la cuenta existe como si no, igual que el
 * servidor. Contestar "ese correo no esta registrado" seria comodo y convertiria
 * esta pantalla en un buscador de quien es cliente del entrenador.
 */
export default function Recuperar(): React.JSX.Element {
  const router = useRouter()
  const [enviado, setEnviado] = useState(false)
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SolicitudRecuperacion>({
    resolver: zodResolver(SolicitudRecuperacionSchema),
    defaultValues: { email: "" },
  })

  const enviar = handleSubmit(async ({ email }) => {
    setErrorGeneral(null)

    try {
      await pedirEnlaceDeRecuperacion(email)
      setEnviado(true)
    } catch (error) {
      // Solo se cuenta lo que es de verdad un problema de esta app: no haber
      // podido hablar con el servidor. Lo demas ya viene sin distinguir.
      setErrorGeneral(faltaDe(error, "No hemos podido enviar el correo.").texto)
    }
  })
  const enviarUnaVez = useEnvioUnico(enviar)

  if (enviado) {
    return (
      <PantallaDeFormulario acceso>
        <Text style={estilos.titulo}>Mira tu correo</Text>
        <Text style={estilos.detalle}>
          Si esa dirección tiene cuenta, le acaba de llegar un enlace para elegir una contraseña
          nueva. Caduca en una hora y solo sirve una vez.
        </Text>
        <Text style={estilos.detalle}>
          Si no te llega, revisa la carpeta de spam o pídeselo a tu entrenador.
        </Text>

        <BotonEnlace texto="VOLVER A ENTRAR" onPress={() => router.replace("/login")} />
      </PantallaDeFormulario>
    )
  }

  return (
    <PantallaDeFormulario acceso>
      <Text style={estilos.titulo}>¿Has olvidado tu contraseña?</Text>
      <Text style={estilos.detalle}>
        Escribe tu correo y te mandamos un enlace para elegir una nueva.
      </Text>

      <Controller
        control={control}
        name="email"
        render={({ field: { onChange, onBlur, value } }) => (
          <Campo
            etiqueta="Correo"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="tu@correo.com"
            autoFocus
            returnKeyType="send"
            onSubmitEditing={enviarUnaVez}
            error={errors.email !== undefined ? "Correo no válido" : undefined}
          />
        )}
      />

      {errorGeneral !== null && <AvisoDeError mensaje={errorGeneral} />}

      <BotonPrincipal texto="ENVIARME EL ENLACE" onPress={enviarUnaVez} ocupado={isSubmitting} />

      <BotonEnlace texto="VOLVER" onPress={() => router.back()} />
    </PantallaDeFormulario>
  )
}

const estilos = StyleSheet.create({
  titulo: { fontFamily: tema.fuenteSemi, color: tema.sobreOscuro, fontSize: 18 },
  detalle: {
    fontFamily: tema.fuenteTexto,
    color: tema.tenueSobreOscuro,
    fontSize: 12,
    marginTop: 8,
    lineHeight: 17,
  },
})
