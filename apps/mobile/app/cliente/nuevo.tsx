import { zodResolver } from "@hookform/resolvers/zod"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { StyleSheet, Text } from "react-native"
import { CrearUsuarioSchema, type CrearUsuario } from "@alpha-omega/shared"

import {
  AvisoDeError,
  BotonEnlace,
  BotonPrincipal,
  BotonSecundario,
  Campo,
  PantallaDeFormulario,
} from "../../src/componentes/formulario"
import { ErrorDelServidor, crearUsuario } from "../../src/lib/api"
import { faltaDe } from "../../src/lib/errores"
import { useSesion } from "../../src/sesion"
import { tema, tipo } from "../../src/tema"

/**
 * Que perfil se esta creando.
 *
 * Por defecto un cliente, que es el alta de todos los dias. El nutricionista
 * llega aqui desde la pantalla de reparto, y solo cuando todavia no existe:
 * crearlo es el paso previo a poder asignarle a nadie.
 *
 * No hay selector libre de rol. Un desplegable con "entrenador" dentro seria una
 * via comoda para crear un segundo administrador sin querer.
 */
const PERFILES = {
  cliente: {
    titulo: "Nuevo cliente",
    explicacion:
      "Se crea al momento y le llega un correo para que elija su contraseña. Puedes asignarle entrenos antes de que lo abra.",
  },
  nutricionista: {
    titulo: "Nuevo nutricionista",
    explicacion:
      "Podrá editar las dietas de los clientes que tú le asignes, y no verá absolutamente nada del resto.",
  },
}

/**
 * El alta, con la persona delante en el gimnasio.
 *
 * Tres campos y nada mas. El perfil nace pendiente y sin contrasena, asi que el
 * entrenador puede seguir trabajando sin esperar a que nadie abra su correo.
 */
export default function NuevoCliente(): React.JSX.Element {
  const { estado, pedir } = useSesion()
  const router = useRouter()
  const parametros = useLocalSearchParams<{ rol?: string | string[] }>()
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)
  const [clienteCreado, setClienteCreado] = useState<{
    id: string
    correoEnviado: boolean
  } | null>(null)

  // El parametro llega de fuera: solo se acepta si es uno de los dos perfiles
  // que esta pantalla sabe crear. Cualquier otra cosa da de alta a un cliente.
  const pedido = Array.isArray(parametros.rol) ? parametros.rol[0] : parametros.rol
  const rol = pedido === "nutricionista" ? "nutricionista" : "cliente"
  const perfil = PERFILES[rol]

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CrearUsuario>({
    resolver: zodResolver(CrearUsuarioSchema),
    defaultValues: { nombre: "", apellidos: "", email: "", rol },
  })

  const tokenAcceso = estado.fase === "dentro" ? estado.tokenAcceso : null

  const enviar = handleSubmit(async (datos) => {
    if (tokenAcceso === null) return

    setErrorGeneral(null)

    try {
      const creado = await crearUsuario(pedir, { ...datos, rol })

      if (rol === "cliente") {
        setClienteCreado(creado)
        return
      }

      router.replace({
        pathname: "/cliente/[id]",
        params: { id: creado.id, correoFallido: creado.correoEnviado ? "0" : "1" },
      })
    } catch (error) {
      if (error instanceof ErrorDelServidor && error.codigo === 409) {
        setErrorGeneral("Ya existe una cuenta con ese correo.")
        return
      }

      setErrorGeneral(faltaDe(error, "No hemos podido crear la cuenta.").texto)
    }
  })

  if (clienteCreado)
    return (
      <PantallaDeFormulario>
        <Text style={estilos.titulo} accessibilityRole="header">
          Cliente creado
        </Text>
        {!clienteCreado.correoEnviado && (
          <AvisoDeError mensaje="La cuenta se ha creado, pero no se pudo enviar el correo de activación. Puedes reenviarlo desde Datos y acceso." />
        )}
        <BotonPrincipal
          texto="Valoración inicial"
          onPress={() =>
            router.replace({
              pathname: "/entrenador/cliente/[id]",
              params: { id: clienteCreado.id, valoracionInicial: "1" },
            })
          }
        />
        <BotonSecundario
          texto="Datos y acceso"
          onPress={() =>
            router.replace({
              pathname: "/cliente/[id]",
              params: {
                id: clienteCreado.id,
                correoFallido: clienteCreado.correoEnviado ? "0" : "1",
              },
            })
          }
        />
      </PantallaDeFormulario>
    )

  return (
    <PantallaDeFormulario>
      <Text style={estilos.titulo}>{perfil.titulo}</Text>
      <Text style={estilos.detalle}>{perfil.explicacion}</Text>

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

      <BotonEnlace texto="CANCELAR" onPress={() => router.back()} />
    </PantallaDeFormulario>
  )
}

const estilos = StyleSheet.create({
  titulo: { ...tipo.tituloPantalla, color: tema.texto },
  detalle: {
    fontFamily: tema.fuenteTexto,
    color: tema.textoTenue,
    fontSize: 12,
    marginTop: 8,
    lineHeight: 17,
  },
})
