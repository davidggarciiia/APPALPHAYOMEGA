import { View } from "react-native"
import Svg, { Circle, Path, Rect } from "react-native-svg"

/**
 * Iconos de trazo de Design.html (24 × 24, trazo 2, extremos redondeados).
 * Son decorativos: quien los usa pone el nombre accesible en el botón.
 */
export type NombreIcono =
  | "entreno"
  | "plan"
  | "nutricion"
  | "perfil"
  | "clientes"
  | "ejercicios"
  | "inicio"
  | "atras"
  | "adelante"
  | "hecho"
  | "pausa"
  | "reproducir"

export function Icono({
  nombre,
  color,
  tamano = 24,
}: {
  nombre: NombreIcono
  color: string
  tamano?: number
}): React.JSX.Element {
  const trazo = {
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    fill: "none",
  } as const
  return (
    // Se oculta con la View: react-native-svg pasa las props de accesibilidad al DOM en web.
    <View aria-hidden>
      <Svg width={tamano} height={tamano} viewBox="0 0 24 24">
        {nombre === "entreno" && <Path d="M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12" {...trazo} />}
        {nombre === "plan" && (
          <>
            <Rect x={4} y={5} width={16} height={15} rx={3} {...trazo} />
            <Path d="M4 10h16M9 3v4M15 3v4" {...trazo} />
          </>
        )}
        {nombre === "nutricion" && (
          <>
            <Path d="M4 11h16a8 8 0 0 1-16 0z" {...trazo} />
            <Path d="M12 4v3M8 5l1 2M16 5l-1 2" {...trazo} />
          </>
        )}
        {nombre === "perfil" && (
          <>
            <Circle cx={12} cy={8} r={4} {...trazo} />
            <Path d="M4 20a8 8 0 0 1 16 0" {...trazo} />
          </>
        )}
        {nombre === "clientes" && (
          <>
            <Circle cx={9} cy={8} r={3.5} {...trazo} />
            <Path
              d="M3 19a6 6 0 0 1 12 0M16 4.5a3.5 3.5 0 0 1 0 7M18 13.5a6 6 0 0 1 3 5.5"
              {...trazo}
            />
          </>
        )}
        {nombre === "ejercicios" && (
          <>
            <Rect x={4} y={4} width={16} height={16} rx={3} {...trazo} />
            <Path d="M8 9h8M8 13h8M8 17h5" {...trazo} />
          </>
        )}
        {nombre === "inicio" && (
          <Path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" {...trazo} />
        )}
        {nombre === "atras" && <Path d="M15 5l-7 7 7 7" {...trazo} />}
        {nombre === "adelante" && <Path d="M9 5l7 7-7 7" {...trazo} />}
        {nombre === "hecho" && <Path d="M5 12.5l4.5 4.5L19 7.5" {...trazo} />}
        {nombre === "pausa" && (
          <>
            <Rect x={6} y={5} width={4} height={14} rx={1} fill={color} />
            <Rect x={14} y={5} width={4} height={14} rx={1} fill={color} />
          </>
        )}
        {nombre === "reproducir" && <Path d="M8 5.5v13l11-6.5z" fill={color} />}
      </Svg>
    </View>
  )
}
