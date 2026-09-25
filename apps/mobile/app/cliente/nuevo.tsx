import { zodResolver } from "@hookform/resolvers/zod"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { StyleSheet, Text } from "react-native"
import { CrearUsuarioSchema, type CrearUsuario, type Rol } from "@alpha-omega/shared"

import {
  AvisoDeError,
  BotonPrincipal,
  Campo,
  PantallaDeFormulario,
} from "../../src/componentes/formulario"
import { Pulsable } from "../../src/componentes/pulsable"
import { ErrorDelServidor, crearUsuario } from "../../src/lib/api"
import { faltaDe } from "../../src/lib/errores"
import { useSesion } from "../../src/sesion"
import { tema } from "../../src/tema"

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
const PERFILES: Partial<Record<Rol, { titulo: string; explicacion: string }>> = {
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
  const { estado } = useSesion()
  const router = useRouter()
  const parametros = useLocalSearchParams<{ rol?: string | string[] }>()
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)

  // El parametro llega de fuera: solo se acepta si es uno de los dos perfiles
  // que esta pantalla sabe crear. Cualquier otra cosa da de alta a un cliente.
  const pedido = Array.isArray(parametros.rol) ? parametros.rol[0] : parametros.rol
  const rol: Rol = pedido === "nutricionista" ? "nutricionista" : "cliente"
  const perfil = PERFILES[rol] ?? PERFILES.cliente

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
      const creado = await crearUsuario(tokenAcceso, { ...datos, rol })

      // Se va a la ficha y no a la lista. Lo siguiente en la vida real es
      // "¿te ha llegado?", y el boton de reenviar esta ahi.
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

  return (
    <PantallaDeFormulario>
      <Text style={estilos.titulo}>{perfil?.titulo}</Text>
      <Text style={estilos.detalle}>{perfil?.explicacion}</Text>

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

      <Pulsable
        style={estilos.volver}
        hitSlop={4}
        onPress={() => {
          router.back()
        }}
        accessibilityRole="button"
      >
        <Text style={estilos.textoVolver}>CANCELAR</Text>
      </Pulsable>
    </PantallaDeFormulario>
  )
}

const estilos = StyleSheet.create({
  titulo: { color: tema.texto, fontSize: 18, fontWeight: "600" },
  detalle: { color: tema.textoTenue, fontSize: 12, marginTop: 8, lineHeight: 17 },
  volver: { alignItems: "center", marginTop: 16, paddingVertical: 12 },
  textoVolver: { color: tema.textoTenue, fontSize: 12, letterSpacing: 2 },
})
