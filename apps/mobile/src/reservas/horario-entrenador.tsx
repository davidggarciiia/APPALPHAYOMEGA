import { useEffect, useState } from "react"
import { StyleSheet, View } from "react-native"
import {
  HorarioSemanalSchema,
  ZONA_AGENDA,
  aInstante,
  hoyEnZona,
  horaDeMinutos,
  sumarDiasFecha,
  type AjustesAgenda,
  type CambiosAjustesAgenda,
  type ExcepcionAgenda,
  type FranjaSemanal,
  type Reserva,
} from "@alpha-omega/shared"

import { faltaDe, type Falta } from "../lib/errores"
import type { ApiReservas } from "./api"
import { conflictosDe } from "./errores"
import { fechaLarga, fechaTitulo, horaDe, local, nombreDe, tramo } from "./formato"
import {
  Aviso,
  Boton,
  CampoTexto,
  Contador,
  Eleccion,
  Estado,
  Grupo,
  Hoja,
  Seccion,
  Tarjeta,
  Texto,
} from "./piezas"

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]
/** Las horas del horario se mueven de media en media hora. */
const PASO_MIN = 30
const INTERVALOS = [15, 30, 45, 60, 90, 120]

type Mensaje = { texto: string; tipo: "error" | "aviso" | "exito" }

const ordenar = (franjas: FranjaSemanal[]): FranjaSemanal[] =>
  [...franjas].sort((a, b) => a.diaSemana - b.diaSemana || a.inicioMin - b.inicioMin)

/** Una franja nueva detrás de la última del día, o de 9:00 a 14:00 si no hay. */
function franjaNueva(diaSemana: number, delDia: FranjaSemanal[]): FranjaSemanal | null {
  const ultima = delDia.at(-1)
  if (!ultima) return { diaSemana, inicioMin: 9 * 60, finMin: 14 * 60 }
  if (ultima.finMin + 60 > 1440) return null
  return { diaSemana, inicioMin: ultima.finMin, finMin: Math.min(1440, ultima.finMin + 4 * 60) }
}

/** Lista de reservas que un cambio dejaría fuera, para moverlas o cancelarlas. */
function Conflictos({ reservas, que }: { reservas: Reserva[]; que: string }): React.JSX.Element {
  return (
    <View style={estilos.conflictos}>
      <Aviso
        tipo="aviso"
        texto={`No se ha guardado ${que}: estas reservas quedarían fuera de tu horario. Muévelas o cancélalas desde la Agenda y vuelve a guardar.`}
      />
      {reservas.map((reserva) => (
        <Tarjeta key={reserva.id}>
          <Texto fuerte>{`${fechaTitulo(local(reserva.inicio).fecha)}, ${tramo(reserva)}`}</Texto>
          <Texto tenue>{`${nombreDe(reserva.cliente)} · ${reserva.servicio.nombre}`}</Texto>
        </Tarjeta>
      ))}
    </View>
  )
}

/**
 * El horario del entrenador: franjas de cada día de la semana, cierres y
 * aperturas puntuales, y los ajustes de la agenda.
 *
 * Si un cambio deja fuera reservas ya confirmadas, el servidor no aplica nada y
 * devuelve cuáles son (decisión 6): se enseñan y el cambio sigue sin guardar.
 */
