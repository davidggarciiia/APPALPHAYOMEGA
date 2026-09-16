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

const RANGOS_PRIVADOS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
]

export function direccionDeLaApi(): string {
  const configurada = process.env.EXPO_PUBLIC_API_URL

  if (configurada === undefined || configurada === "") {
    throw new Error("Falta EXPO_PUBLIC_API_URL. Copia apps/mobile/.env.example a apps/mobile/.env.")
  }

  const limpia = configurada.replace(/\/+$/, "")

  // __DEV__ es false en cualquier compilacion de release, que es justo cuando
  // esto importa. En desarrollo apuntar a una IP privada es lo normal.
  if (!__DEV__) {
    comprobarQueSirveParaProduccion(limpia)
  }

  return limpia
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
