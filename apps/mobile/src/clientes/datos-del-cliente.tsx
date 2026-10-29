import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useRef, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { z } from "zod"
import {
  CambiosDeUsuarioSchema,
  CorreoDeUsuarioSchema,
  type EstadoConsentimiento,
  type FichaDeUsuario,
} from "@alpha-omega/shared"

import {
  AvisoDeError,
  BotonDestructivo,
  BotonPrincipal,
  BotonSecundario,
  Campo,
  vibrar,
} from "../componentes/formulario"
import { Dialogo } from "../componentes/dialogo"
import { Esqueleto, GrupoEsqueletos } from "../componentes/esqueleto"
import { Hoja } from "../componentes/hoja"
import {
  ErrorDelServidor,
  corregirCorreo,
  desactivarUsuario,
  guardarUsuario,
  leerUsuario,
  reactivarUsuario,
  reenviarActivacion,
} from "../lib/api"
import { faltaDe, type Falta } from "../lib/errores"
import { useSesion } from "../sesion"
import { alto, espacio, radio, tema, tipo } from "../tema"
import { textoConsentimiento } from "./consentimiento"

function fechaIso(texto: string): string | null {
  if (texto === "") return null
  const partes = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto)
  return partes ? `${partes[3]}-${partes[2]}-${partes[1]}` : texto
}

const FormularioSchema = z
  .object({
    nombre: z.string(),
    apellidos: z.string(),
    email: z.string(),
    telefono: z.string(),
    nacimiento: z.string(),
    sexo: z.enum(["hombre", "mujer"]).nullable(),
  })
  .superRefine((valores, contexto) => {
    const cambios = CambiosDeUsuarioSchema.safeParse({
      nombre: valores.nombre,
      apellidos: valores.apellidos,
      telefono: valores.telefono,
      fechaNacimiento: fechaIso(valores.nacimiento),
      sexo: valores.sexo,
    })
    if (!cambios.success)
      for (const problema of cambios.error.issues)
        contexto.addIssue({
          code: "custom",
          path: [problema.path[0] === "fechaNacimiento" ? "nacimiento" : problema.path[0]!],
          message:
            problema.path[0] === "fechaNacimiento"
              ? "Escribe una fecha válida: dd/mm/aaaa"
              : problema.path[0] === "nombre"
                ? "Escribe su nombre (hasta 80 caracteres)"
                : problema.path[0] === "apellidos"
                  ? "Usa 120 caracteres o menos"
                  : problema.path[0] === "telefono" && problema.code === "too_big"
                    ? "Usa 30 caracteres o menos"
                    : problema.message,
        })
    if (!CorreoDeUsuarioSchema.safeParse({ email: valores.email }).success)
      contexto.addIssue({ code: "custom", path: ["email"], message: "Escribe un correo válido" })
  })
type Formulario = z.infer<typeof FormularioSchema>
type Confirmacion = "salir" | "correo" | "baja" | "reactivar" | null

