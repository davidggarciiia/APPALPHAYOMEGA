import { zodResolver } from "@hookform/resolvers/zod"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useEffect, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { ActivityIndicator, StyleSheet, Text, View } from "react-native"
import {
  CambiosDeUsuarioSchema,
  CorreoDeUsuarioSchema,
  type CambiosDeUsuario,
  type FichaDeUsuario,
} from "@alpha-omega/shared"

import {
  AvisoDeError,
  BotonDestructivo,
  BotonPrincipal,
  BotonSecundario,
  Campo,
  PantallaDeFormulario,
} from "../../src/componentes/formulario"
import { InsigniaDeEstado } from "../../src/componentes/insignia-estado"
import {
  ErrorDelServidor,
  corregirCorreo,
  desactivarUsuario,
  guardarUsuario,
  leerUsuario,
  reactivarUsuario,
  reenviarActivacion,
} from "../../src/lib/api"
import { Pulsable } from "../../src/componentes/pulsable"
import { faltaDe, type Falta } from "../../src/lib/errores"
import { useSesion } from "../../src/sesion"
import { tema } from "../../src/tema"

type Fase = "cargando" | "listo" | "error"

/** En que parte de la pantalla se pinta la respuesta de lo ultimo que se hizo. */
type Zona = "identidad" | "datos" | "acceso"

const SIN_FALTA: Falta = { texto: "", reintentable: true, sesionCaducada: false }

/**
 * La ficha de una persona de la cartera: verla, corregirla y decidir si entra.
 *
 * Todo en una pantalla a proposito. Abrir la ficha de alguien y corregirle el
 * apellido son el mismo gesto, y separarlos obligaria a un toque mas para algo
 * que se hace de pie y con prisa.
 *
 * Las acciones que cambian el acceso viven abajo, separadas del formulario y con
 * botones distintos. Dar de baja con el mismo boton que guardar es pedir un
 * toque equivocado.
 */
