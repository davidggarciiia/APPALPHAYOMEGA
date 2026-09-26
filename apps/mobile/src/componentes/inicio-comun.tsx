import { useRouter } from "expo-router"
import { useState } from "react"
import { StyleSheet, Text, View } from "react-native"

import { hayPendientes } from "../entrenamiento-cliente/almacen-borradores"
import { useSesion } from "../sesion"

import { Aviso, Avatar, BotonSobrio, EnlaceOro, FilaDeLista, Lista, texto } from "./diseno"

/** «HOLA, LAURA» con las iniciales a la derecha, como en Main.dc.html. */
export function Saludo(): React.JSX.Element | null {
  const { estado } = useSesion()
  const router = useRouter()
  if (estado.fase !== "dentro" && estado.fase !== "local") {
    return null
  }
  const { usuario } = estado
  return (
    <View style={estilos.saludo}>
      <View style={estilos.flexible}>
        <Text style={texto.marca}>Alpha &amp; Omega Training</Text>
        <Text style={texto.titulo} accessibilityRole="header">
          {`Hola, ${usuario.nombre}`}
        </Text>
      </View>
      <Avatar
        nombre={usuario.nombre}
        apellidos={usuario.apellidos}
        onPress={estado.fase === "dentro" ? () => router.push("/perfil") : undefined}
      />
    </View>
  )
}

/** Aviso del modo sin conexión, con la opción de volver a probar. */
export function AvisoSinConexion(): React.JSX.Element | null {
  const { estado, reconectar } = useSesion()
  const [reconectando, setReconectando] = useState(false)
  if (estado.fase !== "local") {
    return null
  }
  return (
    <Aviso>
      <Text style={texto.cuerpo}>
        Sin conexión. Puedes seguir registrando las sesiones que ya tenías descargadas; se enviará
        todo cuando vuelva la red.
      </Text>
      <EnlaceOro
        texto={reconectando ? "Probando…" : "Probar conexión"}
        onPress={() => {
          setReconectando(true)
          void reconectar().finally(() => setReconectando(false))
        }}
      />
    </Aviso>
  )
}

/**
 * «Mi perfil» y «Cerrar sesión».
 *
 * Antes de salir se mira si hay registros que el servidor aún no tiene: salir
 * borra lo de esta cuenta del móvil, y eso no puede pasar sin avisar.
 */
export function SeccionCuenta(): React.JSX.Element | null {
  const { estado, salir } = useSesion()
  const router = useRouter()
  const [avisoDeSalida, setAvisoDeSalida] = useState(false)
  const [saliendo, setSaliendo] = useState(false)
  if (estado.fase !== "dentro" && estado.fase !== "local") {
    return null
  }
  const { usuario } = estado
  const enLocal = estado.fase === "local"

  const pedirSalida = async (): Promise<void> => {
    const pendientes = await hayPendientes(usuario.id).catch(() => false)
    if (pendientes) {
      setAvisoDeSalida(true)
      return
    }
    setSaliendo(true)
    await salir()
  }

  return (
    <View style={estilos.seccion}>
      <Text style={texto.seccion}>Cuenta</Text>
      <Lista destacada={false}>
        {!enLocal && (
          <FilaDeLista
            titulo="Mi perfil"
            subtitulo={usuario.email}
            onPress={() => router.push("/perfil")}
          />
        )}
        <FilaDeLista
          titulo={saliendo ? "Saliendo…" : "Cerrar sesión"}
          onPress={avisoDeSalida || saliendo ? undefined : () => void pedirSalida()}
          derecha={null}
          ultima
        />
      </Lista>
      {avisoDeSalida && (
        <Aviso tono="error">
          <Text style={texto.cuerpo}>
            Tienes entrenos registrados en este móvil que todavía no se han podido enviar al
            servidor. Si sales ahora se borrarán de este móvil.
          </Text>
          <BotonSobrio texto="Salir y descartarlos" peligro onPress={() => void salir()} />
          <BotonSobrio texto="Cancelar" onPress={() => setAvisoDeSalida(false)} />
        </Aviso>
      )}
    </View>
  )
}

const estilos = StyleSheet.create({
  saludo: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  flexible: { flex: 1, gap: 18 },
  seccion: { gap: 14 },
})
