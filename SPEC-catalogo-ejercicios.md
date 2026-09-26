# Spec: `catalogo-ejercicios`

> Módulo 2 de 8. Depende de `identity`. Fundamentos técnicos en [SPEC.md](SPEC.md).
> Mapa: [CAPABILITY-MAP.md](CAPABILITY-MAP.md)

## Objetivo

Qué ejercicios existen, cómo se llaman, qué músculo trabajan y cómo se ven al
hacerlos.

Es el vocabulario del resto de la app. `entrenamiento` prescribe sobre esta
lista y el cliente la lee de pie en la sala, con el móvil en la mano y sin
cobertura. Si el catálogo está mal, el editor de rutinas ofrece nombres
duplicados, la librería del mapa muscular deja huecos y la ficha que abre el
cliente no explica el ejercicio que tiene delante.

## Alcance

**Dentro**

- Alta, edición, retirada y reposición de ejercicios
- Grupos musculares como vocabulario cerrado, con principal y secundarios
- Búsqueda por nombre y filtro por grupo muscular
- Librería por mapa muscular: pulsar un músculo del cuerpo y ver sus ejercicios
- Figura animada por ejercicio, con su origen y su licencia declarados
- Hueco de vídeo por ejercicio, con o sin vídeo dentro
- Subida de figura y vídeo al almacenamiento de objetos, y su entrega firmada
- La mitad de la ficha de detalle que describe el ejercicio

**Fuera**

- Series, pesos, repeticiones y notas del cliente. Son de `entrenamiento`
  ([CAPABILITY-MAP.md](CAPABILITY-MAP.md)). Este módulo define el ejercicio;
  quién lo hace y cuánto levanta, no
- El editor de rutinas del entrenador. Consume este catálogo y vive en
  `entrenamiento`, que es donde está el dato del cliente
- Ejercicios propios de un cliente. Un catálogo por persona multiplica el
  mantenimiento del entrenador por el número de clientes que tenga
- Grabar o editar vídeo dentro de la app. Se sube un fichero ya grabado
- El proveedor concreto de almacenamiento. El [ADR 0005](docs/adr/0005-almacenamiento-de-fotos.md)
  decidió el tipo y dejó la marca sin decidir. Ver la pregunta abierta 4
- Cualquier dato de salud. Fuera por diseño, y ver el requisito 18: es
  exactamente lo que permite construir este módulo entero con la fase de
  cumplimiento aplazada

## Los cuatro roles

| Capacidad                         | Cliente | Entrenador | Nutricionista | Empleado |
| --------------------------------- | :-----: | :--------: | :-----------: | :------: |
| Ver la ficha de un ejercicio      |   sí    |     sí     |      no       |    no    |
| Buscar y filtrar el catálogo      |   sí    |     sí     |      no       |    no    |
| Ver la librería por mapa muscular |   sí    |     sí     |      no       |    no    |
| Ver la figura o el vídeo          |   sí    |     sí     |      no       |    no    |
| Crear un ejercicio                |   no    |     sí     |      no       |    no    |
| Editar un ejercicio               |   no    |     sí     |      no       |    no    |
| Retirar y reponer un ejercicio    |   no    |     sí     |      no       |    no    |
| Ver los ejercicios retirados      |   no    |     sí     |      no       |    no    |
| Gestionar los grupos musculares   |   no    |     sí     |      no       |    no    |
| Subir una figura o un vídeo       |   no    |     sí     |      no       |    no    |

La tabla tiene una sola frontera y conviene decirlo sin adornarla: el cliente
lee y el entrenador escribe. Las columnas del nutricionista y del empleado son
"no" enteras, y eso no es un descuido. El empleado solo llega a fichar
(requisito 16 de [SPEC-identity.md](SPEC-identity.md)) y el nutricionista no
prescribe entrenos. Abrirle la lectura el día que haga falta es un decorador,
pero es una decisión, no un olvido. Ver la pregunta abierta 1.

## Requisitos

