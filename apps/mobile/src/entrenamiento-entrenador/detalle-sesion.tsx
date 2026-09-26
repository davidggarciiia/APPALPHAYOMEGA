import { randomUUID } from "expo-crypto"
import { useRouter } from "expo-router"
import { useState } from "react"
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native"
import {
  diaSemanaDe,
  resumenDeResultado,
  type CambioDeFecha,
  type Prescripcion,
  type ResultadoEntrenamiento,
  type SesionEntrenador,
} from "@alpha-omega/shared"

import { CambiarDia } from "../componentes/cambiar-dia"
import {
  Aviso,
  BotonAtras,
  BotonOro,
  BotonSobrio,
  Lista,
  MarcaDeEstado,
  Pantalla,
  Tarjeta,
  contenidoCentrado,
  texto,
} from "../componentes/diseno"
import { ResultadoSesion, describirObjetivo } from "../componentes/resultado-sesion"
import { cambiarFecha, leerResultado } from "../entrenamiento-cliente/api"
import { TarjetaDeFigura } from "../figuras/tarjeta-de-figura"
import { faltaDe } from "../lib/errores"
import { conMayuscula, fechaLarga, momento } from "../lib/fechas"
import { ErrorDelServidor } from "../lib/transporte"
import { fuentes, tema } from "../tema"

import { ajustarPrescripcion, anularSesion, leerCambiosDeFecha, leerSesionEntrenador } from "./api"
import { EditorDeSesion } from "./editor-sesion"
import { aAjuste, desdePrescripcion, type SesionEnEdicion } from "./plan-en-edicion"
import { useSondeo } from "./use-sondeo"

type Datos =
  | { tipo: "anulada" }
  | {
      tipo: "sesion"
      sesion: SesionEntrenador
      cambios: CambioDeFecha[]
      resultado: ResultadoEntrenamiento | null
    }

async function leerTodo(id: string): Promise<Datos> {
  try {
    const sesion = await leerSesionEntrenador(id)
    const [cambios, resultado] = await Promise.all([
      leerCambiosDeFecha(id),
      sesion.enviadoEn === null ? Promise.resolve(null) : leerResultado(id),
    ])
    return { tipo: "sesion", sesion, cambios: cambios.cambios, resultado }
  } catch (error) {
    // 404: la sesión ya no existe (se anuló). Se dice claro en vez de un error.
    if (error instanceof ErrorDelServidor && error.codigo === 404) {
      return { tipo: "anulada" }
    }
    throw error
  }
}

/**
 * Una sesión vista por el entrenador: fecha, cambios de día, lo prescrito y,
 * cuando el cliente la envía, lo hecho serie a serie frente a lo previsto.
 *
 * Se relee cada 5 s. Mientras no se envía, del registro del cliente no se ve
 * nada: ni si la ha empezado (SPEC-entrenamiento, privacidad del borrador).
 */
