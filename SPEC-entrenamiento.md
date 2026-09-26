# Spec: `entrenamiento` — primera entrega funcional

> Estado: aprobada por David en esta conversación. Redactada el 2026-09-17.
> Módulo del [mapa aprobado](CAPABILITY-MAP.md). Depende de `identity`,
> `catalogo-ejercicios` y `agenda`.
> Intención: [entrevista de la segunda iteración](docs/intent/entrenamiento-iteracion-2.md).
> Stack y reglas comunes: [SPEC.md](SPEC.md).

## Objetivo

El entrenador crea un plan personalizado, lo asigna durante varias semanas y
consulta lo que el cliente realiza. El cliente puede recolocar una sesión dentro
de su semana, registrar series y enviar el entrenamiento al terminar.

El resultado se comprueba con dos cuentas reales de desarrollo: entrenador y
cliente. El entrenador recibe lo registrado al enviarlo; no ve los datos del
borrador mientras el cliente entrena. Esta decisión concreta el criterio 1 de
`SPEC.md`: la actualización automática ocurre después del envío.

## Decisiones aprobadas

La entrevista confirma creación desde cero, reutilización opcional de rutinas,
repetición durante semanas, libertad de día dentro de la semana, objetivos
tenues, registro por serie y publicación al enviar.

Se acuerdan para esta primera entrega:

- Semanas de lunes a domingo, según [SPEC-agenda.md](SPEC-agenda.md).
- Objetivos numéricos por serie; repeticiones o duración en segundos, con peso
  opcional. Rangos y otros indicadores de esfuerzo se pueden añadir después.
- Envío de sesiones parcialmente completadas, distinguiendo las series omitidas.
- Sesiones enviadas en modo consulta; correcciones posteriores se diseñarán aparte.
- Ajustes del entrenador sobre sesiones concretas todavía no iniciadas.
- Recuperación local del borrador, con sincronización privada cuando hay conexión.

## Alcance

**Incluido**

1. Crear una rutina personalizada desde cero para un cliente.
2. Guardar una rutina reutilizable, elegirla y adaptarla sin afectar a otros.
3. Asignar sesiones a días de una semana y repetir el plan un número de semanas.
4. Elegir ejercicios del catálogo y prescribir sus series y objetivos.
5. Consultar la semana y mover una sesión dentro de ella.
6. Registrar la ejecución, guardar borradores y enviar un entrenamiento.
7. Consultar el histórico enviado, con lo previsto y lo realizado por serie.

**Para ampliaciones posteriores**

Mapa muscular, animaciones y vídeos; reservas y clases colectivas; vista mensual
completa; nutrición, medidas corporales, leads y fichajes; chat, notificaciones
push, gráficas avanzadas y cálculos automáticos de progresión. La biblioteca
de rutinas de esta entrega no requiere importación masiva ni rutinas generadas
por IA. No se publica la app en las tiendas como parte de este incremento.

## Dependencias y fronteras entre módulos

Se conservan los identificadores y la dirección de dependencias del mapa.

| Proveedor             | Parte necesaria para este recorrido                                                           |
| --------------------- | --------------------------------------------------------------------------------------------- |
| `identity`            | Sesión validada, roles, cartera y estado de los clientes                                      |
| `catalogo-ejercicios` | Crear, consultar, buscar y elegir ejercicios por id; conservación del histórico al retirarlos |
| `agenda`              | Fechas de las sesiones, semana, cambios de día y cierre al enviar                             |
| `entrenamiento`       | Rutinas, objetivos, asignaciones, borradores y resultados enviados                            |

El borrador existente [SPEC-catalogo-ejercicios.md](SPEC-catalogo-ejercicios.md)
describe el catálogo completo. Para esta entrega basta su recorrido de texto:
un ejercicio puede existir sin figura ni vídeo. No se considera que el módulo
completo esté terminado al implementar solo ese subconjunto. La aprobación de
esta especificación comprende ese contrato mínimo, no resuelve las preguntas
abiertas de medios, mapa muscular o almacenamiento de contenidos.

