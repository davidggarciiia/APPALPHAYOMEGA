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
import { agregarEjercicio, convertirSesion, nuevaSesion, desdeSesion } from "./editor-modelo"
import { EditorSesion } from "./editor-sesion"
import { SelectorEjercicios } from "./selector-ejercicios"

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
  terminado,
}: {
  clienteId: string
  cuentaId: string
  almacen: AlmacenLocal
  api: ApiEntrenamiento
  catalogo: ApiDeCatalogo
  terminado: () => void
}): React.JSX.Element {
  const [sesion, setSesion] = useState(nuevaSesion)
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
          setSesion(desdeSesion(pendiente.solicitud.patron.sesiones[0]!, pendiente.nombres))
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

  function revisar(): void {
    try {
      const patron = { sesiones: [convertirSesion(sesion)] }
      setRevision(
        AsignarPlanSchema.parse({
          operacionId: randomUUID(),
          nombre: sesion.nombre,
          semanaInicial: semana,
          semanas: 1,
          patron,
        }),
      )
      setError("")
    } catch {
      setError(
        "Revisa el nombre, el lunes de inicio y los objetivos de cada serie. Las repeticiones y los segundos deben ser enteros mayores que cero; la carga es opcional.",
      )
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
        nombres: Object.fromEntries(sesion.ejercicios.map((e) => [e.ejercicioId, e.nombre])),
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
      <Text style={{ color: tema.texto, fontSize: 26, fontWeight: "700" }}>
        Preparar entrenamiento
      </Text>
      {!recuperado ? (
        <>
          <Text style={{ color: tema.textoTenue }}>Recuperando asignaciones pendientes…</Text>
          {error !== "" && (
            <BotonSecundario
              texto="Reintentar recuperación"
              onPress={() => setRecuperacion((n) => n + 1)}
            />
          )}
        </>
      ) : revision ? (
        <>
          <Text style={{ color: tema.texto, fontSize: 20 }}>{sesion.nombre}</Text>
          <Text style={{ color: tema.texto }}>
            {fechaLegible(sumarDias(revision.semanaInicial, sesion.diaSemana - 1))}
          </Text>
          {sesion.ejercicios.map((e) => (
            <View key={e.id}>
              <Text style={{ color: tema.texto, fontWeight: "700" }}>{e.nombre}</Text>
              {e.series.map((s, n) => (
                <Text key={s.id} style={{ color: tema.textoTenue }}>
                  Serie {n + 1}: {s.objetivo} {s.tipoMedicion === "tiempo" ? "s" : "rep"}
                  {s.peso ? ` · ${s.peso} kg` : ""}
                </Text>
              ))}
            </View>
          ))}
          <Text style={{ color: tema.textoTenue }}>
            Se añadirá a la semana del cliente. Las sesiones existentes se conservan.
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
      ) : (
        <>
          <Campo
            etiqueta="Lunes de inicio (AAAA-MM-DD)"
            value={semana}
            onChangeText={setSemana}
            placeholder="2026-09-21"
          />
          <EditorSesion valor={sesion} cambiar={setSesion} />
          {sesion.ejercicios.length < 40 && (
            <SelectorEjercicios
              api={catalogo}
              elegir={(e) => setSesion((actual) => agregarEjercicio(actual, e))}
            />
          )}
          <BotonPrincipal texto="Revisar asignación" onPress={revisar} />
        </>
      )}
      {error !== "" && <AvisoDeError mensaje={error} />}
    </View>
  )
}
