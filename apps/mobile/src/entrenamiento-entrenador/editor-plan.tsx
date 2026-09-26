import { randomUUID } from "expo-crypto"
import { useRouter } from "expo-router"
import { useState, type ReactNode } from "react"
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native"
import {
  fechasDelPlan,
  hoyEn,
  lunesDe,
  sumarDias,
  type AsignarPlan,
  type Ejercicio,
  type FechaDelPlan,
  type RutinaGuardada,
} from "@alpha-omega/shared"

import { ejerciciosPorId } from "../catalogo-ejercicios/api"
import {
  Aviso,
  BotonAtras,
  BotonOro,
  BotonSobrio,
  CampoDeTexto,
  EnlaceOro,
  FilaDeLista,
  Lista,
  Pantalla,
  Tarjeta,
  contenidoCentrado,
  texto,
} from "../componentes/diseno"
import { Pulsable } from "../componentes/pulsable"
import { NavegadorDeSemana } from "../componentes/tira-de-semana"
import { faltaDe } from "../lib/errores"
import { conMayuscula, fechaCorta, fechaLarga, rangoDeSemana } from "../lib/fechas"
import { fuentes, tema } from "../tema"

import { asignarPlan, crearRutina, listarRutinas, sesionesDeCliente } from "./api"
import { EditorDeSesion } from "./editor-sesion"
import {
  DIAS_DE_LA_SEMANA,
  aPatron,
  desdePatron,
  resumenDeRutina,
  sesionNueva,
  type SesionEnEdicion,
} from "./plan-en-edicion"

const nuevoId = (): string => randomUUID()

export type CrearEjercicioEnLinea = (
  busqueda: string,
  alCrear: (ejercicio: Ejercicio) => void,
) => ReactNode

/**
 * Las sesiones de un plan o una rutina, cada una con su editor, y «Añadir
 * sesión» en el primer día libre. Lo comparten el editor de planes y el de
 * rutinas.
 */
export function EditorDeSesiones({
  sesiones,
  alCambiar,
  crearEjercicio,
}: {
  sesiones: SesionEnEdicion[]
  alCambiar: (sesiones: SesionEnEdicion[]) => void
  crearEjercicio?: CrearEjercicioEnLinea
}): React.JSX.Element {
  const anadir = (): void => {
    const ocupados = new Set(sesiones.map((s) => s.diaSemana))
    const libre = [1, 2, 3, 4, 5, 6, 7].find((dia) => !ocupados.has(dia)) ?? 1
    alCambiar([...sesiones, sesionNueva(nuevoId, libre)])
  }

  return (
    <View style={estilos.seccion}>
      <Text style={texto.seccion}>Sesiones de cada semana</Text>
      {sesiones.map((sesion, indice) => (
        <Tarjeta key={sesion.id} destacada style={estilos.sesion}>
          <View style={estilos.cabeceraSesion}>
            <Text style={texto.oro}>
              {`Sesión ${String(indice + 1)} · ${DIAS_DE_LA_SEMANA[sesion.diaSemana - 1] ?? ""}`}
            </Text>
            <Pulsable
              onPress={() => alCambiar(sesiones.filter((s) => s.id !== sesion.id))}
              accessibilityRole="button"
              accessibilityLabel={`Quitar la sesión ${String(indice + 1)}`}
              hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
            >
              <Text style={estilos.quitar}>Quitar</Text>
            </Pulsable>
          </View>
          <EditorDeSesion
            sesion={sesion}
            nuevoId={nuevoId}
            alCambiar={(cambiada) =>
              alCambiar(sesiones.map((s) => (s.id === cambiada.id ? cambiada : s)))
            }
            crearEjercicio={crearEjercicio}
          />
        </Tarjeta>
      ))}
      <BotonSobrio texto="+ Añadir sesión" onPress={anadir} />
    </View>
  )
}