1. **El catálogo es único y lo mantiene el entrenador.** Una sola lista para
   todo el negocio. No hay catálogos por cliente ni ejercicios privados. Un
   catálogo por persona obligaría al entrenador a mantener treinta listas y
   rompería la promesa del panel: comparar lo que levanta cada uno exige que
   "press banca" signifique lo mismo en todas las fichas.
2. **Un ejercicio se retira, nunca se borra.** Es el mismo problema que resolvió
   `identity` con las bajas de clientes (requisito 14) y tiene la misma
   respuesta. El histórico de entrenos apunta a estas filas durante años. Borrar
   una deja registros huérfanos o, peor, obliga a borrar los entrenos que la
   citan. No existe endpoint de borrado y no se añade.
3. **Retirar saca el ejercicio del presente, no del pasado.** Un ejercicio
   retirado desaparece de la búsqueda, de la librería y del selector del editor
   de rutinas. Sigue abriéndose por su identificador desde un entreno antiguo, y
   su ficha dice que está retirado. Quien mire un entreno de hace un año tiene
   que poder ver qué hizo.
4. **Reponer existe.** Retirar por error no puede exigir entrar en la base de
   datos a mano. Es la misma decisión que se tomó con la reactivación de
   clientes el 2026-09-16, por la misma razón.
5. **Los grupos musculares son un vocabulario cerrado.** Array `as const` en
   `packages/shared` y enumerado de Prisma en paralelo, igual que `ROLES`. Con
   texto libre aparecen "dorsal", "dorsales" y "Dorsal" como tres músculos
   distintos, el mapa muscular queda con huecos y nadie se entera hasta que un
   cliente pulsa una zona vacía.
6. **Cada ejercicio tiene un grupo principal obligatorio y grupos secundarios
   opcionales.** El principal es por el que el ejercicio aparece en el mapa
   muscular; los secundarios solo amplían la búsqueda. Sin un principal único,
   un ejercicio saldría en tres zonas del cuerpo y la librería dejaría de ser una
   forma de navegar.
7. **El nombre del ejercicio es único y lo comprueba el servidor.** Dos "press
   banca" en el selector de rutinas es un error que el entrenador comete una vez
   y arrastra para siempre, porque las series quedan repartidas entre los dos.
8. **Las instrucciones son texto plano y corto.** Sin formato enriquecido y sin
   HTML. Un editor de texto rico en móvil es una pantalla entera de trabajo, y
   guardar HTML de un campo de entrada es abrir una vía de inyección en la ficha
   que abren todos los clientes.
9. **La figura y el vídeo son opcionales.** Un ejercicio sin nada se crea, se
   busca y se prescribe igual. El catálogo tiene que poder poblarse en una tarde
   tecleando nombres, y las figuras llegar después.
10. **El hueco del vídeo se dibuja desde el primer día, tenga vídeo o no.**
    Cuando no lo hay, la ficha dice que todavía no hay vídeo en lugar de no
    mostrar nada. Es la decisión del documento de intención: las figuras entran
    primero y el vídeo después, con su botón ya colocado al lado. Un botón que
    aparece de la nada meses después es una pantalla distinta que hay que volver
    a diseñar.
11. **Todo contenido entra con su origen declarado.** Cada figura y cada vídeo
    guardan de dónde salieron: _propio_, _licenciado_ o _provisional_. Un
    contenido _provisional_ es el que está puesto para desarrollar y no tiene
    derecho de uso comprobado. Sin este campo, el día de publicar nadie sabe
    cuáles hay que sustituir y hay que abrirlos uno a uno. Ver el riesgo de
    licencia al final de este documento.
12. **Las figuras y los vídeos viven en almacenamiento de objetos, no en el
    disco del servidor.** Lo decidió el [ADR 0005](docs/adr/0005-almacenamiento-de-fotos.md)
    para las fotos y se aplica igual aquí: un centenar de vídeos de decenas de
    megas no cabe en un disco que cada despliegue reinicia. El móvil sube
    directamente con un permiso temporal que emite la API, y encoge la imagen
    antes de subirla.
