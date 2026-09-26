import { useCallback, useState } from "react"
import { useFocusEffect } from "expo-router"
import { StyleSheet, Text, View } from "react-native"
import type { MedioFoto } from "@alpha-omega/shared"

import { AvisoDeError, BotonSecundario } from "../componentes/formulario"
import { Pulsable } from "../componentes/pulsable"
import { hoyAgenda } from "../entrenamiento/fechas"
import { Titulo } from "../entrenamiento/plan/piezas"
import { Chips } from "../entrenamiento/sesion/controles"
import { faltaDe, type Falta } from "../lib/errores"
import { degradadoOro, tema } from "../tema"
import { AnadirFoto } from "./anadir-foto"
import { ComparadorFotos, type EnfoqueFoto } from "./comparador-fotos"
import {
  NOMBRE_CORTO,
  fechaConAno,
  fotosPorDia,
  haceDias,
  vistaDe,
  type DiaDeFotos,
} from "./fotos-modelo"
import { ImagenPrivada } from "./imagen-privada"
import type { ApiMedios } from "./medios-api"

type Api = Pick<ApiMedios, "fotosDeCliente" | "acceso" | "borrar" | "solicitarSubida" | "confirmar">
type Vista = "comparar" | "fechas"
const VISTAS: Array<{ valor: Vista; texto: string }> = [
  { valor: "comparar", texto: "Comparar" },
  { valor: "fechas", texto: "Por fechas" },
]
/** Cada miniatura pide su enlace y su imagen: la galería se abre por tandas de días. */
const DIAS_POR_TANDA = 6
const COLUMNAS = 3
const SEPARACION = 8

/**
 * Fotos de Progreso. El cliente añade las suyas cuando quiere y las compara
 * como en MyFitnessPal: dos fechas de la misma vista, lado a lado o con un
 * divisor que se arrastra. «Por fechas» enseña todas, del día más reciente al
 * más antiguo; tocar una la abre en el comparador. El entrenador ve y compara
 * las mismas fotos, sin añadirlas ni retirarlas desde aquí.
 * `api` debe ser estable entre renderizados (como el de `useMedios`).
 */
export function FotosProgreso({
  clienteId,
  api,
  modo,
  nuevoId,
  hoy = hoyAgenda(),
}: {
  clienteId: string
  api: Api
  modo: "cliente" | "entrenador"
  nuevoId: () => string
  hoy?: string
}): React.JSX.Element {
  const [lista, setLista] = useState<MedioFoto[] | null>(null)
  const [falta, setFalta] = useState<Falta | null>(null)
  const [intento, setIntento] = useState(0)
  const [anadiendo, setAnadiendo] = useState(false)
  const [vista, setVista] = useState<Vista>("comparar")
  const [enfoque, setEnfoque] = useState<EnfoqueFoto>()

  useFocusEffect(
    useCallback(() => {
      let vigente = true
      setFalta(null)
      api.fotosDeCliente(clienteId).then(
        (listado) => {
          if (vigente) setLista(listado.fotos)
        },
        (fallo: unknown) => {
          if (vigente) setFalta(faltaDe(fallo, "No se pudieron cargar las fotos."))
        },
      )
      return () => {
        vigente = false
      }
    }, [api, clienteId, intento]),
  )

  /** Lo que confirma el servidor sustituye a lo que había en la lista. */
  const actualizar = (medio: MedioFoto): void =>
    setLista((antes) => [...(antes ?? []).filter((f) => f.id !== medio.id), medio])
  const abrir = (foto: MedioFoto): void => {
    setEnfoque((antes) => ({ medioId: foto.id, vez: (antes?.vez ?? 0) + 1 }))
    setVista("comparar")
  }

  const conFotos = (lista ?? []).some((f) => f.estado !== "pendiente")

  return (
    <View style={s.grupo}>
      <View style={s.cabecera}>
        <View style={s.flexible}>
          <Titulo>Fotos</Titulo>
        </View>
        {modo === "cliente" && !anadiendo && (
          <Pulsable
            accessibilityRole="button"
            accessibilityLabel="Añadir foto"
            onPress={() => setAnadiendo(true)}
            style={[s.anadir, degradadoOro]}
          >
            <Text style={s.textoAnadir}>+ Añadir foto</Text>
          </Pulsable>
        )}
      </View>

      {anadiendo && (
        <AnadirFoto
          clienteId={clienteId}
          api={api}
          nuevoId={nuevoId}
          hoy={hoy}
          alGuardar={(medio) => {
            actualizar(medio)
            abrir(medio)
          }}
          cerrar={() => setAnadiendo(false)}
        />
      )}

      {falta && (
        <View style={s.grupo}>
          <AvisoDeError mensaje={falta.texto} />
          {falta.reintentable && (
            <BotonSecundario
              texto="Reintentar"
              etiquetaAccesible="Reintentar cargar las fotos"
              onPress={() => setIntento((n) => n + 1)}
            />
          )}
        </View>
      )}

      {lista === null ? (
        !falta && <Text style={s.tenue}>Cargando fotos…</Text>
      ) : !conFotos ? (
        <Text style={s.vacio}>
          {modo === "cliente"
            ? "Aún no hay fotos. Añade la primera para ver tu evolución."
            : "Aún no hay fotos de este cliente."}
        </Text>
      ) : (
        <>
          <Chips
            etiqueta="Cómo ver las fotos"
            opciones={VISTAS}
            elegidas={[vista]}
            cambiar={([elegida]) => elegida && setVista(elegida)}
          />
          {vista === "comparar" ? (
            <ComparadorFotos
              fotos={lista}
              api={api}
              hoy={hoy}
              enfoque={enfoque}
              alRetirar={actualizar}
              puedeBorrar={(foto) =>
                modo === "cliente" && foto.origen === "cliente" && foto.autor.id === clienteId
              }
            />
          ) : (
            <Galeria dias={fotosPorDia(lista)} hoy={hoy} acceso={api.acceso} abrir={abrir} />
          )}
        </>
      )}
    </View>
  )
}

