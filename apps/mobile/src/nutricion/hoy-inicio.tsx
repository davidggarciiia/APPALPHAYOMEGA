import { useCallback, useRef, useState } from "react"
import { randomUUID } from "expo-crypto"
import { useFocusEffect } from "expo-router"
import { StyleSheet, Text, View } from "react-native"
import { Pulsable } from "../componentes/pulsable"
import type {
  CambiarDia,
  ConfiguracionSeguimiento,
  DiaDeSeguimiento,
  Medida,
  Suplemento,
} from "@alpha-omega/shared"

import { AvisoDeError, Campo } from "../componentes/formulario"
import { Aviso } from "../componentes/aviso"
import { Esqueleto, GrupoEsqueletos } from "../componentes/esqueleto"
import { Icono } from "../componentes/iconos"
import { almacenDispositivo } from "../entrenamiento/almacen-dispositivo"
import { hoyAgenda } from "../entrenamiento/fechas"
import { Dialogo } from "../entrenamiento/sesion/controles"
import { faltaDe } from "../lib/errores"
import { ErrorDePermiso, ErrorDeSesion } from "../lib/http"
import { espacio, radio, tema, tipo } from "../tema"
import type { ApiSeguimiento } from "../seguimiento/api"
import { leerDecimal, leerSueno, miles, pesoLegible, suenoLegible } from "../seguimiento/modelo"
import type { ApiNutricion } from "./api"
import { leerCopia } from "./copia-local"
import { cambioDeSuplemento, suplementoTomado } from "./hoy-modelo"

type Dato = "pesoKg" | "pasos" | "suenoMin" | "cinturaCm"
type Pedido = "peso" | "pasos" | "sueno" | "cintura"

const EDICION: Record<
  Dato,
  { titulo: string; texto: string; etiqueta: string; teclado: "decimal-pad" | "number-pad" }
> = {
  pesoKg: {
    titulo: "Peso en ayunas",
    texto: "En kilos, al levantarte y antes de desayunar. Por ejemplo, 111,6.",
    etiqueta: "Peso (kg)",
    teclado: "decimal-pad",
  },
  pasos: {
    titulo: "Pasos de hoy",
    texto: "Los que marque tu móvil o tu reloj.",
    etiqueta: "Pasos",
    teclado: "number-pad",
  },
  suenoMin: {
    titulo: "Sueño",
    texto: "Lo que dormiste anoche. Por ejemplo, 7:40.",
    etiqueta: "Horas dormidas",
    teclado: "decimal-pad",
  },
  cinturaCm: {
    titulo: "Cintura",
    texto: "En centímetros, medida como te indicó tu entrenador. Por ejemplo, 92,5.",
    etiqueta: "Cintura (cm)",
    teclado: "decimal-pad",
  },
}

/** Lo que el entrenador pide apuntar hoy, en el orden visible que eligió. */
function pedidosDeHoy(configuracion: ConfiguracionSeguimiento, diaSemana: number): Pedido[] {
  return configuracion.indicadores.filter((indicador): indicador is Pedido => {
    if (indicador === "fuerza" || indicador === "pruebas") return false
    const pauta = configuracion.registrosSolicitados.find((r) => r.indicador === indicador)
    return pauta !== undefined && (pauta.frecuencia === "diaria" || pauta.diaSemana === diaSemana)
  })
}

/** La última cintura medida hoy; el listado llega ordenado por fecha y hora. */
function cinturaDeHoy(medidas: Medida[], hoy: string): number | null {
  return (
    [...medidas].reverse().find((m) => m.fecha === hoy && m.cinturaCm !== null)?.cinturaCm ?? null
  )
}

/** «92,5 cm». */
function cmLegible(cm: number): string {
  return `${String(cm).replace(".", ",")} cm`
}

function textoInicial(dato: Dato, valor: number | null): string {
  if (valor === null) return ""
  if (dato === "pesoKg" || dato === "cinturaCm") return String(valor).replace(".", ",")
  if (dato === "suenoMin") return `${Math.floor(valor / 60)}:${String(valor % 60).padStart(2, "0")}`
  return String(valor)
}

