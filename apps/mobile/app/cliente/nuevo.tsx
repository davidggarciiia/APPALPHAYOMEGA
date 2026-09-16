import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "expo-router"
import { useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { Pressable, StyleSheet, Text } from "react-native"
import { CrearUsuarioSchema, type CrearUsuario } from "@alpha-omega/shared"

import {
  AvisoDeError,
  BotonPrincipal,
  Campo,
  PantallaDeFormulario,
} from "../../src/componentes/formulario"
import { ErrorDelServidor, crearUsuario } from "../../src/lib/api"
import { faltaDe } from "../../src/lib/errores"
import { useSesion } from "../../src/sesion"
import { tema } from "../../src/tema"

/**
 * El alta, con la persona delante en el gimnasio.
 *
 * Tres campos y nada mas. El perfil nace pendiente y sin contrasena, asi que el
 * entrenador puede seguir trabajando sin esperar a que nadie abra su correo.
 *
 * El rol va fijado a cliente y no hay selector: la matriz de permisos concede
 * "crear, editar y desactivar clientes", y el nutricionista y el empleado se
 * administran en la tarea 18.
 */
export default function NuevoCliente(): React.JSX.Element {
  const { estado } = useSesion()
  const router = useRouter()
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CrearUsuario>({
    resolver: zodResolver(CrearUsuarioSchema),
    defaultValues: { nombre: "", apellidos: "", email: "", rol: "cliente" },
  })

  const tokenAcceso = estado.fase === "dentro" ? estado.tokenAcceso : null

  const enviar = handleSubmit(async (datos) => {
    if (tokenAcceso === null) return

    setErrorGeneral(null)

    try {
      const creado = await crearUsuario(tokenAcceso, { ...datos, rol: "cliente" })

      // Se va a la ficha y no a la lista. Lo siguiente en la vida real es
      // "¿te ha llegado?", y el boton de reenviar esta ahi.
      router.replace({ pathname: "/cliente/[id]", params: { id: creado.id } })
    } catch (error) {
      if (error instanceof ErrorDelServidor && error.codigo === 409) {
        setErrorGeneral("Ya existe una cuenta con ese correo.")
        return
      }

      setErrorGeneral(faltaDe(error, "No hemos podido crear la cuenta.").texto)
    }
  })

  return (
    <PantallaDeFormulario>
      <Text style={estilos.titulo}>Nuevo cliente</Text>
      <Text style={estilos.detalle}>
        Se crea al momento y le llega un correo para que elija su contraseña. Puedes asignarle
        entrenos antes de que lo abra.
      </Text>

      <Controller
        control={control}
        name="nombre"
        render={({ field: { onChange, onBlur, value } }) => (
          <Campo
            etiqueta="Nombre"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            autoFocus
            error={errors.nombre !== undefined ? "Escribe su nombre" : undefined}
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
        name="email"
        render={({ field: { onChange, onBlur, value } }) => (
          <Campo
            etiqueta="Correo"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="cliente@correo.com"
            error={errors.email !== undefined ? "Revisa el correo" : undefined}
          />
        )}
      />

      <Text style={estilos.detalle}>
        Si lo tecleas mal podrás corregirlo desde su ficha, mientras no haya activado la cuenta.
      </Text>

      {errorGeneral !== null && <AvisoDeError mensaje={errorGeneral} />}

      <BotonPrincipal texto="DAR DE ALTA" onPress={() => void enviar()} ocupado={isSubmitting} />

      <Pressable
        style={estilos.volver}
        onPress={() => {
          router.back()
        }}
        accessibilityRole="button"
      >
        <Text style={estilos.textoVolver}>CANCELAR</Text>
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
