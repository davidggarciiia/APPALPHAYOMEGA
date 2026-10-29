import { useEffect, useState } from "react"
import { useRouter } from "expo-router"
import { StyleSheet, Text, View } from "react-native"
import { ETIQUETA_DE_ZONA, type Molestia } from "@alpha-omega/shared"
import { AvisoDeError, BotonPrincipal, BotonSecundario } from "../../componentes/formulario"
import { Aviso } from "../../componentes/aviso"
import { EntradaMarca } from "../../componentes/entrada-marca"
import { Esqueleto, GrupoEsqueletos } from "../../componentes/esqueleto"
import { Hoja } from "../../componentes/hoja"
import { Icono, type NombreIcono } from "../../componentes/iconos"
import { InsigniaDeEstado } from "../../componentes/insignia-estado"
import { Pulsable } from "../../componentes/pulsable"
import { DatosDelCliente } from "../../clientes/datos-del-cliente"
import { fechaCorta, semanaDelBloque } from "../../entrenamiento/plan/modelo"
import { hoyAgenda } from "../../entrenamiento/fechas"
import { tipoDelDia } from "../../nutricion/hoy-modelo"
import { miles } from "../../seguimiento/modelo"
import type { ApiMedios } from "../../seguimiento/medios-api"
import { alto, radio, tema, tipo } from "../../tema"
import { resumenDeResultado } from "../ficha-modelo"
import { DialogoResponder } from "./atencion"
import { BarraDeBloque } from "./barra-bloque"
import { CargasFicha } from "./cargas-ficha"
import { TarjetaDeAccion } from "./tarjeta-accion"
import { TiraSemana } from "./tira-semana"
import { useDatosFicha, type FuentesFicha } from "./use-datos-ficha"

