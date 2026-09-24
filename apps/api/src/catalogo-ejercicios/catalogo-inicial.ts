import type { Consejo, GrupoMuscular } from "@alpha-omega/shared"

/**
 * Catálogo inicial: un ejercicio por cada figura del índice (`medios.ts`).
 *
 * Es CONTENIDO INICIAL EDITABLE POR EL ENTRENADOR. `preparar-catalogo.ts` lo
 * vuelca una sola vez en una instalación nueva para que el catálogo arranque con
 * sus muñecos; a partir de ahí la ficha es del entrenador, que la cambia desde
 * la app, y el script no vuelve a tocar un ejercicio que ya exista.
 *
 * Textos propios, escritos para esta app: técnica estándar y prudente, sin
 * cifras (las series, repeticiones y cargas las pone el entrenador en cada
 * rutina), sin promesas y sin indicaciones médicas. El nombre es el del índice
 * y los grupos salen del vocabulario cerrado del catálogo; en el cardio, el
 * principal es el grupo que más trabaja.
 */
export type EntradaCatalogoInicial = {
  /** Id de la figura en el índice de medios. */
  medioId: string
  nombre: string
  grupoPrincipal: GrupoMuscular
  gruposSecundarios: GrupoMuscular[]
  instrucciones: string
  /** «Cómo hacerlo», paso a paso. */
  pasos: string[]
  /** El error más habitual, en una frase. */
  evita: string
  consejos: Consejo[]
  /**
   * Otros nombres con los que un entrenador suele llamar a este mismo
   * movimiento. Si ya tiene uno así y sin figura, se le asocia la figura en vez
   * de crear otro ejercicio. Solo equivalencias claras, nunca familias enteras.
   */
  equivalentes?: string[]
}

