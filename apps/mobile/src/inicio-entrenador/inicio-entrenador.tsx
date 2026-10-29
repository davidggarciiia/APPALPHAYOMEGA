import { useCallback, useState } from "react"
import { useFocusEffect, type Href } from "expo-router"
import { StyleSheet, Text, View } from "react-native"

import { EntradaMarca } from "../componentes/entrada-marca"
import { Esqueleto, GrupoEsqueletos } from "../componentes/esqueleto"
import { Icono, type NombreIcono } from "../componentes/iconos"
import { Pulsable } from "../componentes/pulsable"
import { listarUsuarios } from "../lib/api"
import type { PeticionAutenticada } from "../lib/peticion-autenticada"
import { espacio, radio, tema, tipo } from "../tema"

const ACCESOS: ReadonlyArray<{ nombre: string; ruta: Href; icono: NombreIcono }> = [
  { nombre: "Mis rutinas", ruta: "/rutinas", icono: "entreno" },
  { nombre: "Ejercicios", ruta: "/catalogo", icono: "ejercicios" },
  { nombre: "Nutricionista", ruta: "/nutricionista", icono: "nutricion" },
  { nombre: "Mi perfil", ruta: "/perfil", icono: "perfil" },
]

export function InicioEntrenador({
  nombre,
  pedir,
  abrir,
}: {
  nombre: string
  pedir: PeticionAutenticada
  abrir: (ruta: Href) => void
}): React.JSX.Element {
  const [cargando, setCargando] = useState(true)
  const [cifras, setCifras] = useState<{ activos: number; pendientes: number } | null>(null)
  useFocusEffect(
    useCallback(() => {
      let vigente = true
      setCargando(true)
      setCifras(null)
      Promise.all([
        listarUsuarios(pedir, { rol: "cliente", estado: "activo", limite: 1, desde: 0 }),
        listarUsuarios(pedir, { rol: "cliente", estado: "pendiente", limite: 1, desde: 0 }),
      ])
        .then(([activos, pendientes]) => {
          if (vigente) setCifras({ activos: activos.total, pendientes: pendientes.total })
        })
        .catch(() => undefined)
        .finally(() => {
          if (vigente) setCargando(false)
        })
      return () => {
        vigente = false
      }
    }, [pedir]),
  )

  return (
    <EntradaMarca style={s.contenido}>
      <View style={s.saludo}>
        <Text style={s.micro}>Tu espacio de trabajo</Text>
        <Text style={s.nombre} accessibilityRole="header">
          Hola, {nombre}
        </Text>
      </View>
      <Pulsable
        style={[s.tarjeta, s.clientes]}
        accessibilityLabel="Mis clientes"
        accessibilityState={{ busy: cargando }}
        accessibilityValue={{
          text: cifras
            ? `${cifras.activos} activos. ${cifras.pendientes} pendientes de activar.`
            : undefined,
        }}
        onPress={() => abrir("/cartera")}
      >
        <View style={s.cabecera}>
          <Text style={s.titulo}>MIS CLIENTES</Text>
          <Icono nombre="adelante" color={tema.acento} />
        </View>
        {cargando ? (
          <View
            accessibilityLabel="Cargando cifras de clientes"
            accessibilityState={{ busy: true }}
          >
            <GrupoEsqueletos>
              <View style={s.cifras}>
                <Esqueleto ancho="40%" alto={54} />
                <Esqueleto ancho="46%" alto={54} />
              </View>
            </GrupoEsqueletos>
          </View>
        ) : (
          cifras && (
            <View style={s.cifras}>
              <View style={s.cifra}>
                <Text style={s.numero}>{cifras.activos}</Text>
                <Text style={s.etiqueta}>activos</Text>
              </View>
              <View style={s.cifra}>
                <Text style={s.numero}>{cifras.pendientes}</Text>
                <Text style={s.etiqueta}>pendientes de activar</Text>
              </View>
            </View>
          )
        )}
      </Pulsable>
      <View style={s.rejilla}>
        {[0, 2].map((inicio) => (
          <View key={inicio} style={s.fila}>
            {ACCESOS.slice(inicio, inicio + 2).map((acceso) => (
              <Pulsable
                key={acceso.nombre}
                style={[s.tarjeta, s.acceso]}
                accessibilityLabel={acceso.nombre}
                onPress={() => abrir(acceso.ruta)}
              >
                <Icono nombre={acceso.icono} color={tema.acento} tamano={28} />
                <Text style={s.textoAcceso} numberOfLines={1}>
                  {acceso.nombre}
                </Text>
              </Pulsable>
            ))}
          </View>
        ))}
      </View>
    </EntradaMarca>
  )
}

const s = StyleSheet.create({
  contenido: { gap: espacio[28] },
  saludo: { gap: espacio[8] },
  micro: { ...tipo.micro, color: tema.textoTenue },
  nombre: { ...tipo.tituloPantalla, color: tema.texto },
  tarjeta: { backgroundColor: tema.superficie, borderRadius: radio.tarjeta, padding: espacio[16] },
  clientes: { borderWidth: 1, borderColor: tema.bordeDestacado, gap: espacio[20] },
  cabecera: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  titulo: { ...tipo.titulo, color: tema.texto },
  cifras: { flexDirection: "row", gap: espacio[20] },
  cifra: { flex: 1, gap: espacio[4] },
  numero: { ...tipo.tituloPantalla, ...tipo.cifras, color: tema.acento },
  etiqueta: { ...tipo.secundario },
  rejilla: { gap: espacio[12] },
  fila: { flexDirection: "row", gap: espacio[12] },
  acceso: {
    flex: 1,
    minWidth: 0,
    minHeight: 128,
    justifyContent: "space-between",
    gap: espacio[20],
  },
  textoAcceso: { ...tipo.fila, color: tema.texto },
})
