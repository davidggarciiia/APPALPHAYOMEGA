import { useCallback, useState } from "react"
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router"
import { View } from "react-native"
import type { Comida, ComidaRegistrada, DietaPublicada } from "@alpha-omega/shared"

import { BotonSecundario, PantallaDeFormulario } from "../../src/componentes/formulario"
import { Aviso } from "../../src/componentes/aviso"
import { Esqueleto, GrupoEsqueletos } from "../../src/componentes/esqueleto"
import { almacenDispositivo } from "../../src/entrenamiento/almacen-dispositivo"
import { hoyAgenda } from "../../src/entrenamiento/fechas"
import { faltaDe, type Falta } from "../../src/lib/errores"
import { ErrorDeRed } from "../../src/lib/http"
import { useNutricion } from "../../src/nutricion/api"
import { ComidaDelDia } from "../../src/nutricion/comida-del-dia"
import { leerCopia } from "../../src/nutricion/copia-local"
import { tipoDelDia } from "../../src/nutricion/hoy-modelo"
import { useSesion } from "../../src/sesion"
import { espacio, radio } from "../../src/tema"

type Estado =
  | { fase: "cargando" }
  | { fase: "error"; falta: Falta; sinConexion: boolean }
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
  const [intento, setIntento] = useState(0)
  const clienteId = "usuario" in sesion ? sesion.usuario.id : null
  const hoy = hoyAgenda()
  const volver = (): void => (router.canGoBack() ? router.back() : router.replace("/nutricion"))

  // Lee la comida del servidor o, sin red, de la última copia de la dieta.
  const cargar = useCallback(
    async (cliente: string): Promise<Estado> => {
      const buscar = (dieta: DietaPublicada | null): Comida | undefined =>
        dieta ? tipoDelDia(dieta.documento, hoy)?.comidas.find((c) => c.id === id) : undefined
      try {
        const lecturas = await Promise.allSettled([
          api.vigente(cliente),
          api.comidas(cliente, hoy, hoy),
        ])
        // Espera ambas lecturas: un fallo de red rápido no puede ocultar un
        // permiso retirado o una respuesta inválida del otro endpoint.
        for (const lectura of lecturas) {
          if (lectura.status === "rejected" && !(lectura.reason instanceof ErrorDeRed))
            throw lectura.reason
        }
        const [lecturaDieta, lecturaComidas] = lecturas
        if (lecturaDieta.status === "rejected") throw lecturaDieta.reason
        if (lecturaComidas.status === "rejected") throw lecturaComidas.reason
        const { dieta } = lecturaDieta.value
        const { comidas } = lecturaComidas.value
        const comida = buscar(dieta)
        return dieta && comida
          ? {
              fase: "lista",
              dieta,
              comida,
              registrada: comidas.find((c) => c.comidaId === comida.id),
              enLinea: true,
            }
          : {
              fase: "error",
              falta: {
                texto: "Esta comida ya no está en tu dieta de hoy.",
                reintentable: false,
                sesionCaducada: false,
              },
              sinConexion: false,
            }
      } catch (error) {
        // La copia solo sustituye una lectura sin red, nunca un rechazo de acceso
        // ni una respuesta que no cumple el contrato.
        if (error instanceof ErrorDeRed) {
          const copia = await leerCopia(almacenDispositivo, cliente).catch(() => null)
          const comida = buscar(copia?.dieta ?? null)
          if (copia?.dieta && comida)
            return { fase: "lista", dieta: copia.dieta, comida, enLinea: false }
        }
        return {
          fase: "error",
          falta: faltaDe(error, "No se pudo abrir esta comida."),
          sinConexion: error instanceof ErrorDeRed,
        }
      }
    },
    [api, hoy, id],
  )

  useFocusEffect(
    useCallback(() => {
      if (clienteId === null) return
      let vigente = true
      void cargar(clienteId).then((nuevo) => {
        if (vigente) setEstado(nuevo)
      })
      return () => {
        vigente = false
      }
    }, [cargar, clienteId, intento]),
  )

  return (
    <PantallaDeFormulario sinTarjeta>
      {estado.fase === "cargando" && (
        <View accessibilityLabel="Cargando comida" accessibilityState={{ busy: true }}>
          <GrupoEsqueletos>
            <View style={{ gap: espacio[20] }}>
              <Esqueleto ancho="70%" alto={38} />
              <Esqueleto alto={44} />
              <Esqueleto alto={160} radio={radio.tarjeta} />
              <Esqueleto alto={160} radio={radio.tarjeta} />
            </View>
          </GrupoEsqueletos>
        </View>
      )}
      {estado.fase === "error" && (
        <>
          <Aviso
            mensaje={estado.falta.texto}
            tipo={estado.sinConexion ? "conexion" : "error"}
            alReintentar={
              estado.falta.reintentable
                ? () => {
                    setEstado({ fase: "cargando" })
                    setIntento((n) => n + 1)
                  }
                : undefined
            }
          />
          <BotonSecundario
            texto="Volver a Nutrición"
            onPress={() => router.replace("/nutricion")}
          />
        </>
      )}
      {estado.fase === "lista" && clienteId !== null && (
        <ComidaDelDia
          comida={estado.comida}
          registrada={estado.registrada}
          // Primero la decisión del profesional: con ella no hay registro que reintentar.
          motivoSoloLectura={
            estado.dieta.documento.registroComidas === false
              ? "registroDesactivado"
              : estado.enLinea
                ? undefined
                : "sinConexion"
          }
          // Recarga sin pasar por «Cargando…»: la comida sigue montada y conserva lo elegido.
          reintentar={async () => setEstado(await cargar(clienteId))}
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