function leer(dato: Dato, texto: string): CambiarDia | { cinturaCm: number } | string {
  if (dato === "cinturaCm") {
    const cm = leerDecimal(texto)
    return cm !== null && !Number.isNaN(cm) && cm >= 30 && cm <= 300
      ? { cinturaCm: Math.round(cm * 10) / 10 }
      : "Escribe una cintura entre 30 y 300 cm."
  }
  if (dato === "pasos") {
    const limpio = texto.trim().replace(/\./g, "")
    if (limpio === "") return { pasos: null }
    return /^\d{1,6}$/.test(limpio) && Number(limpio) <= 100_000
      ? { pasos: Number(limpio) }
      : "Escribe los pasos con cifras, hasta 100.000."
  }
  if (dato === "pesoKg") {
    const peso = leerDecimal(texto)
    if (peso === null) return { pesoKg: null }
    return !Number.isNaN(peso) && peso >= 30 && peso <= 400
      ? { pesoKg: Math.round(peso * 10) / 10 }
      : "Escribe un peso entre 30 y 400 kg."
  }
  const minutos = leerSueno(texto)
  if (minutos === null) return { suenoMin: null }
  return !Number.isNaN(minutos) && minutos <= 1440
    ? { suenoMin: minutos }
    : "Escribe las horas como 7:40 o 7,5."
}