type Propiedades = FuentesFicha & {
  cuentaId: string
  medios: ApiMedios
  nuevoId: () => string
  editarPlan: () => void
  verSemana: (nombre: string) => void
  abrirNutricion: (nombre: string) => void
  valoracionInicial?: boolean
  pestanaInicial?: "progreso"
  datosIniciales?: boolean
  correoFallido?: boolean
  alCerrarDatos?: () => void
}
export function FichaCliente(props: Propiedades): React.JSX.Element {
  return <FichaActual key={`${props.cuentaId}:${props.clienteId}`} {...props} />
}
function FichaActual(props: Propiedades): React.JSX.Element {
  const {
    clienteId,
    editarPlan,
    verSemana,
    abrirNutricion,
    valoracionInicial,
    pestanaInicial,
    datosIniciales = false,
    correoFallido,
    alCerrarDatos,
  } = props
  const { datos, error, copia, lunes, actualizarFicha, responder, reintentar } =
    useDatosFicha(props)
  const [menu, setMenu] = useState(false)
  const [mostrandoDatos, setMostrandoDatos] = useState(datosIniciales)
  const [respondiendo, setRespondiendo] = useState<Molestia | null>(null)
  const router = useRouter()
  useEffect(() => {
    if (datosIniciales) setMostrandoDatos(true)
  }, [datosIniciales])
  useEffect(() => {
    if (valoracionInicial)
      router.replace({
        pathname: "/entrenador/cliente/[id]/valoraciones",
        params: { id: clienteId, valoracionInicial: "1" },
      })
    else if (pestanaInicial === "progreso")
      router.replace({ pathname: "/entrenador/cliente/[id]/progreso", params: { id: clienteId } })
  }, [valoracionInicial, pestanaInicial, clienteId, router])
  if (!datos)
    return error ? (
      <View style={s.grupo}>
        <AvisoDeError mensaje={error} />
        <BotonSecundario texto="Reintentar" onPress={reintentar} />
      </View>
    ) : (
      <GrupoEsqueletos>
        <View
          style={s.contenido}
          accessibilityLabel="Cargando ficha"
          accessibilityState={{ busy: true }}
        >
          <Esqueleto ancho={44} alto={44} />
          <Esqueleto ancho="75%" alto={38} />
          <Esqueleto alto={18} />
          <Esqueleto alto={10} />
          {[0, 1, 2].map((n) => (
            <Esqueleto key={n} alto={102} radio={radio.tarjeta} />
          ))}
        </View>
      </GrupoEsqueletos>
    )
  const nombre = [datos.ficha.nombre, datos.ficha.apellidos].filter(Boolean).join(" ")
  const plan = datos.plan
  const semana = plan ? semanaDelBloque(plan, lunes) : null
  const pendientes = datos.resultados.filter((r) => r.revisadaEn === null)
  const abiertas = datos.molestias
    .filter((m) => m.estado === "abierta")
    .sort((a, b) => b.intensidad - a.intensidad)
  const nueva =
    !plan && datos.totalValoraciones === 0 && !datos.resultados.length && !abiertas.length
  const abrirValoracion = () =>
    router.push({
      pathname: "/entrenador/cliente/[id]/valoraciones",
      params: { id: clienteId, valoracionInicial: "1" },
    })
  const verSesion = (id: string) =>
    router.push({ pathname: "/entrenamiento/[id]", params: { id, nombre } })
  const acciones: Array<{
    titulo: string
    detalle: string
    accion: string
    onPress: () => void
    variante?: "error" | "aviso"
  }> = []
  if (!nueva) {
    const molestia = abiertas[0]
    if (molestia)
      acciones.push({
        titulo: `${ETIQUETA_DE_ZONA[molestia.zona]} · ${molestia.intensidad} de 10`,
        detalle: [
          molestia.ejercicio,
          molestia.serie ? `serie ${molestia.serie}` : null,
          molestia.creadaEn ? `desde ${fechaCorta(molestia.creadaEn.slice(0, 10))}` : null,
          abiertas.length > 1 ? `y ${abiertas.length - 1} más` : null,
        ]
          .filter(Boolean)
          .join(" · "),
        accion: "Responder",
        onPress: () => setRespondiendo(molestia),
        variante: molestia.intensidad >= 7 ? "error" : "aviso",
      })
    if (pendientes.length) {
      const antigua = [...pendientes].sort((a, b) =>
        a.agenda.fechaActual.localeCompare(b.agenda.fechaActual),
      )[0]!
      acciones.push({
        titulo:
          pendientes.length === 1
            ? `${antigua.resultado.prescripcion.nombre} por revisar`
            : `${pendientes.length} sesiones por revisar`,
        detalle:
          pendientes.length === 1
            ? `${fechaCorta(antigua.agenda.fechaActual)} · ${resumenDeResultado(antigua.resultado)}`
            : `La más antigua: ${fechaCorta(antigua.agenda.fechaActual)}`,
        accion: "Revisar",
        onPress: () =>
          pendientes.length === 1
            ? verSesion(antigua.agenda.id)
            : router.push({
                pathname: "/entrenador/cliente/[id]/sesiones",
                params: { id: clienteId, sinRevisar: "1" },
              }),
      })
    }
    if (
      plan &&
      semana === plan.semanas &&
      datos.siguiente !== undefined &&
      (!datos.siguiente || datos.siguiente.id === plan.id)
    )
      acciones.push({
        titulo: `El ${plan.nombre} acaba el domingo`,
        detalle: `Semana ${semana} de ${plan.semanas} · prepara el siguiente`,
        accion: "Preparar",
        onPress: editarPlan,
        variante: "aviso",
      })
    if (!plan && datos.resultados.length)
      acciones.push({
        titulo: "Sin plan esta semana",
        detalle: "Crea el siguiente bloque",
        accion: "Crear plan",
        onPress: editarPlan,
        variante: "aviso",
      })
    if (plan && datos.totalValoraciones === 0 && acciones.length < 3)
      acciones.push({
        titulo: "Valoración inicial",
        detalle: "Aún no tiene la de partida",
        accion: "Empezar",
        onPress: abrirValoracion,
      })
  }
  const peso = datos.medidas?.medidas.filter((m) => m.pesoKg !== null) ?? []
  const delta = peso.length > 1 ? peso.at(-1)!.pesoKg! - peso[0]!.pesoKg! : null
  const ajuste = plan?.bloque?.fases.find((f) => f.ajustes)
  const kcal = datos.dieta?.dieta
    ? tipoDelDia(datos.dieta.dieta.documento, hoyAgenda())?.objetivo?.kcal
    : null
  const destinos: Array<{
    titulo: string
    detalle: string
    icono: NombreIcono
    onPress: () => void
  }> = [
    {
      titulo: "Plan",
      detalle: plan
        ? `${plan.nombre} · ${ajuste ? `${ajuste.nombre.toLowerCase()} en S${ajuste.desde}` : `${plan.semanas} semanas`}`
        : "Sin plan",
      icono: "plan",
      onPress: editarPlan,
    },
    ...(datos.resultados.length
      ? [
          {
            titulo: "Sesiones",
            detalle: `${datos.resultados.length} enviadas${pendientes.length ? ` · ${pendientes.length} sin revisar` : ""}`,
            icono: "entreno" as const,
            onPress: () =>
              router.push({
                pathname: "/entrenador/cliente/[id]/sesiones",
                params: { id: clienteId },
              }),
          },
        ]
      : []),
    ...(datos.medidas?.medidas.length ||
    datos.resultados.some((r) =>
      r.resultado.prescripcion.ejercicios.some((e) => (e.seccion ?? "principal") === "principal"),
    )
      ? [
          {
            titulo: "Progreso",
            detalle:
              delta === null
                ? "Evolución por ejercicio"
                : `${delta > 0 ? "+" : ""}${delta.toFixed(1).replace(".", ",")} kg desde el inicio`,
            icono: "progreso" as const,
            onPress: () =>
              router.push({
                pathname: "/entrenador/cliente/[id]/progreso",
                params: { id: clienteId },
              }),
          },
        ]
      : []),
    {
      titulo: "Valoraciones",
      detalle: datos.totalValoraciones
        ? `${datos.totalValoraciones} hechas${datos.ultimaValoracion ? ` · última ${fechaCorta(datos.ultimaValoracion)}` : ""}`
        : datos.totalValoraciones === 0
          ? "Ninguna todavía"
          : "Sin datos disponibles",
      icono: "ejercicios",
      onPress: () =>
        router.push({
          pathname: "/entrenador/cliente/[id]/valoraciones",
          params: { id: clienteId },
        }),
    },
    ...(datos.molestias.length
      ? [
          {
            titulo: "Molestias",
            detalle: `${abiertas.length ? `${abiertas.length} abiertas` : "Ninguna abierta"} · ${datos.molestias.length - abiertas.length} atendidas`,
            icono: "notificaciones" as const,
            onPress: () =>
              router.push({
                pathname: "/entrenador/cliente/[id]/molestias",
                params: { id: clienteId },
              }),
          },
        ]
      : []),
    {
      titulo: "Nutrición",
      detalle: datos.dieta?.dieta
        ? `Dieta vigente${kcal != null ? ` · ${miles(kcal)} kcal hoy` : ""}`
        : "Sin dieta",
      icono: "nutricion",
      onPress: () => abrirNutricion(nombre),
    },
    {
      titulo: "Datos del cliente",
      detalle: datos.ficha.email,
      icono: "perfil",
      onPress: () => setMostrandoDatos(true),
    },
  ]
  return (
    <View style={s.contenido}>
      <View
        style={s.contenido}
        accessibilityElementsHidden={menu}
        importantForAccessibility={menu ? "no-hide-descendants" : "auto"}
      >
        <View style={s.cabecera}>
          <View style={s.barra}>
            <Pulsable
              accessibilityLabel="Volver"
              style={s.icono}
              onPress={() => (router.canGoBack() ? router.back() : router.replace("/cartera"))}
            >
              <Icono nombre="atras" tamano={20} color={tema.texto} />
            </Pulsable>
            <Pulsable
              accessibilityLabel="Más acciones"
              style={s.icono}
              onPress={() => setMenu(true)}
            >
              <Text style={s.puntos}>⋯</Text>
            </Pulsable>
          </View>
          <Text style={s.nombre} accessibilityRole="header">
            {nombre}
          </Text>
          <View style={s.estado}>
            {datos.ficha.estado && <InsigniaDeEstado estado={datos.ficha.estado} />}
            <Text style={s.tenue}>
              {plan
                ? `${plan.nombre} · semana ${semana} de ${plan.semanas}`
                : nueva
                  ? "Sin plan todavía"
                  : "Sin plan esta semana"}
            </Text>
          </View>
          {plan && (
            <BarraDeBloque
              plan={plan}
              lunes={lunes}
              pausada={menu || mostrandoDatos || respondiendo !== null}
            />
          )}
        </View>
        {error !== "" && (
          <Aviso
            mensaje={copia ? `Sin conexión · copia de las ${copia}` : error}
            alReintentar={reintentar}
          />
        )}
        {datos.consentimiento && !datos.consentimiento.vigente && (
          <Aviso mensaje="Sin consentimiento de salud: no se pueden guardar medidas ni fotos hasta que lo acepte." />
        )}
        <EntradaMarca style={s.contenido}>
          {nueva ? (
            <View style={s.grupo}>
              <View style={[s.paso, s.inicial]}>
                <Text style={s.numero}>1</Text>
                <View style={s.flex}>
                  <Text style={s.fuerte}>Valoración inicial</Text>
                  <Text style={s.tenue}>Peso, medidas y pruebas de partida.</Text>
                  <BotonPrincipal
                    texto="Empezar valoración"
                    onPress={abrirValoracion}
                    deshabilitado={error !== ""}
                    sinMargen
                  />
                </View>
              </View>
              <View style={s.paso}>
                <Text style={s.numero}>2</Text>
                <View style={s.flex}>
                  <Text style={s.fuerte}>Crear plan</Text>
                  <Text style={s.tenue}>Rutina, bloque y fecha de inicio.</Text>
                  <BotonSecundario
                    texto="Crear plan"
                    onPress={editarPlan}
                    deshabilitado={error !== ""}
                    sinMargen
                  />
                </View>
              </View>
            </View>
          ) : (
            <>
              {acciones.length > 0 && (
                <View style={s.grupo}>
                  {acciones.slice(0, 3).map((accion, i) => (
                    <TarjetaDeAccion
                      key={accion.accion}
                      {...accion}
                      principal={i === 0}
                      deshabilitado={error !== ""}
                    />
                  ))}
                </View>
              )}
              {!plan &&
                !datos.resultados.length &&
                datos.totalValoraciones !== null &&
                datos.totalValoraciones > 0 && (
                  <TarjetaDeAccion
                    titulo="Crear plan"
                    detalle="Rutina, bloque y fecha de inicio."
                    accion="Crear plan"
                    onPress={editarPlan}
                    principal={acciones.length === 0}
                    deshabilitado={error !== ""}
                  />
                )}
              {datos.semana && (plan || datos.semana.total > 0) && (
                <TiraSemana
                  semana={datos.semana}
                  resultados={datos.resultados}
                  molestias={datos.molestias}
                  plan={plan}
                  lunes={lunes}
                  abrirSesion={verSesion}
                />
              )}
              <CargasFicha
                resultados={datos.resultados}
                lunes={lunes}
                abrir={(ejercicioId) =>
                  router.push({
                    pathname: "/entrenador/cliente/[id]/ejercicio/[ejercicioId]",
                    params: { id: clienteId, ejercicioId },
                  })
                }
              />
            </>
          )}
          <View style={s.lista}>
            {destinos.map((destino) => (
              <FilaDestino key={destino.titulo} {...destino} />
            ))}
          </View>
        </EntradaMarca>
      </View>
      {menu && (
        <Hoja visible alCerrar={() => setMenu(false)}>
          <View style={s.grupo}>
            {[
              {
                titulo: "Datos del cliente",
                detalle: "Nombre, correo y acceso",
                icono: "perfil" as const,
                onPress: () => setMostrandoDatos(true),
              },
              {
                titulo: "Crear plan nuevo",
                detalle: "Empieza un bloque nuevo",
                icono: "plan" as const,
                onPress: editarPlan,
              },
              {
                titulo: "Ver como cliente",
                detalle: "Su semana, solo lectura",
                icono: "entreno" as const,
                onPress: () => verSemana(nombre),
              },
            ].map((destino) => (
              <FilaDestino
                key={destino.titulo}
                {...destino}
                onPress={() => {
                  setMenu(false)
                  destino.onPress()
                }}
              />
            ))}
            <BotonSecundario texto="Cancelar" onPress={() => setMenu(false)} sinMargen />
          </View>
        </Hoja>
      )}
      {mostrandoDatos && (
        <DatosDelCliente
          clienteId={clienteId}
          fichaInicial={datos.ficha}
          consentimiento={datos.consentimiento}
          correoFallido={correoFallido}
          alCerrar={() => {
            setMostrandoDatos(false)
            alCerrarDatos?.()
          }}
          alActualizar={actualizarFicha}
        />
      )}
      <DialogoResponder
        molestia={error === "" ? respondiendo : null}
        cerrar={() => setRespondiendo(null)}
        responder={responder}
      />
    </View>
  )
}
function FilaDestino({
  titulo,
  detalle,
  icono,
  onPress,
}: {
  titulo: string
  detalle: string
  icono: NombreIcono
  onPress: () => void
}): React.JSX.Element {
  return (
    <Pulsable
      style={s.destino}
      accessibilityLabel={titulo}
      accessibilityHint={detalle}
      onPress={onPress}
    >
      <Icono nombre={icono} color={tema.textoTenue} tamano={22} />
      <View style={s.flex}>
        <Text style={s.fuerte}>{titulo}</Text>
        <Text style={s.tenue}>{detalle}</Text>
      </View>
      <Icono nombre="adelante" color={tema.textoTenue} tamano={18} />
    </Pulsable>
  )
}
const s = StyleSheet.create({
  contenido: { gap: 22 },
  grupo: { gap: 12 },
  cabecera: { gap: 12 },
  barra: {
    minHeight: alto.barraSuperior,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  icono: {
    width: alto.tactil,
    height: alto.tactil,
    borderRadius: radio.celda,
    alignItems: "center",
    justifyContent: "center",
  },
  puntos: { color: tema.texto, fontSize: 30, lineHeight: 34 },
  nombre: { ...tipo.tituloPantalla, fontSize: 34, lineHeight: 38, color: tema.texto },
  estado: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  tenue: tipo.secundario,
  fuerte: { ...tipo.cuerpo, color: tema.texto, fontFamily: tema.fuenteBoton },
  flex: { flex: 1, minWidth: 0, gap: 4 },
  lista: { borderRadius: radio.tarjeta, backgroundColor: tema.superficie, overflow: "hidden" },
  destino: {
    minHeight: 64,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: tema.borde,
  },
  paso: {
    borderRadius: radio.tarjeta,
    backgroundColor: tema.superficie,
    padding: 16,
    flexDirection: "row",
    gap: 12,
  },
  inicial: { borderWidth: 1, borderColor: tema.bordeDestacado },
  numero: {
    ...tipo.cuerpo,
    color: tema.acento,
    width: 28,
    height: 28,
    textAlign: "center",
    borderRadius: 8,
    backgroundColor: tema.acentoSuave,
  },
})