/** Miniaturas agrupadas por día, el más reciente primero. */
function Galeria({
  dias,
  hoy,
  acceso,
  abrir,
}: {
  dias: DiaDeFotos[]
  hoy: string
  acceso: ApiMedios["acceso"]
  abrir: (foto: MedioFoto) => void
}): React.JSX.Element {
  const [tandas, setTandas] = useState(1)
  const [ancho, setAncho] = useState(0)
  const lado = ancho > 0 ? Math.min(140, (ancho - SEPARACION * (COLUMNAS - 1)) / COLUMNAS) : 0
  const visibles = dias.slice(0, tandas * DIAS_POR_TANDA)

  if (dias.length === 0)
    return <Text style={s.vacio}>No hay fotos que se puedan ver: todas se han retirado.</Text>

  return (
    <View
      testID="galeria-fotos"
      style={s.grupo}
      onLayout={(e) => setAncho(e.nativeEvent.layout.width)}
    >
      {visibles.map(({ fecha, fotos }) => (
        <View key={fecha} style={s.dia}>
          <Text style={s.fechaDia} accessibilityRole="header">
            {fechaConAno(fecha)}
            <Text style={s.hace}>{` · ${haceDias(fecha, hoy)}`}</Text>
          </Text>
          <View style={s.miniaturas}>
            {lado > 0 &&
              fotos.map((foto) => {
                const nombre = `${vistaDe(foto)}, ${fechaConAno(foto.fechaToma)}`
                return (
                  <Pulsable
                    key={foto.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Abrir ${nombre} en el comparador`}
                    onPress={() => abrir(foto)}
                    style={[s.miniatura, { width: lado }]}
                  >
                    <ImagenPrivada
                      medioId={foto.id}
                      etiqueta={nombre}
                      acceso={acceso}
                      variante="miniatura"
                      ancho={lado}
                    />
                    <Text style={s.pie} numberOfLines={1}>
                      {foto.vista === "otra" ? vistaDe(foto) : NOMBRE_CORTO[foto.vista]}
                    </Text>
                  </Pulsable>
                )
              })}
          </View>
        </View>
      ))}
      {dias.length > visibles.length && (
        <BotonSecundario
          texto="Ver fechas anteriores"
          etiquetaAccesible="Ver fotos de fechas anteriores"
          onPress={() => setTandas((n) => n + 1)}
        />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  grupo: { gap: 14 },
  cabecera: { flexDirection: "row", alignItems: "center", gap: 12 },
  flexible: { flex: 1 },
  anadir: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  textoAnadir: { color: tema.sobreAcento, fontFamily: tema.fuenteBoton, fontSize: 15 },
  tenue: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 14 },
  vacio: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 15, lineHeight: 22 },
  dia: { gap: 8 },
  fechaDia: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 15 },
  hace: { color: tema.textoTenue, fontFamily: tema.fuenteTexto },
  miniaturas: { flexDirection: "row", flexWrap: "wrap", gap: SEPARACION },
  miniatura: { gap: 4 },
  pie: { color: tema.textoSecundario, fontFamily: tema.fuenteTexto, fontSize: 12 },
})
