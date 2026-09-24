import { useCallback, useState } from "react"
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router"
import { Text } from "react-native"
import type { Comida, ComidaRegistrada, DietaPublicada } from "@alpha-omega/shared"

import { AvisoDeError, PantallaDeFormulario } from "../../src/componentes/formulario"
import { almacenDispositivo } from "../../src/entrenamiento/almacen-dispositivo"
import { hoyAgenda } from "../../src/entrenamiento/fechas"
import { useNutricion } from "../../src/nutricion/api"
import { ComidaDelDia } from "../../src/nutricion/comida-del-dia"
import { leerCopia } from "../../src/nutricion/copia-local"
import { tipoDelDia } from "../../src/nutricion/hoy-modelo"
import { useSesion } from "../../src/sesion"
import { tema } from "../../src/tema"

type Estado =
  | { fase: "cargando" }
  | { fase: "error"; mensaje: string }
  | {
      fase: "lista"
      dieta: DietaPublicada
      comida: Comida
      registrada?: ComidaRegistrada
      enLinea: boolean
    }

/** Una comida de hoy: elegir la opción o armar el plato y guardarla como hecha. */
export default function ComidaDeHoy(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { estado: sesion } = useSesion()
  const api = useNutricion()
  const router = useRouter()
  const [estado, setEstado] = useState<Estado>({ fase: "cargando" })
  const clienteId = "usuario" in sesion ? sesion.usuario.id : null
  const hoy = hoyAgenda()
  const volver = (): void => (router.canGoBack() ? router.back() : router.replace("/nutricion"))

  useFocusEffect(
    useCallback(() => {
      if (clienteId === null) return
      let vigente = true
      const buscar = (dieta: DietaPublicada | null): Comida | undefined =>
        dieta ? tipoDelDia(dieta.documento, hoy)?.comidas.find((c) => c.id === id) : undefined
      const cargar = async (): Promise<void> => {
        try {
          const [{ dieta }, { comidas }] = await Promise.all([
            api.vigente(clienteId),
            api.comidas(clienteId, hoy, hoy),
          ])
          const comida = buscar(dieta)
          if (!vigente) return
          setEstado(
            dieta && comida
              ? {
                  fase: "lista",
                  dieta,
                  comida,
                  registrada: comidas.find((c) => c.comidaId === comida.id),
                  enLinea: true,
                }
              : { fase: "error", mensaje: "Esta comida ya no está en tu dieta de hoy." },
          )
        } catch {
          const copia = await leerCopia(almacenDispositivo, clienteId).catch(() => null)
          const comida = buscar(copia?.dieta ?? null)
          if (!vigente) return
          setEstado(
            copia?.dieta && comida
              ? { fase: "lista", dieta: copia.dieta, comida, enLinea: false }
              : { fase: "error", mensaje: "Necesitas conexión para abrir esta comida." },
          )
        }
      }
      void cargar()
      return () => {
        vigente = false
      }
    }, [api, clienteId, hoy, id]),
  )

  return (
    <PantallaDeFormulario sinTarjeta>
      {estado.fase === "cargando" && (
        <Text style={{ color: tema.textoTenue, fontFamily: tema.fuenteTexto }}>Cargando…</Text>
      )}
      {estado.fase === "error" && <AvisoDeError mensaje={estado.mensaje} />}
      {estado.fase === "lista" && clienteId !== null && (
        <ComidaDelDia
          comida={estado.comida}
          registrada={estado.registrada}
          soloLectura={!estado.enLinea || estado.dieta.documento.registroComidas === false}
          volver={volver}
          registrar={async (eleccion) => {
            await api.registrarComida(clienteId, hoy, estado.comida.id, {
              dietaId: estado.dieta.id,
              eleccion,
            })
          }}
          quitar={() => api.quitarComida(clienteId, hoy, estado.comida.id)}
        />
      )}
    </PantallaDeFormulario>
  )
}
