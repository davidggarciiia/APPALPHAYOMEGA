import { useRef, useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import type {
  BloqueValoracion,
  GuardarProximaRevision,
  PautaRevision,
  ProximaRevision,
} from "@alpha-omega/shared"

import { AvisoDeError, BotonPrincipal, BotonSecundario, Campo } from "../componentes/formulario"
import { fechaLegible } from "../entrenamiento/fechas"
import { Enlace } from "../entrenamiento/sesion/controles"
import { faltaDe } from "../lib/errores"
import { ErrorDePeticion } from "../lib/http"
import { tema } from "../tema"

const BLOQUES: Array<{ valor: BloqueValoracion; texto: string }> = [
  { valor: "medidas", texto: "Medidas" },
  { valor: "pliegues", texto: "Pliegues" },
  { valor: "bioimpedancia", texto: "Bioimpedancia" },
  { valor: "pruebas", texto: "Pruebas físicas" },
  { valor: "fotos", texto: "Fotos" },
]

/** «5 nov», «Cada 6 semanas» o «Sin programar». */
export function textoDePauta(pauta: PautaRevision | null): string {
  if (!pauta) return "Sin programar"
  if (pauta.fecha) return fechaLegible(pauta.fecha)
  return `Cada ${pauta.intervaloSemanas} ${pauta.intervaloSemanas === 1 ? "semana" : "semanas"}`
}

/**
 * Próxima revisión que pauta el entrenador: fecha o intervalo y qué se repetirá.
 * Se muestra lo confirmado por el servidor, no una edición que falló.
 */
export function EditorPautaRevision({
  proxima: inicial,
  guardar,
  recargar,
  cerrar,
}: {
  proxima: ProximaRevision
  guardar: (datos: GuardarProximaRevision) => Promise<ProximaRevision>
  recargar: () => Promise<ProximaRevision>
  cerrar: () => void
}): React.JSX.Element {
  const [proxima, setProxima] = useState(inicial)
  const pauta = proxima.pauta
  const [modo, setModo] = useState<"fecha" | "intervalo">(pauta?.fecha ? "fecha" : "intervalo")
  const [fecha, setFecha] = useState(pauta?.fecha ?? "")
  const [semanas, setSemanas] = useState(
    pauta?.intervaloSemanas ? String(pauta.intervaloSemanas) : "",
  )
  const [bloques, setBloques] = useState<BloqueValoracion[]>(pauta?.bloques ?? ["medidas"])
  const [error, setError] = useState("")
  const [ocupado, setOcupado] = useState(false)
  const enCurso = useRef(false)

  const enviar = async (nueva: PautaRevision | null): Promise<void> => {
    if (enCurso.current) return
    enCurso.current = true
    setOcupado(true)
    setError("")
    try {
      setProxima(await guardar({ revision: proxima.revision, pauta: nueva }))
    } catch (fallo) {
      if (fallo instanceof ErrorDePeticion && fallo.detalle.codigo === "revision_obsoleta") {
        setError("La pauta cambió en otro sitio. Mostramos la guardada; revisa y vuelve a guardar.")
        setProxima(await recargar().catch(() => proxima))
      } else setError(faltaDe(fallo, "No se pudo guardar la pauta.").texto)
    } finally {
      enCurso.current = false
      setOcupado(false)
    }
  }

  const programar = (): void => {
    if (bloques.length === 0) return setError("Elige al menos qué se repetirá.")
    if (modo === "fecha") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || Number.isNaN(Date.parse(fecha)))
        return setError("Escribe la fecha como AAAA-MM-DD.")
      void enviar({ fecha, intervaloSemanas: null, bloques })
      return
    }
    const n = Number(semanas)
    if (!Number.isInteger(n) || n < 1 || n > 52)
      return setError("Indica un intervalo de 1 a 52 semanas.")
    void enviar({ fecha: null, intervaloSemanas: n, bloques })
  }

  return (
    <View style={s.contenido}>
      <View style={s.cabecera}>
        <Text style={s.titulo} accessibilityRole="header">
          Próxima revisión
        </Text>
        <Enlace texto="Cerrar" onPress={cerrar} />
      </View>
      <Text style={s.texto} accessibilityLiveRegion="polite">
        Ahora: {textoDePauta(proxima.pauta)}
        {proxima.pauta && proxima.cumplidaPorId ? " · realizada" : ""}
      </Text>
      <View style={s.fila} accessibilityRole="radiogroup" accessibilityLabel="Cómo se programa">
        {(["fecha", "intervalo"] as const).map((m) => (
          <Pressable
            key={m}
            accessibilityRole="radio"
            accessibilityState={{ checked: modo === m, disabled: ocupado }}
            disabled={ocupado}
            onPress={() => setModo(m)}
            style={[s.chip, modo === m && s.chipElegido]}
          >
            <Text style={s.textoChip}>{m === "fecha" ? "En una fecha" : "Cada cierto tiempo"}</Text>
          </Pressable>
        ))}
      </View>
      {modo === "fecha" ? (
        <Campo
          etiqueta="Fecha (AAAA-MM-DD)"
          value={fecha}
          editable={!ocupado}
          maxLength={10}
          onChangeText={setFecha}
        />
      ) : (
        <Campo
          etiqueta="Cada cuántas semanas"
          value={semanas}
          editable={!ocupado}
          keyboardType="number-pad"
          maxLength={2}
          onChangeText={setSemanas}
        />
      )}
      <Text style={s.subtitulo}>Qué se repetirá</Text>
      <View style={s.fila}>
        {BLOQUES.map((b) => {
          const elegido = bloques.includes(b.valor)
          return (
            <Pressable
              key={b.valor}
              accessibilityRole="checkbox"
              accessibilityLabel={b.texto}
              accessibilityState={{ checked: elegido, disabled: ocupado }}
              disabled={ocupado}
              onPress={() =>
                setBloques(elegido ? bloques.filter((x) => x !== b.valor) : [...bloques, b.valor])
              }
              style={[s.chip, elegido && s.chipElegido]}
            >
              <Text style={s.textoChip}>{b.texto}</Text>
            </Pressable>
          )
        })}
      </View>
      {error !== "" && <AvisoDeError mensaje={error} />}
      <BotonPrincipal
        texto={ocupado ? "Guardando…" : "Guardar pauta"}
        ocupado={ocupado}
        onPress={programar}
      />
      {proxima.pauta && (
        <BotonSecundario texto="Dejar sin programar" onPress={() => void enviar(null)} />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  contenido: { gap: 16 },
  cabecera: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  titulo: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 20 },
  subtitulo: { color: tema.texto, fontFamily: tema.fuenteSemi, fontSize: 15 },
  texto: { color: tema.texto, fontFamily: tema.fuenteTexto, fontSize: 15 },
  fila: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: tema.bordeFuerte,
    justifyContent: "center",
  },
  chipElegido: { borderColor: tema.acento, backgroundColor: tema.acentoSuave },
  textoChip: { color: tema.texto, fontFamily: tema.fuenteTexto, fontSize: 14 },
})
