import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native"
import type { ListadoSesiones, Molestia, PlanVigente } from "@alpha-omega/shared"

import { Icono } from "../../componentes/iconos"
import { Pulsable } from "../../componentes/pulsable"
import { hoyAgenda, sumarDias } from "../../entrenamiento/fechas"
import { fechaCorta, NOMBRES_DE_DIA } from "../../entrenamiento/plan/modelo"
import { radio, tema } from "../../tema"

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]

export function TiraSemana({
  semana,
  molestias,
  plan,
  lunes,
  hoy = hoyAgenda(),
  abrirSesion,
}: {
  semana: ListadoSesiones
  molestias: Molestia[]
  plan: PlanVigente | null
  lunes: string
  hoy?: string
  abrirSesion: (id: string) => void
}): React.JSX.Element {
  const { fontScale, width } = useWindowDimensions()
  const grande = fontScale > 1.3
  const hechas = semana.sesiones.filter((sesion) => sesion.enviadoEn !== null).length
  return (
    <View style={s.grupo}>
      <View style={s.cabecera}>
        <Text style={s.fecha}>
          {fechaCorta(lunes)} – {fechaCorta(sumarDias(lunes, 6))}
        </Text>
        <Text style={s.cuenta}>
          <Text style={s.hechas}>{hechas}</Text>
          {` de ${semana.total} hechas`}
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={width < 372 && !grande ? s.estrecha : undefined}
        contentContainerStyle={s.tira}
      >
        {DIAS.map((dia, i) => {
          const fecha = sumarDias(lunes, i)
          const sesion = semana.sesiones.find((sesion) => sesion.agenda.fechaActual === fecha)
          const enviada = sesion != null && sesion.enviadoEn !== null
          const abierta =
            sesion &&
            molestias.some(
              (molestia) => molestia.sesionId === sesion.agenda.id && molestia.estado === "abierta",
            )
          const deportes =
            plan?.bloque?.deportes
              .filter((deporte) => deporte.dias.includes(i + 1))
              .map((deporte) => deporte.nombre) ?? []
          const noHecha = sesion && !enviada && fecha < hoy
          const estado = !sesion
            ? "sin fuerza"
            : enviada
              ? "hecha"
              : noHecha
                ? "no hecha"
                : "pendiente"
          const nombreDia = NOMBRES_DE_DIA[i]!
          const etiqueta = `${nombreDia[0]!.toLocaleUpperCase("es")}${nombreDia.slice(1)} ${Number(fecha.slice(8))}, ${sesion ? `${sesion.nombre}: ` : ""}${estado}.${abierta ? " Con molestia abierta." : ""}${deportes.length ? ` Además ${deportes.join(" y ")}.` : ""}`
          const contenido = (
            <>
              {abierta && <View style={[s.marca, { backgroundColor: tema.error }]} />}
              <Text style={s.dia}>{dia}</Text>
              <Text style={s.numero}>{Number(fecha.slice(8))}</Text>
              <View
                style={[
                  s.estado,
                  enviada && s.enviada,
                  !!noHecha && s.noHecha,
                  !sesion && s.descanso,
                ]}
              >
                {enviada ? (
                  <Icono nombre="hecho" color={tema.sobreExito} tamano={18} />
                ) : noHecha ? (
                  <Text style={s.cruz}>×</Text>
                ) : !sesion ? (
                  <Text style={s.guion}>−</Text>
                ) : null}
              </View>
              <Text style={s.deporte} numberOfLines={1}>
                {deportes.join(" · ") || " "}
              </Text>
            </>
          )
          const estilo = [s.celda, grande && s.celdaGrande, fecha === hoy && s.hoy]
          return sesion ? (
            <Pulsable
              key={fecha}
              style={estilo}
              accessibilityLabel={etiqueta}
              accessibilityState={{ selected: fecha === hoy }}
              onPress={() => abrirSesion(sesion.agenda.id)}
            >
              {contenido}
            </Pulsable>
          ) : (
            <View
              key={fecha}
              style={estilo}
              accessible
              accessibilityLabel={etiqueta}
              accessibilityState={{ selected: fecha === hoy }}
            >
              {contenido}
            </View>
          )
        })}
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  grupo: { gap: 12 },
  cabecera: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  fecha: { fontFamily: tema.fuenteTexto, fontSize: 13, lineHeight: 18, color: tema.textoTenue },
  cuenta: {
    fontFamily: tema.fuenteSemi,
    fontSize: 14,
    lineHeight: 20,
    color: tema.textoSecundario,
  },
  hechas: { color: tema.acento },
  estrecha: { marginHorizontal: -6 },
  tira: { flexGrow: 1, gap: 4 },
  celda: {
    flex: 1,
    minWidth: 44,
    minHeight: 102,
    borderRadius: radio.tarjetaInterna,
    backgroundColor: tema.superficie,
    borderWidth: 1,
    borderColor: tema.borde,
    paddingVertical: 8,
    alignItems: "center",
    gap: 4,
  },
  celdaGrande: { flex: 0, width: 56 },
  hoy: { backgroundColor: tema.superficieAlta, borderColor: tema.acento },
  dia: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 12, lineHeight: 16 },
  numero: {
    color: tema.texto,
    fontFamily: tema.fuenteSemi,
    fontSize: 16,
    lineHeight: 20,
    fontVariant: ["tabular-nums"],
  },
  estado: {
    width: 24,
    height: 24,
    borderWidth: 1.5,
    borderRadius: 8,
    borderColor: tema.bordeFuerte,
    alignItems: "center",
    justifyContent: "center",
  },
  enviada: { backgroundColor: tema.exito, borderColor: tema.exito },
  noHecha: { borderColor: tema.error },
  descanso: { borderWidth: 0 },
  cruz: { fontFamily: tema.fuenteSemi, fontSize: 21, lineHeight: 24, color: tema.error },
  guion: { fontFamily: tema.fuenteTexto, fontSize: 21, lineHeight: 24, color: tema.marcador },
  marca: { position: "absolute", top: 6, right: 5, height: 8, width: 8, borderRadius: 2 },
  deporte: { fontFamily: tema.fuenteBoton, fontSize: 11, lineHeight: 14, color: tema.naranja },
})
