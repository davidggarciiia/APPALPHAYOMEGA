import { useCallback, useState } from "react"
import { useFocusEffect } from "expo-router"
import { AppState, Pressable, StyleSheet, Text, View } from "react-native"
import type { DietaPublicada, DocumentoDieta } from "@alpha-omega/shared"
import type { AlmacenLocal } from "../entrenamiento/almacen-local"
import { hoyAgenda } from "../entrenamiento/fechas"
import { ErrorDeRed } from "../lib/http"
import { AvisoDeError, BotonSecundario } from "../componentes/formulario"
import { tema } from "../tema"
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
  | { fase: "lista"; dieta: DietaPublicada | null; copiaDel: string | null }

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
            style={[s.pestana, pestana === valor && s.pestanaActiva]}
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
                <Text style={[s.inicial, dia === n && s.textoActivo]}>{inicial}</Text>
                <Text numberOfLines={1} style={[s.tipoDia, dia === n && s.textoActivoTenue]}>
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
}: {
  clienteId: string
  cuenta: string
  api: ApiNutricion
  almacen: AlmacenLocal
}): React.JSX.Element {
  const [estado, setEstado] = useState<Estado>({ fase: "cargando" })
  const [intento, setIntento] = useState(0)

  useFocusEffect(
    useCallback(() => {
      let vigente = true
      const cancelacion = new AbortController()
      const cargar = async (): Promise<void> => {
        try {
          const { dieta } = await api.vigente(clienteId, cancelacion.signal)
          if (!vigente) return
          setEstado({ fase: "lista", dieta, copiaDel: null })
          // Si falla el guardado local, la dieta se sigue viendo: solo se pierde la copia.
          await guardarCopia(almacen, cuenta, dieta).catch(() => undefined)
        } catch (error) {
          if (!vigente) return
          if (error instanceof ErrorDeRed) {
            const copia = await leerCopia(almacen, cuenta).catch(() => null)
            if (!vigente) return
            setEstado(
              copia
                ? { fase: "lista", dieta: copia.dieta, copiaDel: copia.actualizadaEn }
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
    }, [api, almacen, clienteId, cuenta, intento]),
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
  return (
    <View style={s.contenido}>
      {estado.copiaDel !== null && (
        <View style={s.sinRed}>
          <Text style={s.textoSinRed}>Sin conexión · copia del {fechaCorta(estado.copiaDel)}</Text>
          <BotonSecundario texto="Actualizar" onPress={() => setIntento((n) => n + 1)} />
        </View>
      )}
      {estado.dieta === null ? (
        <Text style={s.vacio}>
          Tu dieta aún no está publicada. Cuando tu profesional la publique aparecerá aquí.
        </Text>
      ) : (
        <>
          <View>
            <Text style={s.nombre}>{estado.dieta.documento.nombre}</Text>
            <Text style={s.tenue}>Publicada el {fechaCorta(estado.dieta.publicadaEn)}</Text>
          </View>
          <DocumentoVisible documento={estado.dieta.documento} />
        </>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  contenido: { gap: 14 },
  pestanas: {
    flexDirection: "row",
    backgroundColor: tema.suave,
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  pestana: {
    flex: 1,
    minHeight: 44,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  pestanaActiva: { backgroundColor: tema.texto },
  textoPestana: { color: tema.textoSecundario, fontFamily: tema.fuenteBoton, fontSize: 15 },
  textoActivo: { color: tema.sobreAcento },
  textoActivoTenue: { color: tema.tenueSobreOscuro },
  semana: { flexDirection: "row", gap: 4 },
  dia: {
    flex: 1,
    minWidth: 40,
    minHeight: 60,
    borderRadius: 12,
    backgroundColor: tema.superficie,
    borderColor: tema.borde,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
    gap: 2,
  },
  diaActivo: { backgroundColor: tema.texto, borderColor: tema.texto },
  inicial: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 16 },
  tipoDia: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 10 },
  titulo: {
    color: tema.texto,
    fontFamily: tema.fuenteTitulo,
    fontSize: 28,
    textTransform: "uppercase",
  },
  nombre: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 18 },
  tenue: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 13 },
  vacio: {
    color: tema.textoTenue,
    fontFamily: tema.fuenteTexto,
    fontSize: 15,
    textAlign: "center",
    padding: 24,
  },
  sinRed: {
    backgroundColor: tema.acentoSuave,
    borderRadius: 14,
    padding: 12,
  },
  textoSinRed: { color: tema.error, fontFamily: tema.fuenteBoton, fontSize: 14 },
  indicaciones: { gap: 10 },
  indicacion: {
    backgroundColor: tema.superficie,
    borderColor: tema.borde,
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 6,
  },
  tituloIndicacion: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 16 },
  textoIndicacion: {
    color: tema.textoSecundario,
    fontFamily: tema.fuenteTexto,
    fontSize: 14,
    lineHeight: 21,
  },
})