La unidad de ejecución se prescribe en la rutina, no se deduce del nombre del
ejercicio. Las series y los registros no se añaden a las tablas del catálogo.

## Flujo del entrenador

1. Desde la ficha del cliente abre «Plan de entrenamiento» y crea una rutina.
2. Añade sesiones, les da un nombre y elige sus días de la semana.
3. Para cada sesión ordena los ejercicios, añade series y define los objetivos:
   peso opcional y repeticiones o tiempo. Puede incluir indicaciones de texto.
4. Elige semana inicial y número de semanas, y revisa las fechas antes de asignar.
5. La app crea ocurrencias concretas. Un reintento de la asignación no duplica
   el bloque de sesiones.
6. Puede guardar la estructura como rutina reutilizable. Elegir una rutina
   guardada crea una copia editable para el cliente; no un vínculo que propague
   cambios a todas las personas.
7. Puede ajustar una sesión aún no iniciada. Si el cliente ya ha guardado un
   borrador o la ha enviado, esa prescripción queda conservada. Para una nueva
   etapa se asigna otro bloque de semanas; no se reescribe el histórico.

Una rutina guardada contiene ejercicios y objetivos, nunca registros de ejecución
ni notas del cliente. El catálogo permite añadir un ejercicio que falte sin
exigir poblar toda la biblioteca antes de crear la primera rutina.

La asignación muestra si el cliente ya tiene sesiones en las fechas elegidas.
No las sustituye ni elimina automáticamente; pueden coexistir varias por día.

## Flujo del cliente

### Semana y cambios de fecha

El inicio da acceso a los entrenamientos de la semana. Cada sesión muestra su
fecha, nombre y estado. Se puede cambiar de semana y abrir sesiones anteriores.
«Cambiar día» permite elegir otra fecha de la misma semana. Se aplica el
contrato de agenda, conservando el borrador y sin cambiar semanas posteriores.

### Registro por serie

Cada ejercicio muestra sus instrucciones y una fila por serie prescrita:

| Serie | Peso (kg)                      | Repeticiones o tiempo          | Hecha    |
| ----- | ------------------------------ | ------------------------------ | -------- |
| 1     | Campo editable, objetivo tenue | Campo editable, objetivo tenue | Marcador |
| 2     | Campo editable, objetivo tenue | Campo editable, objetivo tenue | Marcador |

- Los objetivos aparecen como guía en los campos vacíos. Se mantienen etiquetas
  y unidades visibles: el texto tenue no sustituye a las etiquetas accesibles.
- Al escribir, se registra el valor real aunque difiera del objetivo. El objetivo
  original se conserva y sigue consultable junto al ejercicio.
- Un objetivo mostrado no es un valor registrado. Marcar «Hecha» exige introducir
  las repeticiones o el tiempo y, cuando la serie requiere carga, el peso real.
- El peso admite decimales, incluido cero; un campo vacío no equivale a cero.
  La entrada con coma decimal se normaliza sin alterar el valor.
- Repeticiones y segundos son enteros positivos. En una serie se registra uno
  de esos dos tipos, nunca ambos. El tiempo se etiqueta explícitamente en segundos.
- Para un ejercicio sin carga, el peso es opcional y se indica como tal. No se
  obliga a inventar un peso para completar una plancha u otro ejercicio por tiempo.
- Desmarcar una serie conserva sus valores para poder corregirlos. Mientras esté
  sin marcar, no cuenta como realizada en los resultados.
- Hay notas opcionales. No se obliga a escribir para terminar un entrenamiento.
- El cliente no cambia la lista de ejercicios, la prescripción ni el número de
  series; puede dejar series sin completar.

### Borrador y recuperación

- Cada cambio se conserva en almacenamiento local asociado a la cuenta y sesión.
  La interfaz distingue «Guardando», «Guardado» y un error de guardado.
