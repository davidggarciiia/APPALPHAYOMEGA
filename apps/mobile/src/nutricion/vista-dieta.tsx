import { useCallback, useRef, useState } from "react"
import { useFocusEffect } from "expo-router"
import { AppState, Pressable, StyleSheet, Text, View } from "react-native"
import type {
  Comida,
  ComidaRegistrada,
  DiaDeSeguimiento,
  DietaPublicada,
  DocumentoDieta,
  Suplemento,
} from "@alpha-omega/shared"
import type { ApiSeguimiento } from "../seguimiento/api"
import { Enlace } from "../entrenamiento/sesion/controles"
import { faltaDe } from "../lib/errores"
import { cambioDeSuplemento } from "./hoy-modelo"
import { HoyNutricion } from "./hoy-nutricion"
import type { AlmacenLocal } from "../entrenamiento/almacen-local"
import { hoyAgenda } from "../entrenamiento/fechas"
import { ErrorDeRed } from "../lib/http"
import { AvisoDeError, BotonSecundario } from "../componentes/formulario"
import { degradadoOro, tema } from "../tema"
import type { ApiNutricion } from "./api"
import { guardarCopia, leerCopia } from "./copia-local"
import { DiaDieta } from "./dia-dieta"

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"] as const
const INICIALES = ["L", "M", "X", "J", "V", "S", "D"] as const

/** 0 = lunes. La fecha es de calendario en Europe/Madrid, sin zona del teléfono. */
export function diaDeLaSemana(fecha: string): number {
  return (new Date(`${fecha}T00:00:00Z`).getUTCDay() + 6) % 7
}

function fechaCorta(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "long" })
}

type Estado =
  | { fase: "cargando" }
  | { fase: "error"; mensaje: string }
  | {
      fase: "lista"
      dieta: DietaPublicada | null
      deNutricionista: boolean | null
      copiaDel: string | null
    }

/** «HH:MM» en la zona de la agenda. */
function horaActual(): string {
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date())
}

