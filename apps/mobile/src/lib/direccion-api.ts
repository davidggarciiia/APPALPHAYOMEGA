/**
 * De donde sale la direccion de la API y por que se comprueba.
 *
 * Las variables `EXPO_PUBLIC_*` no se leen en tiempo de ejecucion: Expo las
 * sustituye por su valor literal al construir el bundle. Es decir, **lo que haya
 * en el fichero de entorno de la maquina que compila queda escrito dentro del
 * binario que se publica**.
 *
 * Durante el desarrollo ese valor es la IP del ordenador en la wifi. Si alguien
 * compila para producción sin cambiarla, la app sale a las tiendas apuntando a
 * `192.168.1.x`: en el movil de un cliente ninguna peticion llega a ningun sitio,
 * y ademas cualquiera que abra el paquete ve la direccion privada de la red del
 * desarrollador.
 *
 * Las direcciones de produccion se fijan en `eas.json`, por perfil de compilacion.
 * Esta comprobacion es la red que avisa si aun asi se cuela una.
 */

import Constants from "expo-constants"

const RANGOS_PRIVADOS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
]

/** Puerto en el que escucha la API durante el desarrollo. */
const PUERTO_DE_DESARROLLO = 3000

export function direccionDeLaApi(): string {
  const configurada = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, "")

  // __DEV__ es false en cualquier compilacion de release, que es justo cuando
  // esto importa. En produccion la direccion SOLO sale del entorno.
  if (!__DEV__) {
    if (configurada === undefined || configurada === "") {
      throw new Error("Falta EXPO_PUBLIC_API_URL. Se fija por perfil en apps/mobile/eas.json.")
    }

    comprobarQueSirveParaProduccion(configurada)
    return configurada
  }

  // En desarrollo manda el servidor de Metro. El movil ya esta hablando con el,
  // asi que su direccion es, por definicion, la de este ordenador en la red de
  // ahora mismo. Antes esto salia de una IP escrita a mano en `.env`, y cada vez
  // que el router repartia otra, la app dejaba de conectar con un mensaje que
  // parecia un fallo del servidor.
  return anfitrionDeMetro() ?? configurada ?? `http://localhost:${String(PUERTO_DE_DESARROLLO)}`
}

/**
 * La direccion de este ordenador, tomada de quien sirve el codigo.
 *
 * `hostUri` viene como "192.168.1.25:8081" en un movil y como "localhost:8081"
 * en el navegador, y en los dos casos es exactamente el anfitrion al que hay
 * que pedirle la API.
 */
function anfitrionDeMetro(): string | null {
  const deLaConfiguracion = Constants.expoConfig?.hostUri
  const deExpoGo = Constants.expoGoConfig?.debuggerHost
  const origen = typeof deLaConfiguracion === "string" ? deLaConfiguracion : deExpoGo

  if (typeof origen !== "string" || origen === "") {
    return null
  }

  const anfitrion = origen.split(":")[0]

  return anfitrion === undefined || anfitrion === ""
    ? null
    : `http://${anfitrion}:${String(PUERTO_DE_DESARROLLO)}`
}

function comprobarQueSirveParaProduccion(direccion: string): void {
  let anfitrion: string
  try {
    anfitrion = new URL(direccion).hostname
  } catch {
    throw new Error(`EXPO_PUBLIC_API_URL no es una dirección válida: ${direccion}`)
  }

  if (!direccion.startsWith("https://")) {
    throw new Error(
      `La API de producción tiene que ir por https. Recibido: ${direccion}. ` +
        "Revisa el perfil de compilación en apps/mobile/eas.json.",
    )
  }

  if (RANGOS_PRIVADOS.some((rango) => rango.test(anfitrion))) {
    throw new Error(
      `EXPO_PUBLIC_API_URL apunta a una dirección de red local (${anfitrion}) en una ` +
        "compilación de producción. Eso saldría publicado en el binario. " +
        "Revisa el perfil en apps/mobile/eas.json.",
    )
  }
}