- Solo se indica «Guardado» cuando el borrador queda persistido. Una escritura
  local fallida no se presenta como éxito.
- Con conexión, el borrador se sincroniza de forma privada con el servidor.
  Las respuestas de lecturas anteriores no pueden reemplazar cambios locales nuevos.
- Una sesión descargada puede seguir registrándose si se corta la conexión.
  Reabrir la app recupera el último borrador persistido. Descargar por primera
  vez una sesión sí requiere conexión.
- El borrador se guarda por cuenta y sesión. Otra cuenta que entre en el mismo
  dispositivo no lo ve. Al cerrar sesión se limpia el acceso y se advierte antes
  de descartar cambios que todavía no hayan podido sincronizarse.
- Un borrador sincronizado puede recuperarse en otro dispositivo. Las revisiones
  evitan que dos dispositivos sobrescriban cambios en silencio: se informa del
  conflicto y se permite recuperar la versión del servidor conservando la local.
- No se promete recuperar cambios de un dispositivo perdido si nunca llegaron
  al servidor. No se guardan borradores sensibles en logs ni en una caché compartida
  entre usuarios.

### Enviar entrenamiento

1. «Enviar entrenamiento» muestra un resumen de series hechas y pendientes.
2. Si faltan series, el cliente puede volver o enviar lo que ha realizado. Hace
   falta al menos una serie marcada con datos válidos; no se crean éxitos vacíos.
3. La app envía una versión concreta del registro. El servidor valida propiedad,
   prescripción, revisión y campos antes de confirmar.
4. El envío y el cierre de la sesión son atómicos. Tras el éxito se muestra
   «Entrenamiento enviado» y el resultado queda en modo consulta.
5. Pulsar dos veces, perder la respuesta o reintentar produce un solo envío.
   Si el servidor ya confirmó, devuelve ese resultado; no vuelve a registrarlo.
6. Sin conexión o ante un fallo, se conserva el borrador y se ofrece reintentar.
   No se muestra «Enviado» hasta verificar que el servidor lo ha confirmado.
7. Los valores de series sin marcar no se publican como ejecutados. El resultado
   muestra esas series como no realizadas y conserva la prescripción prevista.

## Qué ve el entrenador

- La planificación y los cambios de día son visibles antes del envío.
- Los valores reales y las notas del borrador permanecen privados. Esta
  restricción se aplica también a endpoints de detalle, listados y resúmenes.
- Tras enviar, aparecen ejercicios, series previstas, valores reales, series
  omitidas, notas y fecha de envío. Se distinguen fecha programada y envío real.
- Puede consultar resultados por cliente y semana, abriendo las sesiones enviadas
  para comparar objetivo y ejecución. No se calculan gráficas de progreso todavía.
- La vista abierta se actualiza automáticamente con conexión, en un máximo de
  diez segundos. Al volver a la pantalla se vuelve a consultar. El plan elegirá
  el mecanismo más simple que cumpla ese comportamiento.

## Permisos

| Acción                                  | Cliente            | Entrenador         | Nutricionista / empleado |
| --------------------------------------- | ------------------ | ------------------ | ------------------------ |
| Crear, guardar o adaptar rutinas        | No                 | Sí                 | No                       |
| Asignar y ajustar sesiones no iniciadas | No                 | Sí                 | No                       |
| Ver su prescripción                     | Solo propia        | Todos sus clientes | No                       |
| Guardar, leer y enviar borrador         | Solo propio        | No                 | No                       |
| Ver resultados enviados                 | Solo propios       | Todos sus clientes | No                       |
| Cambiar resultados enviados             | No en esta entrega | No en esta entrega | No                       |

Se conserva la validación de sesión existente. El servidor resuelve la cadena
serie → ejercicio prescrito → sesión → cliente; pertenecer a la cuenta no basta
para mezclar series de sesiones distintas. Un id de otra cuenta no revela datos.

