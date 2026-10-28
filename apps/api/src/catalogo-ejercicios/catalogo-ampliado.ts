import type { CrearEjercicio, GrupoMuscular } from "@alpha-omega/shared"

export type CategoriaAmpliacion =
  "rutina" | "alternativas" | "movilidad" | "estiramientos" | "basicos"
export type EntradaCatalogoAmpliado = CrearEjercicio & {
  equivalentes?: string[]
  categoria: CategoriaAmpliacion
}

/** Textos propios basados en la guía de David y técnica habitual. Sin dosificación ni figuras.
 * Cada material o ejecución distinta tiene una ficha explícita; las pautas no crean variantes.
 * No se incluyen psoas/aductores: el vocabulario actual no permite representarlos fielmente.
 */
function ficha(
  categoria: CategoriaAmpliacion,
  nombre: string,
  grupoPrincipal: GrupoMuscular,
  gruposSecundarios: GrupoMuscular[],
  pasos: [string, string, string],
  evita: string,
  equivalentes?: string[],
): EntradaCatalogoAmpliado {
  return {
    categoria,
    nombre,
    grupoPrincipal,
    gruposSecundarios,
    instrucciones: pasos.join(" "),
    pasos,
    evita,
    consejos: [],
    ...(equivalentes ? { equivalentes } : {}),
  }
}
const r = (
  nombre: string,
  grupo: GrupoMuscular,
  secundarios: GrupoMuscular[],
  pasos: [string, string, string],
  evita: string,
) => ficha("rutina", nombre, grupo, secundarios, pasos, evita)
const m = (nombre: string, grupo: GrupoMuscular, pasos: [string, string, string], evita: string) =>
  ficha("movilidad", nombre, grupo, [], pasos, evita)
const b = (
  nombre: string,
  grupo: GrupoMuscular,
  secundarios: GrupoMuscular[],
  pasos: [string, string, string],
  evita: string,
) => ficha("basicos", nombre, grupo, secundarios, pasos, evita)
const e = (nombre: string, grupo: GrupoMuscular, pasos: [string, string, string], evita: string) =>
  ficha("estiramientos", nombre, grupo, [], pasos, evita)

