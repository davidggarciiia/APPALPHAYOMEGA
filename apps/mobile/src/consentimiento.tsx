import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import {
  AceptarConsentimientoSchema,
  EstadoConsentimientoSchema,
  TEXTO_CONSENTIMIENTO,
  VERSION_CONSENTIMIENTO,
  type EstadoConsentimiento,
} from "@alpha-omega/shared"

import {
  AvisoDeError,
  BotonEnlace,
  BotonPrincipal,
  BotonSecundario,
} from "./componentes/formulario"
import { Icono } from "./componentes/iconos"
import { faltaDe } from "./lib/errores"
import { ErrorDeRed } from "./lib/http"
import type { PeticionAutenticada } from "./lib/peticion-autenticada"
import { degradadoOro, radio, tema } from "./tema"

/** La puerta sustituye a la pila entera, así que no hereda la zona segura de `Armazon`. */
const BORDES = ["top", "bottom", "left", "right"] as const

export type ApiConsentimiento = {
  estado: () => Promise<EstadoConsentimiento>
  aceptar: () => Promise<EstadoConsentimiento>
  retirar: () => Promise<EstadoConsentimiento>
}

export function crearApiConsentimiento(pedir: PeticionAutenticada): ApiConsentimiento {
  return {
    estado: () => pedir("/consentimiento", EstadoConsentimientoSchema),
    aceptar: () =>
      pedir("/consentimiento", EstadoConsentimientoSchema, {
        method: "POST",
        body: JSON.stringify(
          AceptarConsentimientoSchema.parse({ version: VERSION_CONSENTIMIENTO, acepto: true }),
        ),
      }),
    retirar: () => pedir("/consentimiento", EstadoConsentimientoSchema, { method: "DELETE" }),
  }
}

type Consentimiento = { aceptadoEn: string | null; retirar: () => Promise<void> }
const ContextoConsentimiento = createContext<Consentimiento | null>(null)

const diaConAnio = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Madrid",
})

/** El consentimiento vigente del cliente dentro de la puerta; `null` fuera de ella. */
export function useConsentimiento(): Consentimiento | null {
  return useContext(ContextoConsentimiento)
}

/** El texto y la aceptación explícita: nada viene marcado. */
export function PantallaConsentimiento({
  aceptar,
  salir,
}: {
  aceptar: () => Promise<void>
  salir: () => void
}): React.JSX.Element {
  const [marcado, setMarcado] = useState(false)
  const [error, setError] = useState("")
  const [ocupado, setOcupado] = useState(false)
  const enCurso = useRef(false)
  const continuar = async (): Promise<void> => {
    if (!marcado || enCurso.current) return
    enCurso.current = true
    setOcupado(true)
    setError("")
    try {
      await aceptar()
    } catch (fallo) {
      setError(faltaDe(fallo, "No se pudo guardar tu consentimiento. Vuelve a intentarlo.").texto)
    } finally {
      enCurso.current = false
      setOcupado(false)
    }
  }
  return (
    <SafeAreaView edges={BORDES} style={s.pantalla}>
      <ScrollView contentContainerStyle={s.contenido}>
        <Text style={s.titulo} accessibilityRole="header">
          {TEXTO_CONSENTIMIENTO.titulo}
        </Text>
        {TEXTO_CONSENTIMIENTO.parrafos.map((parrafo) => (
          <Text key={parrafo} style={s.texto}>
            {parrafo}
          </Text>
        ))}
        <Pressable
          accessibilityRole="checkbox"
          aria-checked={marcado}
          accessibilityLabel={TEXTO_CONSENTIMIENTO.aceptar}
          accessibilityState={{ checked: marcado, disabled: ocupado }}
          disabled={ocupado}
          onPress={() => setMarcado((actual) => !actual)}
          style={s.fila}
        >
          <View style={[s.casilla, marcado && [s.casillaMarcada, degradadoOro]]}>
            {marcado && <Icono nombre="hecho" color={tema.sobreAcento} tamano={18} />}
          </View>
          <Text style={[s.texto, s.flexible]}>{TEXTO_CONSENTIMIENTO.aceptar}</Text>
        </Pressable>
        {error !== "" && <AvisoDeError mensaje={error} />}
        <BotonPrincipal
          texto={ocupado ? "Guardando…" : "Continuar"}
          ocupado={ocupado || !marcado}
          onPress={() => void continuar()}
        />
        <BotonSecundario texto="Ahora no, cerrar sesión" onPress={salir} />
      </ScrollView>
    </SafeAreaView>
  )
}

/**
 * Antes de usar la app, un cliente debe haber aceptado la versión vigente del
 * consentimiento de datos de salud. Si no se puede comprobar por falta de
 * conexión no se bloquea: el servidor lo exige igualmente al guardar. Cualquier
 * otro fallo (un 500, una sesión caducada, una respuesta inválida) sí bloquea y
 * ofrece reintentar: abrir la puerta ahí dejaba usar la app sin haber consentido.
 */
