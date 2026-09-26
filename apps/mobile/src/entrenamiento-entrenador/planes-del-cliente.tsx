import { useFocusEffect, useRouter } from "expo-router"
import { useCallback, useState } from "react"
import { ActivityIndicator, StyleSheet, Text, View } from "react-native"
import { sumarDias, type ResumenPlan } from "@alpha-omega/shared"

import { Aviso, BotonOro, BotonSobrio, EnlaceOro, Tarjeta, texto } from "../componentes/diseno"
import { faltaDe, type Falta } from "../lib/errores"
import { fechaLarga } from "../lib/fechas"
import { fuentes, tema } from "../tema"

import { anularPlan, planesDeCliente } from "./api"

type Carga =
  { fase: "cargando" } | { fase: "lista"; planes: ResumenPlan[] } | { fase: "error"; falta: Falta }

function describirPlan(plan: ResumenPlan): string {
  const fin = sumarDias(plan.semanaInicial, plan.semanas * 7 - 1)
  const semanas = plan.semanas === 1 ? "1 semana" : `${String(plan.semanas)} semanas`
  return `${semanas}, del ${fechaLarga(plan.semanaInicial)} al ${fechaLarga(fin)}`
}

function describirSesiones(plan: ResumenPlan): string {
  return [
    `${String(plan.sesionesTotales)} sesiones`,
    `${String(plan.sesionesEnviadas)} enviadas`,
    `${String(plan.sesionesSinIniciar)} sin empezar`,
  ].join(" · ")
}

/**
 * Los planes asignados a un cliente, con «Nuevo plan» y la anulación de lo que
 * aún no ha empezado. Lo empezado o enviado nunca se toca: el servidor lo
 * conserva y aquí se dice cuánto.
 */
export function PlanesDelCliente({
  clienteId,
  nombre,
}: {
  clienteId: string
  nombre: string
}): React.JSX.Element {
  const router = useRouter()
  const [carga, setCarga] = useState<Carga>({ fase: "cargando" })
  const [confirmando, setConfirmando] = useState<string | null>(null)
  const [anulando, setAnulando] = useState(false)
  const [mensaje, setMensaje] = useState<{ texto: string; error: boolean } | null>(null)

  const cargar = useCallback(() => {
    let vigente = true
    planesDeCliente(clienteId)
      .then((listado) => {
        if (vigente) setCarga({ fase: "lista", planes: listado.planes })
      })
      .catch((error: unknown) => {
        if (vigente) {
          setCarga({ fase: "error", falta: faltaDe(error, "No hemos podido cargar sus planes.") })
        }
      })
    return () => {
      vigente = false
    }
  }, [clienteId])

  // Al volver del editor de planes, lo recién asignado tiene que estar aquí.
  useFocusEffect(cargar)

  const anular = async (plan: ResumenPlan): Promise<void> => {
    setAnulando(true)
    setMensaje(null)
    try {
      const { anuladas, conservadas } = await anularPlan(plan.id)
      setMensaje({
        texto:
          conservadas === 0
            ? `Anuladas ${String(anuladas)} sesiones de «${plan.nombre}».`
            : `Anuladas ${String(anuladas)} sesiones de «${plan.nombre}». Se conservan ${String(
                conservadas,
              )} que ya estaban empezadas o enviadas.`,
        error: false,
      })
      setConfirmando(null)
      cargar()
    } catch (error) {
      setMensaje({ texto: faltaDe(error, "No hemos podido anular el plan.").texto, error: true })
    } finally {
      setAnulando(false)
    }
  }

  return (
    <View style={estilos.contenedor}>
      <BotonOro
        texto="Nuevo plan"
        onPress={() =>
          router.push({
            pathname: "/entrenador/cliente/[id]/plan",
            params: { id: clienteId, nombre },
          })
        }
      />

      {mensaje !== null && (
        <Aviso tono={mensaje.error ? "error" : "info"}>
          <Text style={texto.cuerpo}>{mensaje.texto}</Text>
        </Aviso>
      )}

      {carga.fase === "cargando" && <ActivityIndicator color={tema.oro} />}
      {carga.fase === "error" && <Text style={texto.cuerpo}>{carga.falta.texto}</Text>}
      {carga.fase === "lista" && carga.planes.length > 0 && (
        <View style={estilos.contenedor}>
          <Text style={texto.seccion}>Planes asignados</Text>
          {carga.planes.map((plan) => (
            <Tarjeta key={plan.id} style={estilos.plan}>
              <Text style={texto.fuerte}>{plan.nombre}</Text>
              <Text style={texto.tenueMedio}>{describirPlan(plan)}</Text>
              <Text style={estilos.cuentas}>{describirSesiones(plan)}</Text>
              {plan.sesionesSinIniciar > 0 &&
                (confirmando === plan.id ? (
                  <Aviso tono="error">
                    <Text style={texto.cuerpo}>
                      {`Se borrarán las ${String(
                        plan.sesionesSinIniciar,
                      )} sesiones que aún no ha empezado. Lo empezado o enviado se queda.`}
                    </Text>
                    <BotonSobrio
                      texto="Anular lo pendiente"
                      peligro
                      ocupado={anulando}
                      onPress={() => void anular(plan)}
                    />
                    <BotonSobrio texto="Cancelar" onPress={() => setConfirmando(null)} />
                  </Aviso>
                ) : (
                  <EnlaceOro
                    texto="Anular lo pendiente"
                    onPress={() => {
                      setMensaje(null)
                      setConfirmando(plan.id)
                    }}
                  />
                ))}
            </Tarjeta>
          ))}
        </View>
      )}
    </View>
  )
}

const estilos = StyleSheet.create({
  contenedor: { gap: 14 },
  plan: { gap: 6 },
  cuentas: { color: tema.texto, fontFamily: fuentes.media, fontSize: 14 },
})
