import { useCallback, useState } from "react"
import { randomUUID } from "expo-crypto"
import { useLocalSearchParams, useRouter } from "expo-router"
import { StyleSheet, Text, View } from "react-native"
import { FichaDeUsuarioSchema, type Molestia } from "@alpha-omega/shared"

import { Aviso } from "../../componentes/aviso"
import { EntradaMarca } from "../../componentes/entrada-marca"
import { Esqueleto, GrupoEsqueletos } from "../../componentes/esqueleto"
import {
  AvisoDeError,
  BotonEnlace,
  BotonSecundario,
  PantallaDeFormulario,
} from "../../componentes/formulario"
import { useSalidaProtegida } from "../../componentes/salida-protegida"
import { useEntrenamiento } from "../../entrenamiento/use-entrenamiento"
import { fechaLegible } from "../../entrenamiento/fechas"
import { BotonAtras } from "../../entrenamiento/sesion/controles"
import { useNutricion } from "../../nutricion/api"
import { ValoracionesProfesional } from "../../seguimiento/editor-valoracion"
import { ProgresoCliente } from "../../seguimiento/progreso"
import { useSeguimiento } from "../../seguimiento/use-seguimiento"
import { useMedios } from "../../seguimiento/use-medios"
import type { ApiMedios } from "../../seguimiento/medios-api"
import { useValoraciones } from "../../seguimiento/use-valoraciones"
import { useSesion } from "../../sesion"
import { radio, tema, tipo } from "../../tema"
import { DialogoResponder, textoDeMolestia } from "./atencion"
import { SesionesDelCliente } from "./sesiones"
import { useDatosFicha, type FuentesFicha } from "./use-datos-ficha"

type Destino = "sesiones" | "progreso" | "valoraciones" | "molestias"
const TITULOS = {
  sesiones: "Sesiones",
  progreso: "Progreso",
  valoraciones: "Valoraciones",
  molestias: "Molestias",
}

export function DestinoFicha({ destino }: { destino: Destino }): React.JSX.Element {
  const { id, valoracionInicial, sinRevisar } = useLocalSearchParams<{
    id: string
    valoracionInicial?: string
    sinRevisar?: string
  }>()
  const { estado, pedir } = useSesion()
  const api = useEntrenamiento()
  const seguimiento = useSeguimiento()
  const valoraciones = useValoraciones()
  const medios = useMedios()
  const nutricion = useNutricion()
  const leerFicha = useCallback(
    () => pedir(`/usuarios/${encodeURIComponent(id)}`, FichaDeUsuarioSchema),
    [pedir, id],
  )
  return (
    <PantallaDeFormulario sinTarjeta>
      {estado.fase === "dentro" && estado.usuario.rol === "entrenador" && typeof id === "string" ? (
        <ContenidoDestino
          key={`${estado.usuario.id}:${id}:${destino}`}
          destino={destino}
          clienteId={id}
          api={api}
          seguimiento={seguimiento}
          valoraciones={valoraciones}
          medios={medios}
          nutricion={nutricion}
          leerFicha={leerFicha}
          inicial={valoracionInicial === "1"}
          sinRevisar={sinRevisar === "1"}
        />
      ) : (
        <Text style={s.texto}>Esta pantalla requiere una cuenta de entrenador.</Text>
      )}
    </PantallaDeFormulario>
  )
}

