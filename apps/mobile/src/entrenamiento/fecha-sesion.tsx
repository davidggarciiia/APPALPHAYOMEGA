import { useState } from "react"
import { Pressable, Text, View } from "react-native"
import type { SesionProgramada, CambioDeFecha } from "@alpha-omega/shared"
import type { ApiEntrenamiento } from "./api"
import { fechaLegible, lunesDeSemana, sumarDias } from "./fechas"
import { AvisoDeError, BotonSecundario } from "../componentes/formulario"
import { tema } from "../tema"

export function FechaSesion({
  agenda,
  api,
  actualizado,
  iniciarAbierta = false,
  onTerminar,
  enHoja = false,
}: {
  agenda: SesionProgramada
  api: Pick<ApiEntrenamiento, "mover" | "cambios">
  actualizado: (agenda?: SesionProgramada) => Promise<void>
  iniciarAbierta?: boolean
  onTerminar?: () => void
  enHoja?: boolean
}): React.JSX.Element {
  const [eligiendo, setEligiendo] = useState(iniciarAbierta)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState("")
  const [historial, setHistorial] = useState<CambioDeFecha[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [pendienteDeActualizar, setPendienteDeActualizar] = useState<SesionProgramada | null>(null)
  const refrescar = async (nueva: SesionProgramada): Promise<void> => {
    setOcupado(true)
    setError("")
    try {
      await actualizado(nueva)
      setPendienteDeActualizar(null)
      onTerminar?.()
    } catch {
      setError("Día cambiado; no se pudo refrescar la semana.")
    } finally {
      setOcupado(false)
    }
  }
  const mover = async (fecha: string): Promise<void> => {
    setOcupado(true)
    setError("")
    let nueva: SesionProgramada
    try {
      nueva = await api.mover(agenda.id, { fecha, revision: agenda.revision })
    } catch {
      setError("No se pudo cambiar el día. Actualiza la sesión antes de reintentar.")
      await actualizado().catch(() => undefined)
      setOcupado(false)
      return
    }
    setEligiendo(false)
    setHistorial([])
    setTotal(null)
    setPendienteDeActualizar(nueva)
    await refrescar(nueva)
  }
  const cambios = async (): Promise<void> => {
    setOcupado(true)
    setError("")
    try {
      const pagina = await api.cambios(agenda.id, historial.length)
      setHistorial((v) => [...v, ...pagina.cambios])
      setTotal(pagina.total)
    } catch {
      setError("No se pudo consultar el historial de cambios.")
    } finally {
      setOcupado(false)
    }
  }
  return (
    <View
      style={{
        gap: 6,
        padding: enHoja ? 0 : 16,
        backgroundColor: tema.superficie,
        borderRadius: 20,
      }}
    >
      {!enHoja && (
        <Text style={{ color: tema.texto, fontFamily: tema.fuenteSemi, fontSize: 16 }}>
          {fechaLegible(agenda.fechaActual)}
        </Text>
      )}
      {agenda.fechaActual !== agenda.fechaOriginal && (
        <Text style={{ color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 14 }}>
          Día original: {fechaLegible(agenda.fechaOriginal)}
        </Text>
      )}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {!enHoja && agenda.estado === "abierta" && (
          <BotonSecundario
            texto={eligiendo ? "Cancelar cambio de día" : "Cambiar día"}
            onPress={() => setEligiendo(!eligiendo)}
            ocupado={ocupado}
            deshabilitado={pendienteDeActualizar !== null}
          />
        )}
        {(total === null || historial.length < total) && (
          <Pressable
            accessibilityRole="button"
            disabled={ocupado}
            accessibilityState={{ disabled: ocupado, busy: ocupado }}
            onPress={() => void cambios()}
            style={{ minHeight: 48, justifyContent: "center", paddingHorizontal: 6, marginTop: 12 }}
          >
            <Text
              style={{
                color: tema.textoTenue,
                fontFamily: tema.fuenteTexto,
                textDecorationLine: "underline",
              }}
            >
              {total === null ? "Ver cambios de día" : "Más cambios"}
            </Text>
          </Pressable>
        )}
      </View>
      {eligiendo && (
        <View style={{ gap: 4 }}>
          <Text style={{ color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 14 }}>
            {enHoja
              ? "Tu entrenador ve el cambio"
              : "Puedes elegir cualquier día de esta semana. Tu entrenador verá el cambio."}
          </Text>
          {Array.from({ length: 7 }, (_, n) =>
            sumarDias(lunesDeSemana(agenda.fechaOriginal), n),
          ).map((fecha) => (
            <BotonSecundario
              key={fecha}
              texto={`${fechaLegible(fecha)}${fecha === agenda.fechaActual ? " (actual)" : ""}`}
              ocupado={ocupado}
              deshabilitado={fecha === agenda.fechaActual}
              onPress={() => void mover(fecha)}
            />
          ))}
        </View>
      )}
      {total === 0 && (
        <Text style={{ color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 14 }}>
          Sin cambios de día.
        </Text>
      )}
      {historial.map((c) => (
        <Text
          key={c.id}
          style={{ color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 14 }}
        >
          {fechaLegible(c.fechaAnterior)} → {fechaLegible(c.fechaNueva)}
        </Text>
      ))}
      {error !== "" && <AvisoDeError mensaje={error} />}
      {pendienteDeActualizar && (
        <BotonSecundario
          texto="Reintentar actualización"
          ocupado={ocupado}
          onPress={() => void refrescar(pendienteDeActualizar)}
        />
      )}
    </View>
  )
}