/** «Hoy» de Inicio: datos diarios, cintura pautada y suplementos de la dieta publicada. */
export function HoyInicio({
  clienteId,
  seguimiento,
  nutricion,
  objetivoPasos,
}: {
  clienteId: string
  seguimiento: Pick<
    ApiSeguimiento,
    "configuracion" | "dias" | "cambiarDia" | "medidas" | "registrarMedida"
  >
  nutricion: Pick<ApiNutricion, "vigente">
  objetivoPasos: number | null
}): React.JSX.Element {
  const [dia, setDia] = useState<DiaDeSeguimiento | null>(null)
  const [diaCargado, setDiaCargado] = useState(false)
  const [configuracion, setConfiguracion] = useState<ConfiguracionSeguimiento | null>(null)
  // `undefined` mientras no se han leído las medidas de hoy.
  const [cintura, setCintura] = useState<number | null | undefined>(undefined)
  // Un reintento del mismo valor reutiliza la operación: el servidor no guarda dos medidas.
  const operacionCintura = useRef<{ id: string; cm: number } | null>(null)
  const [suplementos, setSuplementos] = useState<Suplemento[]>([])
  const [suplementosDeCopia, setSuplementosDeCopia] = useState(false)
  const [editando, setEditando] = useState<Dato | null>(null)
  const [texto, setTexto] = useState("")
  const [error, setError] = useState("")
  const [ocupado, setOcupado] = useState(false)
  const guardando = useRef(false)
  const versionDia = useRef(0)
  const hoy = hoyAgenda()
  const diaSemana = new Date(`${hoy}T00:00:00Z`).getUTCDay() || 7

  useFocusEffect(
    useCallback(() => {
      let vigente = true
      // Sin vaciar lo ya mostrado: al volver a Inicio la tarjeta de Hoy se recarga en
      // silencio en lugar de quedarse en blanco y rellenarse (parpadeo en el caso más frecuente).
      setError("")
      seguimiento
        .configuracion(clienteId)
        .then((configuracion) => {
          if (!vigente) return
          setConfiguracion(configuracion)
          const diaSemana = new Date(`${hoy}T00:00:00Z`).getUTCDay() || 7
          if (!pedidosDeHoy(configuracion, diaSemana).includes("cintura")) {
            setCintura(undefined)
            return
          }
          seguimiento
            .medidas(clienteId)
            .then(({ medidas }) => {
              if (vigente) setCintura(cinturaDeHoy(medidas, hoy))
            })
            .catch(() => {
              if (vigente) setError("No se pudo cargar la cintura de hoy. Revisa la conexión.")
            })
        })
        .catch(() => {
          if (vigente) setError("No se pudo cargar el seguimiento pautado. Revisa la conexión.")
        })
      const lecturaDia = versionDia.current
      seguimiento
        .dias(clienteId, hoy, hoy)
        .then(({ dias }) => {
          if (vigente && lecturaDia === versionDia.current) {
            setDia(dias[0] ?? null)
            setDiaCargado(true)
          }
        })
        .catch(() => {
          if (vigente && lecturaDia === versionDia.current)
            setError("No se pudieron cargar los registros de hoy. Revisa la conexión.")
        })
      nutricion
        .vigente(clienteId)
        .then(({ dieta }) => {
          if (!vigente) return
          setSuplementos(dieta?.documento.suplementos ?? [])
          setSuplementosDeCopia(false)
        })
        .catch(async (fallo) => {
          if (!vigente) return
          // Como en Nutrición, una sesión caducada o un permiso retirado no permiten usar la copia.
          const copia =
            fallo instanceof ErrorDeSesion || fallo instanceof ErrorDePermiso
              ? null
              : await leerCopia(almacenDispositivo, clienteId).catch(() => null)
          if (!vigente) return
          setSuplementos(copia?.dieta?.documento.suplementos ?? [])
          setSuplementosDeCopia(copia !== null)
        })
      return () => {
        vigente = false
      }
    }, [seguimiento, nutricion, clienteId, hoy]),
  )

  const guardarCon = async (accion: () => Promise<void>): Promise<boolean> => {
    if (guardando.current) return false
    guardando.current = true
    setOcupado(true)
    setError("")
    try {
      await accion()
      return true
    } catch (fallo) {
      setError(faltaDe(fallo, "No se pudo guardar. Revisa la conexión.").texto)
      return false
    } finally {
      guardando.current = false
      setOcupado(false)
    }
  }
  const guardar = async (cambio: CambiarDia): Promise<boolean> =>
    diaCargado &&
    guardarCon(async () => {
      // Solo las escrituras del día invalidan su recarga; la cintura va por medidas.
      versionDia.current += 1
      try {
        setDia(await seguimiento.cambiarDia(clienteId, hoy, cambio))
      } finally {
        versionDia.current += 1
      }
    })
  const guardarCintura = (cinturaCm: number): Promise<boolean> =>
    guardarCon(async () => {
      if (operacionCintura.current?.cm !== cinturaCm)
        operacionCintura.current = { id: randomUUID(), cm: cinturaCm }
      const medida = await seguimiento.registrarMedida(clienteId, {
        operacionId: operacionCintura.current.id,
        fecha: hoy,
        pesoKg: null,
        cinturaCm,
        grasaPct: null,
        alturaCm: null,
      })
      operacionCintura.current = null
      setCintura(medida.cinturaCm)
    })
  const abrir = (dato: Dato): void => {
    setTexto(textoInicial(dato, dato === "cinturaCm" ? (cintura ?? null) : (dia?.[dato] ?? null)))
    setError("")
    setEditando(dato)
  }

  const fila = (
    dato: Dato,
    nombre: string,
    valor: string | null,
    primera: boolean,
    cargado = diaCargado,
  ): React.JSX.Element => (
    <Pulsable
      key={dato}
      style={[s.fila, !primera && s.separada]}
      accessibilityRole="button"
      accessibilityLabel={`${nombre}: ${valor ?? "sin apuntar"}. Cambiar`}
      accessibilityState={{ disabled: ocupado || !cargado }}
      disabled={ocupado || !cargado}
      onPress={() => abrir(dato)}
    >
      <View style={s.datosFila}>
        <Text style={s.nombre}>{nombre}</Text>
        <Text style={valor === null ? s.apuntar : s.valor}>{valor ?? "Apuntar"}</Text>
      </View>
      {dato === "pasos" && objetivoPasos !== null && objetivoPasos > 0 && (
        <View style={s.pista} accessible={false}>
          <View
            style={[
              s.progreso,
              { width: `${Math.min(100, ((dia?.pasos ?? 0) / objetivoPasos) * 100)}%` },
            ]}
          />
        </View>
      )}
    </Pulsable>
  )
  const edicion = editando ? EDICION[editando] : null
  const indicadoresHoy = configuracion ? pedidosDeHoy(configuracion, diaSemana) : []
  const cargandoInicial = (!configuracion || !diaCargado) && error === ""

  return (
    <View style={s.contenido}>
      {cargandoInicial ? (
        <View
          accessible
          accessibilityLabel="Cargando registros de hoy"
          accessibilityState={{ busy: true }}
        >
          <GrupoEsqueletos>
            <View style={s.carga}>
              <Esqueleto alto={24} ancho="64%" />
              <Esqueleto alto={24} ancho="82%" />
              <Esqueleto alto={24} ancho="58%" />
            </View>
          </GrupoEsqueletos>
        </View>
      ) : (
        (indicadoresHoy.length > 0 || suplementos.length > 0) && (
          <View style={s.tarjeta}>
            {indicadoresHoy.map((indicador, n) => {
              if (indicador === "peso")
                return fila(
                  "pesoKg",
                  "Peso",
                  dia?.pesoKg != null ? pesoLegible(dia.pesoKg) : null,
                  n === 0,
                )
              if (indicador === "pasos")
                return fila(
                  "pasos",
                  "Pasos",
                  dia?.pasos != null
                    ? `${miles(dia.pasos)}${objetivoPasos ? ` / ${miles(objetivoPasos)}` : ""}`
                    : null,
                  n === 0,
                )
              if (indicador === "sueno")
                return fila(
                  "suenoMin",
                  "Sueño",
                  dia?.suenoMin != null ? suenoLegible(dia.suenoMin) : null,
                  n === 0,
                )
              return fila(
                "cinturaCm",
                "Cintura",
                cintura != null ? cmLegible(cintura) : null,
                n === 0,
                cintura !== undefined,
              )
            })}
            {suplementos.map((suplemento, indice) => {
              const tomado = suplementoTomado(suplemento, dia)
              return (
                <Pulsable
                  key={suplemento.nombre}
                  style={[
                    s.fila,
                    s.filaSuplemento,
                    (indicadoresHoy.length > 0 || indice > 0) && s.separada,
                  ]}
                  accessibilityRole="checkbox"
                  aria-checked={tomado}
                  accessibilityLabel={`${suplemento.nombre} tomada`}
                  accessibilityState={{
                    checked: tomado,
                    disabled: ocupado || !diaCargado || suplementosDeCopia,
                  }}
                  disabled={ocupado || !diaCargado || suplementosDeCopia}
                  onPress={() => void guardar(cambioDeSuplemento(suplemento, !tomado, dia))}
                >
                  <View style={s.suplemento}>
                    <Text style={s.nombre}>{suplemento.nombre}</Text>
                    {suplemento.dosis && <Text style={s.dosis}>{suplemento.dosis}</Text>}
                  </View>
                  <View style={[s.casilla, tomado && s.casillaHecha]}>
                    {tomado && <Icono nombre="hecho" color={tema.sobreExito} tamano={16} />}
                  </View>
                </Pulsable>
              )
            })}
          </View>
        )
      )}
      {suplementosDeCopia && suplementos.length > 0 && (
        <Aviso mensaje="Suplementos de la copia guardada · solo lectura." />
      )}
      {!cargandoInicial &&
        configuracion &&
        indicadoresHoy.length === 0 &&
        suplementos.length === 0 &&
        error === "" && (
          <Text style={s.dosis}>Hoy no tienes registros pautados en esta pantalla.</Text>
        )}
      {ocupado && (
        <Text style={s.anuncio} accessibilityLiveRegion="polite">
          Guardando…
        </Text>
      )}
      {error !== "" && editando === null && <AvisoDeError mensaje={error} />}
      <Dialogo
        visible={edicion !== null}
        titulo={edicion?.titulo ?? ""}
        texto={edicion?.texto ?? ""}
        confirmar="Guardar"
        ocupado={ocupado}
        cancelar="Cancelar"
        alCancelar={() => setEditando(null)}
        alConfirmar={() => {
          if (!editando) return
          const cambio = leer(editando, texto)
          if (typeof cambio === "string") {
            setError(cambio)
            return
          }
          void ("cinturaCm" in cambio ? guardarCintura(cambio.cinturaCm) : guardar(cambio)).then(
            (bien) => {
              if (bien) setEditando(null)
            },
          )
        }}
      >
        {edicion && (
          <Campo
            etiqueta={edicion.etiqueta}
            value={texto}
            editable={!ocupado}
            onChangeText={(nuevo) => {
              if (!guardando.current) setTexto(nuevo)
            }}
            keyboardType={edicion.teclado}
            autoFocus
            maxLength={10}
          />
        )}
        {error !== "" && editando !== null && <AvisoDeError mensaje={error} />}
      </Dialogo>
    </View>
  )
}