export const CATALOGO_INICIAL: readonly EntradaCatalogoInicial[] = [
  // Pecho
  {
    medioId: "vital-0051",
    nombre: "Aperturas en máquina contractora",
    grupoPrincipal: "pecho",
    gruposSecundarios: ["hombros"],
    instrucciones:
      "Sentado con la espalda apoyada, junta los brazos por delante del pecho describiendo un arco amplio y vuelve abriendo despacio. Los codos mantienen el mismo ángulo durante todo el recorrido.",
    pasos: [
      "Ajusta el asiento para que las asas queden a la altura del pecho.",
      "Apoya la espalda y coge las asas con los codos ligeramente flexionados.",
      "Cierra los brazos por delante del pecho sin cambiar el ángulo de los codos.",
      "Abre despacio hasta notar estiramiento en el pecho, sin pasar de ahí.",
    ],
    evita: "Echar los hombros hacia delante o despegar la espalda del respaldo al cerrar.",
    consejos: [
      { titulo: "Respira", texto: "Suelta el aire al cerrar los brazos y cógelo al abrir." },
    ],
  },
  {
    medioId: "vital-0052",
    nombre: "Press Svend",
    grupoPrincipal: "pecho",
    gruposSecundarios: ["hombros", "triceps"],
    instrucciones:
      "De pie, aprieta un disco entre las palmas a la altura del pecho y estira los brazos al frente sin dejar de apretar. Vuelve al pecho con control.",
    pasos: [
      "Ponte de pie con los pies a la anchura de las caderas y el abdomen firme.",
      "Sujeta el disco entre las palmas, pegado al pecho.",
      "Aprieta las manos entre sí y estira los brazos al frente.",
      "Vuelve el disco al pecho despacio, sin dejar de apretar.",
    ],
    evita: "Dejar de apretar el disco entre las manos o encoger los hombros hacia las orejas.",
    consejos: [
      {
        titulo: "La clave",
        texto:
          "El trabajo está en la presión de las palmas: si dejas de apretar, el ejercicio pierde su sentido.",
      },
    ],
  },
  {
    medioId: "movekit-dumbbell-chest-fly",
    nombre: "Aperturas con mancuernas",
    grupoPrincipal: "pecho",
    gruposSecundarios: ["hombros"],
    instrucciones:
      "Tumbado en un banco plano con una mancuerna en cada mano sobre el pecho, abre los brazos en arco con los codos algo flexionados y vuelve a juntarlos por encima del pecho.",
    pasos: [
      "Túmbate en el banco con los pies apoyados en el suelo.",
      "Sube las mancuernas sobre el pecho con las palmas enfrentadas.",
      "Flexiona un poco los codos y abre los brazos en arco hacia los lados.",
      "Baja hasta notar estiramiento en el pecho, sin pasar la línea de los hombros.",
      "Vuelve por el mismo arco hasta juntar las mancuernas.",
    ],
    evita: "Estirar del todo los codos o bajar las mancuernas más allá de lo que controlas.",
    consejos: [],
  },

  // Espalda
  {
    medioId: "movekit-pull-ups",
    nombre: "Dominadas",
    grupoPrincipal: "espalda",
    gruposSecundarios: ["biceps", "antebrazos"],
    instrucciones:
      "Colgado de la barra con las palmas hacia delante, sube el cuerpo tirando de los codos hacia abajo hasta que la barbilla pase la barra. Baja con control hasta casi estirar los brazos.",
    pasos: [
      "Cuélgate de la barra con las manos algo más abiertas que los hombros y las palmas al frente.",
      "Baja los hombros, alejándolos de las orejas, antes de empezar a subir.",
      "Tira de los codos hacia abajo hasta que la barbilla supere la barra.",
      "Baja despacio hasta tener los brazos casi estirados.",
    ],
    evita: "Balancear las piernas o dar tirones para subir.",
    consejos: [
      {
        titulo: "Progresión",
        texto:
          "Si todavía no te salen, tu entrenador puede proponerte una variante con banda elástica o en máquina asistida.",
      },
    ],
  },
  {
    medioId: "vital-0077",
    nombre: "Remo en ergómetro",
    grupoPrincipal: "espalda",
    gruposSecundarios: ["cuadriceps", "gluteos", "biceps"],
    instrucciones:
      "Cada palada empieza con el empuje de las piernas, sigue con una ligera inclinación del tronco hacia atrás y termina con el tirón de los brazos; la vuelta se hace en orden inverso. Mantén la espalda neutra durante todo el movimiento.",
    pasos: [
      "Sujeta los pies con las cintas y coge el mango con los brazos estirados.",
      "Empuja con las piernas manteniendo los brazos estirados.",
      "Con las piernas casi estiradas, inclina un poco el tronco atrás y tira del mango hacia la parte baja del pecho.",
      "Vuelve estirando los brazos, inclina el tronco al frente y después flexiona las rodillas.",
    ],
    evita:
      "Tirar con los brazos antes de empujar con las piernas o redondear la espalda al volver.",
    consejos: [
      {
        titulo: "Ritmo",
        texto: "La vuelta es más lenta que el empuje: aprovéchala para respirar.",
      },
    ],
  },

  // Hombros
  {
    medioId: "vital-0076",
    nombre: "Ondas con cuerda",
    grupoPrincipal: "hombros",
    gruposSecundarios: ["antebrazos", "abdomen"],
    instrucciones:
      "Con un extremo de la cuerda en cada mano y las rodillas algo flexionadas, mueve los brazos arriba y abajo con rapidez para crear ondas que lleguen hasta el anclaje.",
    pasos: [
      "Coge un extremo de la cuerda con cada mano y aléjate hasta tensarla un poco.",
      "Separa los pies, flexiona algo las rodillas y tensa el abdomen.",
      "Mueve los brazos arriba y abajo, alternando o a la vez, con ritmo rápido.",
      "Mantén la espalda neutra y la postura baja durante todo el esfuerzo.",
    ],
    evita:
      "Mover la cuerda solo con las muñecas o erguirte y perder la postura a mitad del esfuerzo.",
    consejos: [],
  },
  {
    medioId: "vital-0080",
    nombre: "Press de hombros sentado en máquina",
    grupoPrincipal: "hombros",
    gruposSecundarios: ["triceps"],
    instrucciones:
      "Sentado con la espalda recta, empuja el peso desde la altura de los hombros hasta casi estirar los brazos por encima de la cabeza y baja con control. La figura lo enseña con mancuernas; en máquina el gesto es el mismo.",
    pasos: [
      "Siéntate con la espalda recta y los pies bien apoyados en el suelo.",
      "Coloca las manos a la altura de los hombros, con las palmas al frente.",
      "Empuja hacia arriba sin bloquear los codos.",
      "Baja despacio hasta que las manos vuelvan a la altura de los hombros.",
    ],
    evita: "Arquear la zona lumbar para ayudarte a subir el peso.",
    consejos: [],
  },
  {
    medioId: "vital-0087",
    nombre: "Press Arnold con mancuernas",
    grupoPrincipal: "hombros",
    gruposSecundarios: ["triceps"],
    instrucciones:
      "Empieza con las mancuernas delante de los hombros y las palmas hacia ti, y empuja hacia arriba girando las muñecas hasta que las palmas miren al frente. Baja deshaciendo el giro.",
    pasos: [
      "Sujeta las mancuernas delante de los hombros con las palmas hacia ti.",
      "Empuja hacia arriba mientras abres los codos y giras las palmas al frente.",
      "Termina con los brazos casi estirados sobre la cabeza.",
      "Baja despacio deshaciendo el giro hasta la posición inicial.",
    ],
    evita: "Arquear la zona lumbar para ayudarte a subir las mancuernas.",
    consejos: [],
  },
  {
    medioId: "vital-0088",
    nombre: "Press militar de pie con barra",
    grupoPrincipal: "hombros",
    gruposSecundarios: ["triceps", "abdomen"],
    instrucciones:
      "De pie, empuja la barra desde la parte alta del pecho hasta encima de la cabeza, apartando un poco la cara al subir. Mantén el abdomen y los glúteos firmes para no arquear la espalda.",
    pasos: [
      "Coge la barra algo más abierta que los hombros y apóyala en la parte alta del pecho.",
      "Separa los pies a la anchura de las caderas y tensa abdomen y glúteos.",
      "Empuja la barra hacia arriba retirando un poco la cabeza hacia atrás.",
      "Arriba, vuelve a meter la cabeza para que la barra quede sobre ella.",
      "Baja con control hasta la parte alta del pecho.",
    ],
    evita: "Arquear la zona lumbar y echar la cadera hacia delante para subir la barra.",
    consejos: [
      {
        titulo: "Respira",
        texto: "Coge aire antes de empujar y suéltalo cuando la barra haya pasado la cabeza.",
      },
    ],
  },
  {
    medioId: "vital-0089",
    nombre: "Remo al mentón con barra",
    grupoPrincipal: "hombros",
    gruposSecundarios: ["espalda", "biceps"],
    instrucciones:
      "De pie con la barra delante de los muslos, súbela pegada al cuerpo llevando los codos hacia arriba y hacia fuera. Detente cuando los codos lleguen a la altura de los hombros y baja con control.",
    pasos: [
      "Coge la barra con las manos algo más abiertas que las caderas.",
      "Súbela pegada al cuerpo guiando el movimiento con los codos.",
      "Detente cuando los codos lleguen a la altura de los hombros.",
      "Baja despacio hasta estirar los brazos.",
    ],
    evita: "Subir la barra más allá de lo cómodo para los hombros o usar un agarre muy cerrado.",
    consejos: [
      {
        titulo: "Hombros",
        texto:
          "Si notas molestias en los hombros, acorta el recorrido y coméntaselo a tu entrenador.",
      },
    ],
  },
  {
    medioId: "vital-0090",
    nombre: "Press de hombros con mancuernas",
    grupoPrincipal: "hombros",
    gruposSecundarios: ["triceps"],
    instrucciones:
      "De pie, con una mancuerna en cada mano a la altura de los hombros, empuja hacia arriba hasta casi estirar los brazos y baja con control.",
    pasos: [
      "Ponte de pie con los pies a la anchura de las caderas y el abdomen firme.",
      "Sube las mancuernas a la altura de los hombros, con las palmas al frente.",
      "Empuja hacia arriba hasta que casi se toquen sobre la cabeza.",
      "Baja despacio hasta la altura de los hombros.",
    ],
    evita: "Arquear la zona lumbar o bajar las mancuernas sin control.",
    consejos: [],
  },
  {
    medioId: "vital-0091",
    nombre: "Remo al mentón con mancuernas",
    grupoPrincipal: "hombros",
    gruposSecundarios: ["espalda", "biceps"],
    instrucciones:
      "De pie con una mancuerna en cada mano delante de los muslos, súbelas pegadas al cuerpo llevando los codos hacia arriba y hacia fuera, sin pasar de la altura de los hombros.",
    pasos: [
      "Sujeta las mancuernas delante de los muslos con las palmas hacia ti.",
      "Súbelas cerca del cuerpo guiando el movimiento con los codos.",
      "Detente cuando los codos lleguen a la altura de los hombros.",
      "Baja despacio hasta estirar los brazos.",
    ],
    evita: "Encoger los hombros hacia las orejas o balancear el tronco para subir el peso.",
    consejos: [],
  },
  {
    medioId: "vital-0092",
    nombre: "Elevación frontal con mancuerna",
    grupoPrincipal: "hombros",
    gruposSecundarios: ["pecho"],
    instrucciones:
      "De pie, eleva las mancuernas al frente con los brazos casi estirados hasta la altura de los hombros y baja despacio. Puede hacerse con los dos brazos a la vez o alternando.",
    pasos: [
      "Ponte de pie con las mancuernas delante de los muslos y el abdomen firme.",
      "Eleva los brazos al frente con los codos ligeramente flexionados.",
      "Detente a la altura de los hombros.",
      "Baja despacio sin dejar caer el peso.",
    ],
    evita: "Balancear el tronco hacia atrás para dar impulso a las mancuernas.",
    consejos: [],
  },
  {
    medioId: "vital-0093",
    nombre: "Elevación frontal con disco",
    grupoPrincipal: "hombros",
    gruposSecundarios: ["pecho"],
    instrucciones:
      "De pie, sujeta un disco con las dos manos y elévalo al frente con los brazos casi estirados. Baja despacio sin balancear el cuerpo.",
    pasos: [
      "Sujeta el disco por los lados con las dos manos, delante de los muslos.",
      "Tensa el abdomen y eleva el disco al frente con los codos algo flexionados.",
      "Súbelo hasta la altura de los ojos, o hasta donde lo controles sin arquear la espalda.",
      "Baja despacio hasta la posición inicial.",
    ],
    evita: "Echar el tronco hacia atrás para subir el disco más alto.",
    consejos: [],
  },
  {
    medioId: "vital-0094",
    nombre: "Press de hombros con kettlebell",
    grupoPrincipal: "hombros",
    gruposSecundarios: ["triceps", "abdomen"],
    instrucciones:
      "De pie, con la kettlebell a la altura del hombro y apoyada sobre el antebrazo, empújala hacia arriba hasta estirar el brazo y bájala con control al mismo sitio. Se trabaja un brazo cada vez.",
    pasos: [
      "Coloca la kettlebell a la altura del hombro, apoyada en el antebrazo y con la muñeca recta.",
      "Tensa el abdomen y los glúteos.",
      "Empuja hacia arriba hasta que el brazo quede estirado junto a la oreja.",
      "Baja con control hasta la posición inicial.",
      "Completa un lado antes de cambiar de brazo.",
    ],
    evita: "Doblar la muñeca hacia atrás o inclinar el tronco hacia un lado al empujar.",
    consejos: [],
  },
  {
    medioId: "vital-0095",
    nombre: "Elevación lateral cruzada en polea",
    grupoPrincipal: "hombros",
    gruposSecundarios: [],
    instrucciones:
      "De pie entre dos poleas bajas, con los cables cruzados por delante del cuerpo, eleva los brazos hacia los lados hasta la altura de los hombros y baja despacio.",
    pasos: [
      "Coloca las poleas abajo y coge cada agarre con la mano contraria.",
      "Ponte de pie en el centro con los codos ligeramente flexionados.",
      "Eleva los brazos hacia los lados hasta la altura de los hombros.",
      "Baja despacio resistiendo la tensión del cable.",
    ],
    evita: "Encoger los hombros hacia las orejas al subir los brazos.",
    consejos: [],
  },
  {
    medioId: "vital-0096",
    nombre: "Elevaciones laterales con mancuernas",
    grupoPrincipal: "hombros",
    gruposSecundarios: [],
    instrucciones:
      "De pie, eleva las mancuernas hacia los lados con los codos ligeramente flexionados hasta la altura de los hombros y baja despacio.",
    pasos: [
      "Ponte de pie con una mancuerna en cada mano a los lados del cuerpo.",
      "Flexiona ligeramente los codos y mantén ese ángulo.",
      "Eleva los brazos hacia los lados hasta la altura de los hombros.",
      "Baja despacio sin dejar caer las mancuernas.",
    ],
    evita: "Balancear el tronco para subir el peso o levantar las manos por encima de los codos.",
    consejos: [
      {
        titulo: "Elige bien el peso",
        texto: "Usa un peso que puedas subir sin balancearte: en este ejercicio manda la técnica.",
      },
    ],
  },
  {
    medioId: "vital-0097",
    nombre: "Elevación lateral en máquina",
    grupoPrincipal: "hombros",
    gruposSecundarios: [],
    instrucciones:
      "Colócate en la máquina con los hombros alineados con sus ejes de giro, eleva los brazos hacia los lados hasta la altura de los hombros y baja con control.",
    pasos: [
      "Ajusta la máquina para que los hombros queden alineados con sus ejes de giro.",
      "Coge las asas o apoya los brazos en las almohadillas.",
      "Eleva los brazos hacia los lados hasta la altura de los hombros.",
      "Baja despacio sin dejar que las placas choquen.",
    ],
    evita: "Encoger los hombros hacia las orejas o inclinar el tronco al subir.",
    consejos: [],
  },
  {
    medioId: "vital-0098",
    nombre: "Press militar sentado en multipower",
    grupoPrincipal: "hombros",
    gruposSecundarios: ["triceps"],
    instrucciones:
      "Sentado en un banco bajo la barra guiada del multipower, empuja la barra desde la altura de la barbilla hasta casi estirar los brazos y baja con control.",
    pasos: [
      "Coloca el banco con el respaldo casi vertical bajo la barra.",
      "Coge la barra algo más abierta que los hombros y desengánchala girándola.",
      "Baja la barra con control hasta la altura de la barbilla.",
      "Empuja hacia arriba sin bloquear los codos.",
      "Al terminar, gira la barra para dejarla en los ganchos.",
    ],
    evita: "Despegar la espalda del respaldo o bajar la barra por detrás de la nuca.",
    consejos: [],
  },
  {
    medioId: "vital-0099",
    nombre: "Pájaros en máquina contractora",
    grupoPrincipal: "hombros",
    gruposSecundarios: ["espalda"],
    instrucciones:
      "Sentado de cara al respaldo de la máquina contractora, abre los brazos hacia atrás en un arco amplio y vuelve con control. Trabaja la parte posterior del hombro.",
    pasos: [
      "Siéntate mirando al respaldo, con el pecho apoyado en él.",
      "Ajusta el asiento para que las asas queden a la altura de los hombros.",
      "Coge las asas con los brazos casi estirados y ábrelos hacia atrás.",
      "Vuelve despacio hasta que las manos queden por delante del pecho.",
    ],
    evita: "Doblar los codos y tirar como en un remo en lugar de abrir los brazos en arco.",
    consejos: [],
  },
  {
    medioId: "vital-0100",
    nombre: "Pájaros en polea",
    grupoPrincipal: "hombros",
    gruposSecundarios: ["espalda"],
    instrucciones:
      "De pie entre dos poleas a la altura de los hombros, con los cables cruzados por delante, abre los brazos hacia atrás en un arco amplio y vuelve despacio.",
    pasos: [
      "Coloca las poleas a la altura de los hombros y coge cada cable con la mano contraria.",
      "Da un paso atrás para tensar los cables, con los brazos estirados al frente.",
      "Abre los brazos hacia atrás y hacia fuera con los codos casi estirados.",
      "Vuelve despacio hasta que las manos se crucen por delante.",
    ],
    evita: "Echar el tronco hacia atrás o encoger los hombros para mover el peso.",
    consejos: [],
  },

  // Tríceps
  {
    medioId: "vital-0085",
    nombre: "Extensión de tríceps en polea con cuerda",
    grupoPrincipal: "triceps",
    gruposSecundarios: ["antebrazos"],
    instrucciones:
      "De pie frente a la polea alta, con los codos pegados al cuerpo, estira los brazos hacia abajo y separa los extremos de la cuerda al final. Vuelve despacio sin mover los codos.",
    pasos: [
      "Engancha la cuerda en la polea alta y cógela con las palmas enfrentadas.",
      "Pega los codos a los costados e inclina un poco el tronco hacia delante.",
      "Estira los brazos hacia abajo y separa los extremos de la cuerda al final.",
      "Sube despacio sin despegar los codos del cuerpo.",
    ],
    evita:
      "Separar los codos del cuerpo o echar el peso del tronco encima de la cuerda para bajarla.",
    consejos: [],
  },

  // Glúteos
  {
    medioId: "vital-0057",
    nombre: "Hip thrust con barra",
    grupoPrincipal: "gluteos",
    gruposSecundarios: ["isquiotibiales"],
    instrucciones:
      "Con la parte alta de la espalda apoyada en un banco y la barra sobre la cadera, eleva la cadera apretando los glúteos hasta alinear tronco y muslos. Baja con control.",
    pasos: [
      "Siéntate en el suelo con la parte alta de la espalda apoyada en el borde de un banco.",
      "Coloca la barra sobre la cadera, mejor con una almohadilla.",
      "Apoya los pies a la anchura de las caderas, con las rodillas flexionadas.",
      "Empuja con los talones y sube la cadera hasta alinear hombros, cadera y rodillas.",
      "Aprieta los glúteos arriba un instante y baja despacio.",
    ],
    evita: "Arquear la zona lumbar al subir en lugar de terminar el movimiento con los glúteos.",
    consejos: [
      {
        titulo: "Mirada",
        texto: "Mira al frente y mete un poco la barbilla: ayuda a no arquear la espalda.",
      },
    ],
  },
  {
    medioId: "vital-0061",
    nombre: "Patada de glúteo en polea",
    grupoPrincipal: "gluteos",
    gruposSecundarios: ["isquiotibiales"],
    instrucciones:
      "De pie frente a la polea baja, con la tobillera enganchada, lleva la pierna hacia atrás apretando el glúteo. Vuelve despacio sin dejar que el cable tire de ti.",
    pasos: [
      "Engancha la tobillera a la polea baja y colócala en un tobillo.",
      "Sujétate a la máquina e inclina un poco el tronco hacia delante.",
      "Lleva la pierna hacia atrás con la rodilla casi estirada.",
      "Aprieta el glúteo al final y vuelve con control.",
    ],
    evita: "Arquear la zona lumbar para llevar la pierna más atrás.",
    consejos: [],
  },
  {
    medioId: "vital-0069",
    nombre: "Abducción de cadera en máquina",
    grupoPrincipal: "gluteos",
    gruposSecundarios: [],
    instrucciones:
      "Sentado en la máquina con las almohadillas por fuera de las rodillas, separa las piernas empujando hacia fuera y vuelve despacio.",
    pasos: [
      "Siéntate con la espalda apoyada y las almohadillas por fuera de las rodillas.",
      "Sujeta las asas laterales para mantener el tronco quieto.",
      "Separa las piernas hacia fuera de forma controlada.",
      "Vuelve despacio sin dejar que las placas choquen.",
    ],
    evita: "Hacer el movimiento a tirones o dejar que las placas caigan de golpe.",
    consejos: [],
  },
  {
    medioId: "vital-0072",
    nombre: "Swing con kettlebell",
    grupoPrincipal: "gluteos",
    gruposSecundarios: ["isquiotibiales", "espalda", "hombros"],
    instrucciones:
      "Balancea la kettlebell entre las piernas y proyéctala hacia delante con un empuje enérgico de la cadera, no con los brazos. Es un movimiento de bisagra de cadera, no una sentadilla.",
    pasos: [
      "Colócate con los pies algo más abiertos que las caderas y la kettlebell un poco por delante.",
      "Cógela con las dos manos y llévala atrás entre las piernas flexionando la cadera.",
      "Extiende la cadera con fuerza para que la kettlebell suba al frente.",
      "Deja que vuelva entre las piernas acompañándola con la cadera.",
      "Para terminar, llévala atrás una última vez y déjala en el suelo con control.",
    ],
    evita:
      "Subir la kettlebell con los brazos o redondear la espalda al recibirla entre las piernas.",
    consejos: [
      {
        titulo: "Aprende el gesto",
        texto: "Domina antes la bisagra de cadera sin peso o con una kettlebell ligera.",
      },
    ],
  },

  // Isquiotibiales
  {
    medioId: "vital-0060",
    nombre: "Peso muerto rumano con barra",
    equivalentes: ["Peso muerto rumano"],
    grupoPrincipal: "isquiotibiales",
    gruposSecundarios: ["gluteos", "espalda"],
    instrucciones:
      "De pie con la barra en las manos, lleva la cadera atrás y baja la barra pegada a las piernas con las rodillas ligeramente flexionadas. Sube empujando la cadera al frente, con la espalda neutra en todo momento.",
    pasos: [
      "De pie, sujeta la barra con las manos algo más abiertas que las caderas.",
      "Flexiona un poco las rodillas y mantén ese ángulo.",
      "Lleva la cadera atrás y baja la barra rozando los muslos.",
      "Baja hasta notar tensión detrás de los muslos sin redondear la espalda.",
      "Sube llevando la cadera al frente y aprieta los glúteos arriba.",
    ],
    evita: "Redondear la espalda o alejar la barra de las piernas al bajar.",
    consejos: [
      {
        titulo: "Recorrido",
        texto: "Lo marca tu flexibilidad: detente cuando la espalda empiece a redondearse.",
      },
    ],
  },
  {
    medioId: "vital-0065",
    nombre: "Bisagra de cadera con mancuernas",
    grupoPrincipal: "isquiotibiales",
    gruposSecundarios: ["gluteos", "espalda"],
    instrucciones:
      "Con una mancuerna en cada mano, lleva la cadera atrás e inclina el tronco con la espalda neutra, dejando que las mancuernas bajen cerca de las piernas. Sube llevando la cadera al frente.",
    pasos: [
      "De pie, con una mancuerna en cada mano delante de los muslos.",
      "Flexiona un poco las rodillas y mantenlas así.",
      "Lleva la cadera atrás mientras el tronco se inclina, con la espalda recta.",
      "Baja hasta notar tensión detrás de los muslos.",
      "Vuelve arriba empujando la cadera hacia delante.",
    ],
    evita: "Convertir el movimiento en una sentadilla flexionando demasiado las rodillas.",
    consejos: [
      {
        titulo: "Aprende el gesto",
        texto: "Es la base del peso muerto: domínalo aquí antes de pasar a la barra.",
      },
    ],
  },
  {
    medioId: "vital-0075",
    nombre: "Curl femoral tumbado en máquina",
    grupoPrincipal: "isquiotibiales",
    gruposSecundarios: ["gemelos"],
    instrucciones:
      "Tumbado boca abajo con el rodillo por encima de los talones, flexiona las rodillas acercando los talones a los glúteos y baja con control.",
    pasos: [
      "Túmbate boca abajo con las rodillas justo por fuera del borde del banco.",
      "Coloca el rodillo por encima de los talones.",
      "Sujeta las asas y flexiona las rodillas sin levantar la cadera.",
      "Baja despacio hasta casi estirar las piernas.",
    ],
    evita: "Levantar la cadera del banco para ayudarte a subir el peso.",
    consejos: [],
  },
  {
    medioId: "vital-0079",
    nombre: "Curl femoral sentado en máquina",
    grupoPrincipal: "isquiotibiales",
    gruposSecundarios: ["gemelos"],
    instrucciones:
      "Sentado con el rodillo detrás de los tobillos y los muslos sujetos por la almohadilla, flexiona las rodillas llevando los talones hacia abajo y atrás. Vuelve con control.",
    pasos: [
      "Ajusta el respaldo para que las rodillas queden alineadas con el eje de la máquina.",
      "Coloca el rodillo detrás de los tobillos y baja la almohadilla sobre los muslos.",
      "Flexiona las rodillas llevando los talones hacia abajo y atrás.",
      "Vuelve despacio hasta casi estirar las piernas.",
    ],
    evita: "Despegar la espalda del respaldo o soltar el peso de golpe al volver.",
    consejos: [],
  },
  {
    medioId: "vital-0084",
    nombre: "Peso muerto con piernas rígidas en máquina",
    grupoPrincipal: "isquiotibiales",
    gruposSecundarios: ["gluteos", "espalda"],
    instrucciones:
      "Con la barra guiada del multipower, baja la barra pegada a las piernas llevando la cadera atrás y con las rodillas casi estiradas. Sube empujando la cadera al frente, con la espalda neutra en todo momento.",
    pasos: [
      "Colócate de pie bajo la barra, con los pies a la anchura de las caderas.",
      "Coge la barra con las manos algo más abiertas que las piernas y desengánchala.",
      "Con las rodillas casi estiradas, lleva la cadera atrás y baja la barra rozando las piernas.",
      "Baja hasta notar tensión detrás de los muslos sin redondear la espalda.",
      "Sube llevando la cadera al frente y engancha la barra al terminar.",
    ],
    evita: "Redondear la espalda para llegar más abajo.",
    consejos: [],
  },

  // Cuádriceps
  {
    medioId: "vital-0054",
    nombre: "Sentadilla trasera con barra",
    grupoPrincipal: "cuadriceps",
    gruposSecundarios: ["gluteos", "isquiotibiales"],
    instrucciones:
      "Con la barra apoyada sobre la parte alta de la espalda, baja flexionando caderas y rodillas a la vez y sube empujando el suelo. Mantén la espalda neutra y el pecho alto durante todo el recorrido.",
    pasos: [
      "Coloca la barra sobre la parte alta de la espalda, no sobre el cuello.",
      "Separa los pies a la anchura de los hombros, con las puntas algo abiertas.",
      "Coge aire, tensa el abdomen y baja llevando la cadera atrás y abajo.",
      "Baja hasta donde mantengas la espalda neutra y los talones en el suelo.",
      "Sube empujando el suelo con todo el pie y suelta el aire arriba.",
    ],
    evita: "Dejar que las rodillas se vayan hacia dentro o que los talones se levanten del suelo.",
    consejos: [
      {
        titulo: "Seguridad",
        texto:
          "Pon los topes de seguridad del rack a una altura que te recoja la barra si no puedes subir.",
      },
      {
        titulo: "Aproximaciones",
        texto: "Calienta con series más ligeras antes de llegar al peso de trabajo.",
      },
    ],
  },
  {
    medioId: "vital-0055",
    nombre: "Sentadilla búlgara con barra",
    grupoPrincipal: "cuadriceps",
    gruposSecundarios: ["gluteos", "isquiotibiales"],
    instrucciones:
      "Con la barra sobre la espalda y el empeine de la pierna de atrás apoyado en un banco, baja flexionando la pierna delantera y sube empujando con ella. Exige mucho equilibrio: domínala antes con mancuernas o sin peso.",
    pasos: [
      "Colócate de espaldas a un banco con la barra sobre la parte alta de la espalda.",
      "Apoya el empeine de un pie en el banco y adelanta el otro lo suficiente.",
      "Baja en vertical hasta que el muslo delantero quede cerca de la horizontal.",
      "Sube empujando con el pie delantero y mantén el tronco estable.",
      "Completa un lado antes de cambiar de pierna.",
    ],
    evita: "Colocar el pie delantero demasiado cerca del banco y perder el equilibrio al bajar.",
    consejos: [
      {
        titulo: "Equilibrio",
        texto: "Si te cuesta mantener el equilibrio, practica primero sin barra o con mancuernas.",
      },
    ],
  },
  {
    medioId: "vital-0056",
    nombre: "Sentadilla frontal con barra",
    grupoPrincipal: "cuadriceps",
    gruposSecundarios: ["gluteos", "abdomen"],
    instrucciones:
      "Con la barra apoyada sobre la parte delantera de los hombros y los codos altos, baja en sentadilla manteniendo el tronco lo más vertical posible. Sube empujando el suelo sin dejar caer los codos.",
    pasos: [
      "Apoya la barra sobre la parte delantera de los hombros, cerca del cuello.",
      "Levanta los codos al frente para que la barra no ruede.",
      "Coge aire, tensa el abdomen y baja con el tronco erguido.",
      "Sube empujando con todo el pie y mantén los codos altos.",
    ],
    evita: "Dejar caer los codos, porque la barra rueda hacia delante y el tronco se inclina.",
    consejos: [
      {
        titulo: "Agarre",
        texto:
          "Si te falta movilidad en las muñecas, apoya solo la punta de los dedos bajo la barra.",
      },
    ],
  },
  {
    medioId: "vital-0058",
    nombre: "Marcha con barra",
    grupoPrincipal: "cuadriceps",
    gruposSecundarios: ["gluteos", "abdomen"],
    instrucciones:
      "De pie con la barra sobre la parte alta de la espalda, eleva una rodilla al frente y vuelve a apoyar, alternando las piernas. El objetivo es mantener el tronco estable y la cadera nivelada.",
    pasos: [
      "Coloca la barra sobre la parte alta de la espalda y ponte de pie con el abdomen firme.",
      "Eleva una rodilla al frente sin inclinar el tronco.",
      "Apoya el pie con control y sube la otra rodilla.",
      "Sigue alternando a un ritmo tranquilo y constante.",
    ],
    evita: "Balancear el tronco o inclinarte hacia un lado al levantar la rodilla.",
    consejos: [
      {
        titulo: "Empieza ligero",
        texto:
          "Aquí manda el equilibrio, no el peso: empieza con la barra sola o con muy poca carga.",
      },
    ],
  },
  {
    medioId: "vital-0059",
    nombre: "Zancadas atrás con barra",
    grupoPrincipal: "cuadriceps",
    gruposSecundarios: ["gluteos", "isquiotibiales"],
    instrucciones:
      "Con la barra sobre la espalda, da un paso largo hacia atrás y baja hasta que las dos rodillas queden flexionadas. Vuelve a la posición inicial empujando con el pie delantero.",
    pasos: [
      "Colócate de pie con la barra sobre la parte alta de la espalda.",
      "Da un paso atrás y apoya la punta del pie.",
      "Baja en vertical hasta que la rodilla de atrás quede cerca del suelo.",
      "Empuja con el pie delantero para volver y junta los pies.",
      "Alterna las piernas o completa un lado antes de cambiar.",
    ],
    evita:
      "Dejar que la rodilla delantera se vaya hacia dentro o golpear el suelo con la de atrás.",
    consejos: [],
  },
  {
    medioId: "vital-0063",
    nombre: "Sentadilla búlgara con mancuernas",
    grupoPrincipal: "cuadriceps",
    gruposSecundarios: ["gluteos", "isquiotibiales"],
    instrucciones:
      "Con una mancuerna en cada mano y el empeine de la pierna de atrás apoyado en un banco, baja flexionando la pierna delantera y sube empujando con ella.",
    pasos: [
      "Colócate de espaldas a un banco con una mancuerna en cada mano.",
      "Apoya el empeine de un pie en el banco y adelanta el otro.",
      "Baja en vertical con el tronco firme y los brazos relajados.",
      "Sube empujando con el pie delantero.",
      "Completa un lado antes de cambiar de pierna.",
    ],
    evita: "Empujar con la pierna de atrás en lugar de con la delantera.",
    consejos: [
      {
        titulo: "Distancia",
        texto:
          "Prueba la distancia al banco sin peso: al bajar, el pie delantero debe quedar entero en el suelo.",
      },
    ],
  },
  {
    medioId: "vital-0064",
    nombre: "Sentadilla goblet con mancuerna",
    equivalentes: ["Sentadilla goblet"],
    grupoPrincipal: "cuadriceps",
    gruposSecundarios: ["gluteos", "abdomen"],
    instrucciones:
      "Sujeta una mancuerna en vertical pegada al pecho y baja en sentadilla con el tronco erguido. Es una buena forma de aprender el gesto de la sentadilla.",
    pasos: [
      "Coge una mancuerna por un extremo y pégala al pecho.",
      "Separa los pies a la anchura de los hombros, con las puntas algo abiertas.",
      "Baja llevando la cadera atrás y abajo, con los codos entre las rodillas.",
      "Sube empujando el suelo con todo el pie.",
    ],
    evita: "Separar la mancuerna del pecho, lo que tira del tronco hacia delante.",
    consejos: [],
  },
  {
    medioId: "vital-0066",
    nombre: "Sentadilla con salto y mancuernas",
    grupoPrincipal: "cuadriceps",
    gruposSecundarios: ["gluteos", "gemelos"],
    instrucciones:
      "Con una mancuerna ligera en cada mano, baja en sentadilla y salta hacia arriba con fuerza. Aterriza suave, con las rodillas flexionadas, antes de empezar el siguiente salto.",
    pasos: [
      "Coge una mancuerna ligera en cada mano, con los brazos a los lados.",
      "Baja en sentadilla con la espalda neutra.",
      "Empuja el suelo con fuerza y salta hacia arriba.",
      "Aterriza sobre la parte delantera del pie y amortigua flexionando las rodillas.",
    ],
    evita: "Aterrizar con las piernas rígidas o con las rodillas hacia dentro.",
    consejos: [
      {
        titulo: "Calidad antes que cantidad",
        texto: "Detente cuando el salto pierda altura o el aterrizaje deje de ser suave.",
      },
    ],
  },
  {
    medioId: "vital-0068",
    nombre: "Sentadilla hack en máquina",
    grupoPrincipal: "cuadriceps",
    gruposSecundarios: ["gluteos"],
    instrucciones:
      "Con la espalda apoyada en el respaldo y los hombros bajo las almohadillas, baja flexionando las rodillas y sube empujando la plataforma. La máquina guía el recorrido; tu atención va a los pies y las rodillas.",
    pasos: [
      "Colócate con la espalda pegada al respaldo y los hombros bajo las almohadillas.",
      "Apoya los pies en la plataforma a la anchura de los hombros.",
      "Quita los seguros y baja despacio flexionando las rodillas.",
      "Sube empujando con todo el pie sin bloquear las rodillas arriba.",
      "Vuelve a poner los seguros al terminar.",
    ],
    evita: "Despegar la cadera del respaldo o bloquear las rodillas de golpe al subir.",
    consejos: [],
  },
  {
    medioId: "vital-0070",
    nombre: "Marcha con kettlebell",
    grupoPrincipal: "cuadriceps",
    gruposSecundarios: ["gluteos", "abdomen"],
    instrucciones:
      "De pie, sujeta una kettlebell con las dos manos delante del pecho y eleva las rodillas al frente de forma alterna. Trabaja la estabilidad del tronco y el equilibrio sobre una pierna.",
    pasos: [
      "Sujeta la kettlebell por el asa con las dos manos, pegada al pecho.",
      "Ponte de pie con el abdomen firme y la mirada al frente.",
      "Eleva una rodilla al frente y apoya el pie con control.",
      "Alterna las piernas a ritmo constante sin mover el tronco.",
    ],
    evita: "Inclinar el tronco hacia atrás al subir la rodilla.",
    consejos: [],
  },
  {
    medioId: "vital-0071",
    nombre: "Levantamiento de kettlebell",
    grupoPrincipal: "cuadriceps",
    gruposSecundarios: ["gluteos", "hombros"],
    instrucciones:
      "Coge la kettlebell del suelo flexionando caderas y rodillas, ponte de pie y, ya arriba, elévala al frente con los brazos estirados hasta la altura de los hombros. Bájala con control y repite el ciclo.",
    pasos: [
      "Colócate con los pies algo más abiertos que las caderas y la kettlebell entre ellos.",
      "Flexiona caderas y rodillas con la espalda neutra y coge el asa con las dos manos.",
      "Sube estirando las piernas hasta quedar de pie.",
      "Eleva la kettlebell al frente con los brazos estirados hasta la altura de los hombros.",
      "Bájala despacio y vuelve a flexionar las piernas para empezar de nuevo.",
    ],
    evita: "Subir la kettlebell con un balanceo de la espalda en lugar de con los brazos.",
    consejos: [],
  },
  {
    medioId: "vital-0073",
    nombre: "Extensión de cuádriceps en máquina",
    grupoPrincipal: "cuadriceps",
    gruposSecundarios: [],
    instrucciones:
      "Sentado en la máquina con el rodillo sobre la parte baja de las espinillas, estira las rodillas y baja despacio.",
    pasos: [
      "Ajusta el respaldo para que las rodillas queden alineadas con el eje de la máquina.",
      "Coloca el rodillo sobre la parte baja de las espinillas, por encima de los tobillos.",
      "Sujeta las asas y estira las piernas de forma controlada.",
      "Baja despacio sin dejar que las placas choquen.",
    ],
    evita: "Dar un tirón para subir el peso o despegar la cadera del asiento.",
    consejos: [],
  },
  {
    medioId: "vital-0074",
    nombre: "Prensa de piernas",
    grupoPrincipal: "cuadriceps",
    gruposSecundarios: ["gluteos", "isquiotibiales"],
    instrucciones:
      "Con la espalda y la cadera bien apoyadas, baja la plataforma flexionando las rodillas y empújala de vuelta sin bloquearlas arriba.",
    pasos: [
      "Siéntate con la espalda y la cadera pegadas al respaldo.",
      "Apoya los pies en la plataforma a la anchura de los hombros.",
      "Quita los seguros y baja la plataforma flexionando las rodillas.",
      "Baja solo hasta donde la cadera siga apoyada en el asiento.",
      "Empuja con todo el pie y detente antes de bloquear las rodillas.",
    ],
    evita: "Bajar tanto que la cadera se despegue del asiento y se redondee la zona lumbar.",
    consejos: [
      {
        titulo: "Seguros",
        texto: "Vuelve a poner los seguros de la máquina antes de sacar los pies de la plataforma.",
      },
    ],
  },
  {
    medioId: "vital-0081",
    nombre: "Subidas al cajón con peso",
    grupoPrincipal: "cuadriceps",
    gruposSecundarios: ["gluteos", "isquiotibiales"],
    instrucciones:
      "Con una mancuerna en cada mano, apoya un pie entero en el cajón y sube empujando con esa pierna hasta quedar de pie encima. Baja con control.",
    pasos: [
      "Colócate frente a un cajón estable con una mancuerna en cada mano.",
      "Apoya un pie entero sobre el cajón.",
      "Empuja con la pierna de arriba hasta estirarla, sin impulsarte con la de abajo.",
      "Baja despacio el pie que subiste en último lugar.",
      "Completa un lado antes de cambiar o alterna, según te indique tu entrenador.",
    ],
    evita: "Impulsarte con el pie del suelo en lugar de subir con la pierna que está en el cajón.",
    consejos: [
      {
        titulo: "Altura",
        texto:
          "Elige un cajón en el que, con el pie apoyado, la rodilla no quede por encima de la cadera.",
      },
    ],
  },

  // Cardio: el principal es el grupo que más trabaja
  {
    medioId: "vital-0053",
    nombre: "Sprint en bicicleta de aire",
    grupoPrincipal: "cuadriceps",
    gruposSecundarios: ["gluteos", "hombros", "abdomen"],
    instrucciones:
      "Pedalea a máxima intensidad empujando y tirando de los brazos de la máquina a la vez. La resistencia crece cuanto más fuerte pedaleas, así que la dureza la marcas tú.",
    pasos: [
      "Ajusta el sillín para que la rodilla quede ligeramente flexionada con el pedal abajo.",
      "Coge los brazos de la máquina y pedalea a ritmo suave para calentar.",
      "En el sprint, empuja con las piernas y alterna empujar y tirar con los brazos.",
      "Al acabar el esfuerzo, sigue pedaleando suave hasta recuperar el aliento.",
    ],
    evita: "Bajarte de golpe al terminar el sprint en lugar de seguir pedaleando suave.",
    consejos: [
      {
        titulo: "Tu ritmo",
        texto: "Empieza con esfuerzos cortos y ve alargándolos según te indique tu entrenador.",
      },
    ],
  },
  {
    medioId: "vital-0062",
    nombre: "Bicicleta estática",
    grupoPrincipal: "cuadriceps",
    gruposSecundarios: ["gluteos", "isquiotibiales", "gemelos"],
    instrucciones:
      "Pedalea a un ritmo constante con el tronco estable y los hombros relajados. Ajusta la resistencia al esfuerzo que te haya indicado tu entrenador.",
    pasos: [
      "Ajusta el sillín a la altura de la cadera, de pie junto a la bicicleta.",
      "Con el pedal abajo, la rodilla debe quedar ligeramente flexionada.",
      "Pedalea con el tronco estable, sin balancear la cadera en el sillín.",
      "Termina con unos minutos a ritmo suave para recuperar.",
    ],
    evita: "Llevar el sillín tan bajo que las rodillas se flexionen mucho en cada pedalada.",
    consejos: [],
  },
  {
    medioId: "vital-0067",
    nombre: "Elíptica en intervalos",
    grupoPrincipal: "cuadriceps",
    gruposSecundarios: ["gluteos", "isquiotibiales", "hombros"],
    instrucciones:
      "Alterna tramos a ritmo alto con tramos suaves, empujando y tirando de las asas mientras las piernas siguen el movimiento de la máquina. Mantén el tronco erguido y los pies apoyados en los pedales.",
    pasos: [
      "Sube a la elíptica y coge las asas móviles.",
      "Empieza a ritmo suave para calentar.",
      "En los tramos rápidos, sube el ritmo o la resistencia sin perder la postura.",
      "En los tramos suaves, baja el ritmo hasta recuperar el aliento.",
    ],
    evita: "Apoyar el peso del cuerpo en las asas o encorvarte sobre la consola.",
    consejos: [],
  },
  {
    medioId: "vital-0078",
    nombre: "Correr en cinta",
    grupoPrincipal: "cuadriceps",
    gruposSecundarios: ["gluteos", "isquiotibiales", "gemelos"],
    instrucciones:
      "Corre con el tronco erguido, zancada corta y los brazos acompañando el movimiento. Ajusta la velocidad y la inclinación a lo que te haya indicado tu entrenador.",
    pasos: [
      "Sube a la cinta con ella parada y engancha la pinza de seguridad a la ropa.",
      "Empieza caminando y sube la velocidad poco a poco.",
      "Corre en el centro de la cinta, con la mirada al frente.",
      "Al terminar, baja la velocidad y camina hasta recuperar el aliento.",
    ],
    evita:
      "Agarrarte a los laterales mientras corres o ir pegado a la parte delantera de la cinta.",
    consejos: [],
  },
  {
    medioId: "vital-0082",
    nombre: "Escaladora (variante)",
    grupoPrincipal: "cuadriceps",
    gruposSecundarios: ["gluteos", "isquiotibiales", "gemelos"],
    instrucciones:
      "Otra toma de la escaladora: sube escalones de forma continua con el pie entero en cada peldaño, el tronco erguido y las manos en los pasamanos solo para mantener el equilibrio.",
    pasos: [
      "Sube a la máquina parada y coge los pasamanos.",
      "Arranca a un ritmo suave y apoya el pie entero en cada escalón.",
      "Mantén el tronco erguido y las manos apoyadas sin cargar peso en ellas.",
      "Al terminar, baja el ritmo antes de parar la máquina.",
    ],
    evita: "Colgarte de los pasamanos o inclinarte sobre la consola.",
    consejos: [],
  },
  {
    medioId: "vital-0083",
    nombre: "Escaladora",
    grupoPrincipal: "cuadriceps",
    gruposSecundarios: ["gluteos", "isquiotibiales", "gemelos"],
    instrucciones:
      "Sube escalones de forma continua a un ritmo que puedas mantener, con el tronco erguido y el pie entero en cada peldaño. Usa los pasamanos solo para mantener el equilibrio.",
    pasos: [
      "Sube a la máquina parada y agárrate a los pasamanos.",
      "Elige un ritmo suave para empezar.",
      "Apoya el pie entero en cada escalón y empuja con toda la pierna.",
      "Mantén el tronco erguido y la mirada al frente.",
      "Baja el ritmo al terminar y espera a que la máquina pare para bajarte.",
    ],
    evita: "Apoyar el peso del cuerpo en los pasamanos o subir solo con la punta de los pies.",
    consejos: [],
  },
  {
    medioId: "vital-0086",
    nombre: "Caminar en cinta",
    grupoPrincipal: "cuadriceps",
    gruposSecundarios: ["gluteos", "gemelos"],
    instrucciones:
      "Camina con paso natural, el tronco erguido y los brazos balanceándose. La velocidad y la inclinación las decide tu entrenador según el objetivo.",
    pasos: [
      "Sube a la cinta parada y engancha la pinza de seguridad a la ropa.",
      "Arranca a velocidad baja y súbela poco a poco.",
      "Camina en el centro de la cinta, con la mirada al frente.",
      "Si usas inclinación, mantén el tronco erguido sin colgarte de las barras.",
    ],
    evita: "Agarrarte a la consola o a las barras mientras caminas, sobre todo con inclinación.",
    consejos: [],
  },
]
