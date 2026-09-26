import * as SplashScreen from "expo-splash-screen"
import { useEffect, useState, type ComponentType } from "react"
import Animated, {
  css,
  cubicBezier,
  type CSSAnimationKeyframes,
  type CSSAnimationProperties,
} from "react-native-reanimated"
import Svg, {
  Defs,
  LinearGradient,
  Path,
  Stop,
  type LinearGradientProps,
  type PathProps,
} from "react-native-svg"

import { useMovimientoReducido } from "../lib/movimiento"
import { tema } from "../tema"
import { AROS, CANTOS, CONTORNOS, LETRAS, RELLENOS } from "./logo/trazos"

/** Lo que se anima de un elemento SVG. */
type PropsAnimables = {
  opacity?: number
  strokeDashoffset?: number
  x1?: number
  y1?: number
  x2?: number
  y2?: number
}
type Fotogramas = CSSAnimationKeyframes<PropsAnimables>
type Animacion = CSSAnimationProperties<PropsAnimables>

/**
 * Reanimated lee las animaciones CSS del `style` de cualquier componente
 * animado, tambien de los de SVG. Los tipos de react-native-svg no declaran
 * `style` en estos elementos, asi que se anade aqui.
 *
 * Los fotogramas van como objetos y no con `css.keyframes`: esa funcion los
 * procesa una sola vez como estilos de vista y en web descarta las propiedades
 * SVG, como `strokeDashoffset`. Como objeto, Reanimated los procesa para el
 * elemento que los usa.
 */
type ConAnimacion<P> = P & { style?: Animacion }
const RutaAnimada = Animated.createAnimatedComponent(Path) as unknown as ComponentType<
  ConAnimacion<PathProps>
>
const DegradadoAnimado = Animated.createAnimatedComponent(
  LinearGradient,
) as unknown as ComponentType<ConAnimacion<LinearGradientProps>>

/** Lado del logo en pantalla, en puntos. */
const TAMANO = 240

/** Salida fuerte: para lo que aparece y lo que se va. */
const SALIDA = cubicBezier(0.23, 1, 0.32, 1)
/** Entrada y salida fuertes: para lo que se dibuja y lo que cruza la pantalla. */
const DENTRO_Y_FUERA = cubicBezier(0.77, 0, 0.175, 1)

/**
 * Lo que dura la animacion entera: aros, emblema, letras y el brillo. La
 * pantalla no se retira antes aunque la sesion este comprobada, para que el logo
 * se vea completo al abrir la app.
 */
const DURACION_MS = 1500
/** Con movimiento reducido solo hay un fundido; basta con dejar leer el logo. */
const DURACION_REDUCIDA_MS = 700
/**
 * Lo que tarda en fundirse sobre la pantalla que llega. Se mantiene con
 * movimiento reducido, porque no desplaza nada.
 */
const SALIDA_MS = 240

/**
 * Oro metalico: bandas de luz y sombra en diagonal sobre todo el logo. La forma
 * es la del logo original; el color se ha redibujado limpio.
 */
const ORO: readonly [number, string][] = [
  [0, "#f6e4a0"],
  [0.2, "#cfa136"],
  [0.38, "#f1d57e"],
  [0.55, "#b98b26"],
  [0.72, "#e6c463"],
  [0.88, "#a47b1d"],
  [1, "#d4ae52"],
]

// Todo se construye una vez, fuera del componente.

const aparecer: Fotogramas = { from: { opacity: 0 }, to: { opacity: 1 } }
const apagar: Fotogramas = { to: { opacity: 0 } }

/** Un trazado se dibuja desde su principio (sentido 1) o desde su final (-1). */
function dibujar(largo: number, sentido: 1 | -1): Fotogramas {
  return { from: { strokeDashoffset: largo * sentido }, to: { strokeDashoffset: 0 } }
}

/**
 * 1. Los aros se trazan desde arriba. El grueso y el fino interior en el
 *    sentido del reloj; el fino exterior al contrario.
 */
const SENTIDO_DE_LOS_AROS: readonly (1 | -1)[] = [1, -1, 1]
const RETRASO_DE_LOS_AROS = [0, 60, 120]
const DURACION_DE_LOS_AROS = [600, 540, 540]
const trazarAros: Animacion[] = AROS.map((aro, i) => ({
  animationName: dibujar(aro.largo, SENTIDO_DE_LOS_AROS[i] ?? 1),
  animationDuration: DURACION_DE_LOS_AROS[i] ?? 600,
  animationDelay: RETRASO_DE_LOS_AROS[i] ?? 0,
  animationTimingFunction: DENTRO_Y_FUERA,
  animationFillMode: "both",
}))