function ContenidoDestino(
  props: FuentesFicha & {
    destino: Destino
    medios: ApiMedios
    inicial: boolean
    sinRevisar: boolean
  },
): React.JSX.Element {
  const { destino, clienteId, api, seguimiento, valoraciones, medios, inicial, sinRevisar } = props
  const { datos, error, copia, responder, sinAcceso, reintentar } = useDatosFicha(props)
  const [editando, setEditando] = useState(false)
  const [respondiendo, setRespondiendo] = useState<Molestia | null>(null)
  const { proteger, proteccion } = useSalidaProtegida(editando)
  const router = useRouter()
  const volver = (): void =>
    router.canGoBack()
      ? router.back()
      : router.replace({ pathname: "/entrenador/cliente/[id]", params: { id: clienteId } })
  const nombre = datos ? [datos.ficha.nombre, datos.ficha.apellidos].filter(Boolean).join(" ") : ""
  const abrir = (id: string): void =>
    router.push({ pathname: "/entrenamiento/[id]", params: { id, nombre } })
  return (
    <View style={s.contenido}>
      {proteccion}
      <View style={s.barra}>
        <BotonAtras etiqueta="Volver a la ficha" onPress={() => proteger(volver)} />
        <Text style={s.tenue}>{nombre}</Text>
      </View>
      <Text style={s.titulo} accessibilityRole="header">
        {TITULOS[destino]}
      </Text>
      {error !== "" &&
        (datos ? (
          <Aviso
            mensaje={copia ? `Sin conexión · copia de las ${copia}` : error}
            alReintentar={reintentar}
          />
        ) : (
          <View style={s.grupo}>
            <AvisoDeError mensaje={error} />
            <BotonSecundario texto="Reintentar" onPress={reintentar} />
          </View>
        ))}
      {!datos ? (
        error === "" && (
          <GrupoEsqueletos>
            <Esqueleto alto={180} />
            <Esqueleto alto={100} />
          </GrupoEsqueletos>
        )
      ) : (
        <EntradaMarca style={s.contenido}>
          {destino === "sesiones" && (
            <SesionesDelCliente
              resultados={datos.resultados}
              molestias={datos.molestias}
              abrir={abrir}
              api={api}
              sinAcceso={sinAcceso}
              sinRevisarInicial={sinRevisar}
            />
          )}
          {destino === "progreso" && (
            <ProgresoCliente
              clienteId={clienteId}
              seguimiento={seguimiento}
              entrenamiento={api}
              modo="entrenador"
              resultados={datos.resultados}
              abrirEjercicio={(ejercicioId) =>
                router.push({
                  pathname: "/entrenador/cliente/[id]/ejercicio/[ejercicioId]",
                  params: { id: clienteId, ejercicioId },
                })
              }
            />
          )}
          {destino === "valoraciones" && (
            <ValoracionesProfesional
              clienteId={clienteId}
              api={valoraciones}
              medios={medios}
              nuevoId={randomUUID}
              alEditar={setEditando}
              iniciarInicial={inicial}
              fechaNacimiento={datos.ficha.fechaNacimiento}
            />
          )}
          {destino === "molestias" &&
            (datos.molestias.length === 0 ? (
              <Text style={s.tenue}>Sin molestias registradas.</Text>
            ) : (
              datos.molestias.map((molestia) => (
                <View
                  key={molestia.id}
                  style={[s.tarjeta, molestia.estado === "atendida" && s.atendida]}
                >
                  <View style={s.nivel}>
                    <View
                      style={[
                        s.intensidad,
                        {
                          width: `${molestia.intensidad * 10}%`,
                          backgroundColor:
                            molestia.intensidad >= 7
                              ? tema.error
                              : molestia.intensidad >= 4
                                ? tema.aviso
                                : tema.exito,
                        },
                      ]}
                    />
                  </View>
                  <Text style={s.texto}>{textoDeMolestia(molestia).titulo}</Text>
                  <Text style={s.tenue}>{textoDeMolestia(molestia).detalle}</Text>
                  <Text style={s.tenue}>
                    {fechaLegible(molestia.creadaEn.slice(0, 10))} ·{" "}
                    {molestia.estado === "abierta" ? "Abierta" : "Atendida"}
                  </Text>
                  {molestia.estado === "abierta" ? (
                    <BotonEnlace
                      texto="Responder"
                      etiquetaAccesible={`Responder: ${textoDeMolestia(molestia).titulo}`}
                      deshabilitado={error !== ""}
                      onPress={() => setRespondiendo(molestia)}
                    />
                  ) : (
                    <Text style={s.texto}>Tu respuesta: {molestia.respuesta}</Text>
                  )}
                  <BotonEnlace texto="Ver sesión" onPress={() => abrir(molestia.sesionId)} />
                </View>
              ))
            ))}
        </EntradaMarca>
      )}
      <DialogoResponder
        molestia={error === "" ? respondiendo : null}
        cerrar={() => setRespondiendo(null)}
        responder={responder}
      />
    </View>
  )
}

const s = StyleSheet.create({
  contenido: { gap: 24 },
  grupo: { gap: 12 },
  barra: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56 },
  titulo: { ...tipo.tituloPantalla, color: tema.texto },
  texto: { ...tipo.cuerpo, color: tema.texto },
  tenue: tipo.secundario,
  tarjeta: { backgroundColor: tema.superficie, borderRadius: radio.tarjeta, padding: 16, gap: 12 },
  atendida: { opacity: 0.65 },
  nivel: { height: 4, backgroundColor: tema.superficieAlta, borderRadius: 2, overflow: "hidden" },
  intensidad: { height: 4 },
})
