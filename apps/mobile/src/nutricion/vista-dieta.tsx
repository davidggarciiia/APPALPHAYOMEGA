import { useCallback, useRef, useState } from "react"
import { useFocusEffect } from "expo-router"
import { AppState, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
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
import { ErrorDePermiso, ErrorDeRed, ErrorDeSesion } from "../lib/http"
import { EstadoVacio } from "../componentes/estado-vacio"
import { AvisoDeError, BotonSecundario } from "../componentes/formulario"
import { Aviso } from "../componentes/aviso"
import { Esqueleto, GrupoEsqueletos } from "../componentes/esqueleto"
import { Pestanas } from "../componentes/piezas"
import { tema, tipo as tipografia } from "../tema"
import type { ApiNutricion } from "./api"
import { guardarCopia, leerCopia } from "./copia-local"
import { DiaDieta } from "./dia-dieta"

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"] as const
const INICIALES = ["L", "M", "X", "J", "V", "S", "D"] as const

function TiraDias({
  documento,
  dia,
  seleccionar,
}: {
  documento: DocumentoDieta
  dia: number
  seleccionar: (dia: number) => void
}): React.JSX.Element {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.semana}
      accessibilityRole="tablist"
    >
      {INICIALES.map((inicial, n) => {
        const tipo = documento.tiposDeDia.find((t) => t.id === documento.semana[n])
        return (
          <Pressable
            key={n}
            accessibilityRole="tab"
            accessibilityState={{ selected: dia === n }}
            accessibilityLabel={`${DIAS[n]}: ${tipo?.nombre ?? "sin tipo"}`}
            onPress={() => seleccionar(n)}
            style={[s.dia, dia === n && s.diaActivo]}
          >
            <Text style={[s.inicial, dia === n && s.inicialActiva]}>{inicial}</Text>
            <Text numberOfLines={1} style={s.tipoDia}>
              {tipo?.nombre ?? "—"}
            </Text>
            {dia === n && <View style={s.marcaDia} />}
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

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
      <Pestanas
        opciones={[
          { valor: "hoy", texto: "Hoy" },
          { valor: "semana", texto: "Semana" },
        ]}
        activa={pestana}
        cambiar={setPestana}
      />
      {pestana === "semana" && <TiraDias documento={documento} dia={dia} seleccionar={setDia} />}
      <Text style={s.titulo} accessibilityRole="header">
        {pestana === "hoy" ? "Hoy" : DIAS[indice]} · {tipo?.nombre ?? "Sin pauta"}
      </Text>
      {tipo && <DiaDieta tipo={tipo} />}
      {documento.indicaciones.length > 0 && (
        <View style={s.pautas}>
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
  const versionDia = useRef(0)
  const hoy = hoyAgenda()
  const [diaElegido, setDiaElegido] = useState<number | null>(null)
  const diaActual = diaDeLaSemana(hoy)
  const diaVisible = diaElegido ?? diaActual

  useFocusEffect(
    useCallback(() => {
      let vigente = true
      const cancelacion = new AbortController()
      const cargar = async (): Promise<void> => {
        // Sin vaciar lo ya mostrado: al recargar (foco, volver de segundo plano) las marcas
        // y los suplementos no pasan a «registro no disponible» mientras llega la respuesta.
        setAviso("")
        try {
          const { dieta, deNutricionista } = await api.vigente(clienteId, cancelacion.signal)
          if (!vigente) return
          setEstado({ fase: "lista", dieta, deNutricionista, copiaDel: null })
          const lecturaDia = versionDia.current
          // Lo marcado hoy. Sin ello, la dieta se ve igual pero no se marca.
          void api
            .comidas(clienteId, hoy, hoy)
            .then(({ comidas }) => vigente && setRegistradas(comidas))
            .catch(() => vigente && setRegistradas(null))
          void seguimiento
            ?.dias(clienteId, hoy, hoy)
            .then(({ dias }) => {
              if (vigente && lecturaDia === versionDia.current && !guardando.current) {
                setDia(dias[0] ?? null)
                setDiaCargado(true)
              }
            })
            .catch(() => {
              if (vigente && lecturaDia === versionDia.current && !guardando.current)
                setAviso("No se pudieron cargar los registros de hoy. Revisa la conexión.")
            })
          // Si falla el guardado local, la dieta se sigue viendo: solo se pierde la copia.
          await guardarCopia(almacen, cuenta, dieta, deNutricionista).catch(() => undefined)
        } catch (error) {
          if (!vigente) return
          // Una sesión caducada o un permiso retirado no son «sin conexión»: la copia no vale.
          if (!(error instanceof ErrorDeSesion) && !(error instanceof ErrorDePermiso)) {
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
                      error instanceof ErrorDeRed
                        ? "Necesitas conexión para descargar tu dieta la primera vez. Después podrás verla sin red."
                        : "No hemos podido cargar tu dieta.",
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
    return (
      <View
        style={s.contenido}
        accessibilityLabel="Cargando dieta"
        accessibilityState={{ busy: true }}
      >
        <GrupoEsqueletos>
          <View style={s.contenido}>
            <Esqueleto alto={248} radio={20} />
            {Array.from({ length: 5 }, (_, n) => (
              <Esqueleto key={n} alto={64} radio={14} />
            ))}
          </View>
        </GrupoEsqueletos>
      </View>
    )
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
  const tipoVisible = dieta?.documento.tiposDeDia.find(
    (t) => t.id === dieta.documento.semana[diaVisible],
  )
  const enLinea = estado.copiaDel === null
  const tomarSuplemento = async (suplemento: Suplemento, tomado: boolean): Promise<void> => {
    if (!seguimiento || !diaCargado || guardando.current) return
    guardando.current = true
    // Invalida las lecturas anteriores y las que coincidan con el guardado.
    versionDia.current += 1
    setGuardandoSuplemento(true)
    setAviso("")
    try {
      setDia(
        await seguimiento.cambiarDia(clienteId, hoy, cambioDeSuplemento(suplemento, tomado, dia)),
      )
    } catch (error) {
      setAviso(faltaDe(error, "No se pudo guardar el suplemento.").texto)
    } finally {
      versionDia.current += 1
      guardando.current = false
      setGuardandoSuplemento(false)
    }
  }
  return (
    <View style={s.contenido}>
      {estado.copiaDel !== null && (
        <Aviso
          mensaje={`Sin conexión · copia del ${fechaCorta(estado.copiaDel)}`}
          alReintentar={() => setIntento((n) => n + 1)}
        />
      )}
      {dieta === null ? (
        <EstadoVacio
          icono="nutricion"
          titulo="Aún sin dieta"
          texto="Tu dieta aún no está publicada. Cuando tu profesional la publique aparecerá aquí."
        />
      ) : semana ? (
        <>
          <Enlace
            texto="‹ Volver a hoy"
            onPress={() => {
              setDiaElegido(null)
              setSemana(false)
            }}
          />
          <View>
            <Text style={s.nombre}>{dieta.documento.nombre}</Text>
            <Text style={s.tenue}>Publicada el {fechaCorta(dieta.publicadaEn)}</Text>
          </View>
          <DocumentoVisible documento={dieta.documento} />
        </>
      ) : (
        <>
          <TiraDias documento={dieta.documento} dia={diaVisible} seleccionar={setDiaElegido} />
          {aviso !== "" && <AvisoDeError mensaje={aviso} />}
          {guardandoSuplemento && (
            <Text style={s.tenue} accessibilityLiveRegion="polite">
              Guardando suplemento…
            </Text>
          )}
          {diaVisible !== diaActual ? (
            <View style={s.contenido}>
              {tipoVisible ? (
                <DiaDieta tipo={tipoVisible} />
              ) : (
                <Text style={s.tenue}>Sin pauta para este día</Text>
              )}
              <BotonSecundario texto="Ver la semana completa" onPress={() => setSemana(true)} />
            </View>
          ) : (
            <HoyNutricion
              documento={dieta.documento}
              deNutricionista={estado.deNutricionista}
              hoy={hoy}
              hora={horaActual()}
              registradas={registradas}
              dia={dia}
              diaCargado={diaCargado}
              puedeTomar={
                enLinea && seguimiento !== undefined && diaCargado && !guardandoSuplemento
              }
              abrirComida={(comida) => (abrirComida ? abrirComida(comida) : setSemana(true))}
              tomarSuplemento={(suplemento, tomado) => void tomarSuplemento(suplemento, tomado)}
              verSemana={() => setSemana(true)}
            />
          )}
        </>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  contenido: { gap: 20 },
  semana: { flexDirection: "row", flexGrow: 1, gap: 4 },
  dia: {
    flex: 1,
    minWidth: 44,
    minHeight: 60,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
    gap: 4,
  },
  diaActivo: { backgroundColor: tema.superficieAlta },
  marcaDia: { position: "absolute", bottom: 0, height: 3, width: 24, backgroundColor: tema.acento },
  inicial: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 16 },
  inicialActiva: { color: tema.acento },
  tipoDia: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 10 },
  titulo: { ...tipografia.titulo, color: tema.texto },
  nombre: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 18 },
  tenue: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 13 },
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