export function HorarioEntrenador({
  api,
  ahora,
}: {
  api: ApiReservas
  ahora: () => Date
}): React.JSX.Element {
  const hoy = hoyEnZona(ZONA_AGENDA, ahora())
  const [guardado, setGuardado] = useState<FranjaSemanal[] | null>(null)
  const [franjas, setFranjas] = useState<FranjaSemanal[]>([])
  const [excepciones, setExcepciones] = useState<ExcepcionAgenda[] | null>(null)
  const [ajustes, setAjustes] = useState<AjustesAgenda | null>(null)
  const [fallo, setFallo] = useState<Falta | null>(null)
  const [intento, setIntento] = useState(0)
  const [editando, setEditando] = useState<number | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState<Mensaje | null>(null)
  const [conflictos, setConflictos] = useState<Reserva[] | null>(null)
  const [nuevaExcepcion, setNuevaExcepcion] = useState(false)
  const [aBorrar, setABorrar] = useState<ExcepcionAgenda | null>(null)

  useEffect(() => {
    let vigente = true
    setFallo(null)
    Promise.all([api.horario(), api.excepciones(hoy, sumarDiasFecha(hoy, 62)), api.ajustes()])
      .then(([horario, listado, leidos]) => {
        if (!vigente) return
        const ordenadas = ordenar(horario.franjas)
        setGuardado(ordenadas)
        setFranjas(ordenadas)
        setExcepciones(listado.excepciones)
        setAjustes(leidos)
      })
      .catch((error: unknown) => {
        if (vigente) setFallo(faltaDe(error, "No hemos podido cargar tu horario."))
      })
    return () => {
      vigente = false
    }
  }, [api, hoy, intento])

  if (guardado === null || excepciones === null || ajustes === null) {
    return (
      <Estado
        cargando={fallo === null}
        error={fallo}
        reintentar={() => setIntento((n) => n + 1)}
        etiqueta="Cargando tu horario"
      />
    )
  }

  const cambiado = JSON.stringify(franjas) !== JSON.stringify(guardado)
  const cambiar = (indice: number, cambios: Partial<FranjaSemanal>): void => {
    setFranjas((actuales) => actuales.map((f, i) => (i === indice ? { ...f, ...cambios } : f)))
    setConflictos(null)
    setMensaje(null)
  }

  async function guardarHorario(): Promise<void> {
    const valido = HorarioSemanalSchema.safeParse({ franjas })
    if (!valido.success) {
      setMensaje({
        tipo: "error",
        texto:
          "Revisa las franjas: cada una termina después de empezar y no se pisan en el mismo día.",
      })
      return
    }
    setGuardando(true)
    setMensaje(null)
    setConflictos(null)
    try {
      const nuevo = await api.guardarHorario({ franjas })
      const ordenadas = ordenar(nuevo.franjas)
      setGuardado(ordenadas)
      setFranjas(ordenadas)
      setEditando(null)
      setMensaje({ tipo: "exito", texto: "Horario guardado." })
    } catch (error) {
      const afectadas = conflictosDe(error)
      if (afectadas !== null) setConflictos(afectadas)
      else
        setMensaje({
          tipo: "error",
          texto: faltaDe(error, "No hemos podido guardar el horario.").texto,
        })
    } finally {
      setGuardando(false)
    }
  }

  const futuras = [...excepciones].sort((a, b) => a.inicio.localeCompare(b.inicio))

  return (
    <View style={estilos.caja}>
      <Seccion titulo="Horario semanal">
        <Texto tenue>Las horas en las que tus clientes pueden reservar, cada semana.</Texto>
        {DIAS.map((nombre, i) => {
          const diaSemana = i + 1
          const delDia = franjas
            .map((franja, indice) => ({ franja, indice }))
            .filter(({ franja }) => franja.diaSemana === diaSemana)
          const nueva = franjaNueva(
            diaSemana,
            delDia.map(({ franja }) => franja),
          )
          return (
            <Tarjeta key={nombre}>
              <View style={estilos.fila}>
                <Texto fuerte>{nombre}</Texto>
                {nueva !== null && (
                  <Boton
                    texto="Añadir franja"
                    tipo="enlace"
                    etiqueta={`Añadir franja el ${nombre.toLowerCase()}`}
                    deshabilitado={guardando}
                    onPress={() => {
                      setFranjas((actuales) => [...actuales, nueva])
                      setEditando(franjas.length)
                      setConflictos(null)
                      setMensaje(null)
                    }}
                  />
                )}
              </View>
              {delDia.length === 0 && <Texto tenue>Cerrado</Texto>}
              {delDia.map(({ franja, indice }) => {
                const texto = `${horaDeMinutos(franja.inicioMin)} – ${horaDeMinutos(franja.finMin)}`
                const quien = `la franja del ${nombre.toLowerCase()} de ${texto.replace(" – ", " a ")}`
                return (
                  <View key={indice} style={estilos.franja}>
                    <View style={estilos.fila}>
                      <Texto>{texto}</Texto>
                      <View style={estilos.acciones}>
                        <Boton
                          texto={editando === indice ? "Listo" : "Editar"}
                          tipo="enlace"
                          etiqueta={
                            editando === indice ? `Terminar de editar ${quien}` : `Editar ${quien}`
                          }
                          deshabilitado={guardando}
                          onPress={() => setEditando(editando === indice ? null : indice)}
                        />
                        <Boton
                          texto="Quitar"
                          tipo="enlace"
                          etiqueta={`Quitar ${quien}`}
                          deshabilitado={guardando}
                          onPress={() => {
                            setFranjas((actuales) => actuales.filter((_, j) => j !== indice))
                            setEditando(null)
                            setConflictos(null)
                            setMensaje(null)
                          }}
                        />
                      </View>
                    </View>
                    {editando === indice && (
                      <View style={estilos.contadores}>
                        <Contador
                          etiqueta="Inicio"
                          texto={horaDeMinutos(franja.inicioMin)}
                          menos={() => cambiar(indice, { inicioMin: franja.inicioMin - PASO_MIN })}
                          mas={() => cambiar(indice, { inicioMin: franja.inicioMin + PASO_MIN })}
                          puedeMenos={franja.inicioMin - PASO_MIN >= 0}
                          puedeMas={franja.inicioMin + PASO_MIN < franja.finMin}
                        />
                        <Contador
                          etiqueta="Fin"
                          texto={horaDeMinutos(franja.finMin)}
                          menos={() => cambiar(indice, { finMin: franja.finMin - PASO_MIN })}
                          mas={() => cambiar(indice, { finMin: franja.finMin + PASO_MIN })}
                          puedeMenos={franja.finMin - PASO_MIN > franja.inicioMin}
                          puedeMas={franja.finMin + PASO_MIN <= 1440}
                        />
                      </View>
                    )}
                  </View>
                )
              })}
            </Tarjeta>
          )
        })}
        {conflictos !== null && <Conflictos reservas={conflictos} que="el horario" />}
        {mensaje !== null && <Aviso tipo={mensaje.tipo} texto={mensaje.texto} />}
        <Boton
          texto="Guardar horario"
          ocupado={guardando}
          deshabilitado={!cambiado}
          onPress={() => void guardarHorario()}
        />
        {cambiado && (
          <Boton
            texto="Descartar cambios"
            tipo="secundario"
            deshabilitado={guardando}
            onPress={() => {
              setFranjas(guardado)
              setEditando(null)
              setConflictos(null)
              setMensaje(null)
            }}
          />
        )}
      </Seccion>

      <Seccion titulo="Cierres y aperturas">
        <Texto tenue>
          Un cierre quita horas (vacaciones, un imprevisto). Una apertura añade horas fuera de tu
          horario.
        </Texto>
        {futuras.length === 0 && (
          <Texto tenue>No tienes cierres ni aperturas en los próximos dos meses.</Texto>
        )}
        {futuras.map((excepcion) => (
          <Tarjeta key={excepcion.id}>
            <View style={estilos.fila}>
              <Texto fuerte>{excepcion.tipo === "cierre" ? "Cierre" : "Apertura"}</Texto>
              <Boton
                texto="Borrar"
                tipo="enlace"
                etiqueta={`Borrar ${excepcion.tipo === "cierre" ? "el cierre" : "la apertura"} del ${fechaLarga(local(excepcion.inicio).fecha)}`}
                onPress={() => setABorrar(excepcion)}
              />
            </View>
            <Texto>{textoExcepcion(excepcion)}</Texto>
            {excepcion.motivo !== null && <Texto tenue>{excepcion.motivo}</Texto>}
          </Tarjeta>
        ))}
        <Boton
          texto="Añadir cierre o apertura"
          tipo="secundario"
          onPress={() => setNuevaExcepcion(true)}
        />
      </Seccion>

      <AjustesDeAgenda
        ajustes={ajustes}
        guardar={async (cambios) => {
          const nuevos = await api.guardarAjustes(cambios)
          setAjustes(nuevos)
        }}
      />

      {nuevaExcepcion && (
        <HojaExcepcion
          api={api}
          hoy={hoy}
          cerrar={() => setNuevaExcepcion(false)}
          creada={(excepcion) => {
            setExcepciones((actuales) => [...(actuales ?? []), excepcion])
            setNuevaExcepcion(false)
          }}
        />
      )}
      {aBorrar !== null && (
        <HojaBorrarExcepcion
          excepcion={aBorrar}
          borrar={() => api.borrarExcepcion(aBorrar.id)}
          cerrar={() => setABorrar(null)}
          borrada={() => {
            setExcepciones((actuales) => (actuales ?? []).filter((e) => e.id !== aBorrar.id))
            setABorrar(null)
          }}
        />
      )}
    </View>
  )
}

