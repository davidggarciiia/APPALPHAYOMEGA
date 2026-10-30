import { useRouter } from "expo-router"
import { StyleSheet, Text, View } from "react-native"
import { AvisoDeError, BotonSecundario } from "../componentes/formulario"
import { Esqueleto, GrupoEsqueletos } from "../componentes/esqueleto"
import { NovedadesEntrenamiento } from "../entrenamiento/novedades"
import { useEntrenamiento } from "../entrenamiento/use-entrenamiento"
import { AvisosSeguimiento } from "../seguimiento/valoraciones-novedades"
import { useValoraciones } from "../seguimiento/use-valoraciones"
import { useSesion } from "../sesion"
import { espacio, tema, tipo } from "../tema"
import { useNotificaciones } from "./contexto"
import { contadoresEntrenamiento } from "./cargar"

export function BandejaNotificaciones(): React.JSX.Element | null {
  const buzon = useNotificaciones()
  const { estado } = useSesion()
  const api = useEntrenamiento()
  const seguimiento = useValoraciones()
  const router = useRouter()
  if (!buzon || estado.fase !== "dentro") return null
  const modo = estado.usuario.rol === "entrenador" ? "entrenador" : "cliente"
  const visibles = buzon.clientes?.filter(
    (cliente) =>
      contadoresEntrenamiento(cliente.entrenamiento).total > 0 ||
      cliente.seguimiento.avisos.length > 0,
  )
  return (
    <View style={s.lista}>
      {buzon.error !== "" && (
        <>
          <AvisoDeError mensaje={buzon.error} />
          <BotonSecundario
            texto="Reintentar"
            etiquetaAccesible="Reintentar notificaciones"
            ocupado={buzon.cargando}
            onPress={buzon.recargar}
          />
        </>
      )}
      {buzon.clientes === null && buzon.cargando && (
        <GrupoEsqueletos>
          <View style={s.lista}>
            {[0, 1, 2].map((i) => (
              <Esqueleto key={i} alto={72} />
            ))}
          </View>
        </GrupoEsqueletos>
      )}
      {buzon.clientes !== null && visibles?.length === 0 && !buzon.error && (
        <Text style={tipo.secundario}>No tienes notificaciones.</Text>
      )}
      {visibles?.map((cliente) => (
        <View key={cliente.id} style={s.grupo}>
          {modo === "entrenador" && (
            <Text style={s.nombre} accessibilityRole="header">
              {cliente.nombre}
            </Text>
          )}
          <NovedadesEntrenamiento
            clienteId={cliente.id}
            api={api}
            inicial={cliente.entrenamiento}
            alLeer={(id) => buzon.confirmarEntrenamiento(cliente.id, id)}
            abrir={(id) =>
              router.push({
                pathname: "/entrenamiento/[id]",
                params: { id, ...(modo === "entrenador" ? { nombre: cliente.nombre } : {}) },
              })
            }
          />
          <AvisosSeguimiento
            clienteId={cliente.id}
            api={seguimiento}
            inicial={cliente.seguimiento}
            modo={modo}
            alLeer={(listado) => buzon.confirmarSeguimiento(cliente.id, listado)}
            abrir={() =>
              modo === "cliente"
                ? router.push("/progreso")
                : router.push({
                    pathname: "/entrenador/cliente/[id]",
                    params: { id: cliente.id, pestana: "progreso" },
                  })
            }
          />
        </View>
      ))}
    </View>
  )
}

const s = StyleSheet.create({
  lista: { gap: espacio[24] },
  grupo: { gap: espacio[12] },
  nombre: { ...tipo.fila, color: tema.texto },
})