/** «Cargar rutina guardada»: la lista y la copia con ids nuevos. */
function CargarRutina({
  alCargar,
}: {
  alCargar: (rutina: RutinaGuardada, sesiones: SesionEnEdicion[]) => void
}): React.JSX.Element {
  const [abierto, setAbierto] = useState(false)
  const [estado, setEstado] = useState<
    | { fase: "cargando" }
    | { fase: "lista"; rutinas: RutinaGuardada[] }
    | { fase: "error"; texto: string }
  >({ fase: "cargando" })
  const [cargando, setCargando] = useState<string | null>(null)

  const abrir = (): void => {
    setAbierto(true)
    setEstado({ fase: "cargando" })
    listarRutinas()
      .then((listado) => setEstado({ fase: "lista", rutinas: listado.rutinas }))
      .catch((error: unknown) =>
        setEstado({
          fase: "error",
          texto: faltaDe(error, "No hemos podido cargar tus rutinas.").texto,
        }),
      )
  }

  const elegir = async (rutina: RutinaGuardada): Promise<void> => {
    setCargando(rutina.id)
    try {
      const ids = rutina.patron.sesiones.flatMap((s) => s.ejercicios.map((e) => e.ejercicioId))
      const { ejercicios } = await ejerciciosPorId(ids)
      const nombres = new Map(ejercicios.map((e) => [e.id, e.nombre]))
      alCargar(rutina, desdePatron(rutina.patron, nombres, nuevoId))
      setAbierto(false)
    } catch (error) {
      setEstado({
        fase: "error",
        texto: faltaDe(error, "No hemos podido cargar la rutina.").texto,
      })
    } finally {
      setCargando(null)
    }
  }

  if (!abierto) {
    return <EnlaceOro texto="Cargar una rutina guardada" onPress={abrir} />
  }
  return (
    <View style={estilos.seccion}>
      <Text style={texto.seccion}>Tus rutinas</Text>
      {estado.fase === "cargando" && <ActivityIndicator color={tema.oro} />}
      {estado.fase === "error" && <Text style={texto.cuerpo}>{estado.texto}</Text>}
      {estado.fase === "lista" &&
        (estado.rutinas.length === 0 ? (
          <Text style={texto.tenueMedio}>Aún no tienes rutinas guardadas.</Text>
        ) : (
          <Lista>
            {estado.rutinas.map((rutina, indice) => (
              <FilaDeLista
                key={rutina.id}
                titulo={cargando === rutina.id ? "Cargando…" : rutina.nombre}
                subtitulo={resumenDeRutina(rutina)}
                ultima={indice === estado.rutinas.length - 1}
                onPress={cargando === null ? () => void elegir(rutina) : undefined}
              />
            ))}
          </Lista>
        ))}
      <EnlaceOro texto="Cerrar" onPress={() => setAbierto(false)} />
    </View>
  )
}

type Revision = {
  plan: AsignarPlan
  fechas: FechaDelPlan[]
  /** Lo que el cliente ya tiene cada día que el plan también ocupa. */
  choques: Map<string, string[]> | null
}

/**
 * Crear un plan para un cliente: sesiones de una semana tipo, repetidas N
 * semanas desde un lunes. «Revisar» enseña las fechas exactas que se van a crear
 * (y si el cliente ya tiene algo ese día) antes de asignar.
 *
 * El `operacionId` nace al revisar y se reutiliza en cada reintento de
 * «Asignar»: si la respuesta se pierde y se pulsa otra vez, el servidor
 * devuelve el mismo plan en vez de crear otro. Cualquier cambio tira la
 * revisión, y con ella el id.
 */