/** 2. El contorno del emblema se dibuja y se apaga cuando llega el relleno. */
const trazarContornos: Animacion[] = CONTORNOS.map((contorno) => ({
  animationName: [dibujar(contorno.largo, 1), apagar],
  animationDuration: [600, 300],
  animationDelay: [120, 620],
  animationTimingFunction: [DENTRO_Y_FUERA, SALIDA],
  animationFillMode: ["both", "forwards"],
}))

/** 3. El emblema se llena de oro, y con el los cantos del rayo. */
const rellenar: Animacion = {
  animationName: aparecer,
  animationDuration: 300,
  animationDelay: 620,
  animationTimingFunction: SALIDA,
  animationFillMode: "both",
}

/** 4. TRAINING, letra a letra. */
const escribirLetras: Animacion[] = LETRAS.map((_, i) => ({
  animationName: aparecer,
  animationDuration: 280,
  animationDelay: 700 + i * 30,
  animationTimingFunction: SALIDA,
  animationFillMode: "both",
}))

/**
 * 5. Una banda de luz cruza el logo en diagonal una sola vez. Es un degradado
 *    cuyas coordenadas se mueven: la luz solo cae donde hay oro.
 */
const cruzar: Animacion = {
  animationName: {
    from: { x1: -1300, y1: -1300, x2: -1088, y2: -1088 },
    to: { x1: 700, y1: 700, x2: 912, y2: 912 },
  },
  animationDuration: 600,
  animationDelay: 900,
  animationTimingFunction: DENTRO_Y_FUERA,
  animationFillMode: "both",
}

/**
 * 6. Si la app sigue cargando, un destello recorre el aro grueso. Son dos
 *    tramos de luz, uno ancho y tenue y otro corto y vivo centrado en el, para
 *    que no tenga bordes duros.
 */
const [GRUESO] = AROS
const LARGO_DEL_GRUESO = GRUESO?.largo ?? 0
function recorrer(desfase: number): Animacion {
  return {
    animationName: [
      aparecer,
      {
        from: { strokeDashoffset: -desfase },
        to: { strokeDashoffset: -desfase - LARGO_DEL_GRUESO },
      },
    ],
    animationDuration: [200, 2200],
    animationDelay: [DURACION_MS, DURACION_MS],
    animationTimingFunction: [SALIDA, "linear"],
    animationIterationCount: [1, "infinite"],
    animationFillMode: ["both", "none"],
  }
}
const destelloAncho = recorrer(0)
const destelloVivo = recorrer(0.03 * LARGO_DEL_GRUESO)

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
    opacity: 1,
    transitionProperty: "opacity",
    transitionDuration: SALIDA_MS,
    transitionTimingFunction: SALIDA,
  },
  // Mientras se funde ya no tapa: lo de debajo responde a los toques.
  saliendo: { opacity: 0, pointerEvents: "none" },
  // Movimiento reducido: el logo entero aparece con un fundido.
  fundido: {
    animationName: css.keyframes({ from: { opacity: 0 }, to: { opacity: 1 } }),
    animationDuration: 300,
    animationTimingFunction: SALIDA,
    animationFillMode: "both",
  },
})

/**
 * Lo que se ve al abrir la app mientras se comprueba la sesion: el logo de Alpha
 * & Omega Training construyendose.
 *
 * 1. Los aros se trazan. 2. El contorno de omega, alfa y el rayo se dibuja y
 * 3. se llena de oro. 4. TRAINING aparece letra a letra. 5. Un brillo cruza el
 * logo. 6. Si la comprobacion sigue, un destello recorre el aro hasta que acaba.
 *
 * Se queda hasta que la sesion esta comprobada (`lista`) y el logo se ha visto
 * entero, lo que tarde mas. Entonces se funde sobre lo que hay debajo sin
 * desmontarse, para que el logo no cambie mientras se va, y al acabar avisa con
 * `alDesaparecer`.
 *
 * El logo esta redibujado en vectores desde el original
 * (`assets/logo/vectorizar.py`). Todo son animaciones CSS de Reanimated sobre
 * trazos, opacidad y un degradado, que corren en el hilo de la interfaz.
 *
 * Con movimiento reducido no se dibuja nada: el logo aparece entero con un
 * fundido y no hay brillo ni destello.
 */