/** «jueves 8 de octubre, todo el día» o «jueves 8 de octubre, de 16:00 a 20:00». */
function textoExcepcion(excepcion: ExcepcionAgenda): string {
  const inicio = local(excepcion.inicio)
  const fin = local(excepcion.fin)
  if (inicio.minutos === 0 && fin.minutos === 0) {
    const ultimo = sumarDiasFecha(fin.fecha, -1)
    return ultimo === inicio.fecha
      ? `${fechaTitulo(inicio.fecha)}, todo el día`
      : `Del ${fechaLarga(inicio.fecha)} al ${fechaLarga(ultimo)}, días completos`
  }
  if (inicio.fecha === fin.fecha) {
    return `${fechaTitulo(inicio.fecha)}, de ${horaDe(excepcion.inicio)} a ${horaDe(excepcion.fin)}`
  }
  return `Del ${fechaLarga(inicio.fecha)} a las ${horaDe(excepcion.inicio)} al ${fechaLarga(fin.fecha)} a las ${horaDe(excepcion.fin)}`
}

function HojaExcepcion({
  api,
  hoy,
  cerrar,
  creada,
}: {
  api: ApiReservas
  hoy: string
  cerrar: () => void
  creada: (excepcion: ExcepcionAgenda) => void
}): React.JSX.Element {
  const [tipo, setTipo] = useState<"cierre" | "apertura">("cierre")
  const [fecha, setFecha] = useState(hoy)
  const [todoElDia, setTodoElDia] = useState(true)
  const [dias, setDias] = useState(1)
  const [desde, setDesde] = useState(9 * 60)
  const [hasta, setHasta] = useState(14 * 60)
  const [motivo, setMotivo] = useState("")
  const [ocupado, setOcupado] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)
  const [conflictos, setConflictos] = useState<Reserva[] | null>(null)

  async function guardar(): Promise<void> {
    const inicio = todoElDia
      ? aInstante(fecha, 0, ZONA_AGENDA)
      : aInstante(fecha, desde, ZONA_AGENDA)
    const fin = todoElDia
      ? aInstante(sumarDiasFecha(fecha, dias), 0, ZONA_AGENDA)
      : aInstante(fecha, hasta, ZONA_AGENDA)
    if (inicio === null || fin === null) {
      setFallo("Esa hora no existe ese día por el cambio de hora. Elige otra.")
      return
    }
    setOcupado(true)
    setFallo(null)
    setConflictos(null)
    try {
      const texto = motivo.trim()
      creada(
        await api.crearExcepcion({
          tipo,
          inicio: inicio.toISOString(),
          fin: fin.toISOString(),
          ...(texto === "" ? {} : { motivo: texto }),
        }),
      )
    } catch (error) {
      const afectadas = conflictosDe(error)
      if (afectadas !== null) setConflictos(afectadas)
      else setFallo(faltaDe(error, "No hemos podido guardarlo.").texto)
      setOcupado(false)
    }
  }

  return (
    <Hoja visible titulo="Cierre o apertura" alCerrar={cerrar} ocupado={ocupado}>
      <Grupo etiqueta="Tipo">
        <Eleccion texto="Cierre" elegida={tipo === "cierre"} onPress={() => setTipo("cierre")} />
        <Eleccion
          texto="Apertura"
          elegida={tipo === "apertura"}
          onPress={() => setTipo("apertura")}
        />
      </Grupo>
      <Contador
        etiqueta="Día"
        texto={fechaTitulo(fecha)}
        menos={() => setFecha(sumarDiasFecha(fecha, -1))}
        mas={() => setFecha(sumarDiasFecha(fecha, 1))}
        puedeMenos={fecha > hoy}
      />
      <Grupo etiqueta="Duración">
        <Eleccion texto="Todo el día" elegida={todoElDia} onPress={() => setTodoElDia(true)} />
        <Eleccion texto="De hora a hora" elegida={!todoElDia} onPress={() => setTodoElDia(false)} />
      </Grupo>
      {todoElDia ? (
        <Contador
          etiqueta="Días seguidos"
          texto={String(dias)}
          menos={() => setDias(dias - 1)}
          mas={() => setDias(dias + 1)}
          puedeMenos={dias > 1}
          puedeMas={dias < 60}
        />
      ) : (
        <View style={estilos.contadores}>
          <Contador
            etiqueta="Desde"
            texto={horaDeMinutos(desde)}
            menos={() => setDesde(desde - PASO_MIN)}
            mas={() => setDesde(desde + PASO_MIN)}
            puedeMenos={desde - PASO_MIN >= 0}
            puedeMas={desde + PASO_MIN < hasta}
          />
          <Contador
            etiqueta="Hasta"
            texto={horaDeMinutos(hasta)}
            menos={() => setHasta(hasta - PASO_MIN)}
            mas={() => setHasta(hasta + PASO_MIN)}
            puedeMenos={hasta - PASO_MIN > desde}
            puedeMas={hasta + PASO_MIN < 1440}
          />
        </View>
      )}
      <CampoTexto
        etiqueta="Motivo (opcional)"
        value={motivo}
        onChangeText={setMotivo}
        maxLength={120}
        editable={!ocupado}
      />
      {conflictos !== null && <Conflictos reservas={conflictos} que="el cierre" />}
      {fallo !== null && <Aviso texto={fallo} />}
      <Boton texto="Guardar" ocupado={ocupado} onPress={() => void guardar()} />
      <Boton texto="Cancelar" tipo="secundario" deshabilitado={ocupado} onPress={cerrar} />
    </Hoja>
  )
}

