import { useEffect, useRef, useState } from "react"
import { useLocalSearchParams, useRouter } from "expo-router"
import { Text, View } from "react-native"
import type { FichaDeUsuario } from "@alpha-omega/shared"

import { DatosDelCliente } from "../../src/clientes/datos-del-cliente"
import {
  AvisoDeError,
  BotonSecundario,
  PantallaDeFormulario,
} from "../../src/componentes/formulario"
import { Esqueleto, GrupoEsqueletos } from "../../src/componentes/esqueleto"
import { ErrorDelServidor, leerUsuario } from "../../src/lib/api"
import { faltaDe, type Falta } from "../../src/lib/errores"
import { useSesion } from "../../src/sesion"
import { tema } from "../../src/tema"

/** Conserva los enlaces de cartera y alta sin duplicar la edición. */
export default function FichaDeCliente(): React.JSX.Element {
  const parametros = useLocalSearchParams<{ id?: string | string[]; correoFallido?: string }>()
  const id = Array.isArray(parametros.id) ? parametros.id[0] : parametros.id
  const { estado, pedir, salir } = useSesion()
  const router = useRouter()
  const navegacion = useRef(router)
  navegacion.current = router
  const cuentaId =
    estado.fase === "dentro" && estado.usuario.rol === "entrenador" ? estado.usuario.id : null
  const [ficha, fijarFicha] = useState<FichaDeUsuario | null>(null)
  const [error, fijarError] = useState<Falta | null>(null)
  const [intento, fijarIntento] = useState(0)
  const correoFallido = parametros.correoFallido === "1"

  useEffect(() => {
    if (cuentaId === null || !id) return
    let vigente = true
    fijarFicha(null)
    fijarError(null)
    void leerUsuario(pedir, id)
      .then((nueva) => {
        if (!vigente) return
        if (nueva.rol === "cliente") {
          navegacion.current.replace({
            pathname: "/entrenador/cliente/[id]",
            params: { id, datos: "1", correoFallido: correoFallido ? "1" : "0" },
          })
        } else fijarFicha(nueva)
      })
      .catch((causa: unknown) => {
        if (vigente)
          fijarError(
            causa instanceof ErrorDelServidor && causa.codigo === 404
              ? { texto: "Esta cuenta ya no existe.", reintentable: false, sesionCaducada: false }
              : faltaDe(causa, "No hemos podido cargar la ficha."),
          )
      })
    return () => {
      vigente = false
    }
  }, [cuentaId, pedir, id, correoFallido, intento])

  return (
    <PantallaDeFormulario sinTarjeta>
      {cuentaId === null ? (
        <Text style={{ color: tema.texto, fontFamily: tema.fuenteTexto }}>
          Esta pantalla requiere una cuenta de entrenador.
        </Text>
      ) : !id ? (
        <AvisoDeError mensaje="No sabemos de quién es esta ficha." />
      ) : error ? (
        <>
          <AvisoDeError mensaje={error.texto} />
          {error.reintentable && (
            <BotonSecundario texto="Reintentar" onPress={() => fijarIntento((n) => n + 1)} />
          )}
          {error.sesionCaducada && (
            <BotonSecundario texto="Volver a entrar" onPress={() => void salir()} />
          )}
          <BotonSecundario texto="Volver" onPress={() => router.back()} />
        </>
      ) : ficha ? (
        <DatosDelCliente
          key={`${cuentaId}:${id}`}
          clienteId={id}
          fichaInicial={ficha}
          correoFallido={correoFallido}
          alCerrar={() => router.back()}
        />
      ) : (
        <GrupoEsqueletos>
          <View accessibilityLabel="Cargando datos del cliente" accessibilityState={{ busy: true }}>
            <Esqueleto alto={52} />
          </View>
        </GrupoEsqueletos>
      )}
    </PantallaDeFormulario>
  )
}
