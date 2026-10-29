import { useEffect, useRef, useState } from "react"
import { StyleSheet, Text, View } from "react-native"
import type { SesionEntrenador } from "@alpha-omega/shared"

import { ChipsRir } from "../componentes/chips-rir"
import {
  AvisoDeError,
  BotonPrincipal,
  BotonSecundario,
  PantallaDeFormulario,
} from "../componentes/formulario"
import { Esqueleto, GrupoEsqueletos } from "../componentes/esqueleto"
import { Hoja } from "../componentes/hoja"
import { useSalidaProtegida } from "../componentes/salida-protegida"
import type { ApiEntrenamiento } from "../entrenamiento/api"
import { fechaLegible, hoyAgenda, lunesDeSemana, sumarDias } from "../entrenamiento/fechas"
import { BotonAtras } from "../entrenamiento/sesion/controles"
import { ErrorDelServidor } from "../lib/http"
import { tema, tipo } from "../tema"

export function AjusteEjercicio({
  clienteId,
  ejercicioId,
  nombreCliente,
  api,
  volver,
}: {
  clienteId: string
  ejercicioId: string
  nombreCliente: string
  api: ApiEntrenamiento
  volver: () => void
}): React.JSX.Element {
  const [original, setOriginal] = useState<SesionEntrenador | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState("")
  const [intento, setIntento] = useState(0)
  const [rir, setRir] = useState<number | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const enCurso = useRef(false)
  const viva = useRef(true)
  const ejercicios = original?.prescripcion.ejercicios
  const ejercicio =
    ejercicios?.find(
      (e) => e.ejercicioId === ejercicioId && (e.seccion ?? "principal") === "principal",
    ) ?? ejercicios?.find((e) => e.ejercicioId === ejercicioId)
  const cambiado = rir !== null && (rir !== ejercicio?.rir?.min || rir !== ejercicio?.rir?.max)
  const { proteger, permitir, proteccion } = useSalidaProtegida(cambiado)
  useEffect(() => {
    viva.current = true
    return () => {
      viva.current = false
    }
  }, [])
  useEffect(() => {
    let vigente = true
    setCargando(true)
    setOriginal(null)
    setRir(null)
    setError("")
    const cargar = async (): Promise<void> => {
      const hoy = hoyAgenda()
      const lunes = lunesDeSemana(hoy)
      const { plan } = await api.plan(clienteId, lunes)
      if (!vigente || !plan) return
      const fin = sumarDias(plan.semanaInicial, plan.semanas * 7)
      for (let semana = lunes; vigente && semana < fin; semana = sumarDias(semana, 7)) {
        const listado = await api.semana(clienteId, semana)
        const proximas = listado.sesiones
          .filter((s) => s.agenda.fechaActual >= hoy && s.enviadoEn === null)
          .sort((a, b) => a.agenda.fechaActual.localeCompare(b.agenda.fechaActual))
        for (const proxima of proximas) {
          if (!vigente) return
          const sesion = await api.leerEntrenador(proxima.agenda.id)
          if (
            sesion.permiteAjuste &&
            sesion.prescripcion.ejercicios.some((e) => e.ejercicioId === ejercicioId)
          ) {
            if (vigente) setOriginal(sesion)
            return
          }
        }
      }
    }
    void cargar()
      .catch(() => {
        if (vigente) setError("No se pudo cargar la próxima sesión.")
      })
      .finally(() => {
        if (vigente) setCargando(false)
      })
    return () => {
      vigente = false
    }
  }, [api, clienteId, ejercicioId, intento])

  const cerrar = (): void => {
    if (!enCurso.current) proteger(volver)
  }
  const guardar = async (): Promise<void> => {
    if (!original || !ejercicio || rir === null || !cambiado || enCurso.current) return
    enCurso.current = true
    setOcupado(true)
    setError("")
    try {
      const { nombre, duracion, nota, partes, circuito, ejercicios } = original.prescripcion
      await api.ajustar(original.agenda.id, {
        revisionPrescripcion: original.revisionPrescripcion,
        nombre,
        duracion,
        nota,
        partes,
        circuito,
        ejercicios: ejercicios.map(({ nombre: _nombre, ...e }) =>
          e.id === ejercicio.id ? { ...e, rir: { min: rir, max: rir } } : e,
        ),
      })
      if (viva.current) permitir(volver)
    } catch (fallo) {
      if (viva.current)
        setError(
          fallo instanceof ErrorDelServidor && fallo.codigo === 409
            ? "La sesión cambió o el cliente ya empezó. Recarga la versión actual; tus cambios no se han aplicado."
            : "No se pudo confirmar el ajuste. Reintenta con conexión.",
        )
    } finally {
      enCurso.current = false
      if (viva.current) setOcupado(false)
    }
  }
  return (
    <PantallaDeFormulario sinTarjeta>
      {proteccion}
      <BotonAtras onPress={cerrar} etiqueta="Volver a la progresión" />
      {cargando && (
        <GrupoEsqueletos>
          <View
            style={s.grupo}
            accessibilityLabel="Cargando próxima sesión"
            accessibilityState={{ busy: true }}
          >
            <Esqueleto ancho="70%" alto={38} />
            <Esqueleto alto={100} />
          </View>
        </GrupoEsqueletos>
      )}
      {!cargando && !original && error === "" && (
        <Text style={s.texto}>No hay una próxima sesión ajustable con este ejercicio.</Text>
      )}
      {error !== "" && !original && (
        <View style={s.grupo}>
          <AvisoDeError mensaje={error} />
          <BotonSecundario texto="Reintentar" onPress={() => setIntento((n) => n + 1)} />
        </View>
      )}
      <Hoja visible={original !== null} alCerrar={cerrar} titulo="Editar ejercicio">
        {original && ejercicio && (
          <View style={s.grupo}>
            <Text style={s.nombre}>{ejercicio.nombre}</Text>
            <Text style={s.tenue}>{nombreCliente}</Text>
            <Text style={s.tenue}>
              {original.prescripcion.nombre} · {fechaLegible(original.agenda.fechaActual)}
            </Text>
            <Text style={s.texto}>RIR pedido</Text>
            <ChipsRir
              valor={rir ?? ejercicio.rir?.min ?? null}
              cambiar={setRir}
              deshabilitado={ocupado}
            />
            {error !== "" && (
              <View style={s.grupo}>
                <AvisoDeError mensaje={error} />
                <BotonSecundario
                  texto="Recargar versión actual"
                  deshabilitado={ocupado}
                  onPress={() => proteger(() => setIntento((n) => n + 1))}
                />
              </View>
            )}
            <BotonPrincipal
              texto="Guardar ajuste"
              ocupado={ocupado}
              deshabilitado={!cambiado}
              onPress={() => void guardar()}
            />
          </View>
        )}
      </Hoja>
    </PantallaDeFormulario>
  )
}

const s = StyleSheet.create({
  grupo: { gap: 16 },
  nombre: { ...tipo.titulo, color: tema.texto },
  texto: { ...tipo.cuerpo, color: tema.texto },
  tenue: tipo.secundario,
})