export function PuertaConsentimiento({
  api,
  salir,
  children,
}: {
  api: ApiConsentimiento
  salir: () => void
  children: ReactNode
}): React.JSX.Element {
  const [estado, setEstado] = useState<"comprobando" | "pendiente" | "listo" | "error">(
    "comprobando",
  )
  const [intento, setIntento] = useState(0)
  const [aceptadoEn, setAceptadoEn] = useState<string | null>(null)
  useEffect(() => {
    let vigente = true
    api
      .estado()
      .then((respuesta) => {
        if (!vigente) return
        setAceptadoEn(respuesta.vigente ? respuesta.aceptadoEn : null)
        setEstado(respuesta.vigente ? "listo" : "pendiente")
      })
      .catch((fallo: unknown) => {
        if (vigente) setEstado(fallo instanceof ErrorDeRed ? "listo" : "error")
      })
    return () => {
      vigente = false
    }
  }, [api, intento])
  if (estado === "comprobando")
    return (
      <View style={[s.vacio, s.centrado]}>
        <ActivityIndicator
          color={tema.acento}
          size="large"
          accessibilityLabel="Comprobando tu consentimiento"
        />
      </View>
    )
  if (estado === "error")
    return (
      <SafeAreaView edges={BORDES} style={s.pantalla}>
        <View style={s.contenido}>
          <Text style={s.texto} accessibilityRole="alert">
            No hemos podido comprobar tu consentimiento. Vuelve a intentarlo.
          </Text>
          <BotonPrincipal
            texto="Reintentar"
            onPress={() => {
              setEstado("comprobando")
              setIntento((n) => n + 1)
            }}
          />
          <BotonSecundario texto="Cerrar sesión" onPress={salir} />
        </View>
      </SafeAreaView>
    )
  if (estado === "pendiente")
    return (
      <PantallaConsentimiento
        salir={salir}
        aceptar={async () => {
          const respuesta = await api.aceptar()
          if (!respuesta.vigente) return
          setAceptadoEn(respuesta.aceptadoEn)
          setEstado("listo")
        }}
      />
    )
  const valor: Consentimiento = {
    aceptadoEn,
    retirar: async () => {
      const respuesta = await api.retirar()
      if (!respuesta.vigente) setEstado("pendiente")
    },
  }
  return <ContextoConsentimiento.Provider value={valor}>{children}</ContextoConsentimiento.Provider>
}

/**
 * En el perfil del cliente: cuándo dio el consentimiento y cómo retirarlo. Pide
 * confirmación y explica qué pasa; retirarlo vuelve a mostrar el texto.
 */
export function TarjetaConsentimiento(): React.JSX.Element | null {
  const consentimiento = useConsentimiento()
  const [confirmando, setConfirmando] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState("")
  if (!consentimiento) return null
  const retirar = async (): Promise<void> => {
    setOcupado(true)
    setError("")
    try {
      await consentimiento.retirar()
    } catch (fallo) {
      setError(faltaDe(fallo, "No se pudo retirar tu consentimiento. Vuelve a intentarlo.").texto)
      setOcupado(false)
    }
  }
  return (
    <View style={s.tarjeta}>
      <View style={s.fila}>
        <View style={[s.casilla, s.consentimientoAceptado]}>
          <Icono nombre="hecho" color={tema.sobreExito} tamano={18} />
        </View>
        <Text accessibilityRole="header" style={[s.tituloTarjeta, s.flexible]}>
          {TEXTO_CONSENTIMIENTO.titulo}
        </Text>
      </View>
      <Text style={s.ayuda}>
        {consentimiento.aceptadoEn
          ? `Diste tu consentimiento el ${diaConAnio.format(new Date(consentimiento.aceptadoEn))}.`
          : "Has dado tu consentimiento para tratar tus datos de salud."}
      </Text>
      {confirmando ? (
        <>
          <Text style={s.texto}>
            Si lo retiras, tu equipo dejará de poder guardar tus medidas, pruebas, molestias,
            registros y fotos, y la app volverá a pedírtelo. Lo guardado hasta ahora no se borra.
          </Text>
          {error !== "" && <AvisoDeError mensaje={error} />}
          <BotonSecundario
            texto={ocupado ? "Retirando…" : "Sí, retirar mi consentimiento"}
            ocupado={ocupado}
            onPress={() => void retirar()}
          />
          <BotonSecundario
            texto="Mantenerlo"
            deshabilitado={ocupado}
            onPress={() => setConfirmando(false)}
          />
        </>
      ) : (
        <BotonEnlace texto="Retirar consentimiento" onPress={() => setConfirmando(true)} />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: tema.fondo },
  contenido: { padding: 24, gap: 16, maxWidth: 560, width: "100%", alignSelf: "center" },
  vacio: { flex: 1 },
  centrado: { alignItems: "center", justifyContent: "center", backgroundColor: tema.fondo },
  titulo: {
    color: tema.texto,
    fontFamily: tema.fuenteTitulo,
    fontSize: 30,
    textTransform: "uppercase",
  },
  texto: { color: tema.texto, fontFamily: tema.fuenteTexto, fontSize: 15, lineHeight: 22 },
  flexible: { flex: 1 },
  fila: { flexDirection: "row", gap: 12, alignItems: "center", minHeight: 44 },
  casilla: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: tema.bordeFuerte,
    alignItems: "center",
    justifyContent: "center",
  },
  casillaMarcada: { borderColor: "transparent" },
  tarjeta: {
    padding: 16,
    borderRadius: radio.tarjeta,
    borderColor: tema.borde,
    borderWidth: 1,
    backgroundColor: tema.superficie,
    gap: 8,
  },
  tituloTarjeta: { color: tema.texto, fontSize: 15, fontFamily: tema.fuenteBoton },
  consentimientoAceptado: { backgroundColor: tema.exito, borderColor: tema.exito },
  ayuda: { color: tema.textoTenue, fontSize: 13, lineHeight: 18, fontFamily: tema.fuenteTexto },
})