Se puede prescribir a clientes pendientes, como exige identidad. Una cuenta
desactivada no puede registrar ni enviar y no recibe nuevas asignaciones. Su
histórico se conserva. Ninguna pantalla concede permisos por sí sola.

## Datos y consistencia

| Concepto                | Responsabilidad                                                   |
| ----------------------- | ----------------------------------------------------------------- |
| Rutina guardada         | Estructura reutilizable de sesiones, ejercicios y objetivos       |
| Plan asignado           | Copia personalizada y bloque de semanas para un cliente           |
| Sesión de entrenamiento | Prescripción concreta y enlace a `SesionProgramada`               |
| Ejercicio prescrito     | Referencia estable al catálogo, orden e indicaciones              |
| Serie prescrita         | Número, tipo de medición y objetivos                              |
| Borrador                | Valores privados y revisión por sesión y cliente                  |
| Resultado enviado       | Ejecución confirmada, prescripción conservada e instante de envío |

Los nombres y las tablas exactas se fijarán en el plan. Las migraciones serán
aditivas. Editar una rutina, retirar un ejercicio o desactivar un usuario no
modifica ni borra lo que se prescribió y realizó en sesiones enviadas.

El servidor conserva una versión de la prescripción utilizada por cada sesión.
La primera escritura de borrador y un ajuste concurrente del entrenador deben
resolver contra esa versión: o se guarda el borrador con la prescripción vigente
o se rechaza por conflicto, sin mezclar objetivos antiguos y nuevos.

## Estructura y estilo

| Ubicación                        | Contenido                                                      |
| -------------------------------- | -------------------------------------------------------------- |
| `apps/api/src/entrenamiento/`    | Rutinas, asignación, borradores, envíos y consultas            |
| `apps/api/src/agenda/`           | Contrato proveedor de fechas y cierre                          |
| `apps/api/prisma/`               | Migraciones y esquema compartido del proyecto                  |
| `packages/shared/src/`           | Contratos Zod separados por módulo y exportados por el paquete |
| `apps/mobile/app/entrenos/`      | Rutas del cliente y sus resultados                             |
| `apps/mobile/app/`               | Accesos desde la cartera y fichas existentes                   |
| `apps/mobile/src/entrenamiento/` | Editor, registro de series, borradores y acceso a API          |
| `apps/api/test/`                 | Pruebas HTTP con base de datos de pruebas                      |

Se aplican las convenciones de `SPEC.md`. Como patrón real se usa el controlador
de usuarios: `@Roles("entrenador")`, entrada mediante `ZodPipe`, llamada a un
servicio y retorno explícito. Los archivos de rutas móviles no acumulan lógica
de persistencia ni reglas de negocio. Se mantiene el tema negro y dorado.

## Stack y dependencias

Se conserva el stack y las versiones fijadas por `package-lock.json`. No se
reemplaza el sistema de sesión. El paquete compartido se recompila al cambiar
contratos.

La especificación general menciona TanStack Query y pruebas móviles, pero el
`package.json` actual de la app no los tiene configurados. El plan debe concretar
la persistencia local, la sincronización y las dependencias de pruebas necesarias,
verificando su compatibilidad antes de proponer instalaciones. Esta propuesta
no considera esas capacidades ya existentes ni autoriza una reescritura global.

## Comandos

Comandos existentes desde la raíz:

```bash
npm run build:shared
npm run test --workspace apps/api -- --runInBand
npm run test:e2e --workspace apps/api -- --runInBand
npm run build --workspace apps/api
npm run typecheck
npm run lint
npm run dev --workspace apps/api
npm run dev --workspace apps/mobile
```

Filtros previstos al crear las pruebas del módulo:

```bash
npm run test --workspace apps/api -- --runInBand entrenamiento
npm run test:e2e --workspace apps/api -- --runInBand entrenamiento agenda
```

La base de pruebas debe estar disponible antes de los tests HTTP. Hoy no existe
un script de tests móviles: se añadirá con su configuración durante la
implementación y el plan recogerá el comando exacto.

## Criterios de aceptación

