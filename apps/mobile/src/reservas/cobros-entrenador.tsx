import { useEffect, useState } from "react"
import { StyleSheet, Text, View } from "react-native"
import {
  ZONA_AGENDA,
  hoyEnZona,
  mesDeFecha,
  sumarMeses,
  type Cobro,
  type ResumenCobros,
} from "@alpha-omega/shared"

import { Pulsable } from "../componentes/pulsable"
import { faltaDe, type Falta } from "../lib/errores"
import { tema } from "../tema"
import type { ApiReservas } from "./api"
import { euros, fechaLarga, local, nombreDe, nombreMes, soloMes } from "./formato"
import { Aviso, Boton, Estado, Hoja, Seccion, Tarjeta, Texto } from "./piezas"

type Mensaje = { texto: string; tipo: "error" | "aviso" | "exito" }

/**
 * Cobros en efectivo: lo cobrado en el mes elegido y todo lo pendiente, sea del
 * mes que sea. La app solo registra; no cobra ni factura.
 */
export function CobrosEntrenador({
  api,
  ahora,
}: {
  api: ApiReservas
  ahora: () => Date
}): React.JSX.Element {
  const mesActual = mesDeFecha(hoyEnZona(ZONA_AGENDA, ahora()))
  const [mes, setMes] = useState(mesActual)
  const [resumen, setResumen] = useState<ResumenCobros | null>(null)
  const [fallo, setFallo] = useState<Falta | null>(null)
  const [recarga, setRecarga] = useState(0)
  const [mensaje, setMensaje] = useState<Mensaje | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [aAnular, setAAnular] = useState<Cobro | null>(null)
  const [falloHoja, setFalloHoja] = useState<string | null>(null)

  useEffect(() => {
    let vigente = true
    setFallo(null)
    api
      .resumenCobros(mes)
      .then((leido) => {
        if (vigente) setResumen(leido)
      })
      .catch((error: unknown) => {
        if (vigente) setFallo(faltaDe(error, "No hemos podido cargar los cobros."))
      })
    return () => {
      vigente = false
    }
  }, [api, mes, recarga])

  async function cobrar(cobro: Cobro): Promise<void> {
    setOcupado(cobro.id)
    setMensaje(null)
    try {
      await api.cobrar(cobro.id)
      setMensaje({
        tipo: "exito",
        texto: `Cobrados ${euros(cobro.importeCentimos)} de ${nombreDe(cobro.cliente)}.`,
      })
      setRecarga((n) => n + 1)
    } catch (error) {
      setMensaje({
        tipo: "error",
        texto: faltaDe(error, "No hemos podido marcarlo como cobrado.").texto,
      })
    } finally {
      setOcupado(null)
    }
  }

  async function anular(cobro: Cobro): Promise<void> {
    setOcupado(cobro.id)
    setFalloHoja(null)
    try {
      await api.anularCobro(cobro.id)
      setAAnular(null)
      setMensaje({ tipo: "exito", texto: `Cobro de ${nombreDe(cobro.cliente)} anulado.` })
      setRecarga((n) => n + 1)
    } catch (error) {
      setFalloHoja(faltaDe(error, "No hemos podido anularlo.").texto)
    } finally {
      setOcupado(null)
    }
  }

  const flecha = (texto: string, etiqueta: string, cambio: number): React.JSX.Element => (
    <Pulsable
      onPress={() => {
        setMes(sumarMeses(mes, cambio))
        setResumen(null)
        setMensaje(null)
      }}
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      style={estilos.flecha}
    >
      <Text style={estilos.textoFlecha}>{texto}</Text>
    </Pulsable>
  )

  return (
    <View style={estilos.caja}>
      <View style={estilos.cabecera}>
        {flecha("‹", "Mes anterior", -1)}
        <Text style={estilos.mes} accessibilityRole="header">
          {nombreMes(mes)}
        </Text>
        {flecha("›", "Mes siguiente", 1)}
      </View>
      {mensaje !== null && <Aviso tipo={mensaje.tipo} texto={mensaje.texto} />}
      {resumen === null ? (
        <Estado
          cargando={fallo === null}
          error={fallo}
          reintentar={() => setRecarga((n) => n + 1)}
          etiqueta="Cargando cobros"
        />
      ) : (
        <>
          <View style={estilos.cifras}>
            <Tarjeta destacada>
              <Texto tenue>{`Cobrado en ${soloMes(mes)}`}</Texto>
              <Text style={estilos.cifra}>{euros(resumen.cobradoCentimos)}</Text>
            </Tarjeta>
            <Tarjeta>
              <Texto tenue>Pendiente</Texto>
              <Text style={[estilos.cifra, estilos.pendiente]}>
                {euros(resumen.pendienteCentimos)}
              </Text>
            </Tarjeta>
          </View>

          <Seccion titulo="Pendientes">
            {resumen.pendientes.length === 0 && <Texto tenue>Nadie te debe nada.</Texto>}
            {resumen.pendientes.map((cobro) => {
              const cliente = nombreDe(cobro.cliente)
              return (
                <Tarjeta key={cobro.id}>
                  <View style={estilos.fila}>
                    <Texto fuerte>{cliente}</Texto>
                    <Texto fuerte>{euros(cobro.importeCentimos)}</Texto>
                  </View>
                  <Texto
                    tenue
                  >{`${cobro.concepto} · desde el ${fechaLarga(local(cobro.creadoEn).fecha)}`}</Texto>
                  <View style={estilos.acciones}>
                    <Boton
                      texto="Marcar cobrado"
                      etiqueta={`Marcar cobrados ${euros(cobro.importeCentimos)} de ${cliente}`}
                      ocupado={ocupado === cobro.id}
                      deshabilitado={ocupado !== null && ocupado !== cobro.id}
                      onPress={() => void cobrar(cobro)}
                    />
                    <Boton
                      texto="Anular"
                      tipo="secundario"
                      etiqueta={`Anular el cobro de ${euros(cobro.importeCentimos)} de ${cliente}`}
                      deshabilitado={ocupado !== null}
                      onPress={() => {
                        setFalloHoja(null)
                        setAAnular(cobro)
                      }}
                    />
                  </View>
                </Tarjeta>
              )
            })}
          </Seccion>

          <Seccion titulo={`Cobrados en ${soloMes(mes)}`}>
            {resumen.cobrados.length === 0 && <Texto tenue>Nada cobrado este mes.</Texto>}
            {resumen.cobrados.map((cobro) => (
              <Tarjeta key={cobro.id}>
                <View style={estilos.fila}>
                  <Texto fuerte>{nombreDe(cobro.cliente)}</Texto>
                  <Texto fuerte>{euros(cobro.importeCentimos)}</Texto>
                </View>
                <Texto tenue>
                  {cobro.cobradoEn === null
                    ? cobro.concepto
                    : `${cobro.concepto} · el ${fechaLarga(local(cobro.cobradoEn).fecha)}`}
                </Texto>
              </Tarjeta>
            ))}
          </Seccion>
        </>
      )}

      <Hoja
        visible={aAnular !== null}
        titulo="¿Anular este cobro?"
        alCerrar={() => setAAnular(null)}
        ocupado={ocupado !== null}
      >
        {aAnular !== null && (
          <>
            <Texto>{`${nombreDe(aAnular.cliente)} · ${aAnular.concepto} · ${euros(aAnular.importeCentimos)}`}</Texto>
            <Texto tenue>
              Deja de contar como deuda. No se borra: queda anulado con tu nombre.
            </Texto>
            {falloHoja !== null && <Aviso texto={falloHoja} />}
            <Boton
              texto="Anular cobro"
              tipo="peligro"
              ocupado={ocupado === aAnular.id}
              onPress={() => void anular(aAnular)}
            />
            <Boton
              texto="Mantenerlo"
              tipo="secundario"
              deshabilitado={ocupado !== null}
              onPress={() => setAAnular(null)}
            />
          </>
        )}
      </Hoja>
    </View>
  )
}

const estilos = StyleSheet.create({
  caja: { gap: 16 },
  cabecera: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  flecha: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: tema.superficie,
    alignItems: "center",
    justifyContent: "center",
  },
  textoFlecha: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 24, lineHeight: 28 },
  mes: {
    flex: 1,
    color: tema.texto,
    fontFamily: tema.fuenteBoton,
    fontSize: 17,
    textAlign: "center",
  },
  cifras: { gap: 12 },
  cifra: { color: tema.acento, fontFamily: tema.fuenteTitulo, fontSize: 40, lineHeight: 46 },
  pendiente: { color: tema.aviso },
  fila: { flexDirection: "row", justifyContent: "space-between", gap: 12, flexWrap: "wrap" },
  acciones: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
})