export function DetalleDeSesion({
  id,
  cliente,
}: {
  id: string
  cliente: string | null
}): React.JSX.Element {
  const router = useRouter()
  const { estado, recargar, sustituir } = useSondeo(
    id,
    () => leerTodo(id),
    "No hemos podido cargar la sesión.",
  )

  return (
    <Pantalla>
      <ScrollView contentContainerStyle={[estilos.contenido, contenidoCentrado]}>
        <View style={estilos.barraSuperior}>
          <BotonAtras onPress={() => router.back()} />
        </View>

        {estado.fase === "cargando" && (
          <View style={estilos.centrado}>
            <ActivityIndicator color={tema.oro} accessibilityLabel="Cargando la sesión" />
          </View>
        )}

        {estado.fase === "error" && (
          <View style={estilos.centrado}>
            <Text style={[texto.cuerpo, estilos.centradoTexto]}>{estado.falta.texto}</Text>
            {estado.falta.reintentable && <BotonSobrio texto="Reintentar" onPress={recargar} />}
          </View>
        )}

        {estado.fase === "lista" && estado.datos.tipo === "anulada" && (
          <View style={estilos.centrado}>
            <Text style={[texto.seccion, estilos.centradoTexto]}>Esta sesión ya no existe</Text>
            <Text style={[texto.tenueGrande, estilos.centradoTexto]}>
              Se ha anulado o ya no forma parte de tu cartera.
            </Text>
          </View>
        )}

        {estado.fase === "lista" && estado.datos.tipo === "sesion" && (
          <Contenido
            datos={estado.datos}
            cliente={cliente}
            avisoDeRed={estado.falta?.texto ?? null}
            alCambiarAgenda={(agenda) => {
              if (estado.datos.tipo === "sesion") {
                sustituir({ ...estado.datos, sesion: { ...estado.datos.sesion, agenda } })
              }
              recargar()
            }}
            alAnular={() => router.back()}
            alAjustar={(sesion) => {
              if (estado.datos.tipo === "sesion") {
                sustituir({ ...estado.datos, sesion })
              }
            }}
          />
        )}
      </ScrollView>
    </Pantalla>
  )
}

function Contenido({
  datos,
  cliente,
  avisoDeRed,
  alCambiarAgenda,
  alAnular,
  alAjustar,
}: {
  datos: Extract<Datos, { tipo: "sesion" }>
  cliente: string | null
  avisoDeRed: string | null
  alCambiarAgenda: (agenda: SesionEntrenador["agenda"]) => void
  alAnular: () => void
  alAjustar: (sesion: SesionEntrenador) => void
}): React.JSX.Element {
  const { sesion, cambios, resultado } = datos
  // El ajuste parte de la revisión que se estaba viendo: si mientras tanto la
  // sesión cambia (el cliente la empieza), el servidor lo rechaza y se dice.
  const [ajuste, setAjuste] = useState<{ sesion: SesionEnEdicion; revision: number } | null>(null)
  const { agenda } = sesion
  const movida = agenda.fechaActual !== agenda.fechaOriginal
  const enviada = sesion.enviadoEn !== null

  return (
    <>
      <View style={estilos.encabezado}>
        {cliente !== null && <Text style={texto.marca}>{cliente}</Text>}
        <Text style={texto.titulo} accessibilityRole="header">
          {sesion.prescripcion.nombre}
        </Text>
        <Text style={texto.tenueGrande}>
          {conMayuscula(fechaLarga(agenda.fechaActual))}
          {movida ? ` · prevista el ${fechaLarga(agenda.fechaOriginal)}` : ""}
        </Text>
      </View>

      {avisoDeRed !== null && (
        <Aviso tono="error">
          <Text style={texto.cuerpo}>{`No se ha podido actualizar: ${avisoDeRed}`}</Text>
        </Aviso>
      )}

      <Tarjeta destacada style={estilos.estado}>
        <MarcaDeEstado estado={enviada ? "hecho" : "pendiente"} />
        <View style={estilos.flexible}>
          {resultado !== null ? (
            <>
              <Text style={texto.fuerte}>
                {(() => {
                  const { seriesHechas, seriesPrescritas } = resumenDeResultado(resultado)
                  return `Enviado · ${String(seriesHechas)} de ${String(seriesPrescritas)} series`
                })()}
              </Text>
              <Text style={texto.tenueMedio}>{`El ${momento(resultado.enviadoEn)}`}</Text>
            </>
          ) : (
            <>
              <Text style={texto.fuerte}>Pendiente de enviar</Text>
              <Text style={texto.tenueMedio}>
                El cliente registra en privado. Verás lo que ha hecho en cuanto lo envíe.
              </Text>
            </>
          )}
        </View>
      </Tarjeta>

      {resultado !== null ? (
        <ResultadoSesion resultado={resultado} />
      ) : ajuste === null ? (
        <>
          <Acciones
            sesion={sesion}
            alCambiarAgenda={alCambiarAgenda}
            alAnular={alAnular}
            alEmpezarAjuste={() =>
              setAjuste({
                sesion: desdePrescripcion(sesion.prescripcion, diaSemanaDe(agenda.fechaActual)),
                revision: sesion.revisionPrescripcion,
              })
            }
          />
          <PrescripcionDeSesion prescripcion={sesion.prescripcion} />
        </>
      ) : (
        <AjusteDeSesion
          sesionId={agenda.id}
          ajuste={ajuste.sesion}
          revision={ajuste.revision}
          alCambiar={(cambiada) => setAjuste({ ...ajuste, sesion: cambiada })}
          alTerminar={(ajustada) => {
            setAjuste(null)
            if (ajustada !== null) alAjustar(ajustada)
          }}
        />
      )}

      {cambios.length > 0 && (
        <View style={estilos.seccion}>
          <Text style={texto.seccion}>Cambios de día</Text>
          <Lista destacada={false}>
            {cambios.map((cambio, indice) => (
              <View
                key={cambio.id}
                style={[estilos.cambio, indice < cambios.length - 1 && estilos.separador]}
              >
                <Text style={texto.cuerpo}>
                  {`Del ${fechaLarga(cambio.fechaAnterior)} al ${fechaLarga(cambio.fechaNueva)}`}
                </Text>
                <Text style={texto.tenue}>{`El ${momento(cambio.cambiadoEn)}`}</Text>
              </View>
            ))}
          </Lista>
        </View>
      )}
    </>
  )
}

