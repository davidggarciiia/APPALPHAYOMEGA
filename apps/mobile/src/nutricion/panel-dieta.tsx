import { useCallback, useRef, useState } from "react"
import { useFocusEffect } from "expo-router"
import { StyleSheet, Text, View } from "react-native"
import type {
  BorradorDieta,
  DietaDelHistorico,
  DietaPublicada,
  ListadoDietas,
} from "@alpha-omega/shared"
import {
  AvisoDeError,
  BotonDestructivo,
  BotonPrincipal,
  BotonSecundario,
} from "../componentes/formulario"
import { ErrorDePeticion, ErrorDePermiso } from "../lib/http"
import { tema } from "../tema"
import type { ApiNutricion } from "./api"
import type { OrigenDelEditor } from "./editor-dieta"
import { Accion } from "./editor-comida"
import { DocumentoVisible } from "./vista-dieta"

const fecha = (iso: string): string =>
  new Date(iso).toLocaleString("es-ES", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  })

type Datos = {
  vigente: DietaPublicada | null
  borrador: BorradorDieta | null
  historico: ListadoDietas
}

/**
 * La dieta de un cliente vista por el profesional: la vigente, el borrador y el
 * histórico. Publicar pide confirmación y reutiliza la misma operación si hay
 * que reintentar, para no publicar dos veces.
 */
