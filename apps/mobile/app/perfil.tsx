import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "expo-router"
import { useEffect, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { CambiosDePerfilSchema, type CambiosDePerfil, type PerfilPropio } from "@alpha-omega/shared"
import {
  AvisoDeError,
  BotonEnlace,
  BotonPrincipal,
  BotonSecundario,
  Campo,
  PantallaDeFormulario,
} from "../src/componentes/formulario"
import { Esqueleto, GrupoEsqueletos } from "../src/componentes/esqueleto"
import { Icono } from "../src/componentes/iconos"
import { TarjetaConsentimiento } from "../src/consentimiento"
import { ErrorDeRed, guardarPerfil, leerPerfil } from "../src/lib/api"
import { useSesion } from "../src/sesion"
import { alto, espacio, radio, tema, tipo } from "../src/tema"

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
  const volver = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Volver"
      onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
      style={s.volver}
    >
      <Icono nombre="atras" color={tema.texto} />
    </Pressable>
  )
  if (errorCarga)
    return (
      <PantallaDeFormulario sinTarjeta>
        <View style={s.contenido}>
          {volver}
          <AvisoDeError mensaje="No hemos podido cargar tu perfil. Comprueba tu conexión." />
          <BotonSecundario texto="Reintentar" onPress={() => setIntento((n) => n + 1)} />
        </View>
      </PantallaDeFormulario>
    )
  if (!perfil)
    return (
      <PantallaDeFormulario sinTarjeta>
        <View style={s.contenido}>
          {volver}
          <View
            accessible
            accessibilityLabel="Cargando tu perfil"
            accessibilityState={{ busy: true }}
          >
            <GrupoEsqueletos>
              <View style={s.contenido}>
                <Esqueleto alto={112} radio={radio.tarjeta} />
                <Esqueleto alto={80} radio={radio.tarjeta} />
                <Esqueleto alto={216} radio={radio.tarjeta} />
              </View>
            </GrupoEsqueletos>
          </View>
        </View>
      </PantallaDeFormulario>
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
        {volver}
        <View style={s.contenido}>
          <View style={[s.tarjeta, s.identidad]}>
            <View style={s.avatar}>
              <Text style={s.iniciales}>{iniciales}</Text>
            </View>
            <View style={s.textos}>
              <Text accessibilityRole="header" style={s.nombre}>
                {nombreCompleto}
              </Text>
              <View style={s.insignias}>
                <Text style={s.insignia}>{perfil.rol}</Text>
                <Text style={[s.insignia, perfil.estado === "activo" && s.activo]}>
                  {perfil.estado}
                </Text>
              </View>
            </View>
          </View>
          <View style={s.tarjeta}>
            <Text style={s.etiqueta}>CORREO</Text>
            <Text style={s.valor}>{perfil.email}</Text>
          </View>
        </View>
        <View style={s.contenido}>
          <View style={s.tarjeta}>
            <View style={s.cabeceraDatos}>
              <Text accessibilityRole="header" style={s.titulo}>
                Datos personales
              </Text>
              {!editando && (
                <BotonEnlace
                  texto="Editar"
                  etiquetaAccesible="Editar datos personales"
                  onPress={() => {
                    setEditando(true)
                    setGuardado(false)
                  }}
                />
              )}
            </View>
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
                          onChange(
                            campo.nombre === "fechaNacimiento" && texto === "" ? null : texto,
                          )
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
              </>
            )}
          </View>
          {guardado && (
            <Text style={s.confirmacion} accessibilityLiveRegion="polite">
              Datos guardados
            </Text>
          )}
          {perfil.rol === "cliente" && <TarjetaConsentimiento />}
          <BotonSecundario texto="Cerrar sesión" onPress={() => void salir()} />
        </View>
      </View>
    </PantallaDeFormulario>
  )
}
const s = StyleSheet.create({
  contenido: { gap: espacio[24] },
  tarjeta: {
    padding: espacio[16],
    borderRadius: radio.tarjeta,
    borderColor: tema.borde,
    borderWidth: 1,
    backgroundColor: tema.superficie,
    gap: espacio[8],
  },
  identidad: { flexDirection: "row", alignItems: "center", gap: espacio[16] },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 16,
    backgroundColor: tema.acentoSuave,
    alignItems: "center",
    justifyContent: "center",
  },
  iniciales: { fontSize: 24, fontFamily: tema.fuenteBoton, color: tema.acento },
  textos: { flex: 1, gap: espacio[8] },
  nombre: {
    fontSize: 28,
    lineHeight: 32,
    fontFamily: tema.fuenteTitulo,
    color: tema.texto,
    textTransform: "uppercase",
  },
  insignias: { flexDirection: "row", flexWrap: "wrap", gap: espacio[8] },
  insignia: {
    ...tipo.secundario,
    color: tema.textoTenue,
    backgroundColor: tema.superficieAlta,
    borderRadius: radio.pastilla,
    paddingVertical: espacio[4],
    paddingHorizontal: espacio[8],
    textTransform: "capitalize",
  },
  activo: { color: tema.exito, backgroundColor: tema.exitoSuave },
  etiqueta: {
    color: tema.textoTenue,
    fontFamily: tema.fuenteBoton,
    fontSize: 11,
    letterSpacing: 1,
    marginTop: 8,
  },
  valor: { color: tema.texto, fontSize: 16, fontFamily: tema.fuenteTexto },
  titulo: { color: tema.texto, fontSize: 15, fontFamily: tema.fuenteBoton },
  cabeceraDatos: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: espacio[12],
  },
  separador: { height: 1, backgroundColor: tema.borde, marginVertical: 6 },
  confirmacion: { color: tema.exito, fontFamily: tema.fuenteBoton, textAlign: "center" },
  volver: {
    width: alto.tactil,
    minHeight: alto.tactil,
    alignItems: "center",
    justifyContent: "center",
  },
})
