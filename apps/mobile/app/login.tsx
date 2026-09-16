import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { CredencialesSchema, type Credenciales } from "@alpha-omega/shared"

import {
  AvisoDeError,
  BotonPrincipal,
  Campo,
  PantallaDeFormulario,
} from "../src/componentes/formulario"
import { ErrorDeRed, ErrorDeSesion } from "../src/lib/api"
import { useSesion } from "../src/sesion"

export default function Login(): React.JSX.Element {
  const { entrar, sesionCaducada } = useSesion()
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Credenciales>({
    resolver: zodResolver(CredencialesSchema),
    defaultValues: { email: "", contrasena: "" },
  })

  const enviar = handleSubmit(async (credenciales) => {
    setErrorGeneral(null)

    try {
      await entrar(credenciales)
    } catch (error) {
      // Un mismo mensaje para credenciales mal y para correo inexistente. El
      // servidor ya no los distingue; la app tampoco debe hacerlo, o se pierde
      // aqui lo que se protegio alli.
      if (error instanceof ErrorDeSesion) {
        setErrorGeneral("Correo o contraseña incorrectos")
      } else if (error instanceof ErrorDeRed) {
        setErrorGeneral("No hemos podido conectar. Revisa tu conexión.")
      } else {
        setErrorGeneral("Algo ha fallado en el servidor. Inténtalo en un momento.")
      }
    }
  })

  return (
    <PantallaDeFormulario>
      {sesionCaducada && <AvisoDeError mensaje="Tu sesión ha caducado. Entra otra vez." />}

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
            error={errors.email !== undefined ? "Correo no válido" : undefined}
          />
        )}
      />

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
            autoComplete="current-password"
            placeholder="••••••••"
            returnKeyType="go"
            onSubmitEditing={() => void enviar()}
            error={errors.contrasena !== undefined ? "Escribe tu contraseña" : undefined}
          />
        )}
      />

      {errorGeneral !== null && <AvisoDeError mensaje={errorGeneral} />}

      <BotonPrincipal texto="ENTRAR" onPress={() => void enviar()} ocupado={isSubmitting} />
    </PantallaDeFormulario>
  )
}
