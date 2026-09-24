import { useCallback, useRef, useState } from "react"
import { useFocusEffect } from "expo-router"
import { StyleSheet, Text, View } from "react-native"
import type {
  BorradorDieta,
  ComidaRegistrada,
  DiaDeSeguimiento,
  DietaPublicada,
  ListadoMedidas,
} from "@alpha-omega/shared"

import { AvisoDeError, BotonSecundario } from "../componentes/formulario"
import { hoyAgenda, sumarDias } from "../entrenamiento/fechas"
import { fechaCorta } from "../entrenamiento/plan/modelo"
import { Fila, Pestanas, Tarjeta, Titulo } from "../entrenamiento/plan/piezas"
import { BotonDorado, Dialogo, Enlace } from "../entrenamiento/sesion/controles"
import { faltaDe } from "../lib/errores"
import type { ApiSeguimiento } from "../seguimiento/api"
import { media, miles, pesoLegible, suenoLegible } from "../seguimiento/modelo"
import { tema } from "../tema"
import type { ApiNutricion } from "./api"
import { aplicarPauta, type Pauta } from "./calculo"
import type { OrigenDelEditor } from "./editor-dieta"
import { tipoDelDia } from "./hoy-modelo"
import { PanelDieta } from "./panel-dieta"
import { PautaNutricion } from "./pauta"

type Pestana = "pauta" | "seguimiento" | "historial"
const PESTANAS = [
  { valor: "pauta", texto: "Pauta" },
  { valor: "seguimiento", texto: "Seguimiento" },
  { valor: "historial", texto: "Historial" },
] as const

type Datos = {
  vigente: DietaPublicada | null
  borrador: BorradorDieta | null
  medidas: ListadoMedidas | null
  dias: DiaDeSeguimiento[]
  comidas: ComidaRegistrada[]
}

const decimal = (valor: number): string => valor.toFixed(1).replace(".", ",")
const diferencia = (valor: number, unidad: string): string =>
  `${valor > 0 ? "+" : valor < 0 ? "−" : "±"}${decimal(Math.abs(valor))} ${unidad}`

/** Comidas que tocaban cada día, según la dieta vigente. */
function comidasEsperadas(dieta: DietaPublicada | null, fecha: string): number {
  return dieta ? (tipoDelDia(dieta.documento, fecha)?.comidas.length ?? 0) : 0
}

function UltimosDias({ datos, ver }: { datos: Datos; ver: () => void }): React.JSX.Element {
  const hoy = hoyAgenda()
  const desde = sumarDias(hoy, -6)
  const semana = datos.dias.filter((d) => d.fecha >= desde)
  const peso = media(semana.map((d) => d.pesoKg))
  const inicioPeso = datos.medidas?.medidas.find((m) => m.pesoKg !== null)?.pesoKg ?? null
  const cinturas = (datos.medidas?.medidas ?? []).filter((m) => m.cinturaCm !== null)
  const cintura = cinturas[cinturas.length - 1]?.cinturaCm ?? null
  const primeraCintura = cinturas[0]?.cinturaCm ?? null
  const fechas = Array.from({ length: 7 }, (_, n) => sumarDias(desde, n))
  const esperadas = fechas.reduce((total, f) => total + comidasEsperadas(datos.vigente, f), 0)
  const hechas = datos.comidas.filter((c) => c.fecha >= desde).length
  const completos = fechas.filter((f) => {
    const toca = comidasEsperadas(datos.vigente, f)
    return toca > 0 && datos.comidas.filter((c) => c.fecha === f).length >= toca
  }).length
  const pasos = media(semana.map((d) => d.pasos))
  const datosResumen: Array<[string, string, string | null]> = [
    [
      "Peso medio",
      peso === null ? "—" : pesoLegible(peso),
      peso !== null && inicioPeso !== null
        ? `${diferencia(peso - inicioPeso, "kg")} frente al inicio`
        : null,
    ],
    [
      "Cintura",
      cintura === null ? "—" : `${decimal(cintura).replace(",0", "")} cm`,
      cintura !== null && primeraCintura !== null && cinturas.length > 1
        ? diferencia(cintura - primeraCintura, "cm")
        : null,
    ],
    [
      "Comidas hechas",
      esperadas === 0 ? "—" : `${hechas} de ${esperadas}`,
      esperadas === 0 ? null : `Completas ${completos} de 7 días`,
    ],
    ["Pasos medios", pasos === null ? "—" : miles(Math.round(pasos)), null],
  ]
  return (
    <View style={s.grupo}>
      <View style={s.cabecera}>
        <Titulo>Últimos 7 días</Titulo>
        <Enlace texto="Ver seguimiento" onPress={ver} />
      </View>
      <View style={s.resumen}>
        {datosResumen.map(([nombre, valor, detalle]) => (
          <View
            key={nombre}
            style={s.dato}
            accessible
            accessibilityLabel={`${nombre}: ${valor}${detalle ? `, ${detalle}` : ""}`}
          >
            <Text style={s.tenue}>{nombre}</Text>
            <Text style={s.valorDato}>{valor}</Text>
            {detalle && <Text style={s.tenue}>{detalle}</Text>}
          </View>
        ))}
      </View>
    </View>
  )
}

