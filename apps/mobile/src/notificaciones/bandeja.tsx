import { useRouter, type Href } from "expo-router"
import { StyleSheet, Text, View } from "react-native"
import type { AvisoSeguimiento } from "@alpha-omega/shared"
import { AvisoDeError, BotonSecundario } from "../componentes/formulario"
import { Esqueleto, GrupoEsqueletos } from "../componentes/esqueleto"
import { NovedadesEntrenamiento } from "../entrenamiento/novedades"
import { useEntrenamiento } from "../entrenamiento/use-entrenamiento"
import { AvisosSeguimiento } from "../seguimiento/valoraciones-novedades"
import { useValoraciones } from "../seguimiento/use-valoraciones"
import { useSesion } from "../sesion"
import { EstadoVacio } from "../componentes/estado-vacio"
import { espacio, tema, tipo } from "../tema"
import { totalSinLeer, useNotificaciones } from "./contexto"
import { contadoresEntrenamiento } from "./cargar"

/** Lleva al cliente a la parte de Progreso a la que se refiere el aviso (lo lee la propia pantalla). */
function destinoEnProgreso(tipo: AvisoSeguimiento["tipo"]): Href {
  if (tipo === "fotosSolicitadas") return "/progreso?abrir=fotos"
  if (tipo === "valoracionPublicada" || tipo === "valoracionCorregida")
    return "/progreso?abrir=valoraciones"
  return "/progreso"
}

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
  const sinLeer = totalSinLeer(buzon.clientes)
  return (
    <View style={s.lista}>
      {sinLeer > 0 && (
        <BotonSecundario
          texto="Marcar todo como leído"
          etiquetaAccesible={`Marcar todo como leído, ${sinLeer} sin leer`}
          ocupado={buzon.marcando}
          onPress={() => void buzon.marcarTodoLeido()}
        />
      )}
      {buzon.errorMarcar !== "" && <AvisoDeError mensaje={buzon.errorMarcar} />}
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
        <EstadoVacio
          icono="notificaciones"
          titulo="Todo al día"
          texto={
            modo === "entrenador"
              ? "No tienes notificaciones. Aquí verás lo que envían tus clientes: entrenos, molestias y fotos."
              : "No tienes notificaciones. Aquí verás los avisos de tu entrenador: cambios de plan, valoraciones y fotos."
          }
        />
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
            abrir={(aviso) =>
              modo === "cliente"
                ? router.push(destinoEnProgreso(aviso.tipo))
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
