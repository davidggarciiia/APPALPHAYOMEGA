import { useEffect, useRef, useState } from "react"
import { z } from "zod"
import { Text, View } from "react-native"
import { randomUUID } from "expo-crypto"
import { AsignarPlanSchema, type AsignarPlan } from "@alpha-omega/shared"
import type { ApiEntrenamiento } from "../entrenamiento/api"
import type { ApiDeCatalogo } from "../catalogo-ejercicios/api"
import type { AlmacenLocal } from "../entrenamiento/almacen-local"
import { AvisoDeError, BotonPrincipal, BotonSecundario, Campo } from "../componentes/formulario"
import { fechaLegible, lunesDeSemana, sumarDias } from "../entrenamiento/fechas"
import { ErrorDePeticion, ErrorDelServidor, ErrorDePermiso } from "../lib/http"
import { tema } from "../tema"
import { convertirSesion, nuevaSesion, desdeSesion } from "./editor-modelo"
import { EditorPatron } from "./editor-patron"
import type { ApiRutinas } from "./api-rutinas"
import { ListadoDeRutinas } from "./listado-rutinas"
import { cargarRutina } from "./cargar-rutina"
import type { RutinaGuardada } from "@alpha-omega/shared"

const PendienteSchema = z.strictObject({
  solicitud: AsignarPlanSchema,
  nombres: z.record(z.string(), z.string()),
})

