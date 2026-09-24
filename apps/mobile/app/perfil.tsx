import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "expo-router"
import { useEffect, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native"
import { CambiosDePerfilSchema, type CambiosDePerfil, type PerfilPropio } from "@alpha-omega/shared"
import {
  AvisoDeError,
  BotonPrincipal,
  BotonSecundario,
  Campo,
  PantallaDeFormulario,
} from "../src/componentes/formulario"
import { ErrorDeRed, guardarPerfil, leerPerfil } from "../src/lib/api"
import { useSesion } from "../src/sesion"
import { tema } from "../src/tema"

const campos = [
  { nombre: "nombre", etiqueta: "Nombre", teclado: "default", placeholder: "Tu nombre" },
  { nombre: "apellidos", etiqueta: "Apellidos", teclado: "default", placeholder: "Tus apellidos" },
  {
    nombre: "telefono",
    etiqueta: "Teléfono",
    teclado: "phone-pad",
    placeholder: "+34 600 00 00 00",
  },
  {
    nombre: "fechaNacimiento",
    etiqueta: "Fecha de nacimiento",
    teclado: "numbers-and-punctuation",
    placeholder: "AAAA-MM-DD",
  },
] as const
const datosEditables = (p: PerfilPropio): CambiosDePerfil => ({
  nombre: p.nombre,
  apellidos: p.apellidos ?? "",
  telefono: p.telefono ?? "",
  fechaNacimiento: p.fechaNacimiento,
})

export default function Perfil(): React.JSX.Element {
  const { estado, salir, pedir } = useSesion()
  const router = useRouter()
  const [perfil, setPerfil] = useState<PerfilPropio | null>(null)
  const [errorCarga, setErrorCarga] = useState(false)
  const [intento, setIntento] = useState(0)
  const [editando, setEditando] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CambiosDePerfil>({
    resolver: zodResolver(CambiosDePerfilSchema),
    defaultValues: { nombre: "", apellidos: "", telefono: "", fechaNacimiento: null },
  })
  const cuenta = estado.fase === "dentro" ? estado.usuario.id : null
  useEffect(() => {
    if (cuenta === null) return
    let vigente = true
    setErrorCarga(false)
    leerPerfil(pedir)
      .then((datos) => {
        if (!vigente) return
        setPerfil(datos)
        reset(datosEditables(datos))
      })
      .catch(() => {
        if (vigente) setErrorCarga(true)
      })
    return () => {
      vigente = false
    }
  }, [cuenta, pedir, intento, reset])

  const enviar = handleSubmit(async (cambios) => {
    if (cuenta === null) return
    setErrorGeneral(null)
    try {
      const actualizado = await guardarPerfil(pedir, {
        ...cambios,
        apellidos: cambios.apellidos === "" ? null : cambios.apellidos,
        telefono: cambios.telefono === "" ? null : cambios.telefono,
        fechaNacimiento: cambios.fechaNacimiento === "" ? null : cambios.fechaNacimiento,
      })
      setPerfil(actualizado)
      reset(datosEditables(actualizado))
      setEditando(false)
      setGuardado(true)
    } catch (error) {
      setErrorGeneral(
        error instanceof ErrorDeRed
          ? "No hemos podido conectar. Revisa tu conexión."
          : "No se han podido guardar los cambios. Tus datos siguen aquí; vuelve a guardar para reintentar.",
      )
    }
  })
  if (errorCarga)
    return (
      <PantallaDeFormulario>
        <AvisoDeError mensaje="No hemos podido cargar tu perfil. Comprueba tu conexión." />
        <BotonSecundario texto="Reintentar" onPress={() => setIntento((n) => n + 1)} />
      </PantallaDeFormulario>
    )
  if (!perfil)
    return (
      <View style={s.centrado}>
        <ActivityIndicator color={tema.acento} accessibilityLabel="Cargando tu perfil" />
      </View>
    )

  const nombreCompleto = [perfil.nombre, perfil.apellidos].filter(Boolean).join(" ")
  const iniciales =
    `${perfil.nombre.slice(0, 1)}${perfil.apellidos?.slice(0, 1) ?? ""}`.toUpperCase()
  const nacimiento = perfil.fechaNacimiento
    ? new Intl.DateTimeFormat("es-ES", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(`${perfil.fechaNacimiento}T00:00:00Z`))
    : "Sin completar"
  return (
    <PantallaDeFormulario sinTarjeta>
      <View style={s.contenido}>
        <View style={[s.tarjeta, s.identidad]}>
          <View style={s.avatar}>
            <Text style={s.iniciales}>{iniciales}</Text>
          </View>
          <View style={s.textos}>
            <Text accessibilityRole="header" style={s.nombre}>
              {nombreCompleto}
            </Text>
            <Text style={s.rol}>
              {perfil.rol} · {perfil.estado}
            </Text>
          </View>
        </View>
        <View style={s.tarjeta}>
          <Text style={s.etiqueta}>CORREO</Text>
          <Text style={s.valor}>{perfil.email}</Text>
          <Text style={s.ayuda}>Para cambiar tu correo, contacta con tu entrenador.</Text>
        </View>
        <View style={s.tarjeta}>
          <Text accessibilityRole="header" style={s.titulo}>
            Datos personales
          </Text>
          {editando ? (
            <>
              {campos.map((campo) => (
                <Controller
                  key={campo.nombre}
                  control={control}
                  name={campo.nombre}
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Campo
                      etiqueta={campo.etiqueta}
                      value={value ?? ""}
                      editable={!isSubmitting}
                      onChangeText={(texto) =>
                        onChange(campo.nombre === "fechaNacimiento" && texto === "" ? null : texto)
                      }
                      onBlur={onBlur}
                      keyboardType={campo.teclado}
                      placeholder={campo.placeholder}
                      error={errors[campo.nombre]?.message}
                    />
                  )}
                />
              ))}
              {errorGeneral && <AvisoDeError mensaje={errorGeneral} />}
              <BotonPrincipal
                texto="Guardar cambios"
                onPress={() => void enviar()}
                ocupado={isSubmitting}
              />
              <BotonSecundario
                texto="Cancelar"
                ocupado={isSubmitting}
                onPress={() => {
                  setEditando(false)
                  setErrorGeneral(null)
                  reset(datosEditables(perfil))
                }}
              />
            </>
          ) : (
            <>
              <Text style={s.etiqueta}>TELÉFONO</Text>
              <Text style={s.valor}>{perfil.telefono || "Sin completar"}</Text>
              <View style={s.separador} />
              <Text style={s.etiqueta}>FECHA DE NACIMIENTO</Text>
              <Text style={s.valor}>{nacimiento}</Text>
              <BotonSecundario
                texto="Editar datos personales"
                onPress={() => {
                  setEditando(true)
                  setGuardado(false)
                }}
              />
            </>
          )}
        </View>
        {guardado && (
          <Text style={s.confirmacion} accessibilityLiveRegion="polite">
            Datos guardados
          </Text>
        )}
        {perfil.rol === "cliente" && (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/entrenamiento")}
            style={[s.tarjeta, s.enlace]}
          >
            <Text style={s.titulo}>Mis entrenamientos</Text>
            <Text style={s.flecha}>›</Text>
          </Pressable>
        )}
        <BotonSecundario texto="Cerrar sesión" onPress={() => void salir()} />
        <Pressable accessibilityRole="button" onPress={() => router.replace("/")} style={s.volver}>
          <Text style={s.ayuda}>Volver al inicio</Text>
        </Pressable>
      </View>
    </PantallaDeFormulario>
  )
}
const s = StyleSheet.create({
  centrado: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tema.fondo,
  },
  contenido: { gap: 14 },
  tarjeta: {
    padding: 16,
    borderRadius: 18,
    borderColor: tema.borde,
    borderWidth: 1,
    backgroundColor: tema.superficie,
    gap: 8,
  },
  identidad: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: tema.acentoSuave,
    alignItems: "center",
    justifyContent: "center",
  },
  iniciales: { fontSize: 20, fontFamily: tema.fuenteBoton, color: tema.acento },
  textos: { flex: 1, gap: 4 },
  nombre: { fontSize: 20, fontFamily: tema.fuenteBoton, color: tema.texto },
  rol: {
    fontSize: 13,
    fontFamily: tema.fuenteTexto,
    color: tema.textoTenue,
    textTransform: "capitalize",
  },
  etiqueta: {
    color: tema.textoTenue,
    fontFamily: tema.fuenteBoton,
    fontSize: 11,
    letterSpacing: 1,
    marginTop: 8,
  },
  valor: { color: tema.texto, fontSize: 16, fontFamily: tema.fuenteTexto },
  ayuda: { color: tema.textoTenue, fontSize: 13, lineHeight: 18, fontFamily: tema.fuenteTexto },
  titulo: { color: tema.texto, fontSize: 15, fontFamily: tema.fuenteBoton },
  separador: { height: 1, backgroundColor: tema.borde, marginVertical: 6 },
  confirmacion: { color: tema.exito, fontFamily: tema.fuenteBoton, textAlign: "center" },
  enlace: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 52,
  },
  flecha: { fontFamily: tema.fuenteTexto, color: tema.textoTenue, fontSize: 24 },
  volver: { minHeight: 44, alignItems: "center", justifyContent: "center" },
})
