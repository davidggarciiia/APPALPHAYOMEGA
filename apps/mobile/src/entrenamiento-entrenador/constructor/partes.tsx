import { useEffect, useState } from "react"
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native"
import type { Bloque, DeporteDelPlan, FaseDeBloque } from "@alpha-omega/shared"

import { INICIALES_DE_DIA } from "../../entrenamiento/plan/modelo"
import { Enlace } from "../../entrenamiento/sesion/controles"
import { degradadoOro, tema } from "../../tema"
import type { EjercicioDelConstructor } from "./modelo"
import { Celda, UNIDADES_DE_FILA } from "./tabla"

/** Calentamiento, circuito o final: una lista con la dosis de cada ejercicio. */
export function ListaDeSeccion({
  ejercicios,
  elegido,
  elegir,
  cambiar,
  quitar,
}: {
  ejercicios: EjercicioDelConstructor[]
  elegido: string | null
  elegir: (id: string) => void
  cambiar: (id: string, cambio: Partial<EjercicioDelConstructor>) => void
  quitar: (id: string) => void
}): React.JSX.Element {
  return (
    <View style={s.lista}>
      {ejercicios.map((e, n) => (
        <View key={e.id} style={[s.fila, e.id === elegido && s.activa]}>
          <Text style={s.numero}>{n + 1}</Text>
          <Pressable
            style={s.flex}
            accessibilityRole="button"
            accessibilityLabel={`${e.nombre}: editar detalles`}
            onPress={() => elegir(e.id)}
          >
            <Text style={s.nombre}>{e.nombre}</Text>
          </Pressable>
          <Celda
            etiqueta={`Cómo se hace ${e.nombre}`}
            valor={e.dosis}
            cambiar={(v) => cambiar(e.id, { dosis: v })}
            ancho={130}
            marcador="1×8 por lado"
          />
          <Celda
            etiqueta={`${UNIDADES_DE_FILA[e.tipo].nombre} de ${e.nombre}`}
            valor={e.objetivo}
            cambiar={(v) => cambiar(e.id, { objetivo: v })}
            ancho={64}
            marcador={UNIDADES_DE_FILA[e.tipo].corta}
          />
          <Enlace texto="Quitar" etiqueta={`Quitar ${e.nombre}`} onPress={() => quitar(e.id)} />
        </View>
      ))}
    </View>
  )
}

const lineas = (texto: string): string[] =>
  texto
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)

/**
 * Lista de una línea por elemento. Guarda el texto tal cual se escribe (con la
 * línea vacía tras un salto) y entrega solo las líneas con contenido.
 */
function AreaDeLineas({
  etiqueta,
  valores,
  cambiar,
  maximo,
  marcador,
}: {
  etiqueta: string
  valores: string[]
  cambiar: (lineas: string[]) => void
  maximo: number
  marcador: string
}): React.JSX.Element {
  const [texto, setTexto] = useState(() => valores.join("\n"))
  return (
    <TextInput
      accessibilityLabel={etiqueta}
      value={texto}
      onChangeText={(v) => {
        setTexto(v)
        cambiar(lineas(v).slice(0, maximo))
      }}
      placeholder={marcador}
      placeholderTextColor={tema.marcador}
      multiline
      style={s.area}
    />
  )
}

const textoDeSemana = (valor: number): string => (valor === 0 ? "" : String(valor))

function SemanasDeFase({
  fase,
  numero,
  cambiar,
  quitar,
}: {
  fase: FaseDeBloque
  numero: number
  cambiar: (cambio: Partial<FaseDeBloque>) => void
  quitar: () => void
}): React.JSX.Element {
  const [desde, setDesde] = useState(() => textoDeSemana(fase.desde))
  const [hasta, setHasta] = useState(() => textoDeSemana(fase.hasta))
  const [revisado, setRevisado] = useState(false)
  useEffect(() => {
    setDesde((texto) => (Number(texto) === fase.desde ? texto : textoDeSemana(fase.desde)))
    setHasta((texto) => (Number(texto) === fase.hasta ? texto : textoDeSemana(fase.hasta)))
    setRevisado(false)
  }, [fase.desde, fase.hasta])
  const error = revisado && [desde, hasta].some((texto) => Number(texto) < 1 || Number(texto) > 52)
  const campo = (primera: boolean): React.JSX.Element => (
    <TextInput
      accessibilityLabel={`${primera ? "Primera" : "Última"} semana de la fase ${numero}`}
      aria-invalid={Boolean(error)}
      value={primera ? desde : hasta}
      onChangeText={(texto) => {
        if (!/^\d*$/.test(texto)) return
        if (primera) setDesde(texto)
        else setHasta(texto)
        cambiar({ [primera ? "desde" : "hasta"]: Number(texto) })
      }}
      onBlur={() => setRevisado(true)}
      keyboardType="number-pad"
      maxLength={2}
      placeholderTextColor={tema.marcador}
      selectionColor={tema.acento}
      style={s.semana}
    />
  )
  return (
    <>
      <View style={s.filaFase}>
        <Text style={s.tenue}>Semanas</Text>
        {campo(true)}
        <Text style={s.tenue}>a</Text>
        {campo(false)}
        <Enlace texto="Quitar" etiqueta={`Quitar la fase ${numero}`} onPress={quitar} />
      </View>
      {error && (
        <Text style={s.errorSemana} accessibilityRole="alert">
          Escribe semanas de 1 a 52.
        </Text>
      )}
    </>
  )
}