13. **El contenido se sirve por enlace firmado, pero aquí protege el negocio y
    no a una persona.** El ADR 0005 pide caducidad corta porque una foto de
    evolución es dato de salud y una dirección filtrada enseña el cuerpo de una
    clienta. Una figura de un press banca no. La parte que se mantiene es que no
    hay ningún contenedor público: el permiso se comprueba antes de firmar. La
    parte que cambia es que la caducidad puede ser larga y el fichero se puede
    guardar en el dispositivo, y eso es lo que hace posible el requisito 14.
    Quien autoriza aquí es el rol, no `AlcanceClienteService`: un ejercicio no
    pertenece a ningún cliente.
14. **El catálogo se puede leer sin cobertura.** Las salas están en sótanos. El
    cliente abre la ficha del ejercicio con el móvil sin red y tiene que ver el
    nombre, el grupo muscular, las instrucciones y la figura. El catálogo cambia
    pocas veces al mes, así que se guarda en el dispositivo y se refresca cuando
    hay red. Sin esto, la pantalla más usada de la app está en blanco justo
    donde se usa.
15. **Todo listado devuelve filas y total.** Igual que `ListadoUsuariosSchema`.
    Una lista cortada en silencio es de los errores que más tardan en
    descubrirse: el entrenador cree que tiene cuarenta ejercicios y ve treinta.
16. **La librería por mapa muscular es una vista del catálogo, no una tabla
    aparte.** Pulsar un músculo del cuerpo equivale a filtrar por grupo
    principal. Guardar la librería en su propia tabla crearía dos verdades sobre
    qué ejercicio trabaja qué músculo, y se separarían en la primera edición.
17. **La ficha de ejercicio es media pantalla de este módulo.** Nombre, grupo,
    instrucciones, figura y vídeo son del catálogo. Las series que registra el
    cliente son de `entrenamiento`. La pantalla es compuesta, como ya dice el
    mapa de capacidades, y la frontera está en el dato: en cuanto aparece un
    número que ha levantado alguien, se ha cruzado.
18. **Este módulo no guarda ningún dato de una persona.** Ninguna tabla del
    catálogo lleva una columna que apunte a un usuario. No es una casualidad del
    diseño, es la condición que permite construirlo entero hoy: la fase de
    cumplimiento está aplazada desde el 2026-09-17 y, mientras no haya
    consentimiento, cualquier módulo que toque datos de una persona real queda
    limitado a datos de prueba. El catálogo no tiene ese límite y conviene que
    siga sin tenerlo.

## Modelo de datos

Esquema de partida. Los nombres definitivos se fijan en la fase de plan.

| Entidad                      | Campos clave                                                                           |
| ---------------------------- | -------------------------------------------------------------------------------------- |
| `Ejercicio`                  | id, nombre, grupoPrincipal, instrucciones, estado, retiradoEn, creadoEn, actualizadoEn |
| `GrupoSecundarioDeEjercicio` | ejercicioId, grupo                                                                     |
| `ContenidoDeEjercicio`       | id, ejercicioId, tipo, claveDeObjeto, origen, licencia, atribucion, subidoEn           |

`grupoPrincipal` y `grupo` son el mismo enumerado cerrado de grupos musculares.
Cuántos valores tiene es la pregunta abierta 3 y hay que contestarla antes de la
primera migración, porque añadir uno después parte en dos la librería de quien ya
tenga la app instalada.

`estado` es un enumerado de dos: _publicado_ y _retirado_. Un booleano llamado
`borrado` invitaría precisamente a lo que el requisito 2 prohíbe, y el enumerado
nombra los dos estados con las palabras que usa el entrenador. `retiradoEn`
guarda cuándo, para poder responder por qué desapareció un ejercicio de una
rutina.

`tipo` de contenido es un enumerado de dos: _figura_ y _video_. Un ejercicio
admite como mucho uno de cada, y los dos pueden faltar (requisito 9).

`origen` es un enumerado de tres: _propio_, _licenciado_ y _provisional_.
`licencia` y `atribucion` son texto opcional y solo tienen sentido cuando el
origen es _licenciado_. Este es el campo que convierte el riesgo de licencia en
una consulta de una línea en vez de en una revisión manual de cien ficheros.