export function EditorDePlan({
  clienteId,
  nombreCliente,
  crearEjercicio,
}: {
  clienteId: string
  nombreCliente: string
  crearEjercicio?: CrearEjercicioEnLinea
}): React.JSX.Element {
  const router = useRouter()
  const hoy = hoyEn()
  const [nombre, setNombre] = useState("")
  const [sesiones, setSesiones] = useState<SesionEnEdicion[]>(() => [sesionNueva(nuevoId, 1)])
  const [semanaInicial, setSemanaInicial] = useState(() => sumarDias(lunesDe(hoy), 7))
  const [semanas, setSemanas] = useState(4)
  const [errores, setErrores] = useState<string[]>([])
  const [revision, setRevision] = useState<Revision | null>(null)
  const [asignando, setAsignando] = useState(false)
  const [asignado, setAsignado] = useState<number | null>(null)
  const [aviso, setAviso] = useState<{ texto: string; error: boolean } | null>(null)
  const [guardandoRutina, setGuardandoRutina] = useState(false)

  /** Todo cambio invalida la revisión: lo revisado tiene que ser lo que se asigna. */
  const editar = <T,>(fijar: (valor: T) => void) => {
    return (valor: T): void => {
      fijar(valor)
      setRevision(null)
      setAviso(null)
    }
  }

  const leerPlan = (): AsignarPlan | null => {
    const patron = aPatron(sesiones)
    const faltas = [
      ...(nombre.trim() === "" ? ["Ponle nombre al plan."] : []),
      ...(patron.ok ? [] : patron.errores),
    ]
    setErrores(faltas)
    if (faltas.length > 0 || !patron.ok) {
      return null
    }
    return {
      operacionId: nuevoId(),
      nombre: nombre.trim(),
      semanaInicial,
      semanas,
      patron: patron.valor,
    }
  }

  const revisar = async (): Promise<void> => {
    setAviso(null)
    const plan = leerPlan()
    if (plan === null) {
      return
    }
    const fechas = fechasDelPlan(plan.semanaInicial, plan.semanas, plan.patron)
    setRevision({ plan, fechas, choques: null })
    try {
      const existentes = await sesionesDeCliente(clienteId, plan.semanaInicial, plan.semanas)
      const choques = new Map<string, string[]>()
      for (const sesion of existentes.sesiones) {
        const dia = choques.get(sesion.agenda.fechaActual) ?? []
        dia.push(sesion.nombre)
        choques.set(sesion.agenda.fechaActual, dia)
      }
      setRevision((actual) => (actual?.plan === plan ? { ...actual, choques } : actual))
    } catch {
      // Sin la lista no se avisa de choques, pero se puede asignar igual.
      setRevision((actual) => (actual?.plan === plan ? { ...actual, choques: new Map() } : actual))
    }
  }

  const asignar = async (): Promise<void> => {
    if (revision === null) return
    setAsignando(true)
    setAviso(null)
    try {
      const asignadoPlan = await asignarPlan(clienteId, revision.plan)
      setAsignado(asignadoPlan.sesiones.length)
    } catch (error) {
      setAviso({ texto: faltaDe(error, "No hemos podido asignar el plan.").texto, error: true })
    } finally {
      setAsignando(false)
    }
  }

  const guardarComoRutina = async (): Promise<void> => {
    setAviso(null)
    const patron = aPatron(sesiones)
    const faltas = [
      ...(nombre.trim() === ""
        ? ["Ponle nombre: la rutina se guarda con el nombre del plan."]
        : []),
      ...(patron.ok ? [] : patron.errores),
    ]
    setErrores(faltas)
    if (faltas.length > 0 || !patron.ok) return
    setGuardandoRutina(true)
    try {
      await crearRutina({ nombre: nombre.trim(), patron: patron.valor })
      setAviso({ texto: `Guardada en tus rutinas como «${nombre.trim()}».`, error: false })
    } catch (error) {
      setAviso({ texto: faltaDe(error, "No hemos podido guardar la rutina.").texto, error: true })
    } finally {
      setGuardandoRutina(false)
    }
  }

  if (asignado !== null) {
    return (
      <Pantalla>
        <ScrollView contentContainerStyle={[estilos.contenido, contenidoCentrado]}>
          <Text style={texto.titulo} accessibilityRole="header">
            Plan asignado
          </Text>
          <Text style={texto.tenueGrande}>
            {`${nombreCliente} ya tiene ${String(asignado)} sesiones de «${nombre.trim()}» en su semana.`}
          </Text>
          <BotonOro texto="Volver a sus entrenos" onPress={() => router.back()} />
        </ScrollView>
      </Pantalla>
    )
  }

  return (
    <Pantalla>
      <ScrollView
        contentContainerStyle={[estilos.contenido, contenidoCentrado]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={estilos.barraSuperior}>
          <BotonAtras onPress={() => router.back()} />
        </View>
        <View style={estilos.encabezado}>
          <Text style={texto.marca}>{nombreCliente}</Text>
          <Text style={texto.titulo} accessibilityRole="header">
            Nuevo plan
          </Text>
        </View>

        <CampoDeTexto
          etiqueta="Nombre del plan"
          value={nombre}
          onChangeText={editar(setNombre)}
          placeholder="Fuerza 3 días"
          maxLength={120}
        />

        <CargarRutina
          alCargar={(rutina, cargadas) => {
            editar(setSesiones)(cargadas)
            if (nombre.trim() === "") setNombre(rutina.nombre)
            setAviso({
              texto: `Cargada la rutina «${rutina.nombre}». Es una copia: cámbiala sin miedo.`,
              error: false,
            })
          }}
        />

        <EditorDeSesiones
          sesiones={sesiones}
          alCambiar={editar(setSesiones)}
          crearEjercicio={crearEjercicio}
        />

        <View style={estilos.seccion}>
          <Text style={texto.seccion}>Calendario</Text>
          <Text style={estilos.etiqueta}>Primera semana</Text>
          <NavegadorDeSemana
            lunes={semanaInicial}
            esEstaSemana={semanaInicial === lunesDe(hoy)}
            alCambiar={(dias) => editar(setSemanaInicial)(sumarDias(semanaInicial, dias))}
            alVolverAHoy={() => editar(setSemanaInicial)(lunesDe(hoy))}
          />
          <Text style={estilos.etiqueta}>Cuántas semanas</Text>
          <View style={estilos.contador}>
            <BotonDePaso
              texto="−"
              etiqueta="Una semana menos"
              desactivado={semanas === 1}
              onPress={() => editar(setSemanas)(Math.max(1, semanas - 1))}
            />
            <Text style={estilos.numeroSemanas} accessibilityLiveRegion="polite">
              {semanas === 1 ? "1 semana" : `${String(semanas)} semanas`}
            </Text>
            <BotonDePaso
              texto="+"
              etiqueta="Una semana más"
              desactivado={semanas === 52}
              onPress={() => editar(setSemanas)(Math.min(52, semanas + 1))}
            />
          </View>
        </View>

        {errores.length > 0 && (
          <Aviso tono="error">
            <Text style={texto.fuerte}>Falta algo</Text>
            {errores.map((error) => (
              <Text key={error} style={texto.cuerpo}>
                {`· ${error}`}
              </Text>
            ))}
          </Aviso>
        )}

        {aviso !== null && (
          <Aviso tono={aviso.error ? "error" : "info"}>
            <Text style={texto.cuerpo}>{aviso.texto}</Text>
          </Aviso>
        )}

        {revision === null ? (
          <BotonOro texto="Revisar fechas" onPress={() => void revisar()} />
        ) : (
          <RevisionDelPlan
            revision={revision}
            asignando={asignando}
            alAsignar={() => void asignar()}
          />
        )}

        <BotonSobrio
          texto="Guardar como rutina"
          ocupado={guardandoRutina}
          onPress={() => void guardarComoRutina()}
        />
      </ScrollView>
    </Pantalla>
  )
}

function BotonDePaso({
  texto: signo,
  etiqueta,
  desactivado,
  onPress,
}: {
  texto: string
  etiqueta: string
  desactivado: boolean
  onPress: () => void
}): React.JSX.Element {
  return (
    <Pulsable
      onPress={onPress}
      disabled={desactivado}
      style={[estilos.paso, desactivado && estilos.apagado]}
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      accessibilityState={{ disabled: desactivado }}
    >
      <Text style={estilos.signo}>{signo}</Text>
    </Pulsable>
  )
}

function RevisionDelPlan({
  revision,
  asignando,
  alAsignar,
}: {
  revision: Revision
  asignando: boolean
  alAsignar: () => void
}): React.JSX.Element {
  const { plan, fechas, choques } = revision
  const semanas = new Map<string, FechaDelPlan[]>()
  for (const fecha of fechas) {
    const semana = semanas.get(fecha.semana) ?? []
    semana.push(fecha)
    semanas.set(fecha.semana, semana)
  }
  const conChoque = choques === null ? 0 : fechas.filter((f) => choques.has(f.fecha)).length

  return (
    <View style={estilos.seccion}>
      <Text style={texto.seccion}>{`Se crearán ${String(fechas.length)} sesiones`}</Text>
      <Text style={texto.tenueMedio}>
        {`Del ${fechaLarga(fechas[0]?.fecha ?? plan.semanaInicial)} al ${fechaLarga(
          fechas[fechas.length - 1]?.fecha ?? plan.semanaInicial,
        )}.`}
      </Text>
      {choques === null && <ActivityIndicator color={tema.oro} />}
      {conChoque > 0 && (
        <Aviso>
          <Text style={texto.cuerpo}>
            {`${String(conChoque)} ${
              conChoque === 1 ? "día coincide" : "días coinciden"
            } con sesiones que ya tiene. Se asignan igual: revisa que sea lo que quieres.`}
          </Text>
        </Aviso>
      )}
      <Lista destacada={false}>
        {[...semanas.entries()].map(([semana, delaSemana], indice, todas) => (
          <View
            key={semana}
            style={[estilos.semana, indice < todas.length - 1 && estilos.separador]}
          >
            <Text style={texto.tenue}>{conMayuscula(rangoDeSemana(semana))}</Text>
            {delaSemana.map((fecha) => {
              const yaTiene = choques?.get(fecha.fecha)
              return (
                <Text key={`${fecha.fecha}-${fecha.sesionPatronId}`} style={texto.cuerpo}>
                  {`${conMayuscula(fechaCorta(fecha.fecha))} · ${fecha.nombre}`}
                  {yaTiene !== undefined && (
                    <Text style={estilos.choque}>{`  ya tiene «${yaTiene.join("», «")}»`}</Text>
                  )}
                </Text>
              )
            })}
          </View>
        ))}
      </Lista>
      <BotonOro texto="Asignar plan" ocupado={asignando} onPress={alAsignar} />
    </View>
  )
}

const estilos = StyleSheet.create({
  contenido: { padding: 20, paddingBottom: 64, gap: 24 },
  barraSuperior: { flexDirection: "row" },
  encabezado: { gap: 8 },
  seccion: { gap: 14 },
  sesion: { gap: 16 },
  cabeceraSesion: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  quitar: { color: tema.error, fontFamily: fuentes.semi, fontSize: 14 },
  etiqueta: { color: tema.textoTenue, fontFamily: fuentes.media, fontSize: 14 },
  contador: { flexDirection: "row", alignItems: "center", gap: 12 },
  paso: {
    width: 56,
    height: 52,
    borderRadius: 14,
    backgroundColor: tema.superficieAlta,
    alignItems: "center",
    justifyContent: "center",
  },
  apagado: { opacity: 0.4 },
  signo: { color: tema.texto, fontFamily: fuentes.negrita, fontSize: 22 },
  numeroSemanas: {
    flex: 2,
    textAlign: "center",
    color: tema.texto,
    fontFamily: fuentes.negrita,
    fontSize: 17,
  },
  semana: { paddingVertical: 12, gap: 4 },
  separador: { borderBottomWidth: 1, borderBottomColor: tema.borde },
  choque: { color: tema.oro, fontFamily: fuentes.semi, fontSize: 14 },
})
