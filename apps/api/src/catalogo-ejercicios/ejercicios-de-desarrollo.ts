import type { CrearEjercicio } from "@alpha-omega/shared"

/**
 * Catálogo básico para DESARROLLO.
 *
 * Lo carga `npm run db:seed` para poder montar rutinas nada más levantar la
 * base, sin teclear ejercicios uno a uno. No es el catálogo del negocio: el
 * entrenador lo revisa, edita o retira desde la app, y con NODE_ENV=production
 * la semilla no lo carga.
 */
export const EJERCICIOS_DE_DESARROLLO: readonly CrearEjercicio[] = [
  {
    nombre: "Press de banca",
    grupoPrincipal: "pecho",
    gruposSecundarios: ["triceps", "hombros"],
    instrucciones:
      "Tumbado en el banco, baja la barra al pecho controlando y empuja hasta extender.",
  },
  {
    nombre: "Press inclinado con mancuernas",
    grupoPrincipal: "pecho",
    gruposSecundarios: ["hombros", "triceps"],
    instrucciones: "Banco a 30-45 grados. Baja las mancuernas a los lados del pecho y empuja.",
  },
  {
    nombre: "Flexiones",
    grupoPrincipal: "pecho",
    gruposSecundarios: ["triceps", "abdomen"],
    instrucciones: "Cuerpo en línea recta, baja el pecho hasta casi tocar el suelo y empuja.",
  },
  {
    nombre: "Dominadas",
    grupoPrincipal: "espalda",
    gruposSecundarios: ["biceps", "antebrazos"],
    instrucciones: "Agarre prono algo más ancho que los hombros. Sube hasta pasar la barbilla.",
  },
  {
    nombre: "Remo con barra",
    grupoPrincipal: "espalda",
    gruposSecundarios: ["biceps"],
    instrucciones:
      "Torso inclinado y espalda neutra. Lleva la barra al abdomen juntando escápulas.",
  },
  {
    nombre: "Jalón al pecho",
    grupoPrincipal: "espalda",
    gruposSecundarios: ["biceps"],
    instrucciones: "Tira de la barra hasta la parte alta del pecho sin balancear el torso.",
  },
  {
    nombre: "Peso muerto",
    grupoPrincipal: "isquiotibiales",
    gruposSecundarios: ["gluteos", "espalda", "antebrazos"],
    instrucciones:
      "Barra pegada a las piernas, espalda neutra. Empuja el suelo y extiende la cadera.",
  },
  {
    nombre: "Sentadilla con barra",
    grupoPrincipal: "cuadriceps",
    gruposSecundarios: ["gluteos", "isquiotibiales"],
    instrucciones:
      "Barra sobre los trapecios. Baja con el pecho alto hasta la profundidad indicada.",
  },
  {
    nombre: "Prensa de piernas",
    grupoPrincipal: "cuadriceps",
    gruposSecundarios: ["gluteos"],
    instrucciones: "Pies a la anchura de la cadera. Baja controlando sin despegar la zona lumbar.",
  },
  {
    nombre: "Zancadas",
    grupoPrincipal: "cuadriceps",
    gruposSecundarios: ["gluteos"],
    instrucciones: "Paso largo, baja la rodilla trasera cerca del suelo y vuelve empujando.",
  },
  {
    nombre: "Hip thrust",
    grupoPrincipal: "gluteos",
    gruposSecundarios: ["isquiotibiales"],
    instrucciones: "Espalda apoyada en el banco. Eleva la cadera apretando glúteos arriba.",
  },
  {
    nombre: "Curl femoral tumbado",
    grupoPrincipal: "isquiotibiales",
    gruposSecundarios: ["gemelos"],
    instrucciones:
      "Flexiona las rodillas llevando los talones hacia los glúteos sin levantar la cadera.",
  },
  {
    nombre: "Elevación de gemelos de pie",
    grupoPrincipal: "gemelos",
    gruposSecundarios: [],
    instrucciones: "Sube de puntillas lo más alto posible y baja lento hasta estirar.",
  },
  {
    nombre: "Press militar",
    grupoPrincipal: "hombros",
    gruposSecundarios: ["triceps"],
    instrucciones: "De pie, empuja la barra desde los hombros por encima de la cabeza.",
  },
  {
    nombre: "Elevaciones laterales",
    grupoPrincipal: "hombros",
    gruposSecundarios: [],
    instrucciones: "Sube las mancuernas a los lados hasta la altura de los hombros, codos suaves.",
  },
  {
    nombre: "Curl de bíceps con barra",
    grupoPrincipal: "biceps",
    gruposSecundarios: ["antebrazos"],
    instrucciones: "Codos pegados al cuerpo. Sube la barra sin balancear y baja controlando.",
  },
  {
    nombre: "Extensión de tríceps en polea",
    grupoPrincipal: "triceps",
    gruposSecundarios: [],
    instrucciones: "Codos fijos junto al cuerpo. Extiende hasta bloquear y vuelve despacio.",
  },
  {
    nombre: "Fondos en paralelas",
    grupoPrincipal: "triceps",
    gruposSecundarios: ["pecho", "hombros"],
    instrucciones: "Baja hasta que los codos formen 90 grados y empuja hasta extender.",
  },
  {
    nombre: "Plancha abdominal",
    grupoPrincipal: "abdomen",
    gruposSecundarios: [],
    instrucciones: "Apoyo en antebrazos y puntas, cuerpo recto. Mantén el tiempo indicado.",
  },
  {
    nombre: "Crunch abdominal",
    grupoPrincipal: "abdomen",
    gruposSecundarios: [],
    instrucciones:
      "Tumbado, eleva los hombros del suelo contrayendo el abdomen sin tirar del cuello.",
  },
  {
    nombre: "Paseo del granjero",
    grupoPrincipal: "antebrazos",
    gruposSecundarios: ["abdomen", "hombros"],
    instrucciones: "Camina erguido con una carga pesada en cada mano durante el tiempo indicado.",
  },
]