`claveDeObjeto` es la ruta dentro del almacenamiento y **nunca sale del
servidor**. La API devuelve un enlace firmado; la clave se queda dentro, porque
publicarla es publicar la estructura del contenedor.

## Success Criteria

Cada punto es un test que existe o el módulo no está terminado.

1. Un cliente que pide la ficha de un ejercicio publicado la recibe.
2. Un cliente que intenta crear, editar o retirar un ejercicio recibe denegación.
3. Un nutricionista que pide el catálogo recibe denegación.
4. Un empleado recibe denegación en todas las rutas del módulo.
5. Una petición sin sesión no obtiene ningún dato del catálogo.
6. Un ejercicio retirado no aparece en la búsqueda ni en la librería por músculo.
7. Un ejercicio retirado se sigue abriendo por su identificador y su respuesta
   dice que está retirado.
8. Reponer un ejercicio retirado lo devuelve a la búsqueda.
9. No existe ninguna ruta del módulo que borre un ejercicio de la base de datos.
10. Crear un ejercicio con un nombre que ya existe devuelve error y no crea nada.
11. Crear un ejercicio con un grupo muscular fuera del vocabulario devuelve 400 y
    no crea nada.
12. Un listado con límite menor que el número de ejercicios devuelve el total
    real, no el número de filas devueltas.
13. Un ejercicio sin figura y sin vídeo se crea, se lista y se abre sin error.
14. La ficha de un ejercicio sin vídeo marca el hueco como ausente en lugar de
    omitir el campo.
15. Ninguna respuesta de la API contiene la clave del objeto en el
    almacenamiento.
16. Un cliente que pide un permiso de subida recibe denegación, y el entrenador
    lo recibe solo para un tipo y un tamaño dentro de los límites.
17. Una consulta al catálogo devuelve cuántos contenidos siguen con origen
    _provisional_.
18. Ninguna tabla del módulo tiene una columna que referencie a un usuario.

El punto nueve protege al módulo siguiente: el histórico de entrenos apunta aquí
y tiene que sobrevivir a que el entrenador limpie su catálogo. El punto dieciocho
protege a este: es lo que mantiene el módulo fuera del alcance del consentimiento
aplazado, y el día que alguien añada una columna con el identificador de un
cliente se enterará por un test en rojo y no por una conversación sobre el RGPD.

## Boundaries del módulo

**Siempre**

- Un test de denegación por cada celda "no" de la matriz de roles
- El contenido se entrega con un enlace firmado emitido después de comprobar el
  rol, nunca desde una dirección pública
- Cada contenido nuevo entra con su origen declarado, aunque sea _provisional_

**Nunca**

- Guardar aquí el identificador de un cliente, un peso, una repetición o una nota
  de nadie
- Borrar un ejercicio de la base de datos
- Publicar en las tiendas una versión con un solo contenido de origen
  _provisional_

**Preguntar antes**

- Añadir o renombrar un valor del vocabulario de grupos musculares. Es una
  migración y deja desalineado el mapa muscular de quien ya tenga la app
- Añadir una dependencia para reproducir vídeo o animaciones

## Riesgo de licencia: las figuras animadas

El boceto del producto enseña las figuras animadas de Symmetry. Son de Symmetry.
Incrustarlas en la app es usar obra ajena sin licencia, y la consecuencia no es
un aviso: es una retirada de la tienda o una reclamación, y llega después de
haberlas metido en ocho pantallas.

El argumento a favor es débil y conviene no apoyarse en él: que en el boceto
funcionaban como referencia visual y no como material final. Vale mientras el
material no se publica. Deja de valer el día que se sube a una tienda.

Consecuencia práctica: se desarrolla con lo que haga falta, marcado con origen
_provisional_, y eso es exactamente para lo que existe el requisito 11. Antes de
la primera subida a tiendas hay que decidir de dónde salen las figuras
definitivas, que es una compra o un encargo, no una tarea de programación. El
criterio de éxito 17 da el número exacto de contenidos que quedan por sustituir
en cualquier momento. Está anotado como bloqueante blando en
[docs/PENDIENTE-PARA-PRODUCCION.md](docs/PENDIENTE-PARA-PRODUCCION.md), punto 6.