1. El entrenador crea desde cero una rutina con varias sesiones, la asigna a un
   cliente durante varias semanas y el cliente ve las fechas correctas.
2. Guardar y adaptar una rutina para otro cliente no altera al primero ni copia
   sus registros o notas.
3. Una sesión se mueve dentro de su semana, conserva sus datos y el entrenador
   ve el cambio. Un movimiento a otra semana se rechaza.
4. Una serie muestra los objetivos tenues; sin escribir nada, no cuenta como
   realizada ni puede convertirse en un registro válido por marcarla.
5. El cliente introduce valores diferentes del objetivo; se conservan ambos
   sin sustituir la prescripción.
6. Una serie por repeticiones y otra por tiempo se guardan y muestran con sus
   unidades correctas; los campos incompatibles se rechazan.
7. Una serie sin carga se completa sin inventar un peso. Cero, campo vacío,
   decimales con coma y valores inválidos se tratan de forma explícita.
8. Cerrar y reabrir la app recupera el último borrador persistido. Perder la
   conexión después de abrir la sesión no borra lo registrado.
9. Un entrenador no obtiene los resultados ni las notas de un borrador, incluso
   solicitando directamente sus rutas. Otro cliente tampoco.
10. Enviar publica una sola vez el registro correcto, cierra la sesión y aparece
    en el panel del entrenador sin recarga manual.
11. Una respuesta de envío perdida y su reintento devuelven el mismo resultado.
    Un fallo real conserva el borrador y no muestra una confirmación falsa.
12. Una sesión parcialmente completada muestra las series omitidas como tales;
    los valores de series sin marcar no cuentan como ejecución.
13. Dos dispositivos, un guardado tardío, un ajuste concurrente o una respuesta
    antigua no sobrescriben una versión nueva ni reabren una sesión enviada.
14. Retirar un ejercicio, editar una rutina o desactivar un cliente conserva el
    histórico enviado y la prescripción que acompañaba a ese resultado.
15. Cliente ajeno, nutricionista, empleado y petición sin sesión tienen pruebas
    de denegación en todas las operaciones protegidas.

## Estrategia de pruebas y verificación

- Unitarias para reglas de series, unidades, copias de rutinas, revisiones y envío.
- Integración HTTP con PostgreSQL para permisos, aislamiento, transacciones,
  reintentos y carreras entre peticiones. Se parte de la infraestructura existente.
- Componentes móviles para objetivos tenues frente a valores reales, marcado,
  unidades, borrador, recuperación, errores y confirmación de envío.
- Verificación del recorrido completo en dispositivo: cuenta de entrenador
  asigna; cuenta de cliente mueve, registra, cierra y recupera; cliente envía;
  entrenador consulta el resultado. Repetir el caso de pérdida de conexión.
- Ejecutar también la suite existente de identidad. No basta con que compile
  ni con exportar el bundle para declarar verificada la experiencia móvil.

Se mantiene el mínimo del 80 % para servicios y guardas definido por el proyecto.
Las pruebas de denegación, pérdida de datos y duplicación son obligatorias
independientemente de ese porcentaje.

## Fronteras y revisión

**Siempre:** separar objetivos de ejecución, proteger borradores, validar
propiedad y revisión en el servidor, conservar históricos, probar los cambios y
aplicar la definición de terminado de Agent Skills.

**Revisar con esta especificación:** las propuestas de detalle, las entidades
nuevas y el alcance mínimo del catálogo y la agenda. Aprobarlas permite planificar
las migraciones necesarias para este recorrido. Las dependencias concretas se
presentarán en el plan, después de comprobar compatibilidad.

**Nunca:** copiar valores objetivo como si se hubieran registrado, publicar un
borrador, mostrar un envío sin confirmación del servidor, sobrescribir otro
cliente al adaptar una rutina, registrar valores personales en logs o dar por
terminados módulos cuyo alcance restante sigue pendiente.

## Continuación del flujo