export default function FichaDeCliente(): React.JSX.Element {
  const { estado: sesion, salir } = useSesion()
  const router = useRouter()
  const parametros = useLocalSearchParams<{
    id?: string | string[]
    correoFallido?: string
  }>()

  // El parametro llega de fuera: puede faltar, venir vacio o venir repetido en
  // la URL, y entonces expo-router entrega un array.
  const id = Array.isArray(parametros.id) ? parametros.id[0] : parametros.id

  const [fase, setFase] = useState<Fase>("cargando")
  const [ficha, setFicha] = useState<FichaDeUsuario | null>(null)
  const [falta, setFalta] = useState<Falta>(SIN_FALTA)
  const [aviso, setAviso] = useState<string | null>(null)
  const [zona, setZona] = useState<Zona>("datos")
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [confirmandoBaja, setConfirmandoBaja] = useState(false)
  const [correoNuevo, setCorreoNuevo] = useState<string | null>(null)
  const [intento, setIntento] = useState(0)

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CambiosDeUsuario>({
    resolver: zodResolver(CambiosDeUsuarioSchema),
    defaultValues: { nombre: "", apellidos: "", telefono: "", fechaNacimiento: null },
  })

  const tokenAcceso = sesion.fase === "dentro" ? sesion.tokenAcceso : null

  /** Deja la ficha y el formulario en el mismo estado que acaba de devolver la API. */
  function asentar(nueva: FichaDeUsuario): void {
    setFicha(nueva)
    // Los nulos del servidor se convierten en texto vacio: un campo de formulario
    // no sabe que hacer con null y React avisaria del cambio a controlado.
    reset({
      nombre: nueva.nombre,
      apellidos: nueva.apellidos ?? "",
      telefono: nueva.telefono ?? "",
      fechaNacimiento: nueva.fechaNacimiento,
    })
    setFase("listo")
  }

  useEffect(() => {
    if (tokenAcceso === null) return

    if (id === undefined || id === "") {
      setFalta({
        texto: "No sabemos de quién es esta ficha.",
        reintentable: false,
        sesionCaducada: false,
      })
      setFase("error")
      return
    }

    let vigente = true

    leerUsuario(tokenAcceso, id)
      .then((nueva) => {
        if (vigente) asentar(nueva)
      })
      .catch((error: unknown) => {
        if (!vigente) return

        setFalta(
          error instanceof ErrorDelServidor && error.codigo === 404
            ? { texto: "Esta cuenta ya no existe.", reintentable: false, sesionCaducada: false }
            : faltaDe(error, "No hemos podido cargar la ficha."),
        )
        setFase("error")
      })

    return () => {
      vigente = false
    }
    // Depende de a quien se mira, no de las funciones que usa por dentro.
  }, [tokenAcceso, id, intento])

  /**
   * Envuelve una accion de la ficha: ocupa el boton, cuenta lo que pasa y repinta.
   *
   * `zona` decide donde se pinta la respuesta. La pantalla es larga y el mensaje
   * de una accion de abajo no puede aparecer a media pagina: en la prueba manual,
   * el aviso de un reenvio fallido quedaba fuera de la vista de quien acababa de
   * pulsar el boton.
   */
  async function ejecutar(
    nombre: string,
    zona: Zona,
    accion: () => Promise<FichaDeUsuario>,
    exito: string,
  ): Promise<void> {
    setAviso(null)
    setFalta(SIN_FALTA)
    setZona(zona)
    setOcupado(nombre)

    try {
      asentar(await accion())
      setAviso(exito)
    } catch (error) {
      setFalta(faltaDe(error, "No hemos podido completar la acción."))
    } finally {
      setOcupado(null)
    }
  }

  const guardar = handleSubmit(async (cambios) => {
    if (tokenAcceso === null || id === undefined) return

    await ejecutar(
      "guardar",
      "datos",
      () =>
        // Lo que el formulario deja vacio se envia como nulo, que es como el
        // servidor entiende "esto ya no lo quiero".
        guardarUsuario(tokenAcceso, id, {
          nombre: cambios.nombre,
          apellidos: cambios.apellidos === "" ? null : cambios.apellidos,
          telefono: cambios.telefono === "" ? null : cambios.telefono,
          fechaNacimiento: cambios.fechaNacimiento === "" ? null : cambios.fechaNacimiento,
        }),
      "Guardado",
    )
  })

  /**
   * Vuelve a mandar el enlace.
   *
   * No usa `ejecutar` porque aqui hay un tercer desenlace, y es el que mas
   * importa: la peticion va bien pero el correo no sale. El enlace anterior ya
   * esta quemado en ese momento, asi que decir "hecho" dejaria a esa persona sin
   * ninguno valido y al entrenador convencido de lo contrario.
   */
  async function reenviar(): Promise<void> {
    if (tokenAcceso === null || id === undefined) return

    setAviso(null)
    setFalta(SIN_FALTA)
    setZona("acceso")
    setOcupado("reenviar")

    try {
      const resultado = await reenviarActivacion(tokenAcceso, id)
      asentar(resultado.usuario)

      if (resultado.correoEnviado) {
        router.setParams({ correoFallido: "0" })
        setAviso("Enlace enviado. El anterior ya no vale.")
      } else {
        setFalta({
          texto: "El enlace anterior ya no vale y el nuevo no ha salido. Vuelve a intentarlo.",
          reintentable: false,
          sesionCaducada: false,
        })
      }
    } catch (error) {
      setFalta(faltaDe(error, "No hemos podido reenviar el enlace."))
    } finally {
      setOcupado(null)
    }
  }

  async function guardarCorreo(): Promise<void> {
    if (tokenAcceso === null || id === undefined || correoNuevo === null) return

    const comprobado = CorreoDeUsuarioSchema.safeParse({ email: correoNuevo })
    setZona("identidad")

    if (!comprobado.success) {
      setFalta({ texto: "Ese correo no es válido.", reintentable: false, sesionCaducada: false })
      return
    }

    setAviso(null)
    setFalta(SIN_FALTA)
    setOcupado("correo")

    try {
      asentar(await corregirCorreo(tokenAcceso, id, comprobado.data.email))
      setCorreoNuevo(null)
      setAviso("Correo corregido. Envíale el enlace otra vez.")
    } catch (error) {
      setFalta(
        error instanceof ErrorDelServidor && error.codigo === 409
          ? {
              texto: "Ya existe una cuenta con ese correo.",
              reintentable: false,
              sesionCaducada: false,
            }
          : faltaDe(error, "No hemos podido cambiar el correo."),
      )
    } finally {
      setOcupado(null)
    }
  }

  if (fase === "cargando") {
    return (
      <View style={estilos.centrado}>
        <ActivityIndicator color={tema.oro} size="large" accessibilityLabel="Cargando la ficha" />
      </View>
    )
  }

  if (fase === "error" || ficha === null) {
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

        {falta.sesionCaducada && (
          <BotonSecundario texto="VOLVER A ENTRAR" onPress={() => void salir()} />
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

  const nombreCompleto = [ficha.nombre, ficha.apellidos].filter(Boolean).join(" ")
  const esPendiente = ficha.estado === "pendiente"
  const esBaja = ficha.estado === "desactivado"

  /**
   * Lo que salio de la ultima accion, pintado donde estaba el boton que la lanzo.
   *
   * La pantalla es larga: un mensaje a media pagina no lo ve quien acaba de
   * pulsar algo abajo del todo.
   */
  function Respuesta({ zona: suya }: { zona: Zona }): React.JSX.Element | null {
    if (zona !== suya) return null

    if (falta.texto !== "") return <AvisoDeError mensaje={falta.texto} />

    if (aviso !== null) {
      return (
        <Text style={estilos.confirmacion} accessibilityLiveRegion="polite">
          {aviso}
        </Text>
      )
    }

    return null
  }

  return (
    <PantallaDeFormulario>
      <View style={estilos.cabecera}>
        <View style={estilos.identidad}>
          <Text style={estilos.nombre}>{nombreCompleto}</Text>
          <Text style={estilos.rol}>{ficha.rol.toUpperCase()}</Text>
        </View>
        <InsigniaDeEstado estado={ficha.estado} />
      </View>

      <Text style={estilos.etiquetaFija}>CORREO</Text>
      <Text style={estilos.valorFijo}>{ficha.email}</Text>

      {esPendiente ? (
        correoNuevo === null ? (
          <>
            <Text style={estilos.detalle}>
              Todavía no ha activado la cuenta. Si te equivocaste al teclearlo, aún puedes
              corregirlo.
            </Text>
            <Pulsable
              onPress={() => {
                setCorreoNuevo(ficha.email)
              }}
              accessibilityRole="button"
              hitSlop={8}
            >
              <Text style={estilos.enlace}>CORREGIR CORREO</Text>
            </Pulsable>
          </>
        ) : (
          <>
            <Campo
              etiqueta="Corregir correo"
              value={correoNuevo}
              onChangeText={setCorreoNuevo}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
            />
            <BotonSecundario
              texto="GUARDAR CORREO"
              onPress={() => void guardarCorreo()}
              ocupado={ocupado === "correo"}
            />
            <Pulsable
              onPress={() => {
                setCorreoNuevo(null)
              }}
              accessibilityRole="button"
              hitSlop={8}
            >
              <Text style={estilos.enlace}>CANCELAR</Text>
            </Pulsable>
          </>
        )
      ) : (
        <Text style={estilos.detalle}>
          El correo ya no se cambia desde aquí: es con lo que entra en la aplicación.
        </Text>
      )}

      <Respuesta zona="identidad" />

      {parametros.correoFallido === "1" && esPendiente && (
        <AvisoDeError mensaje="La cuenta se ha creado, pero no se pudo enviar el correo de activación. Usa REENVIAR ENLACE para intentarlo de nuevo." />
      )}

      <Text style={estilos.etiquetaFija}>DADO DE ALTA</Text>
      <Text style={estilos.valorFijo}>{formatearFecha(ficha.creadoEn)}</Text>

      <View style={estilos.separador} />

      <Controller
        control={control}
        name="nombre"
        render={({ field: { onChange, onBlur, value } }) => (
          <Campo
            etiqueta="Nombre"
            value={value ?? ""}
            onChangeText={onChange}
            onBlur={onBlur}
            error={errors.nombre !== undefined ? "Escribe su nombre" : undefined}
          />
        )}
      />

      <Controller
        control={control}
        name="apellidos"
        render={({ field: { onChange, onBlur, value } }) => (
          <Campo
            etiqueta="Apellidos"
            value={value ?? ""}
            onChangeText={onChange}
            onBlur={onBlur}
            error={errors.apellidos?.message}
          />
        )}
      />

      <Controller
        control={control}
        name="telefono"
        render={({ field: { onChange, onBlur, value } }) => (
          <Campo
            etiqueta="Teléfono"
            value={value ?? ""}
            onChangeText={onChange}
            onBlur={onBlur}
            keyboardType="phone-pad"
            placeholder="+34 600 00 00 00"
            error={errors.telefono?.message}
          />
        )}
      />

      <Controller
        control={control}
        name="fechaNacimiento"
        render={({ field: { onChange, onBlur, value } }) => (
          <Campo
            etiqueta="Fecha de nacimiento"
            value={value ?? ""}
            onChangeText={(texto) => onChange(texto === "" ? null : texto)}
            onBlur={onBlur}
            keyboardType="numbers-and-punctuation"
            placeholder="AAAA-MM-DD"
            error={errors.fechaNacimiento?.message}
          />
        )}
      />

      <Respuesta zona="datos" />

      <BotonPrincipal
        texto="GUARDAR"
        onPress={() => void guardar()}
        ocupado={isSubmitting || ocupado === "guardar"}
      />

      {ficha.rol === "cliente" && (
        <>
          <View style={estilos.separador} />
          <Text style={estilos.etiquetaFija}>ENTRENAMIENTO</Text>
          <BotonSecundario
            texto="ENTRENOS Y PLANES"
            onPress={() =>
              router.push({
                pathname: "/entrenador/cliente/[id]/entrenos",
                params: { id: ficha.id, nombre: nombreCompleto },
              })
            }
          />
        </>
      )}

      <View style={estilos.separador} />
      <Text style={estilos.etiquetaFija}>ACCESO</Text>

      {esPendiente && (
        <>
          <Text style={estilos.detalle}>
            Aún no ha elegido contraseña. Puedes volver a enviarle el enlace: el anterior dejará de
            funcionar.
          </Text>
          <BotonSecundario
            texto="REENVIAR ENLACE"
            ocupado={ocupado === "reenviar"}
            onPress={() => void reenviar()}
          />
        </>
      )}

      {esBaja ? (
        <>
          <Text style={estilos.detalle}>
            {ficha.tieneContrasena
              ? "Está de baja. Si lo reactivas podrá entrar con su contraseña de siempre."
              : "Está de baja y nunca llegó a activar la cuenta. Si lo reactivas volverá a quedar pendiente y tendrás que enviarle un enlace nuevo."}
          </Text>
          <BotonSecundario
            texto="REACTIVAR"
            ocupado={ocupado === "reactivar"}
            onPress={() => {
              if (tokenAcceso === null || id === undefined) return
              void ejecutar(
                "reactivar",
                "acceso",
                () => reactivarUsuario(tokenAcceso, id),
                "Reactivado",
              )
            }}
          />
        </>
      ) : confirmandoBaja ? (
        <View style={estilos.panel} accessibilityLiveRegion="polite">
          <Text style={estilos.textoPanel}>
            {`Vas a dar de baja a ${nombreCompleto}. No podrá entrar y conservarás todo su historial.`}
          </Text>
          <BotonDestructivo
            texto="CONFIRMAR BAJA"
            ocupado={ocupado === "baja"}
            onPress={() => {
              if (tokenAcceso === null || id === undefined) return
              setConfirmandoBaja(false)
              void ejecutar(
                "baja",
                "acceso",
                () => desactivarUsuario(tokenAcceso, id),
                "Dado de baja",
              )
            }}
          />
          <BotonSecundario
            texto="CANCELAR"
            onPress={() => {
              setConfirmandoBaja(false)
            }}
          />
        </View>
      ) : (
        <>
          <Text style={estilos.detalle}>
            Dar de baja le impide entrar. No se borra nada: su historial se conserva entero.
          </Text>
          <BotonDestructivo
            texto="DAR DE BAJA"
            onPress={() => {
              setConfirmandoBaja(true)
            }}
          />
        </>
      )}

      <Respuesta zona="acceso" />

      <Pulsable
        style={estilos.volver}
        hitSlop={4}
        onPress={() => {
          router.back()
        }}
        accessibilityRole="button"
      >
        <Text style={estilos.textoVolver}>VOLVER A LA CARTERA</Text>
      </Pulsable>
    </PantallaDeFormulario>
  )
}

/** La fecha de alta, en como se escribe una fecha aquí. */
function formatearFecha(iso: string): string {
  const fecha = new Date(iso)

  return Number.isNaN(fecha.getTime())
    ? "—"
    : `${String(fecha.getDate()).padStart(2, "0")}/${String(fecha.getMonth() + 1).padStart(2, "0")}/${String(fecha.getFullYear())}`
}

const estilos = StyleSheet.create({
  centrado: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tema.fondo,
    padding: 24,
  },
  aviso: { color: tema.texto, fontSize: 15, textAlign: "center" },
  cabecera: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  identidad: { flex: 1, gap: 4 },
  nombre: { color: tema.texto, fontSize: 20, fontWeight: "600" },
  rol: { color: tema.textoTenue, fontSize: 11, letterSpacing: 2 },
  etiquetaFija: { color: tema.oroSuave, fontSize: 11, letterSpacing: 2, marginTop: 20 },
  valorFijo: { color: tema.texto, fontSize: 16, marginTop: 6 },
  detalle: { color: tema.textoTenue, fontSize: 12, marginTop: 8, lineHeight: 17 },
  enlace: {
    color: tema.oro,
    fontSize: 12,
    letterSpacing: 2,
    fontWeight: "700",
    marginTop: 12,
    paddingVertical: 6,
  },
  separador: { height: 1, backgroundColor: tema.borde, marginTop: 24 },
  confirmacion: { color: tema.oroSuave, fontSize: 14, textAlign: "center", marginTop: 16 },
  panel: {
    borderColor: tema.error,
    borderWidth: 1,
    borderRadius: 10,
    padding: 16,
    marginTop: 16,
  },
  textoPanel: { color: tema.texto, fontSize: 14, lineHeight: 20 },
  volver: { alignItems: "center", marginTop: 24, paddingVertical: 12 },
  textoVolver: { color: tema.textoTenue, fontSize: 12, letterSpacing: 2 },
})