export function DatosDelCliente({
  clienteId,
  visible = true,
  alCerrar,
  alActualizar,
  correoFallido,
  consentimiento = null,
  fichaInicial,
}: {
  clienteId: string
  visible?: boolean
  alCerrar: () => void
  alActualizar?: (ficha: FichaDeUsuario) => void
  correoFallido?: boolean
  consentimiento?: EstadoConsentimiento | null
  fichaInicial?: FichaDeUsuario
}): React.JSX.Element {
  const { estado, pedir, salir } = useSesion()
  const cuentaId = estado.fase === "dentro" ? estado.usuario.id : null
  const [ficha, fijarFicha] = useState<FichaDeUsuario | null>(null)
  const [cargando, fijarCargando] = useState(true)
  const [falta, fijarFalta] = useState<Falta | null>(null)
  const [aviso, fijarAviso] = useState<string | null>(null)
  const [activacionReenviada, fijarActivacionReenviada] = useState(false)
  const [ocupado, fijarOcupado] = useState(false)
  const enCurso = useRef(false)
  const [confirmacion, fijarConfirmacion] = useState<Confirmacion>(null)
  const [intento, fijarIntento] = useState(0)
  const {
    control,
    reset,
    handleSubmit,
    getValues,
    formState: { errors, isDirty, isValid },
  } = useForm<Formulario>({
    mode: "onChange",
    resolver: zodResolver(FormularioSchema),
    defaultValues: {
      nombre: "",
      apellidos: "",
      email: "",
      telefono: "",
      nacimiento: "",
      sexo: null,
    },
  })

  function asentar(nueva: FichaDeUsuario): void {
    fijarFicha(nueva)
    reset({
      nombre: nueva.nombre,
      apellidos: nueva.apellidos ?? "",
      email: nueva.email,
      telefono: nueva.telefono ?? "",
      nacimiento: nueva.fechaNacimiento?.split("-").reverse().join("/") ?? "",
      sexo: nueva.sexo ?? null,
    })
  }

  useEffect(() => {
    if (cuentaId === null) return
    let vigente = true
    fijarCargando(true)
    fijarFalta(null)
    fijarActivacionReenviada(false)
    const lectura =
      fichaInicial?.id === clienteId ? Promise.resolve(fichaInicial) : leerUsuario(pedir, clienteId)
    void lectura
      .then((nueva) => {
        if (vigente) asentar(nueva)
      })
      .catch((error: unknown) => {
        if (vigente)
          fijarFalta(
            error instanceof ErrorDelServidor && error.codigo === 404
              ? { texto: "Esta cuenta ya no existe.", reintentable: false, sesionCaducada: false }
              : faltaDe(error, "No hemos podido cargar la ficha."),
          )
      })
      .finally(() => {
        if (vigente) fijarCargando(false)
      })
    return () => {
      vigente = false
    }
    // Renovar el token o refrescar la ficha no debe pisar una edición abierta.
  }, [cuentaId, pedir, clienteId, intento])

  function cerrar(): void {
    if (enCurso.current) return
    if (isDirty) fijarConfirmacion("salir")
    else alCerrar()
  }

  async function ejecutar(accion: () => Promise<void>): Promise<void> {
    if (enCurso.current) return
    enCurso.current = true
    fijarOcupado(true)
    fijarFalta(null)
    fijarAviso(null)
    try {
      await accion()
    } catch (error) {
      fijarFalta(
        error instanceof ErrorDelServidor && error.codigo === 409
          ? {
              texto: "Ya existe una cuenta con ese correo.",
              reintentable: false,
              sesionCaducada: false,
            }
          : faltaDe(error, "No hemos podido guardar los cambios."),
      )
    } finally {
      enCurso.current = false
      fijarOcupado(false)
      fijarConfirmacion(null)
    }
  }

  async function guardar(valores: Formulario): Promise<void> {
    if (!ficha) return
    await ejecutar(async () => {
      let nueva = ficha
      const email = CorreoDeUsuarioSchema.parse({ email: valores.email }).email
      if (email !== ficha.email) {
        nueva = await corregirCorreo(pedir, clienteId, email)
        fijarFicha(nueva)
        alActualizar?.(nueva)
      }
      nueva = await guardarUsuario(
        pedir,
        clienteId,
        CambiosDeUsuarioSchema.parse({
          nombre: valores.nombre,
          apellidos: valores.apellidos === "" ? null : valores.apellidos,
          telefono: valores.telefono === "" ? null : valores.telefono,
          fechaNacimiento: fechaIso(valores.nacimiento),
          sexo: valores.sexo,
        }),
      )
      asentar(nueva)
      alActualizar?.(nueva)
      fijarAviso("Guardado")
    })
  }

  const enviar = handleSubmit((valores) => {
    if (ficha && CorreoDeUsuarioSchema.parse({ email: valores.email }).email !== ficha.email)
      fijarConfirmacion("correo")
    else return guardar(valores)
  })

  async function cambiarAcceso(): Promise<void> {
    const baja = confirmacion === "baja"
    await ejecutar(async () => {
      const nueva = await (baja ? desactivarUsuario : reactivarUsuario)(pedir, clienteId)
      fijarFicha(nueva)
      alActualizar?.(nueva)
      fijarAviso(baja ? "Dado de baja" : "Reactivado")
      if (baja) vibrar("aviso")
    })
  }

  function campo(
    nombre: "nombre" | "apellidos" | "email" | "telefono" | "nacimiento",
    etiqueta: string,
  ): React.JSX.Element {
    return (
      <Controller
        control={control}
        name={nombre}
        render={({ field: { value, onChange, onBlur } }) => (
          <Campo
            etiqueta={etiqueta}
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            error={errors[nombre]?.message}
            editable={!ocupado && (nombre !== "email" || ficha?.estado === "pendiente")}
            keyboardType={
              nombre === "email"
                ? "email-address"
                : nombre === "telefono"
                  ? "phone-pad"
                  : nombre === "nacimiento"
                    ? "numbers-and-punctuation"
                    : "default"
            }
            autoCapitalize={nombre === "email" ? "none" : "words"}
            autoCorrect={nombre !== "email"}
            placeholder={nombre === "nacimiento" ? "dd/mm/aaaa" : etiqueta}
          />
        )}
      />
    )
  }

  return (
    <>
      <Hoja visible={visible} alCerrar={cerrar} titulo="Datos del cliente">
        {cargando ? (
          <View
            accessibilityLabel="Cargando datos del cliente"
            accessibilityState={{ busy: true }}
            style={s.carga}
          >
            <GrupoEsqueletos>
              {[0, 1, 2, 3].map((n) => (
                <Esqueleto key={n} alto={alto.campo} />
              ))}
            </GrupoEsqueletos>
          </View>
        ) : ficha ? (
          <View style={s.contenido}>
            <View style={s.columnas}>
              <View style={s.columna}>{campo("nombre", "Nombre")}</View>
              <View style={s.columna}>{campo("apellidos", "Apellidos")}</View>
            </View>
            {campo("email", "Correo")}
            {ficha.estado !== "pendiente" && (
              <Text style={s.detalle}>
                El correo solo se puede cambiar mientras está pendiente de activar.
              </Text>
            )}
            {campo("telefono", "Teléfono")}
            {campo("nacimiento", "Nacimiento")}
            <Text style={s.etiqueta}>Sexo</Text>
            <Controller
              control={control}
              name="sexo"
              render={({ field: { value, onChange } }) => (
                <View style={s.columnas} accessibilityRole="radiogroup" accessibilityLabel="Sexo">
                  {(["hombre", "mujer"] as const).map((sexo) => (
                    <Pressable
                      key={sexo}
                      accessibilityRole="radio"
                      aria-checked={value === sexo}
                      accessibilityLabel={sexo === "hombre" ? "Hombre" : "Mujer"}
                      accessibilityState={{ checked: value === sexo, disabled: ocupado }}
                      disabled={ocupado}
                      onPress={() => onChange(value === sexo ? null : sexo)}
                      style={[s.opcion, value === sexo && s.elegida]}
                    >
                      <Text style={[s.textoOpcion, value === sexo && s.textoElegido]}>
                        {sexo === "hombre" ? "Hombre" : "Mujer"}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            />
            <View style={s.consentimiento}>
              <View style={s.columna}>
                <Text style={s.etiqueta}>Consentimiento de salud</Text>
                <Text style={s.detalle}>{textoConsentimiento(consentimiento)}</Text>
              </View>
              {consentimiento?.vigente && <Text style={s.vigente}>Vigente</Text>}
            </View>
            {falta && <AvisoDeError mensaje={falta.texto} />}
            {aviso && (
              <Text style={s.confirmado} accessibilityLiveRegion="polite">
                {aviso}
              </Text>
            )}
            {falta?.sesionCaducada && (
              <BotonSecundario texto="Volver a entrar" onPress={() => void salir()} />
            )}
            <BotonPrincipal
              texto="Guardar cambios"
              onPress={() => void enviar()}
              ocupado={ocupado}
              deshabilitado={!isDirty || !isValid || ocupado}
            />
            {ficha.estado === "activo" && (
              <BotonDestructivo
                texto="Dar de baja"
                deshabilitado={ocupado}
                onPress={() => fijarConfirmacion("baja")}
              />
            )}
            {ficha.estado === "pendiente" && (
              <>
                {correoFallido && !activacionReenviada && (
                  <AvisoDeError mensaje="No se pudo enviar el correo de activación. Vuelve a intentarlo." />
                )}
                <BotonSecundario
                  texto="Reenviar activación"
                  deshabilitado={ocupado}
                  onPress={() =>
                    void ejecutar(async () => {
                      const resultado = await reenviarActivacion(pedir, clienteId)
                      fijarFicha(resultado.usuario)
                      alActualizar?.(resultado.usuario)
                      if (resultado.correoEnviado) {
                        fijarActivacionReenviada(true)
                        fijarAviso("Enlace enviado. El anterior ya no vale.")
                      } else
                        fijarFalta({
                          texto:
                            "El enlace anterior ya no vale y el nuevo no ha salido. Vuelve a intentarlo.",
                          reintentable: false,
                          sesionCaducada: false,
                        })
                    })
                  }
                />
              </>
            )}
            {ficha.estado === "desactivado" && (
              <BotonSecundario
                texto="Reactivar"
                deshabilitado={ocupado}
                onPress={() => fijarConfirmacion("reactivar")}
              />
            )}
          </View>
        ) : (
          <View style={s.carga}>
            {falta && <AvisoDeError mensaje={falta.texto} />}
            {falta?.reintentable && (
              <BotonSecundario texto="Reintentar" onPress={() => fijarIntento((n) => n + 1)} />
            )}
            {falta?.sesionCaducada && (
              <BotonSecundario texto="Volver a entrar" onPress={() => void salir()} />
            )}
          </View>
        )}
      </Hoja>
      <Dialogo
        visible={confirmacion !== null}
        titulo={
          confirmacion === "salir"
            ? "¿Salir sin guardar?"
            : confirmacion === "correo"
              ? "¿Cambiar correo?"
              : confirmacion === "baja"
                ? "¿Dar de baja?"
                : "¿Reactivar?"
        }
        texto={
          confirmacion === "salir"
            ? "Se perderán los cambios de esta ficha."
            : confirmacion === "correo"
              ? `Usará ${getValues("email")}. El enlace anterior dejará de funcionar.`
              : confirmacion === "baja"
                ? "No podrá entrar. Conservarás todo su historial."
                : ficha?.tieneContrasena
                  ? "Volverá a estar activo y podrá entrar con su contraseña."
                  : "Volverá a estar pendiente de activar. Tendrás que reenviarle el enlace."
        }
        confirmar={
          confirmacion === "salir"
            ? "Salir sin guardar"
            : confirmacion === "correo"
              ? "Confirmar correo"
              : confirmacion === "baja"
                ? "Confirmar baja"
                : "Confirmar reactivación"
        }
        cancelar={confirmacion === "salir" ? "Seguir editando" : "Cancelar"}
        peligro={confirmacion === "salir" || confirmacion === "baja"}
        ocupado={ocupado}
        alCancelar={() => fijarConfirmacion(null)}
        alConfirmar={() => {
          if (confirmacion === "salir") {
            fijarConfirmacion(null)
            alCerrar()
          } else if (confirmacion === "correo") void handleSubmit(guardar)()
          else void cambiarAcceso()
        }}
      />
    </>
  )
}

const s = StyleSheet.create({
  contenido: { paddingBottom: espacio[4] },
  carga: { gap: espacio[16], paddingVertical: espacio[16] },
  columnas: { flexDirection: "row", gap: espacio[12] },
  columna: { flex: 1, minWidth: 0 },
  etiqueta: {
    ...tipo.cuerpo,
    fontFamily: tema.fuenteSemi,
    color: tema.texto,
    marginTop: espacio[16],
    marginBottom: espacio[8],
  },
  detalle: { ...tipo.secundario, color: tema.textoTenue, marginTop: espacio[8] },
  opcion: {
    flex: 1,
    height: alto.campo,
    borderRadius: radio.campo,
    borderWidth: 1,
    borderColor: tema.bordeFuerte,
    justifyContent: "center",
    alignItems: "center",
  },
  elegida: { backgroundColor: tema.acentoSuave, borderColor: tema.acento },
  textoOpcion: { ...tipo.cuerpo, fontFamily: tema.fuenteSemi, color: tema.texto },
  textoElegido: { color: tema.acento },
  consentimiento: {
    flexDirection: "row",
    gap: espacio[12],
    alignItems: "center",
    marginVertical: espacio[8],
  },
  vigente: {
    ...tipo.secundario,
    color: tema.exito,
    backgroundColor: tema.exitoSuave,
    borderRadius: radio.celda,
    padding: espacio[8],
  },
  confirmado: { ...tipo.cuerpo, color: tema.textoSecundario, marginTop: espacio[16] },
})
