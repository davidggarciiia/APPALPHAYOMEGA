import { Image } from "react-native"
import Animated, { css, cubicBezier, Easing, FadeOut, ReduceMotion } from "react-native-reanimated"

import anillo from "../../assets/logo/anillo.png"
import emblema from "../../assets/logo/emblema.png"
import { useMovimientoReducido } from "../lib/movimiento"
import { tema } from "../tema"

/**
 * Lado del logo en pantalla, en puntos. Las capas se generan a este tamano con
 * `assets/logo/capas.py`; si cambia aqui, cambia alli.
 */
const TAMANO = 216

/** Salida fuerte: arranca deprisa, que es justo el momento que se esta mirando. */
const SALIDA = cubicBezier(0.23, 1, 0.32, 1)

/**
 * Lo que se espera antes de pintar nada. Sin sesion guardada la comprobacion
 * acaba en unos milisegundos, y un logo que asoma y se va en seguida es un
 * parpadeo. Si acaba antes de esto, se pasa del fondo negro a la pantalla sin
 * ver el logo.
 */
const ESPERA_MS = 200

/** Lo que tarda en entrar el logo. Por encima de 300 ms ya se nota lento. */
const ENTRADA_MS = 300

/**
 * Una vuelta del aro. Lo bastante lenta para leerse como un brillo que recorre
 * el metal y no como una rueda girando.
 */
const VUELTA_MS = 6000

/** Un latido del aro con movimiento reducido: de apagado a encendido. */
const LATIDO_MS = 1400

/**
 * La pantalla se retira fundiendose sobre la que llega, un 20 % mas rapido de lo
 * que tarda en entrar el logo: la llegada merece el tiempo, la salida no. El
 * fundido se mantiene con movimiento reducido, porque no desplaza nada.
 */
const SALIDA_DE_LA_PANTALLA = FadeOut.duration(240)
  .easing(Easing.bezier(0.23, 1, 0.32, 1))
  .reduceMotion(ReduceMotion.Never)

/** Nunca desde escala 0: nada en el mundo real aparece de la nada. */
const aparecerCreciendo = css.keyframes({
  from: { opacity: 0, transform: [{ scale: 0.96 }] },
  to: { opacity: 1, transform: [{ scale: 1 }] },
})

const aparecer = css.keyframes({
  from: { opacity: 0 },
  to: { opacity: 1 },
})

const girar = css.keyframes({
  from: { transform: [{ rotate: "0deg" }] },
  to: { transform: [{ rotate: "360deg" }] },
})

const latir = css.keyframes({
  from: { opacity: 0.55 },
  to: { opacity: 1 },
})

/**
 * Lo que se ve mientras se comprueba la sesion al abrir la app: el logo de Alpha
 * & Omega Training con su aro exterior girando.
 *
 * El logo va en dos capas, el aro grueso y el resto, generadas desde
 * `assets/logo/original.webp`. El aro es un circulo, asi que girarlo no cambia su
 * forma: lo que se mueve son sus brillos metalicos, que recorren el circulo como
 * si le diera la luz. Asi se ve que la app esta trabajando y no colgada sin
 * anadir nada al logo. El rayo toca el aro por dentro y lo sigue tocando mientras
 * gira.
 *
 * El logo entra una vez y el aro gira hasta que acaba la comprobacion; entonces la
 * pantalla se funde sobre la siguiente. Nunca alarga la espera: si la
 * comprobacion acaba a mitad de la entrada, se va igual.
 *
 * Todo son animaciones CSS de Reanimated sobre opacidad y transformaciones, que
 * corren en el hilo de la interfaz y no recalculan la maquetacion.
 *
 * Con movimiento reducido el logo solo aparece, sin crecer, y el aro no gira:
 * late suavemente.
 */
export function PantallaDeCarga(): React.JSX.Element {
  const movimientoReducido = useMovimientoReducido()

  return (
    <Animated.View
      style={estilos.pantalla}
      exiting={SALIDA_DE_LA_PANTALLA}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Comprobando tu sesión"
    >
      {/* Las dos capas entran juntas: si crecieran por separado, las puntas del
          rayo se despegarian del aro durante la entrada. */}
      <Animated.View
        style={[estilos.logo, movimientoReducido ? estilos.aparecer : estilos.aparecerCreciendo]}
      >
        <Animated.Image
          source={anillo}
          style={[estilos.capa, movimientoReducido ? estilos.latido : estilos.giro]}
          // Android funde por su cuenta cada imagen al cargarla, encima de la
          // entrada. Aqui la entrada ya la marca la animacion.
          fadeDuration={0}
        />
        <Image source={emblema} style={estilos.capa} fadeDuration={0} />
      </Animated.View>
    </Animated.View>
  )
}

const estilos = css.create({
  pantalla: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tema.fondo,
  },
  logo: { width: TAMANO, height: TAMANO },
  capa: { position: "absolute", top: 0, left: 0, width: TAMANO, height: TAMANO },
  aparecerCreciendo: {
    animationName: aparecerCreciendo,
    animationDuration: ENTRADA_MS,
    animationDelay: ESPERA_MS,
    animationTimingFunction: SALIDA,
    animationFillMode: "both",
  },
  aparecer: {
    animationName: aparecer,
    animationDuration: ENTRADA_MS,
    animationDelay: ESPERA_MS,
    animationTimingFunction: SALIDA,
    animationFillMode: "both",
  },
  // Movimiento constante: lineal. Con una curva el brillo frenaria y arrancaria
  // en cada vuelta.
  giro: {
    animationName: girar,
    animationDuration: VUELTA_MS,
    animationTimingFunction: "linear",
    animationIterationCount: "infinite",
  },
  latido: {
    animationName: latir,
    animationDuration: LATIDO_MS,
    animationTimingFunction: "ease-in-out",
    animationIterationCount: "infinite",
    animationDirection: "alternate",
  },
})