/** Bloque del constructor: fases, otros deportes, qué buscamos, notas y pasos. */
export function EditorDeBloque({
  bloque,
  semanas,
  cambiar,
  quitarFase,
  quitarDeporte,
  avisoFases,
  avisoDeportes,
}: {
  bloque: Bloque
  semanas: number
  cambiar: (bloque: Bloque) => void
  quitarFase?: (indice: number) => void
  quitarDeporte?: (indice: number) => void
  avisoFases?: React.ReactNode
  avisoDeportes?: React.ReactNode
}): React.JSX.Element {
  const cambiarFase = (n: number, cambio: Partial<FaseDeBloque>): void =>
    cambiar({ ...bloque, fases: bloque.fases.map((f, i) => (i === n ? { ...f, ...cambio } : f)) })
  const cambiarDeporte = (n: number, cambio: Partial<DeporteDelPlan>): void =>
    cambiar({
      ...bloque,
      deportes: bloque.deportes.map((d, i) => (i === n ? { ...d, ...cambio } : d)),
    })
  const numero = (texto: string, minimo: number): number => {
    const valor = Number(texto)
    return Number.isInteger(valor) && valor >= minimo ? valor : minimo
  }
  return (
    <View style={s.bloque}>
      <Text style={s.titulo} accessibilityRole="header">
        Fases
      </Text>
      {bloque.fases.length > 0 && (
        <View testID="fases" style={s.fases}>
          {bloque.fases.map((fase, n) => (
            <View key={n} style={s.fase}>
              <SemanasDeFase
                fase={fase}
                numero={n + 1}
                cambiar={(cambio) => cambiarFase(n, cambio)}
                quitar={() =>
                  quitarFase
                    ? quitarFase(n)
                    : cambiar({ ...bloque, fases: bloque.fases.filter((_, i) => i !== n) })
                }
              />
              <TextInput
                accessibilityLabel={`Nombre de la fase ${n + 1}`}
                value={fase.nombre}
                onChangeText={(v) => cambiarFase(n, { nombre: v })}
                placeholder="Calibrar"
                placeholderTextColor={tema.marcador}
                maxLength={40}
                style={s.nombreFase}
              />
              <TextInput
                accessibilityLabel={`Detalle de la fase ${n + 1}`}
                value={fase.detalle ?? ""}
                onChangeText={(v) => cambiarFase(n, { detalle: v === "" ? null : v })}
                placeholder="Compuestos RIR 3, accesorios RIR 2–3"
                placeholderTextColor={tema.marcador}
                maxLength={120}
                style={s.detalleFase}
              />
            </View>
          ))}
        </View>
      )}
      {avisoFases}
      {/* La fase retirada conserva su plaza hasta que caduque «Deshacer». */}
      {bloque.fases.length + (avisoFases ? 1 : 0) < 8 && (
        <Enlace
          texto="Añadir fase"
          onPress={() => {
            const desde = Math.min(semanas, (bloque.fases[bloque.fases.length - 1]?.hasta ?? 0) + 1)
            cambiar({
              ...bloque,
              fases: [...bloque.fases, { desde, hasta: desde, nombre: "", detalle: null }],
            })
          }}
        />
      )}

      <Text style={s.titulo} accessibilityRole="header">
        Otros deportes
      </Text>
      {bloque.deportes.map((d, n) => (
        <View key={n} style={s.deporte}>
          <TextInput
            accessibilityLabel={`Deporte ${n + 1}`}
            value={d.nombre}
            onChangeText={(v) => cambiarDeporte(n, { nombre: v })}
            placeholder="K-1"
            placeholderTextColor={tema.marcador}
            maxLength={40}
            style={[s.nombreFase, s.flex]}
          />
          <View
            style={s.dias}
            accessibilityRole="toolbar"
            accessibilityLabel={`Días de ${d.nombre || "este deporte"}`}
          >
            {INICIALES_DE_DIA.map((inicial, i) => {
              const dia = i + 1
              const activo = d.dias.includes(dia)
              return (
                <Pressable
                  key={inicial}
                  accessibilityRole="checkbox"
                  aria-checked={activo}
                  accessibilityState={{ checked: activo }}
                  accessibilityLabel={`${inicial}, ${d.nombre}`}
                  onPress={() => {
                    const dias = activo ? d.dias.filter((x) => x !== dia) : [...d.dias, dia].sort()
                    if (dias.length > 0) cambiarDeporte(n, { dias })
                  }}
                  style={[s.dia, activo && [s.diaActivo, degradadoOro]]}
                >
                  <Text style={[s.textoDia, activo && s.textoDiaActivo]}>{inicial}</Text>
                </Pressable>
              )
            })}
          </View>
          <Celda
            etiqueta={`Minutos de ${d.nombre}`}
            valor={d.minutos === null ? "" : String(d.minutos)}
            cambiar={(v) => cambiarDeporte(n, { minutos: v.trim() === "" ? null : numero(v, 1) })}
            ancho={56}
            teclado="number-pad"
            marcador="min"
          />
          <Enlace
            texto="Quitar"
            etiqueta={`Quitar ${d.nombre}`}
            onPress={() =>
              quitarDeporte
                ? quitarDeporte(n)
                : cambiar({ ...bloque, deportes: bloque.deportes.filter((_, i) => i !== n) })
            }
          />
        </View>
      ))}
      {avisoDeportes}
      {bloque.deportes.length + (avisoDeportes ? 1 : 0) < 4 && (
        <Enlace
          texto="Añadir deporte"
          onPress={() =>
            cambiar({
              ...bloque,
              deportes: [...bloque.deportes, { nombre: "", dias: [4], minutos: 60 }],
            })
          }
        />
      )}

      <View style={s.columnas}>
        <View style={s.columna}>
          <Text style={s.titulo}>Qué buscamos</Text>
          <AreaDeLineas
            etiqueta="Qué buscamos, uno por línea"
            valores={bloque.objetivos}
            cambiar={(objetivos) => cambiar({ ...bloque, objetivos })}
            maximo={6}
            marcador={"Bajar grasa sin perder músculo\nTécnica y progresión, sin fallo"}
          />
        </View>
        <View style={s.columna}>
          <Text style={s.titulo}>Notas para el cliente</Text>
          <AreaDeLineas
            etiqueta="Notas del bloque, una por línea"
            valores={bloque.notas}
            cambiar={(notas) => cambiar({ ...bloque, notas })}
            maximo={10}
            marcador="Nada de K-1 los miércoles"
          />
        </View>
      </View>
      <View style={s.filaFase}>
        <Text style={[s.tenue, s.flex]}>Pasos al día</Text>
        <Celda
          etiqueta="Objetivo de pasos al día"
          valor={bloque.pasosDiarios ? String(bloque.pasosDiarios) : ""}
          cambiar={(v) =>
            cambiar({
              ...bloque,
              pasosDiarios: v.trim() === "" ? undefined : Number(v.replace(/\D/g, "")) || undefined,
            })
          }
          ancho={90}
          teclado="number-pad"
          marcador="7000"
        />
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  lista: { gap: 2 },
  fila: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 12,
  },
  activa: { backgroundColor: tema.superficieAlta },
  numero: { width: 18, color: tema.acento, fontFamily: tema.fuenteBoton, fontSize: 13 },
  nombre: { color: tema.texto, fontFamily: tema.fuenteTexto, fontSize: 15 },
  bloque: { gap: 14 },
  titulo: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 18 },
  tenue: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 13 },
  fases: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  fase: {
    flexGrow: 1,
    flexBasis: 220,
    backgroundColor: tema.superficie,
    borderRadius: 16,
    padding: 12,
    gap: 6,
    borderTopWidth: 3,
    borderTopColor: tema.acento,
  },
  filaFase: { flexDirection: "row", alignItems: "center", gap: 8 },
  semana: {
    width: 44,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tema.bordeFuerte,
    backgroundColor: tema.hundido,
    color: tema.texto,
    fontFamily: tema.fuenteBoton,
    fontSize: 14,
    textAlign: "center",
    paddingHorizontal: 4,
  },
  errorSemana: { color: tema.error, fontFamily: tema.fuenteTexto, fontSize: 13 },
  nombreFase: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 16, paddingVertical: 4 },
  detalleFase: {
    color: tema.textoTenue,
    fontFamily: tema.fuenteTexto,
    fontSize: 13,
    paddingVertical: 2,
  },
  deporte: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    backgroundColor: tema.superficie,
    borderRadius: 14,
    padding: 10,
  },
  dias: { flexDirection: "row", gap: 4 },
  dia: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tema.bordeFuerte,
    alignItems: "center",
    justifyContent: "center",
  },
  diaActivo: { borderColor: "transparent" },
  textoDia: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 13 },
  textoDiaActivo: { color: tema.sobreAcento },
  columnas: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  columna: { flexGrow: 1, flexBasis: 260, gap: 8 },
  area: {
    minHeight: 88,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tema.bordeFuerte,
    backgroundColor: tema.superficie,
    color: tema.texto,
    fontFamily: tema.fuenteTexto,
    fontSize: 14,
    padding: 10,
    textAlignVertical: "top",
  },
})