const s = StyleSheet.create({
  contenido: { gap: espacio[12] },
  tarjeta: {
    backgroundColor: tema.superficie,
    borderRadius: radio.tarjeta,
    paddingHorizontal: espacio[16],
  },
  carga: {
    backgroundColor: tema.superficie,
    borderRadius: radio.tarjeta,
    padding: espacio[16],
    gap: espacio[24],
  },
  fila: {
    minHeight: 56,
    paddingVertical: espacio[12],
    justifyContent: "center",
    gap: espacio[8],
  },
  datosFila: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: espacio[12],
  },
  filaSuplemento: { flexDirection: "row", alignItems: "center" },
  pista: { height: 4, backgroundColor: tema.borde, borderRadius: 2, overflow: "hidden" },
  progreso: { height: 4, backgroundColor: tema.acento },
  separada: { borderTopWidth: 1, borderTopColor: tema.borde },
  nombre: { ...tipo.cuerpo, color: tema.texto, flexShrink: 1 },
  suplemento: { flex: 1, gap: 2 },
  dosis: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 13 },
  valor: {
    color: tema.textoSecundario,
    fontFamily: tema.fuenteTexto,
    fontSize: 15,
    fontVariant: ["tabular-nums"],
  },
  apuntar: { color: tema.acento, fontFamily: tema.fuenteBoton, fontSize: 15 },
  casilla: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: tema.bordeFuerte,
    alignItems: "center",
    justifyContent: "center",
  },
  casillaHecha: { borderColor: tema.exito, backgroundColor: tema.exito },
  anuncio: { position: "absolute", left: -10000, width: 1, height: 1, overflow: "hidden" },
})
