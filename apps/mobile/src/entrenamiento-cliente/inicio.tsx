import { useRouter } from "expo-router"
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native"
import { hoyEn, lunesDe } from "@alpha-omega/shared"

import {
  BotonOro,
  BotonSobrio,
  EnlaceOro,
  MarcaDeEstado,
  Pantalla,
  Tarjeta,
  texto,
} from "../componentes/diseno"
import { AvisoSinConexion, Saludo, SeccionCuenta } from "../componentes/inicio-comun"
import { TiraDeSemana } from "../componentes/tira-de-semana"
import { conMayuscula, fechaLarga } from "../lib/fechas"
import { fuentes, tema } from "../tema"

import { destacadoDe, type Destacado } from "./destacado"
import { marcasDe } from "./semana"
import { useSemana } from "./use-semana"

function Atrasadas({ cuantas }: { cuantas: number }): React.JSX.Element | null {
  if (cuantas === 0) {
    return null
  }
  return (
    <Text style={texto.tenueGrande}>
      {cuantas === 1
        ? "Te queda 1 entreno de esta semana sin enviar."
        : `Te quedan ${String(cuantas)} entrenos de esta semana sin enviar.`}
    </Text>
  )
}

/**
 * El inicio del cliente, como Main.dc.html: saludo, «Hoy toca» y la semana.
 */
export function InicioDelCliente(): React.JSX.Element {
  const router = useRouter()
  const hoy = hoyEn()
  const lunes = lunesDe(hoy)
  const { carga, refrescando, refrescar } = useSemana(lunes)
  const abrir = (id: string): void => router.push({ pathname: "/entrenos/[id]", params: { id } })

  return (
    <Pantalla>
      <ScrollView
        contentContainerStyle={estilos.contenido}
        refreshControl={
          <RefreshControl
            refreshing={refrescando}
            onRefresh={refrescar}
            tintColor={tema.oro}
            colors={[tema.oro]}
          />
        }
      >
        <Saludo />
        <AvisoSinConexion />

        {carga.fase === "cargando" && (
          <Tarjeta destacada style={estilos.tarjetaHoy}>
            <ActivityIndicator color={tema.oro} accessibilityLabel="Cargando tu semana" />
          </Tarjeta>
        )}

        {carga.fase === "error" && (
          <Tarjeta destacada style={estilos.tarjetaHoy}>
            <Text style={texto.cuerpo}>{carga.falta.texto}</Text>
            {carga.falta.reintentable && <BotonSobrio texto="Reintentar" onPress={refrescar} />}
          </Tarjeta>
        )}

        {carga.fase === "lista" && (
          <TarjetaDeHoy destacado={destacadoDe(carga.filas, hoy)} abrir={abrir} />
        )}

        <View style={estilos.seccion}>
          <Text style={texto.seccion}>Esta semana</Text>
          <TiraDeSemana
            lunes={lunes}
            hoy={hoy}
            marcas={marcasDe(carga.fase === "lista" ? carga.filas : [])}
          />
          <EnlaceOro texto="Ver mis entrenos" onPress={() => router.push("/entrenos")} />
        </View>

        <SeccionCuenta />
      </ScrollView>
    </Pantalla>
  )
}

function TarjetaDeHoy({
  destacado,
  abrir,
}: {
  destacado: Destacado
  abrir: (id: string) => void
}): React.JSX.Element {
  if (destacado.tipo === "descanso") {
    return (
      <Tarjeta destacada style={estilos.tarjetaHoy}>
        <Text style={estilos.antetitulo}>Hoy descansas</Text>
        {destacado.atrasadas === 0 ? (
          <Text style={texto.tenueGrande}>No tienes más entrenos esta semana.</Text>
        ) : (
          <Atrasadas cuantas={destacado.atrasadas} />
        )}
      </Tarjeta>
    )
  }

  const { fila } = destacado
  if (destacado.tipo === "hecho") {
    return (
      <Tarjeta destacada style={estilos.tarjetaHoy}>
        <View style={estilos.hecho}>
          <MarcaDeEstado estado="hecho" tamano={32} />
          <Text style={estilos.textoHecho}>Hecho hoy</Text>
        </View>
        <Text style={estilos.nombre}>{fila.nombre}</Text>
        <Atrasadas cuantas={destacado.atrasadas} />
        <BotonSobrio texto="Ver resultado" onPress={() => abrir(fila.agenda.id)} />
      </Tarjeta>
    )
  }

  const esHoy = destacado.tipo === "hoy"
  return (
    <Tarjeta destacada style={estilos.tarjetaHoy}>
      <Text style={estilos.antetitulo}>{esHoy ? "Hoy toca:" : "Próximo:"}</Text>
      <Text style={estilos.nombre}>{fila.nombre}</Text>
      <Text style={[texto.tenueGrande, estilos.fecha]}>
        {conMayuscula(fechaLarga(fila.agenda.fechaActual))}
      </Text>
      {esHoy ? (
        <BotonOro
          texto={fila.enCurso ? "Seguir entreno" : "Empezar entreno"}
          onPress={() => abrir(fila.agenda.id)}
        />
      ) : (
        <BotonSobrio texto="Ver entreno" onPress={() => abrir(fila.agenda.id)} />
      )}
    </Tarjeta>
  )
}

const estilos = StyleSheet.create({
  contenido: { padding: 20, paddingBottom: 48, gap: 32 },
  tarjetaHoy: { padding: 24, gap: 12, minHeight: 120, justifyContent: "center" },
  antetitulo: {
    color: tema.oro,
    fontFamily: fuentes.titulo,
    fontSize: 44,
    lineHeight: 50,
    textTransform: "uppercase",
  },
  nombre: {
    color: tema.texto,
    fontFamily: fuentes.titulo,
    fontSize: 40,
    lineHeight: 46,
    textTransform: "uppercase",
  },
  fecha: { marginBottom: 8 },
  hecho: { flexDirection: "row", alignItems: "center", gap: 10 },
  textoHecho: { color: tema.verdeClaro, fontFamily: fuentes.negrita, fontSize: 17 },
  seccion: { gap: 16 },
})