export const CATALOGO_AMPLIADO: readonly EntradaCatalogoAmpliado[] = [
  r(
    "Elevación lateral unilateral en polea",
    "hombros",
    [],
    [
      "Colócate de lado a una polea baja y sujeta el asa con la mano más alejada.",
      "Eleva el brazo hacia el lado con el codo ligeramente flexionado hasta una altura cómoda.",
      "Baja despacio sin inclinar el tronco y cambia de brazo.",
    ],
    "Encoger el hombro o usar impulso para subir.",
  ),
  r(
    "Extensión de tríceps sobre la cabeza unilateral en polea",
    "triceps",
    [],
    [
      "Sujeta el asa de una polea baja con un brazo junto a la cabeza y estabiliza el tronco.",
      "Extiende el codo sin mover el brazo ni arquear la espalda.",
      "Flexiona el codo con control y cambia de lado.",
    ],
    "Forzar el hombro o desplazar el codo durante la extensión.",
  ),
  r(
    "Press inclinado con mancuernas",
    "pecho",
    ["hombros", "triceps"],
    [
      "Apoya la espalda en un banco de inclinación moderada y mantén los pies firmes en el suelo.",
      "Baja las mancuernas a ambos lados del pecho con muñecas firmes.",
      "Empuja de forma simétrica y vuelve con control.",
    ],
    "Chocar las mancuernas o arquear la espalda en exceso.",
  ),
  r(
    "Aperturas en polea",
    "pecho",
    ["hombros"],
    [
      "Colócate entre las poleas con un pie adelantado y codos ligeramente flexionados.",
      "Acerca las manos por delante del pecho manteniendo el ángulo de los codos.",
      "Abre despacio hasta un recorrido cómodo.",
    ],
    "Convertir el movimiento en un press o adelantar los hombros.",
  ),
  r(
    "Extensión de tríceps sobre la cabeza con cuerda",
    "triceps",
    [],
    [
      "Sujeta la cuerda de una polea baja y sitúa los brazos junto a la cabeza.",
      "Extiende los codos manteniendo costillas y brazos estables.",
      "Flexiona los codos despacio sin desplazar los hombros.",
    ],
    "Arquear la espalda o abrir demasiado los codos.",
  ),
  r(
    "Extensión de tríceps sobre la cabeza con mancuerna bilateral",
    "triceps",
    [],
    [
      "Sujeta una mancuerna con ambas manos sobre la cabeza y fija el tronco.",
      "Flexiona los codos llevando la mancuerna detrás de la cabeza.",
      "Extiende los codos sin mover los brazos.",
    ],
    "Forzar el recorrido o arquear la zona lumbar.",
  ),
  r(
    "Extensión de tríceps sobre la cabeza con mancuerna unilateral",
    "triceps",
    [],
    [
      "Sujeta una mancuerna con un brazo junto a la cabeza.",
      "Flexiona el codo despacio manteniendo el brazo estable.",
      "Extiende el codo y vuelve; repite con el otro brazo.",
    ],
    "Abrir el codo o inclinar el tronco.",
  ),
  r(
    "Sit-ups con peso",
    "abdomen",
    [],
    [
      "Túmbate con rodillas flexionadas y el peso cerca del pecho.",
      "Eleva el tronco de forma controlada sin tirar del cuello.",
      "Desciende gradualmente hasta donde mantengas el control.",
    ],
    "Usar impulso o arquear la espalda al bajar.",
  ),
  r(
    "Tijeras",
    "abdomen",
    [],
    [
      "Túmbate con piernas extendidas y zona lumbar estable.",
      "Alterna la altura de las piernas con un recorrido corto.",
      "Mantén el abdomen activo y respira durante el movimiento.",
    ],
    "Bajar las piernas hasta despegar la zona lumbar.",
  ),
  r(
    "Toques de talón alternos",
    "abdomen",
    [],
    [
      "Túmbate con rodillas flexionadas y pies apoyados.",
      "Eleva ligeramente cabeza y hombros y acerca una mano al talón de su lado.",
      "Alterna el lado sin rebotes ni tirones de cuello.",
    ],
    "Despegar la zona lumbar o forzar el cuello.",
  ),
  r(
    "Plancha RKC",
    "abdomen",
    ["gluteos", "cuadriceps"],
    [
      "Apoya antebrazos y puntas de los pies con el cuerpo alineado.",
      "Contrae abdomen, glúteos y muslos intentando acercar codos y pies sin moverlos.",
      "Mantén la tensión mientras respiras y termina antes de perder la postura.",
    ],
    "Hundir la pelvis o contener la respiración.",
  ),
  r(
    "Remo en T",
    "espalda",
    ["biceps"],
    [
      "Sujeta el agarre de remo en T con el tronco estable; usa apoyo de pecho si está disponible.",
      "Lleva los codos atrás sin elevar los hombros.",
      "Extiende los brazos despacio conservando el apoyo o la posición del tronco.",
    ],
    "Tirar con la zona lumbar o despegar el pecho del apoyo.",
  ),
  r(
    "Jalón al pecho neutro de anchura media",
    "espalda",
    ["biceps"],
    [
      "Ajusta el apoyo de muslos y toma un agarre neutro de anchura media.",
      "Lleva los codos hacia abajo acercando el agarre a la parte alta del pecho.",
      "Devuelve el agarre arriba sin balancear el tronco.",
    ],
    "Llevar el agarre tras la nuca o usar impulso.",
  ),
  r(
    "Remo unilateral en polea",
    "espalda",
    ["biceps"],
    [
      "Sujeta el asa de una polea con una mano y estabiliza cadera y tronco.",
      "Lleva el codo hacia la cadera sin girar el cuerpo.",
      "Extiende el brazo con control y cambia de lado.",
    ],
    "Rotar el tronco o encoger el hombro.",
  ),
  r(
    "Face pull con rotación externa",
    "hombros",
    ["espalda"],
    [
      "Coloca la cuerda a la altura de la cara y toma sus extremos.",
      "Tira hacia la cara separando las manos y termina con antebrazos orientados hacia arriba.",
      "Vuelve despacio sin forzar la rotación del hombro.",
    ],
    "Arquear la espalda o encoger los hombros.",
  ),
  r(
    "Curl inclinado con mancuernas",
    "biceps",
    [],
    [
      "Apoya la espalda en un banco inclinado y deja los brazos detrás del tronco.",
      "Flexiona los codos sin adelantar los brazos.",
      "Baja las mancuernas despacio manteniendo el apoyo.",
    ],
    "Girar el hombro o usar impulso.",
  ),
  r(
    "Curl martillo con mancuernas",
    "biceps",
    ["antebrazos"],
    [
      "Colócate con mancuernas a los lados y palmas enfrentadas.",
      "Flexiona los codos manteniendo muñecas firmes y brazos junto al cuerpo.",
      "Baja con control sin balancearte.",
    ],
    "Arquear la espalda o mover los codos hacia delante.",
  ),
  r(
    "Encogimientos de rodillas sentado en banco",
    "abdomen",
    [],
    [
      "Siéntate en el borde del banco y sujeta los laterales con manos firmes.",
      "Acerca las rodillas al tronco controlando la pelvis.",
      "Aleja las piernas sin perder la estabilidad de la espalda.",
    ],
    "Balancearte o hundir la zona lumbar.",
  ),
  r(
    "Bicycle crunch",
    "abdomen",
    [],
    [
      "Túmbate y coloca las manos suavemente junto a la cabeza.",
      "Acerca una rodilla mientras giras el tronco hacia ella y alejas la pierna contraria.",
      "Alterna lentamente manteniendo control lumbar.",
    ],
    "Tirar del cuello o pedalear con impulso.",
  ),
  r(
    "Plancha lateral con bajada y subida de cadera",
    "abdomen",
    ["gluteos"],
    [
      "Apoya un antebrazo bajo el hombro y coloca el cuerpo de lado.",
      "Baja la cadera un recorrido corto sin girar el tronco.",
      "Eleva la cadera hasta recuperar la alineación y cambia de lado.",
    ],
    "Colapsar el hombro o girar la pelvis.",
  ),
  r(
    "Pallof press en polea",
    "abdomen",
    [],
    [
      "Colócate de lado a una polea a la altura del pecho y toma el asa con ambas manos.",
      "Extiende los brazos al frente resistiendo el giro del tronco.",
      "Vuelve al pecho con control y cambia de lado.",
    ],
    "Rotar la cadera o inclinar el tronco.",
  ),
  r(
    "Elevación de gemelos de pie",
    "gemelos",
    [],
    [
      "Colócate de pie sobre un apoyo estable con talones libres y sujétate.",
      "Eleva los talones empujando con la parte delantera de los pies.",
      "Baja despacio sin rebotar.",
    ],
    "Doblar las rodillas para impulsarte o inclinar los tobillos.",
  ),
  r(
    "Elevación de gemelos en prensa",
    "gemelos",
    [],
    [
      "Apoya espalda y pelvis en la prensa y coloca la parte delantera de los pies sobre la plataforma.",
      "Extiende los tobillos manteniendo las rodillas estables y sin bloquearlas con fuerza.",
      "Permite bajar los talones con control sin que resbalen los pies.",
    ],
    "Mover la carga con las rodillas o perder el apoyo de los pies.",
  ),
  r(
    "Press inclinado en máquina",
    "pecho",
    ["hombros", "triceps"],
    [
      "Ajusta el asiento para que las asas queden cerca de la parte alta del pecho.",
      "Empuja siguiendo la trayectoria de la máquina con espalda apoyada.",
      "Vuelve despacio sin despegar los hombros del respaldo.",
    ],
    "Arquear la espalda o bloquear los codos con violencia.",
  ),
  r(
    "Dominadas asistidas en máquina",
    "espalda",
    ["biceps"],
    [
      "Ajusta la asistencia y sube al apoyo siguiendo las indicaciones de la máquina.",
      "Tira llevando los codos abajo con el tronco estable.",
      "Desciende con control y baja del apoyo con cuidado.",
    ],
    "Balancearte o dejar caer el apoyo.",
  ),
  r(
    "Remo sentado en polea",
    "espalda",
    ["biceps"],
    [
      "Siéntate con pies apoyados, rodillas suaves y espalda larga.",
      "Lleva el agarre hacia el abdomen con los codos cerca del cuerpo.",
      "Extiende los brazos despacio sin balancear el tronco.",
    ],
    "Redondear la espalda o tirar con la zona lumbar.",
  ),
  r(
    "Pullover en polea",
    "espalda",
    ["triceps"],
    [
      "Toma un agarre de polea alta y fija el tronco con una ligera inclinación.",
      "Lleva los brazos hacia los muslos manteniendo los codos ligeramente flexionados.",
      "Vuelve arriba con control sin arquear la espalda.",
    ],
    "Convertirlo en un empuje de tríceps o usar impulso.",
  ),
  r(
    "Crunch en máquina",
    "abdomen",
    [],
    [
      "Ajusta asiento y apoyos para quedar estable en la máquina.",
      "Acerca las costillas a la pelvis flexionando el tronco.",
      "Vuelve despacio sin soltar la carga.",
    ],
    "Tirar solo con los brazos o forzar el cuello.",
  ),
  r(
    "Elevación de piernas desde el suelo",
    "abdomen",
    [],
    [
      "Túmbate con brazos apoyados y abdomen activo.",
      "Eleva las piernas controlando la pelvis; flexiona las rodillas si lo necesitas.",
      "Baja únicamente hasta donde mantengas la zona lumbar estable.",
    ],
    "Arquear la espalda al bajar.",
  ),
  r(
    "Mountain climber cruzado",
    "abdomen",
    ["hombros"],
    [
      "Adopta una plancha sobre las manos con hombros sobre muñecas.",
      "Acerca una rodilla hacia el lado contrario del tronco.",
      "Devuelve el pie y alterna con un movimiento lento y pelvis estable.",
    ],
    "Rebotar o elevar mucho la cadera.",
  ),
  r(
    "Dead bug",
    "abdomen",
    [],
    [
      "Túmbate con brazos al techo y caderas y rodillas flexionadas.",
      "Aleja brazo y pierna contrarios mientras exhalas y mantienes la zona lumbar estable.",
      "Vuelve al inicio y alterna lados sin acelerar.",
    ],
    "Arquear la espalda o mover ambos lados a la vez.",
  ),
  r(
    "Curl predicador en máquina",
    "biceps",
    [],
    [
      "Ajusta el asiento para apoyar brazos y axilas cómodamente.",
      "Flexiona los codos sin despegar los brazos del soporte.",
      "Desciende despacio sin forzar la extensión del codo.",
    ],
    "Perder el apoyo o elevar los hombros.",
  ),
  r(
    "Curl martillo en polea",
    "biceps",
    ["antebrazos"],
    [
      "Sujeta una cuerda en polea baja con palmas enfrentadas.",
      "Flexiona los codos manteniéndolos junto al cuerpo.",
      "Baja con control sin inclinar el tronco.",
    ],
    "Adelantar los codos o balancearte.",
  ),
  r(
    "Fondos de tríceps en banco",
    "triceps",
    ["hombros"],
    [
      "Apoya las manos junto a la cadera sobre un banco estable y acerca los pies.",
      "Flexiona los codos hacia atrás con un recorrido corto y cómodo.",
      "Empuja para regresar manteniendo hombros estables.",
    ],
    "Buscar profundidad máxima o continuar con molestia anterior del hombro.",
  ),
  r(
    "Extensión de tríceps unilateral con cuerda",
    "triceps",
    [],
    [
      "Toma un extremo de una cuerda en polea alta y fija el codo junto al cuerpo.",
      "Extiende el codo sin girar el tronco ni desplazar el hombro.",
      "Vuelve con control y cambia de brazo.",
    ],
    "Abrir el codo o usar impulso.",
  ),
  r(
    "Farmer carry",
    "antebrazos",
    ["abdomen", "hombros"],
    [
      "Toma cargas a ambos lados con agarre firme y tronco erguido.",
      "Camina con pasos cortos manteniendo las costillas sobre la pelvis.",
      "Detente de forma estable y deposita las cargas con control.",
    ],
    "Inclinarte, encoger los hombros o acelerar perdiendo control.",
  ),
  ficha(
    "alternativas",
    "Fondos asistidos en máquina",
    "triceps",
    ["pecho", "hombros"],
    [
      "Ajusta la asistencia y coloca las manos en las barras de fondos.",
      "Baja con codos orientados atrás hasta un recorrido cómodo.",
      "Empuja para subir manteniendo los hombros estables.",
    ],
    "Forzar la profundidad o balancearte.",
  ),
  ficha(
    "alternativas",
    "Press cerrado en multipower",
    "triceps",
    ["pecho", "hombros"],
    [
      "Coloca un banco y ajusta los topes bajo la barra con un agarre algo más estrecho que el de banca.",
      "Baja hacia el pecho manteniendo antebrazos alineados y codos cerca del cuerpo.",
      "Empuja sin despegar la espalda ni los glúteos.",
    ],
    "Cerrar el agarre hasta doblar las muñecas o rebotar en el pecho.",
  ),
  b(
    "Flexiones",
    "pecho",
    ["triceps", "hombros"],
    [
      "Apoya manos bajo los hombros y pies atrás con el cuerpo alineado.",
      "Flexiona los codos acercando el pecho al suelo.",
      "Empuja manteniendo abdomen y pelvis estables.",
    ],
    "Hundir la cintura o adelantar la cabeza.",
  ),
  b(
    "Flexiones inclinadas con manos en apoyo",
    "pecho",
    ["triceps", "hombros"],
    [
      "Apoya las manos en una superficie elevada que no se mueva.",
      "Baja el pecho hacia el apoyo con el cuerpo alineado.",
      "Empuja sin perder la postura del tronco.",
    ],
    "Usar un apoyo inestable o dejar caer la cadera.",
  ),
  b(
    "Press de banca plano con mancuernas",
    "pecho",
    ["triceps", "hombros"],
    [
      "Túmbate en un banco plano con pies firmes y mancuernas sobre el pecho.",
      "Baja de forma simétrica con muñecas estables.",
      "Empuja arriba sin chocar las mancuernas.",
    ],
    "Despegar los glúteos o forzar el recorrido del hombro.",
  ),
  b(
    "Remo con banda",
    "espalda",
    ["biceps"],
    [
      "Fija la banda a un anclaje estable a la altura del tronco.",
      "Tira llevando los codos atrás sin encoger los hombros.",
      "Extiende los brazos controlando la tensión de la banda.",
    ],
    "Usar un anclaje inseguro o balancearte.",
  ),
  b(
    "Curl de bíceps supino con mancuernas",
    "biceps",
    [],
    [
      "Sujeta las mancuernas con palmas hacia delante y brazos junto al cuerpo.",
      "Flexiona los codos sin mover los hombros.",
      "Baja despacio manteniendo muñecas firmes.",
    ],
    "Balancearte o adelantar los codos.",
  ),
  b(
    "Elevación de gemelos sentado",
    "gemelos",
    [],
    [
      "Siéntate con pies apoyados sobre una plataforma y resistencia estable sobre los muslos.",
      "Eleva los talones manteniendo las rodillas flexionadas.",
      "Baja despacio sin rebotar.",
    ],
    "Desplazar la carga o inclinar los tobillos.",
  ),
  b(
    "Plancha lateral estática",
    "abdomen",
    ["gluteos"],
    [
      "Apoya un antebrazo bajo el hombro y coloca los pies de lado.",
      "Eleva la pelvis formando una línea con el tronco.",
      "Mantén la postura respirando y cambia de lado.",
    ],
    "Colapsar el hombro o dejar caer la pelvis.",
  ),
  b(
    "Pallof press con banda",
    "abdomen",
    [],
    [
      "Fija la banda a un anclaje estable a la altura del pecho y colócate de lado.",
      "Extiende los brazos al frente resistiendo el giro.",
      "Vuelve con control al pecho y cambia de lado.",
    ],
    "Rotar el tronco o usar un anclaje inseguro.",
  ),
  m(
    "Rotaciones torácicas en cuadrupedia",
    "espalda",
    [
      "Apoya manos y rodillas y coloca una mano detrás de la cabeza.",
      "Gira el pecho acompañando con la mirada sin mover la pelvis.",
      "Vuelve y cambia de lado manteniendo la zona lumbar estable.",
    ],
    "Girar solo el cuello o desplazar la cadera.",
  ),
  m(
    "Círculos de brazos",
    "hombros",
    [
      "Colócate de pie con tronco estable y brazos separados.",
      "Dibuja círculos pequeños y amplía gradualmente dentro de un recorrido cómodo.",
      "Cambia el sentido manteniendo los hombros relajados.",
    ],
    "Arquear la espalda o hacer movimientos bruscos.",
  ),
  m(
    "Pasadas con goma",
    "hombros",
    [
      "Sujeta una goma con agarre amplio y brazos extendidos.",
      "Pásala por encima de la cabeza hacia atrás dentro de un recorrido cómodo.",
      "Vuelve al frente con control y conserva el agarre amplio.",
    ],
    "Cerrar demasiado el agarre o forzar los hombros.",
  ),
  m(
    "Pasadas con pica",
    "hombros",
    [
      "Sujeta una pica con agarre amplio y codos extendidos.",
      "Llévala sobre la cabeza hacia atrás solo dentro de tu movilidad cómoda.",
      "Vuelve al frente manteniendo el tronco estable.",
    ],
    "Forzar el recorrido con una pica rígida o arquear la espalda.",
  ),
  m(
    "Band pull-apart",
    "espalda",
    [
      "Sujeta una banda con brazos al frente y codos suaves.",
      "Separa las manos llevando los brazos hacia los lados sin elevar los hombros.",
      "Vuelve despacio sin soltar la tensión.",
    ],
    "Encoger los hombros o arquear la zona lumbar.",
  ),
  m(
    "Rotación externa con goma",
    "hombros",
    [
      "Fija una goma a un apoyo estable y coloca el codo junto al cuerpo y flexionado.",
      "Gira el antebrazo hacia fuera sin separar el codo.",
      "Vuelve despacio y cambia de brazo.",
    ],
    "Rotar el tronco o utilizar demasiada resistencia.",
  ),
  m(
    "Flexiones escapulares en plancha",
    "espalda",
    [
      "Adopta una plancha sobre las manos con codos extendidos.",
      "Aproxima suavemente las escápulas sin flexionar los codos.",
      "Empuja el suelo para separar las escápulas manteniendo el tronco alineado.",
    ],
    "Hundir la zona lumbar o adelantar la cabeza.",
  ),
  m(
    "Flexiones escapulares en cuadrupedia",
    "espalda",
    [
      "Apoya manos bajo los hombros y rodillas bajo las caderas.",
      "Acerca suavemente las escápulas con los codos extendidos.",
      "Empuja el suelo separando las escápulas sin mover la pelvis.",
    ],
    "Flexionar los codos o mover toda la espalda.",
  ),
  m(
    "Flexión y extensión torácica en banco",
    "espalda",
    [
      "Arrodíllate ante un banco y apoya los codos o las manos.",
      "Lleva el pecho suavemente hacia el suelo controlando las costillas.",
      "Vuelve a la posición inicial sin arquear la zona lumbar.",
    ],
    "Forzar los hombros o rebotar.",
  ),
  m(
    "Face pull en polea",
    "hombros",
    [
      "Toma una cuerda de polea a la altura de la cara.",
      "Tira hacia la cara separando las manos con los codos altos pero cómodos.",
      "Vuelve despacio manteniendo el tronco estable.",
    ],
    "Arquear la espalda o añadir una rotación forzada.",
  ),
  m(
    "Curl de bíceps con goma",
    "biceps",
    [
      "Sujeta una goma fijada abajo con codos junto al cuerpo.",
      "Flexiona los codos sin mover los hombros.",
      "Vuelve despacio manteniendo tensión y tronco estable.",
    ],
    "Balancearte o perder el anclaje.",
  ),
  m(
    "Movilidad de tobillo hacia la pared",
    "gemelos",
    [
      "Coloca un pie cerca de una pared con el talón apoyado.",
      "Acerca la rodilla a la pared siguiendo la dirección del pie.",
      "Vuelve sin levantar el talón y cambia de lado.",
    ],
    "Colapsar la rodilla hacia dentro o levantar el talón.",
  ),
  m(
    "Rotaciones de cadera 90/90 dinámicas",
    "gluteos",
    [
      "Siéntate con ambas rodillas flexionadas y las piernas hacia un lado.",
      "Gira las rodillas hacia el otro lado controlando el movimiento de las caderas.",
      "Alterna sin forzar el rango ni girar bruscamente las rodillas.",
    ],
    "Forzar las articulaciones para alcanzar el suelo.",
  ),
  m(
    "Balanceo frontal de pierna",
    "gluteos",
    [
      "Sujétate a un apoyo estable y deja una pierna libre.",
      "Balancéala suavemente hacia delante y hacia atrás con la pelvis estable.",
      "Reduce el recorrido si pierdes control y cambia de pierna.",
    ],
    "Arquear la espalda o dar patadas con impulso.",
  ),
  m(
    "Balanceo lateral de pierna",
    "gluteos",
    [
      "Sujétate a un apoyo estable y deja una pierna libre.",
      "Mueve la pierna de lado a lado por delante del cuerpo con control.",
      "Mantén el tronco quieto y cambia de pierna.",
    ],
    "Girar la pelvis o aumentar el recorrido con impulso.",
  ),
  m(
    "Sentadilla profunda asistida con desplazamiento",
    "cuadriceps",
    [
      "Sujeta un apoyo estable y separa los pies en una posición cómoda.",
      "Desciende hasta una sentadilla que puedas mantener con talones apoyados.",
      "Desplaza suavemente el peso entre los lados y sube usando el apoyo.",
    ],
    "Forzar la profundidad o colapsar las rodillas.",
  ),
  m(
    "Monster walk con minibanda",
    "gluteos",
    [
      "Coloca una minibanda sobre las rodillas y flexiona ligeramente caderas y rodillas.",
      "Da pasos diagonales cortos manteniendo los pies separados y tensión en la banda.",
      "Vuelve con pasos controlados sin juntar las rodillas.",
    ],
    "Balancear el tronco o perder la alineación de las rodillas.",
  ),
  m(
    "Caminata lateral con minibanda",
    "gluteos",
    [
      "Coloca una minibanda sobre las rodillas y adopta una posición de ligera flexión de caderas y rodillas.",
      "Da un paso corto hacia un lado y acompaña con el otro pie manteniendo tensión en la banda.",
      "Continúa sin juntar los pies y repite hacia el lado contrario.",
    ],
    "Balancear el tronco o dejar que las rodillas se junten.",
  ),
  m(
    "Extensión torácica sobre foam roller",
    "espalda",
    [
      "Siéntate y coloca el rodillo bajo la parte alta de la espalda con rodillas flexionadas.",
      "Sostén la cabeza y extiende suavemente la zona torácica sobre el rodillo.",
      "Vuelve controlando las costillas y mantén la pelvis estable.",
    ],
    "Rodar sobre la zona lumbar o forzar el cuello.",
  ),
  m(
    "Empujes de tríceps con goma",
    "triceps",
    [
      "Fija una goma a un anclaje alto y toma sus extremos.",
      "Extiende los codos manteniéndolos junto al cuerpo.",
      "Vuelve despacio sin mover los hombros.",
    ],
    "Usar el peso del cuerpo o soltar la tensión.",
  ),
  e(
    "Estiramiento de pectoral en apoyo",
    "pecho",
    [
      "Apoya el antebrazo en una estructura estable con el codo a una altura cómoda.",
      "Gira suavemente el tronco alejándolo del brazo hasta notar tensión moderada en el pecho.",
      "Mantén una respiración tranquila y deshaz la posición despacio.",
    ],
    "Forzar el hombro o arquear la espalda.",
  ),
  e(
    "Estiramiento de dorsal con apoyo",
    "espalda",
    [
      "Sujeta un apoyo estable con ambas manos y brazos largos.",
      "Lleva la cadera atrás conservando la columna controlada.",
      "Respira suavemente y vuelve sin tirar con fuerza del apoyo.",
    ],
    "Colapsar la zona lumbar.",
  ),
  e(
    "Estiramiento de tríceps sobre la cabeza",
    "triceps",
    [
      "Eleva un brazo y flexiona el codo dejando la mano hacia la espalda.",
      "Acompaña suavemente el codo con la otra mano sin empujar con fuerza.",
      "Mantén costillas controladas y cambia de brazo.",
    ],
    "Arquear la espalda o forzar el hombro.",
  ),
  e(
    "Estiramiento de deltoides posterior cruzado",
    "hombros",
    [
      "Cruza un brazo por delante del pecho con el hombro alejado de la oreja.",
      "Acompaña suavemente el brazo con la mano contraria por encima del codo.",
      "Respira y cambia de lado sin tirar con fuerza.",
    ],
    "Elevar el hombro o presionar el codo con fuerza.",
  ),
  e(
    "Estiramiento de cuádriceps de pie",
    "cuadriceps",
    [
      "Sujétate a un apoyo y flexiona una rodilla.",
      "Toma el tobillo y acerca suavemente el talón al glúteo con rodillas próximas.",
      "Mantén la pelvis neutra y cambia de pierna.",
    ],
    "Arquear la espalda o tirar de la rodilla hacia fuera.",
  ),
  e(
    "Estiramiento de isquiotibiales con talón apoyado",
    "isquiotibiales",
    [
      "Apoya un talón en una superficie baja y estable con rodilla ligeramente flexionada.",
      "Lleva la cadera atrás e inclina el tronco conservando la espalda larga.",
      "Vuelve despacio y cambia de pierna.",
    ],
    "Redondear la espalda o forzar la rodilla en extensión.",
  ),
  e(
    "Estiramiento de glúteos tumbado",
    "gluteos",
    [
      "Túmbate con rodillas flexionadas y coloca un tobillo sobre el muslo contrario.",
      "Acerca suavemente el muslo de apoyo hacia el tronco sujetándolo con las manos.",
      "Mantén la pelvis estable y cambia de lado.",
    ],
    "Empujar o girar la rodilla de la pierna cruzada.",
  ),
  e(
    "Estiramiento de gemelos en pared",
    "gemelos",
    [
      "Apoya las manos en la pared y lleva una pierna atrás con el pie al frente.",
      "Avanza suavemente el cuerpo manteniendo el talón posterior apoyado.",
      "Vuelve y cambia de pierna sin rebotes.",
    ],
    "Levantar el talón o girar el pie hacia fuera.",
  ),
]