export function PanelDieta({
  clienteId,
  api,
  editar,
  nuevoId,
  alCambiar,
}: {
  clienteId: string
  api: ApiNutricion
  editar: (origen: OrigenDelEditor) => void
  nuevoId: () => string
  alCambiar?: () => void
}): React.JSX.Element {
  const [datos, setDatos] = useState<Datos | null>(null)
  const [error, setError] = useState("")
  const [aviso, setAviso] = useState("")
  const [confirmando, setConfirmando] = useState<"publicar" | "descartar" | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [abierta, setAbierta] = useState<DietaDelHistorico | null>(null)
  const [intento, setIntento] = useState(0)
  const [cargandoMas, setCargandoMas] = useState(false)
  const consulta = useRef(0)
  const operacion = useRef<{ revision: number; id: string } | null>(null)

  useFocusEffect(
    useCallback(() => {
      let vigente = true
      consulta.current += 1
      setCargandoMas(false)
      Promise.all([api.vigente(clienteId), api.borrador(clienteId), api.historico(clienteId, 0)])
        .then(([{ dieta }, { borrador }, historico]) => {
          if (!vigente) return
          setDatos({ vigente: dieta, borrador, historico })
          setError("")
        })
        .catch((fallo: unknown) => {
          if (!vigente) return
          setError(
            fallo instanceof ErrorDePermiso
              ? "No tienes acceso a la dieta de este cliente."
              : "No se pudo cargar la dieta. Revisa la conexión.",
          )
        })
      return () => {
        vigente = false
        consulta.current += 1
      }
    }, [api, clienteId, intento]),
  )

  if (error !== "") {
    return (
      <View style={s.contenido}>
        <AvisoDeError mensaje={error} />
        <BotonSecundario texto="Reintentar" onPress={() => setIntento((n) => n + 1)} />
      </View>
    )
  }
  if (datos === null) return <Text style={s.tenue}>Cargando la dieta…</Text>

  const { vigente, borrador, historico } = datos
  const archivadas = historico.dietas.filter((d) => d.estado === "archivada")

  const publicar = async (): Promise<void> => {
    if (borrador === null) return
    // El mismo id en cada reintento de la misma revisión: el servidor no publica dos veces.
    if (operacion.current?.revision !== borrador.revision) {
      operacion.current = { revision: borrador.revision, id: nuevoId() }
    }
    setOcupado(true)
    try {
      await api.publicar(clienteId, operacion.current.id, borrador.revision)
      operacion.current = null
      setConfirmando(null)
      setAviso("Dieta publicada. El cliente ya la ve.")
      setIntento((n) => n + 1)
      alCambiar?.()
    } catch (fallo) {
      setAviso(
        fallo instanceof ErrorDePeticion
          ? `${fallo.message} Recarga la dieta antes de volver a publicar.`
          : "No se ha podido confirmar la publicación. Reintenta: no se publicará dos veces.",
      )
    } finally {
      setOcupado(false)
    }
  }

  const descartar = async (): Promise<void> => {
    if (borrador === null) return
    setOcupado(true)
    try {
      await api.descartar(clienteId, borrador.revision)
      setConfirmando(null)
      setAviso("Borrador descartado.")
      setIntento((n) => n + 1)
      alCambiar?.()
    } catch (fallo) {
      setAviso(
        fallo instanceof ErrorDePeticion
          ? `${fallo.message}`
          : "No se ha podido descartar el borrador. Reintenta con conexión.",
      )
    } finally {
      setOcupado(false)
    }
  }

  return (
    <View style={s.contenido}>
      {aviso !== "" && (
        <Text style={s.aviso} accessibilityLiveRegion="polite">
          {aviso}
        </Text>
      )}

      <View style={s.tarjeta}>
        <Text style={s.leyenda}>BORRADOR</Text>
        {borrador ? (
          <>
            <Text style={s.nombre}>{borrador.documento.nombre}</Text>
            <Text style={s.tenue}>
              Guardado el {fecha(borrador.actualizadoEn)} · el cliente todavía no lo ve
            </Text>
            <BotonSecundario texto="Editar borrador" onPress={() => editar("borrador")} />
            {confirmando === "publicar" ? (
              <View style={s.confirmar}>
                <Text style={s.textoConfirmar}>
                  Al publicar, el cliente verá «{borrador.documento.nombre}» y la dieta actual
                  pasará al histórico.
                </Text>
                <BotonPrincipal
                  texto="Confirmar y publicar"
                  ocupado={ocupado}
                  onPress={() => void publicar()}
                />
                <BotonSecundario texto="Cancelar" onPress={() => setConfirmando(null)} />
              </View>
            ) : confirmando === "descartar" ? (
              <View style={s.confirmar}>
                <Text style={s.textoConfirmar}>
                  Se perderá el borrador. La dieta vigente no cambia.
                </Text>
                <BotonDestructivo
                  texto="Descartar borrador"
                  ocupado={ocupado}
                  onPress={() => void descartar()}
                />
                <BotonSecundario texto="Cancelar" onPress={() => setConfirmando(null)} />
              </View>
            ) : (
              <>
                <BotonPrincipal texto="Publicar" onPress={() => setConfirmando("publicar")} />
                <Accion texto="Descartar borrador" onPress={() => setConfirmando("descartar")} />
              </>
            )}
          </>
        ) : (
          <>
            <Text style={s.tenue}>No hay ningún borrador en preparación.</Text>
            {vigente && (
              <BotonPrincipal
                texto="Editar a partir de la vigente"
                onPress={() => editar("vigente")}
              />
            )}
            <BotonSecundario texto="Nueva dieta desde cero" onPress={() => editar("nueva")} />
          </>
        )}
      </View>

      <Text style={s.seccion} accessibilityRole="header">
        Dieta vigente
      </Text>
      {vigente ? (
        <>
          <Text style={s.tenue}>
            {vigente.documento.nombre} · publicada el {fecha(vigente.publicadaEn)}
          </Text>
          <DocumentoVisible documento={vigente.documento} />
        </>
      ) : (
        <Text style={s.tenue}>El cliente todavía no tiene ninguna dieta publicada.</Text>
      )}

      <Text style={s.seccion} accessibilityRole="header">
        Histórico
      </Text>
      {archivadas.length === 0 ? (
        <Text style={s.tenue}>Aún no hay dietas anteriores.</Text>
      ) : (
        archivadas.map((d) => (
          <View key={d.id} style={s.fila}>
            <View style={s.datosFila}>
              <Text style={s.nombreFila}>{d.nombre}</Text>
              <Text style={s.tenue}>
                Publicada el {fecha(d.publicadaEn)} por {d.publicadaPor.nombre}
              </Text>
            </View>
            <Accion
              texto={abierta?.id === d.id ? "Cerrar" : "Ver"}
              etiqueta={`${abierta?.id === d.id ? "Cerrar" : "Ver"} ${d.nombre}`}
              onPress={() =>
                abierta?.id === d.id
                  ? setAbierta(null)
                  : void api
                      .delHistorico(clienteId, d.id)
                      .then(setAbierta)
                      .catch(() => setAviso("No se pudo abrir esa dieta."))
              }
            />
          </View>
        ))
      )}
      {historico.total > historico.dietas.length && (
        <View>
          <Text style={s.tenue}>
            Mostrando {historico.dietas.length} de {historico.total} dietas.
          </Text>
          <BotonSecundario
            texto="Ver más dietas"
            ocupado={cargandoMas}
            onPress={() => {
              if (cargandoMas) return
              const vigente = consulta.current
              setCargandoMas(true)
              void api
                .historico(clienteId, historico.dietas.length)
                .then((pagina) => {
                  if (vigente !== consulta.current) return
                  setDatos(
                    (actual) =>
                      actual && {
                        ...actual,
                        historico: {
                          ...pagina,
                          dietas: [
                            ...new Map(
                              [...actual.historico.dietas, ...pagina.dietas].map((dieta) => [
                                dieta.id,
                                dieta,
                              ]),
                            ).values(),
                          ],
                        },
                      },
                  )
                })
                .catch(() => {
                  if (vigente === consulta.current)
                    setAviso("No se pudieron cargar más dietas. Reintenta.")
                })
                .finally(() => {
                  if (vigente === consulta.current) setCargandoMas(false)
                })
            }}
          />
        </View>
      )}
      {abierta && (
        <View style={s.tarjeta}>
          <Text style={s.leyenda}>DIETA ANTERIOR · SOLO LECTURA</Text>
          <Text style={s.nombre}>{abierta.documento.nombre}</Text>
          <DocumentoVisible documento={abierta.documento} />
        </View>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  contenido: { gap: 12 },
  tenue: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 13 },
  aviso: {
    backgroundColor: tema.exitoSuave,
    color: tema.texto,
    borderRadius: 12,
    padding: 12,
    fontFamily: tema.fuenteBoton,
  },
  tarjeta: {
    backgroundColor: tema.superficie,
    borderColor: tema.borde,
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 6,
  },
  leyenda: { color: tema.acento, fontFamily: tema.fuenteBoton, fontSize: 12, letterSpacing: 2.4 },
  nombre: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 18 },
  confirmar: { backgroundColor: tema.acentoSuave, borderRadius: 14, padding: 12, marginTop: 8 },
  textoConfirmar: { color: tema.texto, fontFamily: tema.fuenteTexto, fontSize: 14, lineHeight: 20 },
  seccion: {
    color: tema.texto,
    fontFamily: tema.fuenteTitulo,
    fontSize: 24,
    textTransform: "uppercase",
    marginTop: 8,
  },
  fila: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: tema.superficie,
    borderColor: tema.borde,
    borderWidth: 1,
    borderRadius: 14,
    paddingLeft: 14,
  },
  datosFila: { flex: 1, paddingVertical: 10, gap: 2 },
  nombreFila: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 15 },
})