function HojaBorrarExcepcion({
  excepcion,
  borrar,
  cerrar,
  borrada,
}: {
  excepcion: ExcepcionAgenda
  borrar: () => Promise<void>
  cerrar: () => void
  borrada: () => void
}): React.JSX.Element {
  const [ocupado, setOcupado] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)
  const nombre = excepcion.tipo === "cierre" ? "este cierre" : "esta apertura"
  return (
    <Hoja visible titulo={`¿Borrar ${nombre}?`} alCerrar={cerrar} ocupado={ocupado}>
      <Texto>{textoExcepcion(excepcion)}</Texto>
      {fallo !== null && <Aviso texto={fallo} />}
      <Boton
        texto="Borrar"
        tipo="peligro"
        ocupado={ocupado}
        onPress={() => {
          setOcupado(true)
          setFallo(null)
          borrar()
            .then(borrada)
            .catch((error: unknown) => {
              setFallo(faltaDe(error, "No hemos podido borrarlo.").texto)
              setOcupado(false)
            })
        }}
      />
      <Boton texto="Cancelar" tipo="secundario" deshabilitado={ocupado} onPress={cerrar} />
    </Hoja>
  )
}

/** Antelación, horizonte, plazo de cancelación e intervalo. Solo se envía lo que cambia. */
function AjustesDeAgenda({
  ajustes,
  guardar,
}: {
  ajustes: AjustesAgenda
  guardar: (cambios: CambiosAjustesAgenda) => Promise<void>
}): React.JSX.Element {
  const [borrador, setBorrador] = useState(ajustes)
  const [ocupado, setOcupado] = useState(false)
  const [mensaje, setMensaje] = useState<Mensaje | null>(null)
  useEffect(() => setBorrador(ajustes), [ajustes])

  const cambios = Object.fromEntries(
    (Object.keys(borrador) as Array<keyof AjustesAgenda>)
      .filter((clave) => borrador[clave] !== ajustes[clave])
      .map((clave) => [clave, borrador[clave]]),
  ) as CambiosAjustesAgenda
  const hayCambios = Object.keys(cambios).length > 0
  const poner = (cambio: Partial<AjustesAgenda>): void => {
    setBorrador((actual) => ({ ...actual, ...cambio }))
    setMensaje(null)
  }
  const horas = Math.round(borrador.antelacionMin / 60)

  return (
    <Seccion titulo="Ajustes">
      <Tarjeta>
        <Contador
          etiqueta="Antelación mínima"
          texto={`${String(horas)} h`}
          menos={() => poner({ antelacionMin: Math.max(0, (horas - 1) * 60) })}
          mas={() => poner({ antelacionMin: Math.min(168, horas + 1) * 60 })}
          puedeMenos={horas > 0}
          puedeMas={horas < 168}
        />
        <Texto tenue>Cuánto antes del inicio deja de poder reservar un cliente.</Texto>
        <Contador
          etiqueta="Horizonte"
          texto={`${String(borrador.horizonteDias)} días`}
          menos={() => poner({ horizonteDias: Math.max(1, borrador.horizonteDias - 7) })}
          mas={() => poner({ horizonteDias: Math.min(120, borrador.horizonteDias + 7) })}
          puedeMenos={borrador.horizonteDias > 1}
          puedeMas={borrador.horizonteDias < 120}
        />
        <Texto tenue>Hasta cuántos días por delante puede reservar.</Texto>
        <Contador
          etiqueta="Plazo para cancelar"
          texto={`${String(borrador.cancelacionHoras)} h`}
          menos={() => poner({ cancelacionHoras: Math.max(0, borrador.cancelacionHoras - 1) })}
          mas={() => poner({ cancelacionHoras: Math.min(168, borrador.cancelacionHoras + 1) })}
          puedeMenos={borrador.cancelacionHoras > 0}
          puedeMas={borrador.cancelacionHoras < 168}
        />
        <Texto tenue>Si cancela antes, recupera la sesión; después, la pierde.</Texto>
        <Texto tenue>Intervalo entre inicios</Texto>
        <Grupo etiqueta="Intervalo entre inicios">
          {INTERVALOS.map((minutos) => (
            <Eleccion
              key={minutos}
              texto={`${String(minutos)} min`}
              elegida={borrador.intervaloMin === minutos}
              onPress={() => poner({ intervaloMin: minutos })}
            />
          ))}
        </Grupo>
      </Tarjeta>
      {mensaje !== null && <Aviso tipo={mensaje.tipo} texto={mensaje.texto} />}
      <Boton
        texto="Guardar ajustes"
        ocupado={ocupado}
        deshabilitado={!hayCambios}
        onPress={() => {
          setOcupado(true)
          guardar(cambios)
            .then(() => setMensaje({ tipo: "exito", texto: "Ajustes guardados." }))
            .catch((error: unknown) =>
              setMensaje({
                tipo: "error",
                texto: faltaDe(error, "No hemos podido guardar los ajustes.").texto,
              }),
            )
            .finally(() => setOcupado(false))
        }}
      />
    </Seccion>
  )
}

const estilos = StyleSheet.create({
  caja: { gap: 28 },
  fila: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  acciones: { flexDirection: "row", gap: 16 },
  franja: { gap: 8 },
  contadores: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  conflictos: { gap: 8 },
})
