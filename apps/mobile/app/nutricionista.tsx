import { useFocusEffect, useRouter } from "expo-router"
import { useCallback, useRef, useState } from "react"
import { ActivityIndicator, FlatList, StyleSheet, Switch, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import type { ResumenUsuario } from "@alpha-omega/shared"

import { BotonSecundario } from "../src/componentes/formulario"
import { InsigniaDeEstado } from "../src/componentes/insignia-estado"
import { HOLGURA_DE_ENLACE, Pulsable } from "../src/componentes/pulsable"
import { asignarCliente, leerAsignaciones, listarUsuarios, retirarCliente } from "../src/lib/api"
import { faltaDe, type Falta } from "../src/lib/errores"
import { useSesion } from "../src/sesion"
import { tema } from "../src/tema"

const LIMITE = 100

type Fase = "cargando" | "sin-nutricionista" | "listo" | "error"

const SIN_FALTA: Falta = { texto: "", reintentable: true, sesionCaducada: false }

/**
 * Quien ve el nutricionista.
 *
 * El nutricionista esta subcontratado: no es de la casa. Por eso no ve nada por
 * defecto y el entrenador le va dando acceso cliente a cliente, con un
 * interruptor por persona.
 *
 * Quitar un interruptor corta el acceso en la peticion siguiente. No hay que
 * cerrarle la sesion ni esperar a que caduque nada.
 */
export default function Nutricionista(): React.JSX.Element {
  const { estado: sesion } = useSesion()
  const router = useRouter()

  const [fase, setFase] = useState<Fase>("cargando")
  const [nutri, setNutri] = useState<ResumenUsuario | null>(null)
  const [clientes, setClientes] = useState<ResumenUsuario[]>([])
  const [asignados, setAsignados] = useState<Set<string>>(new Set())
  const [moviendo, setMoviendo] = useState<string | null>(null)
  const cambioEnCurso = useRef(false)
  const [falta, setFalta] = useState<Falta>(SIN_FALTA)
  const [intento, setIntento] = useState(0)

  const tokenAcceso = sesion.fase === "dentro" ? sesion.tokenAcceso : null

  useFocusEffect(
    useCallback(() => {
      if (tokenAcceso === null) return

      let vigente = true
      setFase("cargando")
      setFalta(SIN_FALTA)

      const cargar = async (): Promise<void> => {
        const nutricionistas = await listarUsuarios(tokenAcceso, {
          rol: "nutricionista",
          limite: LIMITE,
          desde: 0,
        })

        const primero = nutricionistas.usuarios[0]

        if (primero === undefined) {
          if (vigente) setFase("sin-nutricionista")
          return
        }

        // Hoy hay uno solo. El dia que haya dos, esta pantalla tendra que dejar
        // elegir; mientras tanto, inventar un selector para una lista de uno seria
        // un paso de mas en cada uso.
        const [cartera, reparto] = await Promise.all([
          listarUsuarios(tokenAcceso, { rol: "cliente", limite: LIMITE, desde: 0 }),
          leerAsignaciones(tokenAcceso, primero.id),
        ])

        // El reparto permite administrar toda la cartera, tambien las paginas
        // posteriores a la primera. La API limita cada peticion a cien personas.
        const todos = [...cartera.usuarios]
        while (todos.length < cartera.total) {
          if (!vigente) return
          const pagina = await listarUsuarios(tokenAcceso, {
            rol: "cliente",
            limite: LIMITE,
            desde: todos.length,
          })
          if (pagina.usuarios.length === 0) break
          todos.push(...pagina.usuarios)
        }

        if (!vigente) return

        setNutri(primero)
        setClientes(todos)
        setAsignados(new Set(reparto.clienteIds))
        setFase("listo")
      }

      cargar().catch((error: unknown) => {
        if (!vigente) return

        setFalta(faltaDe(error, "No hemos podido cargar el reparto."))
        setFase("error")
      })

      return () => {
        vigente = false
      }
    }, [tokenAcceso, intento]),
  )

  /**
   * Mueve el interruptor.
   *
   * La pantalla se pinta con lo que se pidio y se revierte si el servidor dice
   * que no. Un interruptor que se queda quieto medio segundo se vuelve a pulsar,
   * y entonces se ha asignado y retirado a la vez.
   */
  async function alternar(cliente: ResumenUsuario, dar: boolean): Promise<void> {
    if (tokenAcceso === null || nutri === null || cambioEnCurso.current) return

    cambioEnCurso.current = true
    setFalta(SIN_FALTA)
    setMoviendo(cliente.id)
    setAsignados((previos) => conCambio(previos, cliente.id, dar))

    try {
      if (dar) {
        await asignarCliente(tokenAcceso, nutri.id, cliente.id)
      } else {
        await retirarCliente(tokenAcceso, nutri.id, cliente.id)
      }
    } catch (error) {
      setFalta(faltaDe(error, "No hemos podido cambiar el acceso."))
      // Una respuesta perdida no demuestra que el servidor no escribio. Se
      // exige recargar antes de mostrar otra vez el estado de los permisos.
      setFase("error")
    } finally {
      cambioEnCurso.current = false
      setMoviendo(null)
    }
  }

  if (fase === "cargando") {
    return (
      <View style={estilos.centrado}>
        <ActivityIndicator color={tema.oro} size="large" accessibilityLabel="Cargando el reparto" />
      </View>
    )
  }

  if (fase === "error") {
    return (
      <View style={estilos.centrado}>
        <Text style={estilos.aviso} accessibilityRole="alert">
          {falta.texto}
        </Text>
        {falta.reintentable && (
          <BotonSecundario
            texto="REINTENTAR"
            onPress={() => {
              setFase("cargando")
              setIntento((n) => n + 1)
            }}
          />
        )}
        <BotonSecundario
          texto="VOLVER"
          onPress={() => {
            router.back()
          }}
        />
      </View>
    )
  }

  if (fase === "sin-nutricionista") {
    return (
      <View style={estilos.centrado}>
        <Text style={estilos.aviso}>Todavía no tienes ningún nutricionista.</Text>
        <Text style={estilos.detalle}>
          Créale su perfil y después decide a qué clientes ve. Sin que lo decidas tú, no verá nada
          de nadie.
        </Text>
        <BotonSecundario
          texto="CREAR SU PERFIL"
          onPress={() => {
            router.push({ pathname: "/cliente/nuevo", params: { rol: "nutricionista" } })
          }}
        />
        <BotonSecundario
          texto="VOLVER"
          onPress={() => {
            router.back()
          }}
        />
      </View>
    )
  }

  const nombreNutri = [nutri?.nombre, nutri?.apellidos].filter(Boolean).join(" ")

  return (
    <SafeAreaView style={estilos.pantalla}>
      <View style={estilos.cabecera}>
        <Text style={estilos.titulo}>NUTRICIONISTA</Text>
        <Pulsable
          onPress={() => {
            router.back()
          }}
          accessibilityRole="button"
          hitSlop={HOLGURA_DE_ENLACE}
        >
          <Text style={estilos.volver}>VOLVER</Text>
        </Pulsable>
      </View>

      <View style={estilos.ficha}>
        <Text style={estilos.nombreNutri}>{nombreNutri}</Text>
        <Text style={estilos.correo}>{nutri?.email}</Text>
        <Text style={estilos.detalle}>
          {`Ve a ${String(asignados.size)} de tus ${String(clientes.length)} clientes. Del resto no ve nada: ni dieta, ni peso, ni medidas.`}
        </Text>
      </View>

      {falta.texto !== "" && (
        <Text style={estilos.error} accessibilityRole="alert">
          {falta.texto}
        </Text>
      )}

      <FlatList
        data={clientes}
        keyExtractor={(cliente) => cliente.id}
        contentContainerStyle={estilos.lista}
        renderItem={({ item }) => {
          const tiene = asignados.has(item.id)
          const nombre = [item.nombre, item.apellidos].filter(Boolean).join(" ")

          return (
            <View style={estilos.fila}>
              <View style={estilos.datos}>
                <Text style={estilos.nombre} numberOfLines={1}>
                  {nombre}
                </Text>
                <InsigniaDeEstado estado={item.estado} />
              </View>

              <Switch
                value={tiene}
                onValueChange={(dar) => void alternar(item, dar)}
                disabled={moviendo !== null}
                trackColor={{ false: tema.borde, true: tema.oro }}
                thumbColor={tema.texto}
                accessibilityLabel={`${nombre}. ${tiene ? "El nutricionista lo ve" : "El nutricionista no lo ve"}`}
              />
            </View>
          )
        }}
        ListEmptyComponent={
          <Text style={estilos.vacio}>
            Todavía no tienes clientes que asignarle. Da de alta al primero desde tu cartera.
          </Text>
        }
      />
    </SafeAreaView>
  )
}

/** Devuelve un conjunto nuevo: React no repinta si le das el mismo objeto. */
function conCambio(previos: Set<string>, id: string, dentro: boolean): Set<string> {
  const siguiente = new Set(previos)

  if (dentro) {
    siguiente.add(id)
  } else {
    siguiente.delete(id)
  }

  return siguiente
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: tema.fondo },
  centrado: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tema.fondo,
    padding: 24,
  },
  cabecera: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  titulo: { color: tema.oro, fontSize: 16, fontWeight: "700", letterSpacing: 3 },
  volver: { color: tema.textoTenue, fontSize: 12, letterSpacing: 2 },
  ficha: {
    marginHorizontal: 20,
    marginTop: 4,
    padding: 16,
    backgroundColor: tema.superficie,
    borderColor: tema.borde,
    borderWidth: 1,
    borderRadius: 10,
    gap: 4,
  },
  nombreNutri: { color: tema.texto, fontSize: 18, fontWeight: "600" },
  correo: { color: tema.textoTenue, fontSize: 12 },
  detalle: { color: tema.textoTenue, fontSize: 12, marginTop: 8, lineHeight: 17 },
  aviso: { color: tema.texto, fontSize: 15, textAlign: "center" },
  error: { color: tema.error, fontSize: 13, textAlign: "center", marginTop: 12 },
  lista: { padding: 20, gap: 10 },
  fila: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: tema.superficie,
    borderColor: tema.borde,
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    gap: 12,
  },
  datos: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  nombre: { color: tema.texto, fontSize: 16, flexShrink: 1 },
  vacio: {
    color: tema.textoTenue,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginTop: 40,
  },
})