David ha aprobado esta especificación, `SPEC-agenda.md` y la ubicación separada
del nuevo plan. El borrador del catálogo se mantiene como fuente de su módulo.

El [plan de esta iteración](tasks/entrenamiento/plan.md) y sus
[tareas](tasks/entrenamiento/todo.md) viven en `tasks/entrenamiento/`.
Los archivos `tasks/plan.md` y `tasks/todo.md` conservan el seguimiento pendiente
de identidad. El plan nuevo se revisa antes de implementar.

---

## Ampliación 2026-09-26: el servicio completo del entrenador

> Estado: **borrador para revisión de David** (checkpoint A del
> [plan del panel](tasks/panel-entrenador/plan.md)). Diseño de pantallas en
> [docs/diseno/panel-entrenador.md](docs/diseno/panel-entrenador.md) y
> [prototipo](docs/diseno/prototipo-entrenador.html). Decisiones en la
> [intención](docs/intent/app-alpha-omega.md), apartado del 2026-09-26.

### Por qué se amplía

El entrenador entrega hoy a cada cliente una rutina, una guía semanal y una guía
de ejercicios, y pide que le cuenten sueño, agujetas, molestias, RIR y RPE. La
primera entrega de este módulo solo cubría series con peso y repeticiones. Esta
ampliación recoge lo que falta para que el servicio entero viva en la app.
Revoca dos decisiones del 17-09: «nada de RPE ni descanso» y «sin plantillas».

Todo lo anterior de este documento sigue vigente salvo donde esta sección lo
cambia de forma explícita.

### Prescripción

Todos los campos nuevos son opcionales o tienen valor por defecto, así que las
prescripciones ya guardadas siguen validando con los esquemas estrictos. Un test
valida un documento antiguo.

| Nivel     | Campo nuevo                                   | Uso                                                          |
| --------- | --------------------------------------------- | ------------------------------------------------------------ |
| Serie     | `repeticionesMax`, `segundosMax`, `metrosMax` | Rango: «8–10» es `repeticiones 8` y `repeticionesMax 10`     |
| Serie     | `rir`, `rirMax` (0–5)                         | RIR objetivo o rango                                         |
| Serie     | `tipoMedicion: "distancia"` con `metros`      | Farmer carry y similares                                     |
| Ejercicio | `seccion`                                     | `calentamiento`, `principal`, `core`, `cardio` o `calma`     |
| Ejercicio | `descansoSegundos`, `descansoMaxSegundos`     | Descanso o rango                                             |
| Ejercicio | `unilateral`                                  | `no`, `por lado` o `por brazo`                               |
| Ejercicio | `recorte`                                     | `nunca`, `normal` o `primero`                                |
| Ejercicio | `alternativas`                                | Ejercicios del catálogo si molesta                           |
| Ejercicio | `dosis`                                       | Texto para calentamiento y calma («1×8/lado», «2–3 series»)  |
| Ejercicio | `cardio`                                      | Rangos de inclinación, velocidad y RPE                       |
| Sección   | `formato`, `vueltas`, descanso entre vueltas  | Circuito de core: cada vuelta es una serie de cada ejercicio |
| Sesión    | `nota`                                        | «Carga inicial orientativa…»                                 |

Calentamiento y vuelta a la calma no tienen series: se marcan como hechos. Una
sesión admite así ejercicios sin series; los de las otras secciones siguen
necesitando al menos una.

### Bloque, fases y deporte

El plan asignado y la rutina guardada ganan:

- **Objetivos e indicaciones del bloque**, en texto.
- **Fases por semanas**: nombre, RIR para compuestos y para accesorios, ajuste
  de series en porcentaje (la descarga quita un 40–50 %), objetivos de la semana
  y nota. Al asignar, el servidor aplica la fase de cada semana a la copia de esa
  semana: la prescripción de la semana 6 ya lleva menos series y RIR 3–4.