function AjusteDeSesion({
  sesionId,
  ajuste,
  revision,
  alCambiar,
  alTerminar,
}: {
  sesionId: string
  ajuste: SesionEnEdicion
  revision: number
  alCambiar: (sesion: SesionEnEdicion) => void
  alTerminar: (ajustada: SesionEntrenador | null) => void
}): React.JSX.Element {
  const [errores, setErrores] = useState<string[]>([])
  const [guardando, setGuardando] = useState(false)

  const guardar = async (): Promise<void> => {
    const leido = aAjuste(ajuste)
    if (!leido.ok) {
      setErrores(leido.errores)
      return
    }
    setErrores([])
    setGuardando(true)
    try {
      alTerminar(
        await ajustarPrescripcion(sesionId, { revisionPrescripcion: revision, ...leido.valor }),
      )
    } catch (error) {
      setErrores([faltaDe(error, "No hemos podido guardar el ajuste.").texto])
      setGuardando(false)
    }
  }

  return (
    <View style={estilos.seccion}>
      <Text style={texto.seccion}>Ajustar la sesión</Text>
      <Text style={texto.tenueMedio}>
        Cambia ejercicios, series o cargas. Solo se puede mientras el cliente no la empiece.
      </Text>
      <EditorDeSesion
        sesion={ajuste}
        alCambiar={alCambiar}
        nuevoId={() => randomUUID()}
        conDia={false}
      />
      {errores.length > 0 && (
        <Aviso tono="error">
          {errores.map((error) => (
            <Text key={error} style={texto.cuerpo}>
              {error}
            </Text>
          ))}
        </Aviso>
      )}
      <BotonOro texto="Guardar ajuste" ocupado={guardando} onPress={() => void guardar()} />
      <BotonSobrio texto="Cancelar" onPress={() => alTerminar(null)} />
    </View>
  )
}

