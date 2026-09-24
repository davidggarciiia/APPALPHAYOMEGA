import { useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import type { Comida, ComidaRegistrada, EleccionDeComida } from "@alpha-omega/shared"

import { AvisoDeError } from "../componentes/formulario"
import { BotonAtras, BotonDorado, Enlace } from "../entrenamiento/sesion/controles"
import { faltaDe } from "../lib/errores"
import { degradadoOro, tema } from "../tema"

type Alternativas = Extract<Comida, { forma: "alternativas" }>
type Intercambio = Extract<Comida, { forma: "intercambio" }>

/** Pestañas del diseño: la elegida en dorado. */
function Segmentos({
  opciones,
  activa,
  cambiar,
  etiqueta,
}: {
  opciones: string[]
  activa: number
  cambiar: (indice: number) => void
  etiqueta: string
}): React.JSX.Element {
  return (
    <View style={s.segmentos} accessibilityRole="tablist" accessibilityLabel={etiqueta}>
      {opciones.map((texto, n) => (
        <Pressable
          key={`${texto}-${n}`}
          accessibilityRole="tab"
          accessibilityState={{ selected: n === activa }}
          onPress={() => cambiar(n)}
          style={[s.segmento, n === activa && degradadoOro]}
        >
          <Text style={[s.textoSegmento, n === activa && s.textoSegmentoActivo]}>{texto}</Text>
        </Pressable>
      ))}
    </View>
  )
}

function Cabecera({
  comida,
  subtitulo,
  volver,
}: {
  comida: Comida
  subtitulo: string
  volver: () => void
}): React.JSX.Element {
  return (
    <>
      <BotonAtras etiqueta="Volver a Nutrición" onPress={volver} />
      <View style={s.titulos}>
        <Text style={s.titulo} accessibilityRole="header">
          {comida.nombre}
        </Text>
        <Text style={s.subtitulo}>
          {subtitulo}
          {comida.indicacion ? ` · ${comida.indicacion}` : ""}
        </Text>
      </View>
    </>
  )
}

/** El cliente elige un plato completo, con sus ingredientes fijos. */
function ElegirAlternativa({
  comida,
  registrada,
  guardar,
  enviando,
}: {
  comida: Alternativas
  registrada?: ComidaRegistrada
  guardar: (eleccion: EleccionDeComida) => void
  enviando: boolean
}): React.JSX.Element {
  const previa =
    registrada?.eleccion.tipo === "alternativa" ? registrada.eleccion.alternativaId : null
  const inicial = Math.max(
    0,
    comida.grupos.findIndex((g) => g.alternativas.some((a) => a.id === previa)),
  )
  const [grupo, setGrupo] = useState(inicial)
  const [elegida, setElegida] = useState<string | null>(previa)
  const [aviso, setAviso] = useState("")
  const alternativas = comida.grupos[grupo]?.alternativas ?? []
  return (
    <>
      {comida.grupos.length > 1 && (
        <Segmentos
          etiqueta="Grupos de platos"
          opciones={comida.grupos.map((g, n) => g.nombre ?? `Opciones ${n + 1}`)}
          activa={grupo}
          cambiar={setGrupo}
        />
      )}
      <View style={s.lista} accessibilityRole="radiogroup" accessibilityLabel="Platos completos">
        {alternativas.map((alternativa) => {
          const activa = alternativa.id === elegida
          return (
            <Pressable
              key={alternativa.id}
              accessibilityRole="radio"
              accessibilityState={{ checked: activa }}
              accessibilityLabel={`${alternativa.titulo}: ${alternativa.alimentos
                .map((a) => `${a.nombre}${a.cantidad ? ` ${a.cantidad}` : ""}`)
                .join(", ")}`}
              onPress={() => {
                setElegida(alternativa.id)
                setAviso("")
              }}
              style={[s.opcion, activa && s.opcionActiva]}
            >
              <View style={s.cabeceraOpcion}>
                <Text style={s.nombreOpcion}>{alternativa.titulo}</Text>
                <View style={[s.radio, activa && [s.radioActivo, degradadoOro]]} />
              </View>
              {alternativa.alimentos.map((alimento, n) => (
                <View key={`${alimento.nombre}-${n}`} style={s.alimento}>
                  <Text style={s.nombreAlimento}>{alimento.nombre}</Text>
                  {alimento.cantidad && <Text style={s.cantidad}>{alimento.cantidad}</Text>}
                </View>
              ))}
              {alternativa.nota && <Text style={s.nota}>{alternativa.nota}</Text>}
            </Pressable>
          )
        })}
      </View>
      {aviso !== "" && <Text style={s.subtitulo}>{aviso}</Text>}
      <BotonDorado
        texto="Registrar comida"
        ocupado={enviando}
        onPress={() =>
          elegida !== null
            ? guardar({ tipo: "alternativa", alternativaId: elegida })
            : setAviso("Elige un plato completo antes de guardar.")
        }
      />
    </>
  )
}

/** Intercambio: un alimento explícito de cada grupo. */
function ArmarPlato({
  comida,
  registrada,
  guardar,
  enviando,
}: {
  comida: Intercambio
  registrada?: ComidaRegistrada
  guardar: (eleccion: EleccionDeComida) => void
  enviando: boolean
}): React.JSX.Element {
  const previos =
    registrada?.eleccion.tipo === "plato"
      ? Object.fromEntries(registrada.eleccion.elegidos.map((e) => [e.columna, e.alimento]))
      : {}
  const [plato, setPlato] = useState<Record<string, string>>(previos)
  const [columna, setColumna] = useState(0)
  const [aviso, setAviso] = useState("")
  const actual = comida.columnas[columna]
  const cantidadDe = (nombreColumna: string, alimento: string): string | null =>
    comida.columnas
      .find((c) => c.nombre === nombreColumna)
      ?.alimentos.find((a) => a.nombre === alimento)?.cantidad ?? null

  return (
    <>
      <View style={s.plato}>
        <Text style={s.tituloPlato} accessibilityRole="header">
          Tu plato
        </Text>
        <View style={s.cajas}>
          {comida.columnas.map((c) => (
            <View
              key={c.nombre}
              style={s.caja}
              accessible
              accessibilityLabel={`${c.nombre}: ${plato[c.nombre] ?? "sin elegir"}${plato[c.nombre] ? ` ${cantidadDe(c.nombre, plato[c.nombre] ?? "") ?? ""}` : ""}`}
            >
              <Text style={s.etiquetaCaja}>{c.nombre}</Text>
              <Text style={s.nombreCaja}>{plato[c.nombre] ?? "Elige un alimento"}</Text>
              {plato[c.nombre] && (
                <Text style={s.cantidadCaja}>{cantidadDe(c.nombre, plato[c.nombre] ?? "")}</Text>
              )}
            </View>
          ))}
        </View>
        {aviso !== "" && <Text style={s.subtitulo}>{aviso}</Text>}
        <BotonDorado
          texto="Registrar comida"
          ocupado={enviando}
          onPress={() => {
            const pendiente = comida.columnas.findIndex((c) => !plato[c.nombre])
            if (pendiente >= 0) {
              setColumna(pendiente)
              setAviso("Elige un alimento de cada grupo antes de guardar.")
              return
            }
            guardar({
              tipo: "plato",
              elegidos: comida.columnas.map((c) => ({
                columna: c.nombre,
                alimento: plato[c.nombre]!,
              })),
            })
          }}
        />
      </View>
      {comida.columnas.length > 1 && (
        <Segmentos
          etiqueta="Grupos de alimentos"
          opciones={comida.columnas.map((c) => c.nombre)}
          activa={columna}
          cambiar={setColumna}
        />
      )}
      {actual && (
        <View
          style={s.rejilla}
          accessibilityRole="radiogroup"
          accessibilityLabel={`Elige ${actual.nombre.toLowerCase()}`}
        >
          {actual.alimentos.map((alimento) => {
            const activo = plato[actual.nombre] === alimento.nombre
            return (
              <Pressable
                key={alimento.nombre}
                accessibilityRole="radio"
                accessibilityState={{ checked: activo }}
                accessibilityLabel={`${alimento.nombre}${alimento.cantidad ? `, ${alimento.cantidad}` : ""}`}
                onPress={() => {
                  setPlato((p) => ({ ...p, [actual.nombre]: alimento.nombre }))
                  setAviso("")
                }}
                style={[s.baldosa, activo && s.baldosaActiva]}
              >
                <Text style={s.nombreBaldosa}>{alimento.nombre}</Text>
                {alimento.cantidad && (
                  <Text style={[s.cantidadBaldosa, activo && s.cantidadActiva]}>
                    {alimento.cantidad}
                  </Text>
                )}
              </Pressable>
            )
          })}
        </View>
      )}
    </>
  )
}

/** Una comida del día: elegir y guardarla como hecha, o quitarla. */
export function ComidaDelDia({
  comida,
  registrada,
  registrar,
  quitar,
  volver,
  soloLectura = false,
}: {
  comida: Comida
  registrada?: ComidaRegistrada
  registrar: (eleccion: EleccionDeComida) => Promise<void>
  quitar: () => Promise<void>
  volver: () => void
  /** Sin conexión o sin registro de comidas: se ve, no se guarda. */
  soloLectura?: boolean
}): React.JSX.Element {
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState("")
  const [confirmada, setConfirmada] = useState<EleccionDeComida | null>(
    registrada?.eleccion ?? null,
  )
  const [mensaje, setMensaje] = useState(registrada ? "Comida registrada" : "")
  const ejecutar = async (accion: () => Promise<void>, alCompletar: () => void): Promise<void> => {
    if (soloLectura) return
    setError("")
    setEnviando(true)
    try {
      await accion()
      alCompletar()
    } catch (e) {
      setError(faltaDe(e, "No se pudo guardar la comida.").texto)
    } finally {
      setEnviando(false)
    }
  }
  const guardar = (eleccion: EleccionDeComida): void =>
    void ejecutar(
      () => registrar(eleccion),
      () => {
        setConfirmada(eleccion)
        setMensaje("Comida registrada")
      },
    )
  const resumenConfirmado =
    confirmada?.tipo === "alternativa" && comida.forma === "alternativas"
      ? comida.grupos.flatMap((g) => g.alternativas).find((a) => a.id === confirmada.alternativaId)
          ?.titulo
      : confirmada?.tipo === "plato"
        ? confirmada.elegidos.map((e) => `${e.columna}: ${e.alimento}`).join(" · ")
        : confirmada?.tipo === "hecha"
          ? "Hecha"
          : null
  return (
    <View style={s.contenido}>
      <Cabecera
        comida={comida}
        subtitulo={
          comida.forma === "alternativas" ? "Elige un plato completo" : "Elige uno de cada grupo"
        }
        volver={volver}
      />
      {comida.forma === "alternativas" ? (
        <ElegirAlternativa
          comida={comida}
          registrada={registrada}
          guardar={guardar}
          enviando={enviando}
        />
      ) : (
        <ArmarPlato comida={comida} registrada={registrada} guardar={guardar} enviando={enviando} />
      )}
      {confirmada && (
        <View style={s.confirmacion} accessibilityLiveRegion="polite">
          <Text style={s.confirmacionTitulo}>{mensaje}</Text>
          {resumenConfirmado && <Text style={s.subtitulo}>{resumenConfirmado}</Text>}
        </View>
      )}
      {soloLectura && (
        <Text style={s.subtitulo}>Sin conexión: podrás guardarla cuando vuelvas a tener red.</Text>
      )}
      {error !== "" && <AvisoDeError mensaje={error} />}
      {confirmada && !soloLectura && (
        <Enlace
          texto="Quitar de hechas"
          onPress={() =>
            void ejecutar(quitar, () => {
              setConfirmada(null)
              setMensaje("")
            })
          }
        />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  contenido: { gap: 20, paddingBottom: 24 },
  confirmacion: {
    backgroundColor: tema.acentoSuave,
    borderColor: tema.bordeDestacado,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 4,
  },
  confirmacionTitulo: { color: tema.acento, fontFamily: tema.fuenteBoton, fontSize: 16 },
  titulos: { gap: 6 },
  titulo: {
    color: tema.texto,
    fontFamily: tema.fuenteTitulo,
    fontSize: 34,
    lineHeight: 38,
    textTransform: "uppercase",
  },
  subtitulo: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 15 },
  segmentos: {
    flexDirection: "row",
    flexWrap: "wrap",
    backgroundColor: tema.superficie,
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  segmento: {
    flexGrow: 1,
    flexBasis: "30%",
    minHeight: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  textoSegmento: { color: tema.texto, fontFamily: tema.fuenteSemi, fontSize: 15 },
  textoSegmentoActivo: { color: tema.sobreAcento, fontFamily: tema.fuenteBoton },
  lista: { gap: 12 },
  opcion: {
    backgroundColor: tema.superficie,
    borderRadius: 20,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: tema.bordeFuerte,
  },
  opcionActiva: { borderColor: tema.acento },
  cabeceraOpcion: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 4 },
  nombreOpcion: { flex: 1, color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 17 },
  radio: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: tema.bordeFuerte,
  },
  radioActivo: { borderColor: "transparent" },
  alimento: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  nombreAlimento: {
    flex: 1,
    color: tema.textoSecundario,
    fontFamily: tema.fuenteTexto,
    fontSize: 14,
  },
  cantidad: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 14 },
  nota: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 13 },
  plato: {
    backgroundColor: tema.superficie,
    borderRadius: 20,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: tema.bordeDestacado,
  },
  tituloPlato: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 17 },
  cajas: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  caja: {
    flexGrow: 1,
    flexBasis: 120,
    backgroundColor: tema.superficieAlta,
    borderRadius: 14,
    padding: 12,
    gap: 4,
  },
  etiquetaCaja: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 12 },
  nombreCaja: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 15 },
  cantidadCaja: { color: tema.acento, fontFamily: tema.fuenteBoton, fontSize: 14 },
  rejilla: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  // Dos columnas, como en el diseño.
  baldosa: {
    flexGrow: 1,
    flexBasis: "45%",
    minHeight: 60,
    backgroundColor: tema.superficie,
    borderRadius: 14,
    padding: 12,
    gap: 2,
    borderWidth: 1,
    borderColor: tema.bordeFuerte,
  },
  baldosaActiva: { borderColor: tema.acento, backgroundColor: tema.acentoSuave },
  nombreBaldosa: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 15 },
  cantidadBaldosa: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 14 },
  cantidadActiva: { color: tema.acento, fontFamily: tema.fuenteBoton },
})