- **Deporte**: nombre, veces por semana, duración, días a evitar y reglas. No
  crea sesiones con fecha. El cliente registra cada práctica (fecha, duración,
  intensidad 0–10, si le pesaban las piernas y si fue antes o después de la
  fuerza) y cuenta en la semana.
- **NEAT**: objetivo de pasos, en texto hasta que exista seguimiento corporal.

Qué es compuesto o accesorio lo dice el catálogo, y se puede cambiar por
ejercicio en el plan.

### Progresión sugerida

Tras cada envío, el servidor calcula la carga de la próxima vez de cada ejercicio
con carga, con la doble progresión:

| Última sesión del mismo ejercicio en el plan               | Próxima vez                                  |
| ---------------------------------------------------------- | -------------------------------------------- |
| Todas las series al máximo del rango y con RIR ≥ el mínimo | Sube el incremento del ejercicio             |
| Dentro del rango con el RIR previsto                       | Igual                                        |
| Alguna serie con RIR por debajo del mínimo                 | Igual                                        |
| Alguna serie a RIR 0, o bajó la carga dentro de la sesión  | Revisa: la carga de la última serie completa |
| Molestia ámbar o roja en ese ejercicio en esa sesión       | Pendiente del entrenador                     |

Incremento por defecto: 2,5 kg en tren superior y 5 kg en inferior; el plan y el
ejercicio lo pueden cambiar. La carga de cada ocurrencia tiene origen `inicial`
o `fijada`. Una `inicial` se sustituye por la sugerencia cuando la hay; una
`fijada` (el entrenador la ajustó) manda siempre. El cliente ve la sugerencia
como objetivo tenue, nunca como valor registrado.

### Señales de ajuste

Calculadas por cliente y semana: rendimiento más bajo dos sesiones seguidas en un
ejercicio principal; agujetas de 7 o más en la misma zona durante más de 72 horas;
sueño o energía de 2 o menos en la mayoría de check-ins; molestia ámbar o roja o
técnica incómoda en el cierre; piernas pesadas al registrar el deporte.

Con el umbral del plan (2 por defecto) se avisa al entrenador. «Aplicar a la
semana» calcula primero una propuesta sobre las sesiones sin empezar (quitar lo
marcado `primero` y recortar un 25–30 % las series accesorias) y solo la guarda
cuando el entrenador la confirma, con la revisión de cada prescripción.

### Check-in

Antes de empezar, el cliente rellena: horas de sueño, calidad del sueño,
energía, motivación (1–5), agujetas por zona (0–10), dolor articular, rigidez o
molestia de espalda (con zona), K-1 en las últimas 24 horas (con intensidad) y
cómo recuperó de la sesión anterior.

La app calcula en el teléfono, con los umbrales de la guía descargados con la
sesión, el nivel y la recomendación de «cuándo modificar la sesión», para que
funcione sin red. El servidor lo recalcula al recibirlo. La recomendación no
cambia la sesión. Un check-in rojo avisa al entrenador.

### Molestias

Zona, lado, intensidad 0–10, síntomas (rigidez, va a más, pinchazo o irradia,
pérdida de fuerza, síntomas generales), ejercicio y serie opcionales, momento y
nota. El servidor calcula el semáforo: rojo con pinchazo o irradiación, pérdida de
fuerza, intensidad 7 o más o síntomas generales; ámbar con «va a más», rigidez o
4 a 6; verde en el resto. Con síntomas generales la app le dice al cliente que
pare y pida valoración sanitaria.

Se puede registrar dentro o fuera de una sesión. Sin red, queda en cola con su
id de operación y la pantalla dice que se enviará al volver la conexión.

### Excepción a la privacidad del borrador

**El check-in, las molestias y los registros de deporte son avisos que el
cliente envía a propósito**, y el entrenador los ve al momento. Los valores de
las series, las notas y el cierre de un borrador siguen siendo privados hasta el
envío, con las mismas pruebas de denegación.

### Cierre