function Acciones({
  sesion,
  alCambiarAgenda,
  alAnular,
  alEmpezarAjuste,
}: {
  sesion: SesionEntrenador
  alCambiarAgenda: (agenda: SesionEntrenador["agenda"]) => void
  alAnular: () => void
  alEmpezarAjuste: () => void
}): React.JSX.Element {
  const [confirmando, setConfirmando] = useState(false)
  const [anulando, setAnulando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const anular = async (): Promise<void> => {
    setAnulando(true)
    setError(null)
    try {
      await anularSesion(sesion.agenda.id)
      alAnular()
    } catch (fallo) {
      setError(faltaDe(fallo, "No hemos podido anular la sesión.").texto)
      setAnulando(false)
    }
  }

  return (
    <View style={estilos.seccion}>
      {sesion.agenda.estado === "abierta" && (
        <CambiarDia
          agenda={sesion.agenda}
          cambiar={(fecha, revision) => cambiarFecha(sesion.agenda.id, fecha, revision)}
          alCambiar={alCambiarAgenda}
        />
      )}
      {sesion.permiteAjuste ? (
        confirmando ? (
          <Aviso tono="error">
            <Text style={texto.cuerpo}>
              La sesión desaparecerá de la semana del cliente. Solo se puede porque aún no la ha
              empezado.
            </Text>
            <BotonSobrio
              texto="Anular sesión"
              peligro
              ocupado={anulando}
              onPress={() => void anular()}
            />
            <BotonSobrio texto="Cancelar" onPress={() => setConfirmando(false)} />
          </Aviso>
        ) : (
          <>
            <BotonSobrio texto="Ajustar sesión" onPress={alEmpezarAjuste} />
            <BotonSobrio texto="Anular sesión" peligro onPress={() => setConfirmando(true)} />
          </>
        )
      ) : (
        <Text style={texto.tenueMedio}>
          El cliente ya ha empezado esta sesión: no se puede ajustar ni anular.
        </Text>
      )}
      {error !== null && (
        <Text style={estilos.error} accessibilityRole="alert">
          {error}
        </Text>
      )}
    </View>
  )
}

/** Lo que tiene que hacer, ejercicio a ejercicio. */
export function PrescripcionDeSesion({
  prescripcion,
}: {
  prescripcion: Prescripcion
}): React.JSX.Element {
  return (
    <View style={estilos.seccion}>
      <Text style={texto.seccion}>Lo previsto</Text>
      {prescripcion.ejercicios.map((ejercicio) => (
        <View key={ejercicio.id} style={estilos.ejercicio}>
          <TarjetaDeFigura nombre={ejercicio.nombre} />
          <Text style={texto.fuerte}>{ejercicio.nombre}</Text>
          {ejercicio.indicaciones !== null && (
            <Text style={texto.oro}>{ejercicio.indicaciones}</Text>
          )}
          <Lista destacada={false}>
            {ejercicio.series.map((serie, indice) => (
              <View
                key={serie.id}
                style={[estilos.serie, indice < ejercicio.series.length - 1 && estilos.separador]}
              >
                <Text style={estilos.numero}>{String(indice + 1)}</Text>
                <Text style={texto.cuerpo}>{describirObjetivo(serie)}</Text>
              </View>
            ))}
          </Lista>
        </View>
      ))}
    </View>
  )
}

const estilos = StyleSheet.create({
  contenido: { padding: 20, paddingBottom: 48, gap: 24 },
  barraSuperior: { flexDirection: "row" },
  centrado: { alignItems: "center", justifyContent: "center", paddingVertical: 48, gap: 12 },
  centradoTexto: { textAlign: "center" },
  encabezado: { gap: 8 },
  estado: { flexDirection: "row", alignItems: "center", gap: 14 },
  flexible: { flex: 1, gap: 2 },
  seccion: { gap: 14 },
  ejercicio: { gap: 10 },
  serie: { flexDirection: "row", alignItems: "center", gap: 14, minHeight: 48 },
  numero: {
    width: 20,
    color: tema.textoTenue,
    fontFamily: fuentes.semi,
    fontSize: 15,
    textAlign: "center",
  },
  separador: { borderBottomWidth: 1, borderBottomColor: tema.borde },
  cambio: { paddingVertical: 12, gap: 2 },
  error: { color: tema.error, fontFamily: fuentes.normal, fontSize: 14 },
})