function SeguimientoNutricion({ datos }: { datos: Datos }): React.JSX.Element {
  const hoy = hoyAgenda()
  const fechas = Array.from({ length: 14 }, (_, n) => sumarDias(hoy, -n))
  const porFecha = new Map(datos.dias.map((d) => [d.fecha, d]))
  const medidas = [...(datos.medidas?.medidas ?? [])].reverse()
  return (
    <View style={s.contenido}>
      <View style={s.grupo}>
        <Titulo>Últimos 14 días</Titulo>
        <Tarjeta>
          <View style={[s.filaTabla, s.cabeceraTabla]} accessible={false}>
            {["Día", "Peso", "Pasos", "Sueño", "Comidas", "Creatina"].map((t) => (
              <Text key={t} style={[s.celda, s.tenue]}>
                {t}
              </Text>
            ))}
          </View>
          {fechas.map((fecha) => {
            const dia = porFecha.get(fecha)
            const toca = comidasEsperadas(datos.vigente, fecha)
            const hechas = datos.comidas.filter((c) => c.fecha === fecha).length
            return (
              <View key={fecha} style={[s.filaTabla, s.separada]}>
                <Text style={[s.celda, s.fuerte]}>{fecha === hoy ? "Hoy" : fechaCorta(fecha)}</Text>
                <Text style={s.celda}>{dia?.pesoKg != null ? decimal(dia.pesoKg) : "—"}</Text>
                <Text style={s.celda}>{dia?.pasos != null ? miles(dia.pasos) : "—"}</Text>
                <Text style={s.celda}>
                  {dia?.suenoMin != null ? suenoLegible(dia.suenoMin) : "—"}
                </Text>
                <Text style={s.celda}>{toca > 0 ? `${hechas}/${toca}` : "—"}</Text>
                <Text style={s.celda}>{dia?.creatina ? "Sí" : "—"}</Text>
              </View>
            )
          })}
        </Tarjeta>
      </View>
      <View style={s.grupo}>
        <Titulo>Medidas</Titulo>
        {medidas.length === 0 ? (
          <Text style={s.tenue}>Aún no hay medidas.</Text>
        ) : (
          <Tarjeta>
            {medidas.map((m, n) => (
              <Fila key={m.id} primera={n === 0}>
                <Text style={[s.fuerte, s.fecha]}>{fechaCorta(m.fecha)}</Text>
                <Text style={[s.texto, s.flex]}>
                  {[
                    m.pesoKg !== null ? pesoLegible(m.pesoKg) : null,
                    m.cinturaCm !== null ? `cintura ${decimal(m.cinturaCm)} cm` : null,
                    m.grasaPct !== null ? `grasa ${decimal(m.grasaPct)} %` : null,
                    m.alturaCm !== null ? `${m.alturaCm} cm` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              </Fila>
            ))}
          </Tarjeta>
        )}
      </View>
    </View>
  )
}

/**
 * Ficha del cliente para el nutricionista, como en el diseño: Pauta (cálculo
 * del gasto y objetivo), Seguimiento e Historial, y «Publicar cambios».
 */
export function FichaNutricion({
  clienteId,
  nombre,
  api,
  seguimiento,
  nuevoId,
  editar,
}: {
  clienteId: string
  nombre: string
  api: ApiNutricion
  seguimiento: ApiSeguimiento
  nuevoId: () => string
  editar: (origen: OrigenDelEditor) => void
}): React.JSX.Element {
  const [pestana, setPestana] = useState<Pestana>("pauta")
  const [datos, setDatos] = useState<Datos | null>(null)
  const [error, setError] = useState("")
  const [aviso, setAviso] = useState("")
  const [intento, setIntento] = useState(0)
  const [pauta, setPauta] = useState<Pauta | string>("")
  const [confirmando, setConfirmando] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const operacion = useRef<string | null>(null)
  const hoy = hoyAgenda()

  useFocusEffect(
    useCallback(() => {
      let vigente = true
      Promise.all([
        api.vigente(clienteId),
        api.borrador(clienteId),
        seguimiento.medidas(clienteId).catch(() => null),
        seguimiento.dias(clienteId, sumarDias(hoy, -13), hoy).catch(() => ({ dias: [] })),
        api.comidas(clienteId, sumarDias(hoy, -13), hoy).catch(() => ({ comidas: [] })),
      ])
        .then(([{ dieta }, { borrador }, medidas, { dias }, { comidas }]) => {
          if (!vigente) return
          setDatos({ vigente: dieta, borrador, medidas, dias, comidas })
          setError("")
        })
        .catch((fallo: unknown) => {
          if (vigente) setError(faltaDe(fallo, "No se pudo cargar la ficha.").texto)
        })
      return () => {
        vigente = false
      }
    }, [api, seguimiento, clienteId, hoy, intento]),
  )

  const publicar = async (): Promise<void> => {
    if (datos === null || typeof pauta === "string") return
    setOcupado(true)
    setAviso("")
    try {
      const documento = aplicarPauta(
        datos.borrador?.documento ?? datos.vigente?.documento ?? null,
        pauta,
        nuevoId,
      )
      const guardado = await api.guardar(clienteId, datos.borrador?.revision ?? 0, documento)
      // Un reintento reutiliza la operación: el servidor no publica dos veces.
      operacion.current ??= nuevoId()
      await api.publicar(clienteId, operacion.current, guardado.revision)
      operacion.current = null
      setConfirmando(false)
      setAviso(`Cambios publicados. ${nombre.split(" ")[0]} ya los ve en su pestaña Nutrición.`)
      setIntento((n) => n + 1)
    } catch (fallo) {
      setConfirmando(false)
      setAviso(faltaDe(fallo, "No se pudieron publicar los cambios. Reintenta.").texto)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <View style={s.contenido}>
      <View style={s.titulos}>
        <Text style={s.nombre} accessibilityRole="header">
          {nombre}
        </Text>
        <Text style={s.tenue}>{datos?.vigente?.documento.nombre ?? "Sin dieta publicada"}</Text>
      </View>
      <Pestanas opciones={PESTANAS} activa={pestana} cambiar={setPestana} />
      {aviso !== "" && (
        <Text style={s.aviso} accessibilityLiveRegion="polite">
          {aviso}
        </Text>
      )}
      {error !== "" ? (
        <View style={s.grupo}>
          <AvisoDeError mensaje={error} />
          <BotonSecundario texto="Reintentar" onPress={() => setIntento((n) => n + 1)} />
        </View>
      ) : datos === null ? (
        <Text style={s.tenue}>Cargando la ficha…</Text>
      ) : pestana === "pauta" ? (
        <>
          <PautaNutricion
            key={`${datos.vigente?.id ?? "sin"}-${datos.borrador?.revision ?? 0}`}
            nombre={nombre}
            base={datos.borrador ?? datos.vigente}
            medidas={datos.medidas}
            resumen={<UltimosDias datos={datos} ver={() => setPestana("seguimiento")} />}
            alCambiar={setPauta}
          />
          {typeof pauta === "string" && pauta !== "" && <Text style={s.falta}>{pauta}</Text>}
          <BotonDorado
            texto="Publicar cambios"
            ocupado={ocupado}
            onPress={() => typeof pauta !== "string" && setConfirmando(true)}
          />
          <Enlace
            texto="Editar comidas y días de la dieta"
            onPress={() => setPestana("historial")}
          />
        </>
      ) : pestana === "seguimiento" ? (
        <SeguimientoNutricion datos={datos} />
      ) : (
        <PanelDieta clienteId={clienteId} api={api} nuevoId={nuevoId} editar={editar} />
      )}
      <Dialogo
        visible={confirmando}
        titulo="¿Publicar los cambios?"
        texto={`${nombre.split(" ")[0]} verá las nuevas calorías, macros y pautas en su pestaña Nutrición.`}
        confirmar={ocupado ? "Publicando…" : "Publicar cambios"}
        cancelar="Cancelar"
        alConfirmar={() => void (ocupado ? undefined : publicar())}
        alCancelar={() => setConfirmando(false)}
      />
    </View>
  )
}

const s = StyleSheet.create({
  contenido: { gap: 24 },
  grupo: { gap: 12 },
  cabecera: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  titulos: { gap: 4 },
  nombre: {
    color: tema.texto,
    fontFamily: tema.fuenteTitulo,
    fontSize: 34,
    lineHeight: 38,
    textTransform: "uppercase",
  },
  tenue: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 13 },
  texto: { color: tema.texto, fontFamily: tema.fuenteTexto, fontSize: 14 },
  fuerte: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 14 },
  flex: { flex: 1 },
  fecha: { width: 64 },
  falta: { color: tema.aviso, fontFamily: tema.fuenteTexto, fontSize: 14 },
  aviso: {
    backgroundColor: tema.exitoSuave,
    color: tema.texto,
    borderRadius: 12,
    padding: 12,
    fontFamily: tema.fuenteBoton,
  },
  resumen: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  dato: {
    flexGrow: 1,
    flexBasis: "45%",
    backgroundColor: tema.superficie,
    borderRadius: 16,
    padding: 14,
    gap: 4,
  },
  valorDato: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 20 },
  filaTabla: { flexDirection: "row", alignItems: "center", paddingVertical: 10, gap: 4 },
  cabeceraTabla: { paddingTop: 14 },
  separada: { borderTopWidth: 1, borderTopColor: tema.borde },
  celda: {
    flex: 1,
    color: tema.textoSecundario,
    fontFamily: tema.fuenteTexto,
    fontSize: 13,
    textAlign: "center",
  },
})
