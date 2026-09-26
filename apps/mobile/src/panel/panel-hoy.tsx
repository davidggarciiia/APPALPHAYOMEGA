import { useEffect, useState } from "react"
import { useRouter, type Href } from "expo-router"
import { StyleSheet, Text, View, useWindowDimensions } from "react-native"
import type { ActividadDelPanel, EstadoEntrenoDeHoy, PanelHoy as Datos } from "@alpha-omega/shared"

import { AvisoDeError } from "../componentes/formulario"
import { Pulsable } from "../componentes/pulsable"
import { hoyAgenda } from "../entrenamiento/fechas"
import { useMovimientoReducido } from "../lib/movimiento"
import { tema } from "../tema"
import type { ApiPanel } from "./api"
import {
  ETIQUETA_DE_ESTADO,
  cuenta,
  fechaLarga,
  momento,
  rangoDeSemana,
  textoDeActividad,
  tituloDeMolestia,
  totalPorRevisar,
} from "./modelo"
import {
  BarraDeAdherencia,
  BotonDeContorno,
  FilaDeTexto,
  FilaPulsable,
  Indicador,
  Pildora,
  Seccion,
  Tarjeta,
  estilosDelPanel as p,
  type Entrada,
} from "./piezas"
import { usePanelHoy } from "./use-panel-hoy"

/** El mismo ancho desde el que el armazón pasa a barra lateral. */
const ANCHO_ESCRITORIO = 1024

/**
 * La entrada de las tarjetas se ve una vez por sesión de la app. El panel se
 * abre decenas de veces al día: a partir de la segunda, las cifras ya están.
 */
let yaEntraron = false

/** Pestañas de la ficha a las que lleva el panel (`?pestana=` en la ruta). */
type PestanaDeFicha = "sesiones" | "progreso"

const TONO_DE_ESTADO = {
  pendiente: "neutro",
  enCurso: "aviso",
  enviada: "exito",
} as const satisfies Record<EstadoEntrenoDeHoy, string>

const COLOR_DE_NIVEL = { verde: tema.exito, ambar: tema.aviso, rojo: tema.error } as const

type FilaDeRevision =
  | {
      tipo: "elemento"
      clave: string
      marca: string
      color: string
      titulo: string
      detalle: string
      abrir: () => void
    }
  | { tipo: "resto"; clave: string; texto: string }

/**
 * «Hoy» del entrenador: saludo, cifras del día, quién entrena hoy, lo que espera
 * su revisión, la semana y lo último que han hecho sus clientes. Cada fila abre
 * su destino. Una columna en el teléfono y dos en escritorio.
 */