export function EditorPlan({
  clienteId,
  cuentaId,
  almacen,
  api,
  catalogo,
  rutinas,
  terminado,
}: {
  clienteId: string
  cuentaId: string
  almacen: AlmacenLocal
  api: ApiEntrenamiento
  catalogo: ApiDeCatalogo
  rutinas: ApiRutinas
  terminado: () => void
}): React.JSX.Element {
  const [sesiones, setSesiones] = useState(() => [nuevaSesion()])
  const [nombre, setNombre] = useState("")
  const [semanas, setSemanas] = useState("1")
  const [existentes, setExistentes] = useState(0)
  const [eligiendoRutina, setEligiendoRutina] = useState(false)
  const [semana, setSemana] = useState(lunesDeSemana)
  const [revision, setRevision] = useState<AsignarPlan | null>(null)
  const [error, setError] = useState("")
  const [ocupado, setOcupado] = useState(false)
  const [intentado, setIntentado] = useState(false)
  const enCurso = useRef(false)
  const vigente = useRef(true)
  const [recuperado, setRecuperado] = useState(false)
  const [recuperacion, setRecuperacion] = useState(0)
  const clave = `plan-${clienteId}`
  useEffect(() => {
    vigente.current = true
    let actual = true
    setRecuperado(false)
    void almacen
      .leer(cuentaId, clave, PendienteSchema)
      .then((pendiente) => {
        if (!actual) return
        if (pendiente) {
          setRevision(pendiente.solicitud)
          setSemana(pendiente.solicitud.semanaInicial)
          setSesiones(
            pendiente.solicitud.patron.sesiones.map((s) => desdeSesion(s, pendiente.nombres)),
          )
          setNombre(pendiente.solicitud.nombre)
          setSemanas(String(pendiente.solicitud.semanas))
          setIntentado(true)
        }
        setRecuperado(true)
      })
      .catch(() => {
        if (actual)
          setError(
            "No se pudo recuperar la asignación pendiente. Reintenta para evitar duplicarla.",
          )
      })
    return () => {
      actual = false
      vigente.current = false
    }
  }, [almacen, cuentaId, clave, recuperacion])

  async function elegirRutina(rutina: RutinaGuardada): Promise<void> {
    setOcupado(true)
    setError("")
    try {
      const copia = await cargarRutina(rutina.patron, catalogo)
      if (!vigente.current) return
      setSesiones(copia.sesiones)
      setNombre(rutina.nombre)
      setEligiendoRutina(false)
      if (copia.retirados.length)
        setError(
          `Sustituye los ejercicios retirados antes de asignar: ${copia.retirados.join(", ")}`,
        )
    } catch {
      if (vigente.current) setError("No se pudo cargar la rutina completa. Reintenta con conexión.")
    } finally {
      if (vigente.current) setOcupado(false)
    }
  }

  async function revisar(): Promise<void> {
    setOcupado(true)
    try {
      const patron = { sesiones: sesiones.map(convertirSesion) }
      const propuesta = AsignarPlanSchema.parse({
        operacionId: randomUUID(),
        nombre: nombre || sesiones[0]!.nombre,
        semanaInicial: semana,
        semanas: Number(semanas),
        patron,
      })
      const previas = await Promise.all(
        Array.from({ length: propuesta.semanas }, (_, n) =>
          api.semana(clienteId, sumarDias(semana, n * 7)),
        ),
      )
      if (!vigente.current) return
      setExistentes(previas.reduce((total, s) => total + s.total, 0))
      setRevision(propuesta)
      setError("")
    } catch {
      setError(
        "Revisa el nombre, el lunes de inicio, de 1 a 52 semanas y los objetivos de cada serie. Necesitamos conexión para comprobar las sesiones existentes.",
      )
    } finally {
      setOcupado(false)
    }
  }
  async function asignar(): Promise<void> {
    if (!revision || enCurso.current) return
    enCurso.current = true
    setOcupado(true)
    setIntentado(true)
    setError("")
    try {
      await almacen.guardar(cuentaId, clave, {
        solicitud: revision,
        nombres: Object.fromEntries(
          sesiones.flatMap((s) => s.ejercicios.map((e) => [e.ejercicioId, e.nombre])),
        ),
      })
      await api.asignar(clienteId, revision)
      await almacen.borrar(cuentaId, clave)
      if (vigente.current) terminado()
    } catch (fallo) {
      if (!vigente.current) return
      setError(
        fallo instanceof ErrorDePeticion
          ? fallo.message
          : "No se pudo confirmar la asignación. Reintenta: se conservará la misma operación para evitar duplicados.",
      )
      if (
        fallo instanceof ErrorDePermiso ||
        (fallo instanceof ErrorDelServidor &&
          fallo.codigo >= 400 &&
          fallo.codigo < 500 &&
          fallo.codigo !== 401)
      ) {
        try {
          await almacen.borrar(cuentaId, clave)
          if (vigente.current) setIntentado(false)
        } catch {
          /* Se mantiene la operación hasta que pueda eliminarse de forma segura. */
        }
      }
    } finally {
      enCurso.current = false
      if (vigente.current) setOcupado(false)
    }
  }
  return (
    <View style={{ gap: 12 }}>
      <Text style={{ fontFamily: tema.fuenteBoton, color: tema.texto, fontSize: 26 }}>
        Preparar entrenamiento
      </Text>
      {!recuperado ? (
        <>
          <Text style={{ fontFamily: tema.fuenteTexto, color: tema.textoTenue }}>
            Recuperando asignaciones pendientes…
          </Text>
          {error !== "" && (
            <BotonSecundario
              texto="Reintentar recuperación"
              onPress={() => setRecuperacion((n) => n + 1)}
            />
          )}
        </>
      ) : revision ? (
        <>
          <Text style={{ fontFamily: tema.fuenteTexto, color: tema.texto, fontSize: 20 }}>
            {revision.nombre}
          </Text>
          {sesiones.map((sesion) => (
            <View key={sesion.id} style={{ gap: 10 }}>
              <Text style={{ fontFamily: tema.fuenteBoton, color: tema.texto }}>
                {sesion.nombre}
              </Text>
              <Text style={{ fontFamily: tema.fuenteTexto, color: tema.texto }}>
                {Array.from({ length: revision.semanas }, (_, n) =>
                  fechaLegible(sumarDias(revision.semanaInicial, n * 7 + sesion.diaSemana - 1)),
                ).join(" · ")}
              </Text>
              {sesion.ejercicios.map((e) => (
                <View key={e.id}>
                  <Text style={{ fontFamily: tema.fuenteBoton, color: tema.texto }}>
                    {e.nombre}
                  </Text>
                  {e.series.map((s, n) => (
                    <Text
                      key={s.id}
                      style={{ fontFamily: tema.fuenteTexto, color: tema.textoTenue }}
                    >
                      Serie {n + 1}: {s.objetivo} {s.tipoMedicion === "tiempo" ? "s" : "rep"}
                      {s.peso ? ` · ${s.peso} kg` : ""}
                    </Text>
                  ))}
                </View>
              ))}
            </View>
          ))}
          <Text style={{ fontFamily: tema.fuenteTexto, color: tema.textoTenue }}>
            Se añadirán {revision.semanas * revision.patron.sesiones.length} sesiones. Ya hay{" "}
            {existentes} sesiones en estas semanas: se conservarán todas.
          </Text>
          <BotonPrincipal
            texto={intentado ? "Reintentar asignación" : "Asignar entrenamiento"}
            onPress={() => void asignar()}
            ocupado={ocupado}
          />
          {!intentado && (
            <BotonSecundario texto="Volver a editar" onPress={() => setRevision(null)} />
          )}
        </>
      ) : ocupado ? (
        <Text style={{ fontFamily: tema.fuenteTexto, color: tema.textoTenue }}>
          Comprobando el plan…
        </Text>
      ) : (
        <>
          <BotonSecundario
            texto={
              eligiendoRutina ? "Cerrar biblioteca de rutinas" : "Partir de una rutina guardada"
            }
            onPress={() => setEligiendoRutina(!eligiendoRutina)}
          />
          {eligiendoRutina && (
            <>
              <Text style={{ fontFamily: tema.fuenteTexto, color: tema.textoTenue }}>
                Elegir una rutina sustituye el plan que estás preparando. La copia será
                independiente para este cliente.
              </Text>
              <ListadoDeRutinas api={rutinas} elegir={(r) => void elegirRutina(r)} />
            </>
          )}
          <Campo
            etiqueta="Nombre del plan (opcional)"
            value={nombre}
            onChangeText={setNombre}
            maxLength={120}
            placeholder="Usar el nombre de la primera sesión"
          />
          <Campo
            etiqueta="Lunes de inicio (AAAA-MM-DD)"
            value={semana}
            onChangeText={setSemana}
            placeholder="2026-09-21"
          />
          <Campo
            etiqueta="Número de semanas"
            value={semanas}
            onChangeText={setSemanas}
            keyboardType="number-pad"
            maxLength={2}
          />
          <EditorPatron sesiones={sesiones} cambiar={setSesiones} catalogo={catalogo} />
          <BotonPrincipal
            texto="Revisar asignación"
            ocupado={ocupado}
            onPress={() => void revisar()}
          />
        </>
      )}
      {error !== "" && <AvisoDeError mensaje={error} />}
    </View>
  )
}
