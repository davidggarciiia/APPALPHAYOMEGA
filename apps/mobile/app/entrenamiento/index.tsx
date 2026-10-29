import { useState } from "react"
import { useRouter } from "expo-router"
import { Text, View } from "react-native"
import { BotonSecundario, PantallaDeFormulario } from "../../src/componentes/formulario"
import { PlanCliente } from "../../src/entrenamiento/plan/plan-cliente"
import { SemanaEntrenamiento } from "../../src/entrenamiento/semana"
import { useEntrenamiento } from "../../src/entrenamiento/use-entrenamiento"
import { useSesion } from "../../src/sesion"
import { tema } from "../../src/tema"
import { Pestanas } from "../../src/componentes/piezas"

const VISTAS = [
  { valor: "semana", texto: "Semana" },
  { valor: "rutina", texto: "Rutina" },
  { valor: "bloque", texto: "Bloque" },
  { valor: "guia", texto: "Guía" },
] as const

export default function MiEntrenamiento(): React.JSX.Element {
  const { estado, salir, reintentar } = useSesion()
  const api = useEntrenamiento()
  const router = useRouter()
  const [vista, setVista] = useState<"semana" | "rutina" | "bloque" | "guia">("semana")
  const abrir = (id: string): void =>
    router.push({ pathname: "/entrenamiento/[id]", params: { id } })
  return (
    <PantallaDeFormulario sinTarjeta>
      {"usuario" in estado && estado.usuario.rol === "cliente" ? (
        <View style={{ gap: 16 }}>
          <Pestanas opciones={VISTAS} activa={vista} cambiar={setVista} variante="pil" />
          {vista === "semana" ? (
            <SemanaEntrenamiento
              clienteId={estado.usuario.id}
              api={api}
              abrir={abrir}
              copiaLocal
              detectarEmpezadas
            />
          ) : (
            <PlanCliente clienteId={estado.usuario.id} api={api} abrir={abrir} pestana={vista} />
          )}
        </View>
      ) : (
        <Text style={{ fontFamily: tema.fuenteTexto, color: tema.texto }}>
          Esta pantalla requiere una cuenta de cliente.
        </Text>
      )}
      {estado.fase === "local" ? (
        <>
          <Text style={{ fontFamily: tema.fuenteTexto, color: tema.textoTenue }}>
            Sin conexión · puedes abrir las sesiones descargadas.
          </Text>
          <BotonSecundario texto="Reconectar" onPress={reintentar} />
          <BotonSecundario texto="Cerrar sesión" onPress={() => void salir()} />
        </>
      ) : null}
    </PantallaDeFormulario>
  )
}