export function PantallaDeCarga({
  lista,
  alDesaparecer,
}: {
  lista: boolean
  alDesaparecer: () => void
}): React.JSX.Element {
  const reducido = useMovimientoReducido()
  const [vista, setVista] = useState(false)
  const saliendo = lista && vista

  // La pantalla nativa de arranque es el mismo fondo, vacio: se quita en cuanto
  // esta se pinta y el logo empieza a dibujarse sin corte. Si se esperase a
  // expo-router, que la quita cuando hay navegacion, taparia toda la animacion,
  // porque mientras se comprueba la sesion no hay navegacion montada.
  useEffect(() => {
    void SplashScreen.hideAsync()
  }, [])

  useEffect(() => {
    const temporizador = setTimeout(
      () => {
        setVista(true)
      },
      reducido ? DURACION_REDUCIDA_MS : DURACION_MS,
    )
    return () => {
      clearTimeout(temporizador)
    }
  }, [reducido])

  useEffect(() => {
    if (!saliendo) {
      return
    }
    const temporizador = setTimeout(alDesaparecer, SALIDA_MS)
    return () => {
      clearTimeout(temporizador)
    }
  }, [saliendo, alDesaparecer])

  return (
    <Animated.View
      style={[estilos.pantalla, saliendo && estilos.saliendo]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Alpha & Omega Training. Cargando"
    >
      <Animated.View style={reducido ? estilos.fundido : undefined}>
        <Svg width={TAMANO} height={TAMANO} viewBox="-600 -600 1200 1200">
          <Defs>
            <LinearGradient
              id="oro"
              gradientUnits="userSpaceOnUse"
              x1={-600}
              y1={-600}
              x2={600}
              y2={600}
            >
              {ORO.map(([desplazamiento, color]) => (
                <Stop key={desplazamiento} offset={desplazamiento} stopColor={color} />
              ))}
            </LinearGradient>
            {!reducido && (
              <DegradadoAnimado
                id="brillo"
                gradientUnits="userSpaceOnUse"
                x1={-1300}
                y1={-1300}
                x2={-1088}
                y2={-1088}
                style={cruzar}
              >
                <Stop offset={0} stopColor="#fff6d6" stopOpacity={0} />
                <Stop offset={0.5} stopColor="#fff6d6" stopOpacity={0.85} />
                <Stop offset={1} stopColor="#fff6d6" stopOpacity={0} />
              </DegradadoAnimado>
            )}
          </Defs>

          {AROS.map((aro, i) => (
            <RutaAnimada
              key={aro.nombre}
              d={aro.d}
              fill="none"
              stroke="url(#oro)"
              strokeWidth={aro.grosor}
              strokeDasharray={reducido ? undefined : [aro.largo, aro.largo]}
              style={reducido ? undefined : trazarAros[i]}
            />
          ))}

          {!reducido &&
            CONTORNOS.map((contorno, i) => (
              <RutaAnimada
                key={contorno.d}
                d={contorno.d}
                fill="none"
                stroke="url(#oro)"
                strokeWidth={4}
                strokeDasharray={[contorno.largo, contorno.largo]}
                style={trazarContornos[i]}
              />
            ))}

          {RELLENOS.map((d) => (
            <RutaAnimada
              key={d}
              d={d}
              fill="url(#oro)"
              fillRule="evenodd"
              style={reducido ? undefined : rellenar}
            />
          ))}

          {/* Sin esto, en oro liso el rayo y el arco del omega se funden en una
              mancha y deja de verse que el rayo pasa por encima. */}
          {CANTOS.map((d) => (
            <RutaAnimada
              key={d}
              d={d}
              fill="none"
              stroke="#5c430d"
              strokeWidth={3}
              strokeOpacity={0.75}
              style={reducido ? undefined : rellenar}
            />
          ))}

          {LETRAS.map((d, i) => (
            <RutaAnimada
              key={d}
              d={d}
              fill="url(#oro)"
              fillRule="evenodd"
              style={reducido ? undefined : escribirLetras[i]}
            />
          ))}

          {!reducido && (
            <>
              {[...RELLENOS, ...LETRAS].map((d) => (
                <Path key={`brillo-${d}`} d={d} fill="url(#brillo)" fillRule="evenodd" />
              ))}
              {AROS.map((aro) => (
                <Path
                  key={`brillo-${aro.nombre}`}
                  d={aro.d}
                  fill="none"
                  stroke="url(#brillo)"
                  strokeWidth={aro.grosor}
                />
              ))}
              {GRUESO && (
                <>
                  <RutaAnimada
                    d={GRUESO.d}
                    fill="none"
                    stroke="#fff4cf"
                    strokeOpacity={0.28}
                    strokeWidth={GRUESO.grosor}
                    strokeDasharray={[LARGO_DEL_GRUESO * 0.1, LARGO_DEL_GRUESO * 0.9]}
                    style={destelloAncho}
                  />
                  <RutaAnimada
                    d={GRUESO.d}
                    fill="none"
                    stroke="#fff4cf"
                    strokeOpacity={0.75}
                    strokeWidth={GRUESO.grosor}
                    strokeDasharray={[LARGO_DEL_GRUESO * 0.04, LARGO_DEL_GRUESO * 0.96]}
                    style={destelloVivo}
                  />
                </>
              )}
            </>
          )}
        </Svg>
      </Animated.View>
    </Animated.View>
  )
}