## Decisiones tomadas

| Fecha      | Decisión                                                                                           |
| ---------- | -------------------------------------------------------------------------------------------------- |
| 2026-09-11 | Las figuras animadas entran primero y el vídeo después, con su botón ya colocado al lado           |
| 2026-09-11 | Los vídeos de ejercicios no bloquean el lanzamiento                                                |
| 2026-09-11 | `catalogo-ejercicios` es el módulo 2 y depende solo de `identity`                                  |
| 2026-09-16 | Las figuras y los vídeos van a almacenamiento de objetos con enlaces firmados y proveedor en la UE |
| 2026-09-17 | El entrenador prescribe eligiendo ejercicios de este catálogo, desde el módulo `entrenamiento`     |
| 2026-09-17 | El hosting y el almacenamiento los asume el entrenador, con las cuentas a su nombre                |

## Open Questions

1. **¿El nutricionista tiene que ver el catálogo?** Hoy la matriz dice que no,
   por denegar por defecto y porque no prescribe entrenos. Abrirle la lectura es
   un decorador y cuatro tests. Decidirlo ahora evita que la primera vez que lo
   pida se resuelva con prisa.
2. **¿De dónde salen las figuras animadas definitivas?** Comprar una librería
   licenciada, encargarlas o dibujarlas. No bloquea el desarrollo y bloquea la
   primera subida a tiendas. Ver el riesgo de licencia.
3. **¿Cuántos grupos musculares tiene el mapa, y cuáles?** Ocho zonas grandes o
   veinte músculos. Es vocabulario cerrado, así que define la primera migración y
   el dibujo de la librería. Cambiarlo después es migración y app desalineada.
4. **¿Qué proveedor de almacenamiento?** El [ADR 0005](docs/adr/0005-almacenamiento-de-fotos.md)
   lo dejó sin decidir y la única restricción firme es que los datos estén en la
   Unión Europea. Bloquea la tarea de subida de contenido, no el resto del módulo.
5. **¿Cuántos ejercicios tiene el catálogo el primer día y quién los teclea?**
   Define si hace falta una carga masiva desde un fichero o basta con la pantalla
   de alta, y si el entrenador dedica una tarde a escribirlos o lo hace sobre la
   marcha.

---

## Ampliación 2026-09-26: la técnica de cada ejercicio

> Estado: **borrador para revisión de David**, junto con la ampliación de
> [SPEC-entrenamiento.md](SPEC-entrenamiento.md) del mismo día. Diseño en
> [docs/diseno/panel-entrenador.md](docs/diseno/panel-entrenador.md).

La guía de ejercicios que el entrenador entrega hoy explica cada ejercicio con
«Cómo realizarlo» y «Evita». Esa guía pasa a ser el catálogo. Campos nuevos,
todos aditivos:

| Campo           | Contenido                                                                 |
| --------------- | ------------------------------------------------------------------------- |
| `tipo`          | `fuerza`, `calentamiento`, `core`, `cardio`, `estiramiento` o `movilidad` |
| `medicion`      | Por defecto al prescribirlo: repeticiones, tiempo o distancia             |
| `instrucciones` | Se muestra como «Cómo realizarlo»; ya existe                              |
| `evita`         | Errores que evitar                                                        |
| `paraSi`        | Señales para parar, si las tiene                                          |
| `carga`         | `compuesto` o `accesorio`; decide qué RIR le da cada fase del plan        |
| `alternativas`  | Ejercicios del catálogo que suelen sustituirlo                            |

El tren (superior o inferior) para el incremento de carga se deduce del grupo
principal. Un ejercicio de cardio o de movilidad general puede no tener grupo
principal.

Grupos que usa el servicio y la lista de 11 no tiene: **aductores**, **flexores
de cadera**, **lumbar** y **trapecio**. Añadirlos resuelve en parte la pregunta 3.

**Carga inicial.** Los textos de la guía actual se teclean una vez desde la
pantalla de alta; son del orden de 90 ejercicios. No hace falta importación masiva.