export function PanelHoy({ api, nombre }: { api: ApiPanel; nombre: string }): React.JSX.Element {
  const { estado, reintentar } = usePanelHoy(api)
  const router = useRouter()
  const { width } = useWindowDimensions()
  const reducido = useMovimientoReducido()
  const [animar] = useState(() => !yaEntraron)
  const listo = estado.fase === "listo"
  useEffect(() => {
    if (listo) yaEntraron = true
  }, [listo])
  const entrada: Entrada = animar ? (reducido ? "fundir" : "subir") : null
  const escritorio = width >= ANCHO_ESCRITORIO

  const ir = (ruta: Href): void => router.push(ruta)
  const abrirSesion = (id: string): void =>
    router.push({ pathname: "/entrenamiento/[id]", params: { id } })
  const abrirFicha = (id: string, pestana?: PestanaDeFicha): void =>
    router.push({
      pathname: "/entrenador/cliente/[id]",
      params: pestana ? { id, pestana } : { id },
    })

  const saludo = (
    <View style={s.saludo}>
      <Text style={s.fecha}>{fechaLarga(listo ? estado.datos.fecha : hoyAgenda())}</Text>
      <Text style={s.hola} accessibilityRole="header">
        Hola, {nombre.split(" ")[0] ?? nombre}
      </Text>
    </View>
  )

  const accesos = (datos: Datos | null): React.JSX.Element => (
    <Seccion titulo="Accesos">
      {datos && (
        <View style={s.cartera}>
          <Text style={p.tenue}>
            {cuenta(datos.clientes.activos, "cliente activo", "clientes activos")} ·{" "}
            {datos.clientes.pendientes} pendientes de activar
            {datos.clientes.bajas > 0 ? ` · ${cuenta(datos.clientes.bajas, "baja", "bajas")}` : ""}
          </Text>
          {datos.clientes.sinConsentimiento > 0 && (
            <Text style={[p.tenue, s.aviso]}>
              {datos.clientes.sinConsentimiento} sin consentimiento de salud: no se les puede
              guardar nada nuevo hasta que lo acepten.
            </Text>
          )}
        </View>
      )}
      <View style={s.accesos}>
        {(
          [
            ["Clientes", "/cartera"],
            ["Rutinas", "/rutinas"],
            ["Ejercicios", "/catalogo"],
            ["Nutricionista", "/nutricionista"],
            ["Mi perfil", "/perfil"],
          ] as const
        ).map(([texto, ruta]) => (
          <Pulsable
            key={ruta}
            accessibilityRole="button"
            accessibilityLabel={texto}
            onPress={() => ir(ruta)}
            style={s.acceso}
          >
            <Text style={s.textoAcceso}>{texto}</Text>
          </Pulsable>
        ))}
      </View>
    </Seccion>
  )

  if (estado.fase !== "listo")
    return (
      <View style={s.panel}>
        {saludo}
        {estado.fase === "cargando" ? (
          <Text style={p.tenue} accessibilityLiveRegion="polite">
            Cargando tu día…
          </Text>
        ) : (
          <View style={s.fallo}>
            <AvisoDeError mensaje={estado.falta.texto} />
            {estado.falta.reintentable && (
              <BotonDeContorno texto="Reintentar" onPress={reintentar} />
            )}
          </View>
        )}
        {accesos(null)}
      </View>
    )

  const { datos, falta } = estado
  const { hoy, porRevisar, semana, actividad } = datos
  const pendienteDeRevisar = totalPorRevisar(datos)
  const molestiasAbiertas = porRevisar.molestias.total

  const indicadores = (
    <View style={s.indicadores}>
      <Indicador
        orden={0}
        entrada={entrada}
        etiqueta="Entrenos hoy"
        cifra={String(hoy.total)}
        detalle={
          hoy.total === 0
            ? "Nada programado"
            : [
                cuenta(hoy.enviadas, "enviado", "enviados"),
                hoy.enCurso > 0 ? `${hoy.enCurso} en curso` : null,
              ]
                .filter(Boolean)
                .join(" · ")
        }
      />
      <Indicador
        orden={1}
        entrada={entrada}
        etiqueta="Por revisar"
        cifra={String(pendienteDeRevisar)}
        destacada={pendienteDeRevisar > 0}
        color={pendienteDeRevisar > 0 ? tema.acento : tema.texto}
        detalle={
          pendienteDeRevisar === 0
            ? "Todo al día"
            : [
                porRevisar.entrenamientos.total > 0
                  ? cuenta(porRevisar.entrenamientos.total, "entreno", "entrenos")
                  : null,
                porRevisar.fotos.total > 0 ? `${porRevisar.fotos.total} de fotos` : null,
                porRevisar.comentarios.total > 0
                  ? cuenta(porRevisar.comentarios.total, "comentario", "comentarios")
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")
        }
      />
      <Indicador
        orden={2}
        entrada={entrada}
        etiqueta="Molestias"
        cifra={String(molestiasAbiertas)}
        destacada={molestiasAbiertas > 0}
        color={molestiasAbiertas > 0 ? tema.aviso : tema.texto}
        detalle={molestiasAbiertas === 0 ? "Ninguna abierta" : "Abiertas, sin responder"}
      />
      <Indicador
        orden={3}
        entrada={entrada}
        etiqueta="Adherencia"
        cifra={semana.adherencia === null ? "—" : `${semana.adherencia} %`}
        detalle={
          semana.adherencia === null
            ? "Nada programado aún"
            : `${semana.enviadas} de ${semana.programadas} esta semana`
        }
      />
    </View>
  )

  const hoyEntrenan = (
    <Seccion titulo="Hoy entrenan" derecha={hoy.total > 0 ? `${hoy.enviadas}/${hoy.total}` : null}>
      <Tarjeta>
        {hoy.sesiones.length === 0 ? (
          <FilaDeTexto primera>Hoy no hay sesiones programadas.</FilaDeTexto>
        ) : (
          hoy.sesiones.map((sesion, n) => (
            <FilaPulsable
              key={sesion.sesionId}
              primera={n === 0}
              etiqueta={`${sesion.cliente.nombre}, ${sesion.sesion}: ${ETIQUETA_DE_ESTADO[sesion.estado]}`}
              onPress={() => abrirSesion(sesion.sesionId)}
            >
              <View style={s.filaConPildora}>
                <View style={s.textos}>
                  <Text style={p.fuerte} numberOfLines={1}>
                    {sesion.cliente.nombre}
                  </Text>
                  <Text style={p.tenue} numberOfLines={1}>
                    {sesion.enviadoEn
                      ? `${sesion.sesion} · ${momento(sesion.enviadoEn)}`
                      : sesion.sesion}
                  </Text>
                </View>
                <Pildora
                  texto={ETIQUETA_DE_ESTADO[sesion.estado]}
                  tono={TONO_DE_ESTADO[sesion.estado]}
                />
              </View>
            </FilaPulsable>
          ))
        )}
        {hoy.total > hoy.sesiones.length && (
          <FilaDeTexto>{`Y ${hoy.total - hoy.sesiones.length} más`}</FilaDeTexto>
        )}
      </Tarjeta>
    </Seccion>
  )

  /** «Y 3 entrenos más»: lo que no cabe en la lista, dicho en voz alta. */
  const resto = (
    clave: string,
    lista: { total: number; elementos: unknown[] },
    singular: string,
    plural: string,
  ): FilaDeRevision[] =>
    lista.total > lista.elementos.length
      ? [
          {
            tipo: "resto",
            clave,
            texto: `Y ${cuenta(lista.total - lista.elementos.length, singular, plural)} más`,
          },
        ]
      : []
  const filasDeRevision: FilaDeRevision[] = [
    ...porRevisar.molestias.elementos.map((m): FilaDeRevision => ({
      tipo: "elemento",
      clave: `molestia-${m.id}`,
      marca: tituloDeMolestia(m),
      color: COLOR_DE_NIVEL[m.nivel],
      titulo: m.cliente.nombre,
      detalle: [`${m.intensidad} de 10`, m.ejercicio, momento(m.creadaEn)]
        .filter(Boolean)
        .join(" · "),
      abrir: () => abrirFicha(m.cliente.id),
    })),
    ...resto("molestias", porRevisar.molestias, "molestia", "molestias"),
    ...porRevisar.entrenamientos.elementos.map((e): FilaDeRevision => ({
      tipo: "elemento",
      clave: `envio-${e.sesionId}`,
      marca: "Entreno enviado",
      color: tema.acento,
      titulo: `${e.cliente.nombre} · ${e.sesion}`,
      detalle: [momento(e.enviadoEn), e.esfuerzo === null ? null : `Esfuerzo ${e.esfuerzo}/10`]
        .filter(Boolean)
        .join(" · "),
      abrir: () => abrirSesion(e.sesionId),
    })),
    ...resto("entrenamientos", porRevisar.entrenamientos, "entreno", "entrenos"),
    ...porRevisar.fotos.elementos.map((f): FilaDeRevision => ({
      tipo: "elemento",
      clave: `fotos-${f.solicitudId}`,
      marca: "Fotos recibidas",
      color: tema.acento,
      titulo: f.cliente.nombre,
      detalle: `${cuenta(f.fotos, "foto", "fotos")} · ${momento(f.recibidaEn)}`,
      abrir: () => abrirFicha(f.cliente.id, "progreso"),
    })),
    ...resto("fotos", porRevisar.fotos, "solicitud de fotos", "solicitudes de fotos"),
    ...porRevisar.comentarios.elementos.map((c): FilaDeRevision => ({
      tipo: "elemento",
      clave: `comentario-${c.novedadId}`,
      marca: "Comentario sin leer",
      color: tema.acento,
      titulo: `${c.cliente.nombre} · ${c.sesion}`,
      detalle: momento(c.creadaEn),
      abrir: () => {
        // Se da por leído al abrirlo, como en las novedades de la ficha. Si
        // falla, sigue en la lista y la próxima visita lo vuelve a ofrecer.
        api.leerComentario(c.sesionId, c.novedadId).catch(() => undefined)
        abrirFicha(c.cliente.id, "sesiones")
      },
    })),
    ...resto("comentarios", porRevisar.comentarios, "comentario", "comentarios"),
  ]
  const totalDeRevision = pendienteDeRevisar + molestiasAbiertas

  const pendiente = (
    <Seccion titulo="Por revisar" derecha={totalDeRevision > 0 ? String(totalDeRevision) : null}>
      <Tarjeta>
        {filasDeRevision.length === 0 ? (
          <FilaDeTexto primera>Todo revisado. Nada pendiente.</FilaDeTexto>
        ) : (
          filasDeRevision.map((fila, n) =>
            fila.tipo === "resto" ? (
              <FilaDeTexto key={fila.clave} primera={n === 0}>
                {fila.texto}
              </FilaDeTexto>
            ) : (
              <FilaPulsable
                key={fila.clave}
                primera={n === 0}
                etiqueta={`${fila.marca}. ${fila.titulo}. ${fila.detalle}`}
                onPress={fila.abrir}
              >
                <Text style={[p.marca, { color: fila.color }]}>{fila.marca}</Text>
                <Text style={p.fuerte} numberOfLines={2}>
                  {fila.titulo}
                </Text>
                <Text style={p.tenue}>{fila.detalle}</Text>
              </FilaPulsable>
            ),
          )
        )}
      </Tarjeta>
    </Seccion>
  )

  const bloqueSemana = (
    <Seccion titulo="Semana" derecha={rangoDeSemana(semana.lunes, semana.domingo)}>
      <Tarjeta>
        <View style={s.semana}>
          {semana.adherencia === null ? (
            <Text style={p.tenue}>Aún no tocaba ninguna sesión esta semana.</Text>
          ) : (
            <>
              <View style={s.resumenSemana}>
                <Text style={s.cifraSemana}>{semana.adherencia} %</Text>
                <Text style={[p.tenue, s.textos]}>
                  {semana.enviadas} de {semana.programadas}{" "}
                  {semana.programadas === 1 ? "sesión enviada" : "sesiones enviadas"} de lunes a hoy
                </Text>
              </View>
              <BarraDeAdherencia porcentaje={semana.adherencia} animar={animar && !reducido} />
            </>
          )}
          {semana.restantes > 0 && (
            <Text style={p.tenue}>
              {semana.restantes === 1
                ? "Queda 1 sesión hasta el domingo."
                : `Quedan ${semana.restantes} sesiones hasta el domingo.`}
            </Text>
          )}
        </View>
        {semana.menorAdherencia.length > 0 && (
          <>
            <View style={s.subtitulo}>
              <Text style={[p.marca, s.tenueMarca]}>Menor adherencia</Text>
            </View>
            {semana.menorAdherencia.map((c, n) => (
              <FilaPulsable
                key={c.cliente.id}
                primera={n === 0}
                etiqueta={`${c.cliente.nombre}: ${c.enviadas} de ${c.programadas} enviadas, ${c.adherencia} %`}
                onPress={() => abrirFicha(c.cliente.id, "sesiones")}
              >
                <View style={s.filaConPildora}>
                  <View style={s.textos}>
                    <Text style={p.fuerte} numberOfLines={1}>
                      {c.cliente.nombre}
                    </Text>
                    <Text style={p.tenue}>
                      {c.enviadas} de {c.programadas} enviadas
                    </Text>
                  </View>
                  <Text style={s.porcentaje}>{c.adherencia} %</Text>
                </View>
              </FilaPulsable>
            ))}
          </>
        )}
      </Tarjeta>
    </Seccion>
  )

  const abrirActividad = (evento: ActividadDelPanel): void => {
    switch (evento.tipo) {
      case "envio":
        return abrirSesion(evento.sesionId)
      case "molestia":
        return abrirFicha(evento.cliente.id)
      case "fotos":
      case "medida":
        return abrirFicha(evento.cliente.id, "progreso")
    }
  }
  const bloqueActividad = (
    <Seccion titulo="Actividad reciente">
      <Tarjeta>
        {actividad.length === 0 ? (
          <FilaDeTexto primera>Tus clientes aún no han registrado nada.</FilaDeTexto>
        ) : (
          actividad.map((evento, n) => (
            <FilaPulsable
              key={`${evento.tipo}-${evento.id}`}
              primera={n === 0}
              etiqueta={`${textoDeActividad(evento)}, ${momento(evento.fecha)}`}
              onPress={() => abrirActividad(evento)}
            >
              <Text style={p.fuerte} numberOfLines={2}>
                {textoDeActividad(evento)}
              </Text>
              <Text style={p.tenue}>{momento(evento.fecha)}</Text>
            </FilaPulsable>
          ))
        )}
      </Tarjeta>
    </Seccion>
  )

  const aviso = falta && (
    <View style={s.fallo}>
      <Text style={[p.tenue, s.aviso]} accessibilityRole="alert">
        No se ha podido actualizar: {falta.texto} Ves lo último que llegó.
      </Text>
      {falta.reintentable && <BotonDeContorno texto="Reintentar" onPress={reintentar} />}
    </View>
  )

  return (
    <View style={s.panel}>
      {saludo}
      {aviso}
      {indicadores}
      {escritorio ? (
        <View style={s.columnas}>
          <View style={s.columna}>
            {hoyEntrenan}
            {pendiente}
          </View>
          <View style={s.columna}>
            {bloqueSemana}
            {bloqueActividad}
            {accesos(datos)}
          </View>
        </View>
      ) : (
        <>
          {hoyEntrenan}
          {pendiente}
          {bloqueSemana}
          {bloqueActividad}
          {accesos(datos)}
        </>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  panel: { gap: 28 },
  saludo: { gap: 4 },
  fecha: {
    color: tema.acento,
    fontFamily: tema.fuenteSemi,
    fontSize: 13,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  hola: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 26, lineHeight: 32 },
  fallo: { gap: 12 },
  aviso: { color: tema.aviso },
  indicadores: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  columnas: { flexDirection: "row", alignItems: "flex-start", gap: 24 },
  columna: { flex: 1, minWidth: 0, gap: 28 },
  textos: { flex: 1, minWidth: 0, gap: 3 },
  filaConPildora: { flexDirection: "row", alignItems: "center", gap: 12 },
  semana: { paddingVertical: 16, gap: 12 },
  resumenSemana: { flexDirection: "row", alignItems: "center", gap: 16 },
  cifraSemana: { color: tema.texto, fontFamily: tema.fuenteTitulo, fontSize: 40, lineHeight: 48 },
  subtitulo: { borderTopWidth: 1, borderTopColor: tema.borde, paddingTop: 14, paddingBottom: 2 },
  tenueMarca: { color: tema.textoTenue },
  porcentaje: { color: tema.aviso, fontFamily: tema.fuenteBoton, fontSize: 16 },
  cartera: { gap: 6 },
  accesos: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  acceso: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: tema.superficie,
    borderWidth: 1,
    borderColor: tema.borde,
    justifyContent: "center",
  },
  textoAcceso: { color: tema.texto, fontFamily: tema.fuenteSemi, fontSize: 15 },
})