El envío admite un cierre opcional, que el resultado muestra: RPE de la sesión
(0–10), energía al terminar (1–5), ejercicios inestables o incómodos, cardio
hecho (duración, inclinación, velocidad, RPE), deporte de ese día y notas.
El registro de cada serie admite `rir` real.

### Guía y reglas

Textos del entrenador reutilizables: RIR, RPE, semáforo, «cuándo modificar la
sesión» (con sus umbrales), señales para detener, respiración, normas técnicas,
material, prioridades si falta tiempo, qué comunicar, registro mínimo e
indicaciones por tipo de ejercicio. Hay una versión general y cada plan puede
sustituir textos para su cliente. El cliente lee la guía que le aplica.

### Notas de salud

Notas del entrenador sobre salud que condicionan el trabajo, por cliente, con la
opción de que el cliente las vea en su guía. Son datos de salud: hasta que
existan las tareas 19 y 21 de `identity` (consentimiento), solo con datos de
prueba.

### Exportar a PDF

La ficha genera un PDF con la rutina, la guía y la técnica de los ejercicios del
plan, a partir de lo que ya hay en la app. Es lo último de esta ampliación.

### Permisos nuevos

| Acción                                          | Cliente              | Entrenador         | Nutricionista / empleado |
| ----------------------------------------------- | -------------------- | ------------------ | ------------------------ |
| Enviar check-in, molestia o registro de deporte | Solo propios         | No                 | No                       |
| Ver check-ins, molestias y deporte              | Solo propios         | Todos sus clientes | No                       |
| Marcar una molestia como vista                  | No                   | Sí                 | No                       |
| Ver sugerencias y señales                       | Sugerencia propia    | Todos sus clientes | No                       |
| Aplicar un ajuste de semana                     | No                   | Sí                 | No                       |
| Editar guía y reglas                            | No                   | Sí                 | No                       |
| Leer la guía                                    | La que le aplica     | Todas              | No                       |
| Notas de salud                                  | Leer si son visibles | Leer y escribir    | No                       |
| Exportar PDF                                    | No                   | Sí                 | No                       |

### Criterios de aceptación de la ampliación

16. Una prescripción antigua, sin campos nuevos, se lee y se registra igual que
    antes.
17. Rangos de repeticiones, RIR y descanso, series por distancia y ejercicios por
    lado se guardan y se muestran con sus unidades; los incompatibles se rechazan.
18. Un circuito de 2 vueltas se registra por vueltas y el resultado lo muestra así.
19. Asignar un bloque con fases crea semanas cuya prescripción ya refleja su
    fase; la descarga lleva menos series.
20. Tras un envío, la próxima sesión del mismo ejercicio muestra la carga
    sugerida según la tabla; una carga fijada por el entrenador no se toca; una
    molestia deja el ejercicio pendiente.
21. Dos señales en una semana avisan al entrenador; «Aplicar a la semana» no
    cambia nada hasta confirmarse y no toca sesiones empezadas ni enviadas.
22. El check-in funciona sin red, muestra la recomendación correcta para cada
    fila de la tabla y un check-in rojo aparece en el panel.
23. Una molestia llega al panel en menos de 10 s con red; sin red, llega al
    reconectar y no se duplica al reintentar.
24. El entrenador no obtiene valores, notas ni cierre de un borrador, aunque sí
    su check-in y sus molestias. Otro cliente no obtiene nada.
25. Cambiar la guía general no cambia los textos sustituidos en un plan.
26. Cliente ajeno, nutricionista, empleado y petición sin sesión tienen pruebas
    de denegación en cada operación nueva.

### Preguntas abiertas para David

1. ¿Los umbrales por defecto de «cuándo modificar la sesión» (energía 2 o menos,
   agujetas 7 o más, K-1 7 o más) son los que usa el entrenador?
2. ¿Incremento por defecto de 2,5 y 5 kg, o el mínimo del rango (1 y 2,5 kg)?
3. ¿La carga sugerida se aplica sola al cliente, o el entrenador la confirma
   antes de que el cliente la vea?