/** Documento de una dieta publicada, con «Hoy» y «Semana». Lo usan cliente y profesional. */
export function DocumentoVisible({ documento }: { documento: DocumentoDieta }): React.JSX.Element {
  const hoy = diaDeLaSemana(hoyAgenda())
  const [pestana, setPestana] = useState<"hoy" | "semana">("hoy")
  const [dia, setDia] = useState(hoy)
  const indice = pestana === "hoy" ? hoy : dia
  const tipo = documento.tiposDeDia.find((t) => t.id === documento.semana[indice])
  return (
    <View style={s.contenido}>
      <View style={s.pestanas} accessibilityRole="tablist">
        {(["hoy", "semana"] as const).map((valor) => (
          <Pressable
            key={valor}
            accessibilityRole="tab"
            accessibilityState={{ selected: pestana === valor }}
            onPress={() => setPestana(valor)}
            style={[s.pestana, pestana === valor && [s.pestanaActiva, degradadoOro]]}
          >
            <Text style={[s.textoPestana, pestana === valor && s.textoActivo]}>
              {valor === "hoy" ? "Hoy" : "Semana"}
            </Text>
          </Pressable>
        ))}
      </View>
      {pestana === "semana" && (
        <View style={s.semana}>
          {INICIALES.map((inicial, n) => {
            const delDia = documento.tiposDeDia.find((t) => t.id === documento.semana[n])
            return (
              <Pressable
                key={inicial}
                accessibilityRole="button"
                accessibilityState={{ selected: dia === n }}
                accessibilityLabel={`${DIAS[n]}: ${delDia?.nombre ?? "sin tipo"}`}
                onPress={() => setDia(n)}
                style={[s.dia, dia === n && s.diaActivo]}
              >
                <Text style={s.inicial}>{inicial}</Text>
                <Text numberOfLines={1} style={s.tipoDia}>
                  {delDia?.nombre ?? "—"}
                </Text>
              </Pressable>
            )
          })}
        </View>
      )}
      <Text style={s.titulo} accessibilityRole="header">
        {pestana === "hoy" ? "Hoy" : DIAS[indice]} · {tipo?.nombre ?? "Sin pauta"}
      </Text>
      {tipo && <DiaDieta tipo={tipo} />}
      {documento.indicaciones.length > 0 && (
        <View style={s.pautas}>
          <Text style={s.titulo}>Pautas</Text>
          <View style={s.indicaciones}>
            {documento.indicaciones.map((indicacion, n) => (
              <View key={`${indicacion.titulo}-${n}`} style={s.indicacion}>
                <Text style={s.tituloIndicacion} accessibilityRole="header">
                  {indicacion.titulo}
                </Text>
                <Text style={s.textoIndicacion}>{indicacion.texto}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  )
}

/** La dieta vigente del cliente, con copia cifrada para leerla sin conexión. */
export function VistaDieta({
  clienteId,
  cuenta,
  api,
  almacen,
  seguimiento,
  abrirComida,
}: {
  clienteId: string
  cuenta: string
  api: ApiNutricion
  almacen: AlmacenLocal
  /** Para los suplementos del día. Sin él, la vista es de solo lectura. */
  seguimiento?: ApiSeguimiento
  abrirComida?: (comida: Comida) => void
}): React.JSX.Element {
  const [estado, setEstado] = useState<Estado>({ fase: "cargando" })
  const [intento, setIntento] = useState(0)
  const [semana, setSemana] = useState(false)
  const [registradas, setRegistradas] = useState<ComidaRegistrada[] | null>(null)
  const [dia, setDia] = useState<DiaDeSeguimiento | null>(null)
  const [diaCargado, setDiaCargado] = useState(false)
  const [aviso, setAviso] = useState("")
  const [guardandoSuplemento, setGuardandoSuplemento] = useState(false)
  const guardando = useRef(false)
  const hoy = hoyAgenda()

  useFocusEffect(
    useCallback(() => {
      let vigente = true
      const cancelacion = new AbortController()
      const cargar = async (): Promise<void> => {
        setAviso("")
        setDiaCargado(false)
        setRegistradas(null)
        try {
          const { dieta, deNutricionista } = await api.vigente(clienteId, cancelacion.signal)
          if (!vigente) return
          setEstado({ fase: "lista", dieta, deNutricionista, copiaDel: null })
          // Lo marcado hoy. Sin ello, la dieta se ve igual pero no se marca.
          void api
            .comidas(clienteId, hoy, hoy)
            .then(({ comidas }) => vigente && setRegistradas(comidas))
            .catch(() => vigente && setRegistradas(null))
          void seguimiento
            ?.dias(clienteId, hoy, hoy)
            .then(({ dias }) => {
              if (vigente) {
                setDia(dias[0] ?? null)
                setDiaCargado(true)
              }
            })
            .catch(() => {
              if (vigente)
                setAviso("No se pudieron cargar los registros de hoy. Revisa la conexión.")
            })
          // Si falla el guardado local, la dieta se sigue viendo: solo se pierde la copia.
          await guardarCopia(almacen, cuenta, dieta, deNutricionista).catch(() => undefined)
        } catch (error) {
          if (!vigente) return
          if (error instanceof ErrorDeRed) {
            const copia = await leerCopia(almacen, cuenta).catch(() => null)
            if (!vigente) return
            setEstado(
              copia
                ? {
                    fase: "lista",
                    dieta: copia.dieta,
                    deNutricionista: copia.deNutricionista ?? null,
                    copiaDel: copia.actualizadaEn,
                  }
                : {
                    fase: "error",
                    mensaje:
                      "Necesitas conexión para descargar tu dieta la primera vez. Después podrás verla sin red.",
                  },
            )
            return
          }
          setEstado({ fase: "error", mensaje: "No hemos podido cargar tu dieta." })
        }
      }
      void cargar()
      const actividad = AppState.addEventListener("change", (siguiente) => {
        if (siguiente === "active") void cargar()
      })
      return () => {
        vigente = false
        cancelacion.abort()
        actividad.remove()
      }
    }, [api, almacen, clienteId, cuenta, intento, seguimiento, hoy]),
  )

  if (estado.fase === "cargando") {
    return <Text style={s.tenue}>Cargando tu dieta…</Text>
  }
  if (estado.fase === "error") {
    return (
      <View style={s.contenido}>
        <AvisoDeError mensaje={estado.mensaje} />
        <BotonSecundario texto="Reintentar" onPress={() => setIntento((n) => n + 1)} />
      </View>
    )
  }
  const dieta = estado.dieta
  const enLinea = estado.copiaDel === null
  const tomarSuplemento = async (suplemento: Suplemento, tomado: boolean): Promise<void> => {
    if (!seguimiento || !diaCargado || guardando.current) return
    guardando.current = true
    setGuardandoSuplemento(true)
    setAviso("")
    try {
      setDia(
        await seguimiento.cambiarDia(clienteId, hoy, cambioDeSuplemento(suplemento, tomado, dia)),
      )
    } catch (error) {
      setAviso(faltaDe(error, "No se pudo guardar el suplemento.").texto)
    } finally {
      guardando.current = false
      setGuardandoSuplemento(false)
    }
  }
  return (
    <View style={s.contenido}>
      {estado.copiaDel !== null && (
        <View style={s.sinRed}>
          <Text style={s.textoSinRed}>Sin conexión · copia del {fechaCorta(estado.copiaDel)}</Text>
          <BotonSecundario texto="Actualizar" onPress={() => setIntento((n) => n + 1)} />
        </View>
      )}
      {dieta === null ? (
        <Text style={s.vacio}>
          Tu dieta aún no está publicada. Cuando tu profesional la publique aparecerá aquí.
        </Text>
      ) : semana ? (
        <>
          <Enlace texto="‹ Volver a hoy" onPress={() => setSemana(false)} />
          <View>
            <Text style={s.nombre}>{dieta.documento.nombre}</Text>
            <Text style={s.tenue}>Publicada el {fechaCorta(dieta.publicadaEn)}</Text>
          </View>
          <DocumentoVisible documento={dieta.documento} />
        </>
      ) : (
        <>
          {aviso !== "" && <AvisoDeError mensaje={aviso} />}
          {guardandoSuplemento && (
            <Text style={s.tenue} accessibilityLiveRegion="polite">
              Guardando suplemento…
            </Text>
          )}
          <HoyNutricion
            documento={dieta.documento}
            deNutricionista={estado.deNutricionista}
            hoy={hoy}
            hora={horaActual()}
            registradas={registradas}
            dia={dia}
            diaCargado={diaCargado}
            puedeTomar={enLinea && seguimiento !== undefined && diaCargado && !guardandoSuplemento}
            abrirComida={(comida) => (abrirComida ? abrirComida(comida) : setSemana(true))}
            tomarSuplemento={(suplemento, tomado) => void tomarSuplemento(suplemento, tomado)}
            verSemana={() => setSemana(true)}
          />
        </>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  contenido: { gap: 20 },
  pestanas: {
    flexDirection: "row",
    backgroundColor: tema.superficie,
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  pestana: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  pestanaActiva: {},
  textoPestana: { color: tema.texto, fontFamily: tema.fuenteSemi, fontSize: 15 },
  textoActivo: { color: tema.sobreAcento, fontFamily: tema.fuenteBoton },
  semana: { flexDirection: "row", gap: 4 },
  dia: {
    flex: 1,
    minWidth: 0,
    minHeight: 60,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
    gap: 4,
  },
  diaActivo: { backgroundColor: tema.superficieAlta },
  inicial: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 16 },
  tipoDia: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 10 },
  titulo: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 20 },
  nombre: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 18 },
  tenue: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 13 },
  vacio: {
    color: tema.textoTenue,
    fontFamily: tema.fuenteTexto,
    fontSize: 15,
    textAlign: "center",
    padding: 24,
  },
  sinRed: { backgroundColor: tema.acentoSuave, borderRadius: 14, padding: 12 },
  textoSinRed: { color: tema.aviso, fontFamily: tema.fuenteBoton, fontSize: 14 },
  pautas: { gap: 12 },
  indicaciones: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  indicacion: {
    flexGrow: 1,
    flexBasis: 160,
    backgroundColor: tema.superficie,
    borderRadius: 14,
    padding: 14,
    gap: 4,
  },
  tituloIndicacion: { color: tema.acento, fontFamily: tema.fuenteBoton, fontSize: 17 },
  textoIndicacion: {
    color: tema.textoTenue,
    fontFamily: tema.fuenteTexto,
    fontSize: 13,
    lineHeight: 19,
  },
})
