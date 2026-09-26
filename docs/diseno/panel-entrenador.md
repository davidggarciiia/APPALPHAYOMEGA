# Diseño — panel del entrenador

> Borrador del 2026-09-26 para el checkpoint A. Lo revisa David junto con el
> [prototipo](prototipo-entrenador.html) antes de programar las fases 4 y 5.
> Plan: [tasks/panel-entrenador/plan.md](../../tasks/panel-entrenador/plan.md).
> Fuentes: las decisiones de David de esta fecha, el export de Claude Design
> ([pantallas/](pantallas/)), su [auditoría](auditoria-accesibilidad.md), los
> specs vigentes y los tres documentos que el entrenador entrega hoy a cada
> cliente. Esos documentos tienen datos de salud reales y **no están en el
> repositorio**: aquí solo se describe su estructura.

## Objetivo

Digitalizar el servicio completo del entrenador. Todo lo que hoy prepara en
documentos (rutina, pauta nutricional, guía semanal y guía de ejercicios) y todo
lo que pregunta al cliente para ajustar el programa pasa a hacerse en la app. El
entrenador abre el panel y ve, sin preguntar, qué ha hecho cada cliente, cómo
llegó y qué le molesta.

## 1. Del papel a la app

El entrenador entrega hoy tres documentos por cliente. Cada parte tiene un sitio.

| Documento y parte                                          | Dónde vive en la app                                            |
| ---------------------------------------------------------- | --------------------------------------------------------------- |
| Rutina · recomendaciones nutricionales                     | Ficha › **Nutrición**                                           |
| Rutina · estructura semanal (CAL, URes, UFuerz, UFlex)     | Constructor › **Semana**, calculada a partir de las secciones   |
| Rutina · distribución, K-1, NEAT e indicaciones generales  | Constructor › **Bloque** (indicaciones del plan)                |
| Rutina · una página por día                                | Constructor › **Día**                                           |
| Rutina · progresión y seguimiento                          | Constructor › **Bloque** (fases, regla de progresión, ajustes)  |
| Guía semanal · objetivos de la semana                      | Constructor › Bloque › objetivos por fase                       |
| Guía semanal · comprobación antes de entrenar              | **Check-in** del cliente; lo lee la ficha                       |
| Guía semanal · cuándo modificar la sesión                  | **Guía y reglas**; se aplica tras cada check-in                 |
| Guía semanal · material, prioridades si falta tiempo       | Guía y reglas; prioridades también por ejercicio                |
| Guía semanal y de ejercicios · RIR, RPE, semáforo, señales | Guía y reglas                                                   |
| Guía de ejercicios · «Cómo realizarlo» y «Evita»           | **Ejercicios** (catálogo), un texto por ejercicio               |
| Guía de ejercicios · estiramientos                         | Ejercicios, con el tipo «estiramiento»                          |
| Guía de ejercicios · qué comunicar, registro mínimo        | Guía y reglas; el registro mínimo es el **cierre** de la sesión |
| Nota de salud (un diagnóstico que condiciona el trabajo)   | Ficha › **Salud**                                               |
| El propio PDF                                              | **Exportar PDF** desde la ficha, para quien lo siga queriendo   |

## 2. Navegación

La misma app Expo sirve al teléfono y al escritorio.

| Ancho     | Navegación                                                             |
| --------- | ---------------------------------------------------------------------- |
| < 1024 px | Pestañas abajo: **Hoy · Clientes · Rutinas · Ejercicios · Más**        |
| ≥ 1024 px | Barra lateral de 232 px con todas las secciones, como en Claude Design |

Secciones: Hoy, Clientes, Rutinas, Ejercicios, Guía y reglas, Agenda, Cobros,
Boxeo, Ajustes, Leads, Fichajes, Nutricionistas y Perfil. En el teléfono, las
que no caben van en «Más». Cuando llegue horarios, Agenda pasa a la pestaña de
Ejercicios y Ejercicios baja a «Más».

«Rutinas» y no «Planes»: `planes` es el módulo de bonos y saldo
([SPEC-planes.md](../../SPEC-planes.md)). En la ficha, el plan asignado de un
cliente se llama «Plan de entrenamiento».

Rutas (grupo `app/(entrenador)/`, que no cambia las URL):

```
/hoy
/clientes              /clientes/nuevo       /clientes/[id]?pestana=sesiones
/clientes/[id]/constructor                    /clientes/[id]/asignar
/sesiones/[id]         (resultado o ajuste de una sesión)
/rutinas               /rutinas/[id]
/ejercicios            /ejercicios/[id]
/guia
/mas  → agenda, cobros, boxeo, ajustes, leads, fichajes, nutricionistas, perfil
```

La pestaña activa de la ficha y el día del constructor van en la URL, para que
volver atrás y recargar en web no pierdan el sitio (auditoría, P3).

## 3. Pantallas

Cada pantalla tiene cuatro estados además del normal: **cargando**, **vacío**
(con la acción que lo llena), **error** (con reintentar si procede) y **sin
permiso** (403: no se muestra nada del recurso).

### Hoy

El espejo del producto. Una columna en el teléfono, dos en escritorio.

- **Requiere tu atención.** Molestias ámbar y rojas sin ver, check-ins con dolor,
  señales de ajuste (2 o más en la semana) y clientes con la sesión de hoy sin
  empezar a última hora. Cada fila dice quién, qué y cuándo, con acciones:
  «Marcar como vista», «Abrir ficha» y «Ajustar próxima sesión».
- **Hoy.** Sesiones programadas para hoy por cliente, con su estado: pendiente,
  check-in hecho, enviada (con series hechas/prescritas y RPE) o movida.
- **Esta semana.** Una fila por cliente: sesiones hechas de las previstas, series
  hechas, RPE medio y la última enviada. Ordenado por quien necesita atención.
- **Enviadas recientemente**, con acceso directo al resultado.

Se actualiza cada 5 s mientras la pantalla está visible y la app activa, y al
volver a ella. Los valores de un borrador nunca aparecen.

### Clientes

La cartera actual con el estilo nuevo: búsqueda, filtros por estado, alta. Cada
fila añade la semana del plan («semana 2 de 6») y un punto si hay algo pendiente.

### Ficha del cliente

Cabecera con nombre, objetivo y semana del bloque («Recomposición · semana 2
de 6 · cinco días de fuerza y dos de K-1»). Botones «Editar plan» y «Exportar
PDF». Pestañas:

| Pestaña               | Contenido                                                                                                                                                                     |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Resumen               | Datos de cuenta (lo que hoy es `cliente/[id]`), plan en curso, adherencia de las últimas semanas, avisos abiertos                                                             |
| Sesiones              | Semana ‹ ›. Cada sesión con estado y fecha (original y actual). Abrir una enviada muestra **Prescrito · Sugerido · Hecho · RIR · Próxima vez**, el cardio, el K-1 y el cierre |
| Plan de entrenamiento | Planes asignados con fechas y progreso; anular lo no empezado; asignar un bloque nuevo; guardar como rutina                                                                   |
| Check-ins y molestias | Historial de check-ins (sueño, energía, agujetas por zona, K-1) y de molestias con su semáforo; tendencias de la semana                                                       |
| Progreso              | Peso, cintura, fuerza por ejercicio principal y pruebas físicas (fase de seguimiento corporal)                                                                                |
| Nutrición             | La pauta del entrenador: datos de referencia, metabolismo basal, gasto, calorías objetivo, reparto de macros, recomendaciones y suplementos                                   |
| Salud                 | Notas de salud que condicionan el trabajo; el entrenador elige si el cliente las ve en su guía                                                                                |

En el resultado de una sesión, lo que se sale de lo previsto va marcado con
texto y color, nunca solo con color: «RIR 1 · por debajo de lo previsto».

### Constructor

El editor del plan de un cliente. En escritorio, tres zonas: días a la izquierda,
tabla del día en el centro, panel del ejercicio a la derecha. En el teléfono, el
panel es una hoja inferior. Cuatro vistas:

**Bloque.** Nombre y objetivo («Bloque 1 · Recomposición»), semanas, objetivos
del bloque, indicaciones generales del plan (reparto, K-1, NEAT con su objetivo
de pasos), y las **fases**:

| Campo por fase         | Ejemplo                                                    |
| ---------------------- | ---------------------------------------------------------- |
| Semanas                | 1–2                                                        |
| Nombre                 | Calibrar                                                   |
| RIR por tipo           | Compuestos 3 · accesorios 2–3                              |
| Ajuste de volumen      | Ninguno; en la descarga, −40 a −50 % de series             |
| Objetivos de la semana | Aprender la rutina, establecer cargas iniciales…           |
| Nota                   | «La primera semana sirve para calibrar, no para demostrar» |

Y la **regla de progresión** (doble progresión con incremento de 1–2,5 kg en
tren superior y 2,5–5 kg en tren inferior) y los **criterios de ajuste** (las
señales y qué se recorta primero). Vienen de Guía y reglas y se pueden cambiar
para este cliente.

**Semana.** Tabla de días × bloques (calentamiento, fuerza, cardio, vuelta a la
calma) con los minutos, calculada a partir de lo que hay en cada día. Los días de
deporte (K-1) aparecen con su duración y sus reglas («evitar el miércoles»,
«separar varias horas de la fuerza»).

**Día.** Nombre («Lunes · Empuje»), nota de la sesión («Carga inicial orientativa
del press banca: 60 kg para 4×6 si conservas 3 RIR»), duración estimada
calculada, y las secciones en orden:

| Sección           | Cómo se prescribe                                                                                                     | Cómo lo registra el cliente           |
| ----------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Calentamiento     | Lista de ejercicios con dosis («1×8/lado», «3–4 min», «2–3 series de aproximación»)                                   | Los marca como hechos                 |
| Parte principal   | Series × repeticiones o rango, RIR o rango de RIR, descanso o rango, carga inicial, por lado o por brazo              | Peso, repeticiones y RIR por serie    |
| Core              | Circuito de N vueltas con descanso entre vueltas, o series normales; cada ejercicio con su enfoque («ABS / oblicuos») | Vueltas hechas, o series              |
| Cardio            | Máquina, duración, inclinación, velocidad y RPE objetivo                                                              | Lo que hizo de verdad en los 4 campos |
| Vuelta a la calma | Duración y músculos a estirar                                                                                         | La marca como hecha                   |

Cada ejercicio de la tabla lleva además: indicaciones para el cliente,
**alternativas si molesta** (ejercicios del catálogo), y la **prioridad de
recorte** («nunca se recorta», «normal», «se quita primero»), que usan las
prioridades si falta tiempo y los ajustes de volumen.

Tipos de medición de una serie: repeticiones, tiempo (segundos) y **distancia
(metros)** para cosas como el farmer carry.

Botones: «Añadir desde la biblioteca», «Añadir deporte», «Guardar como rutina»,
«Ver como cliente» y «Asignar».

### Asignar

Semana inicial, número de semanas (por defecto, las del bloque) y vista previa de
las fechas que se crearán, con aviso de las sesiones que ya existen esos días.
Confirmar mantiene el mismo identificador de operación hasta saber el resultado,
así que un reintento no duplica nada.

### Resultado y ajuste de una sesión (`/sesiones/[id]`)

Si está enviada: resultado completo en modo consulta. Si no ha empezado: el mismo
editor del día, que guarda con la revisión de la prescripción y resuelve el
conflicto si el cliente empieza mientras tanto. Si está empezada y sin enviar:
solo la prescripción, y el aviso de que el cliente está en ello.

### Rutinas

Biblioteca de plantillas: buscar, abrir, editar, archivar y «Usar para un
cliente», que crea una copia en su constructor. Una plantilla guarda bloque,
fases, días y ejercicios; nunca registros ni notas de un cliente.

### Ejercicios

Catálogo con búsqueda y filtro por grupo muscular y por tipo (fuerza,
calentamiento, core, cardio, estiramiento). La ficha de cada ejercicio tiene
nombre, grupos, **Cómo realizarlo**, **Evita**, respiración y señales para
parar si las tiene, figura y vídeo (hueco reservado), y alternativas habituales.
Retirar y reponer como hasta ahora.

### Guía y reglas

Los textos que el entrenador repite en cada documento, escritos una vez:

- RIR y RPE: qué significa cada valor y qué hacer.
- Semáforo de molestias: verde, ámbar y rojo, con qué ocurre y qué hacer.
- Cuándo modificar la sesión: situación → decisión (ver el check-in).
- Señales para detener o modificar un ejercicio.
- Respiración, normas técnicas generales, material y preparación.
- Orden de prioridades si falta tiempo.
- Qué comunicar al entrenador y registro mínimo después de entrenar.
- Indicaciones por tipo de ejercicio (presses, remos, pierna, core, cardio).

Son la versión general. Cada plan puede añadir o sustituir un texto para ese
cliente. El cliente los lee en su pestaña Guía.

### Más

Agenda, Cobros, Boxeo y Ajustes llegan con horarios ([tasks/horarios](../../tasks/horarios/todo.md)).
Leads y Fichajes, con sus módulos. Nutricionistas es la pantalla actual de
reparto. Perfil y cerrar sesión.

## 4. Lo que genera el cliente

El panel se alimenta de cuatro momentos del cliente. Sus pantallas ya existen en
Claude Design (Checkin, Sesion, Molestia, Cierre) y se amplían así.

### Check-in antes de entrenar

Completo, como la comprobación rápida de la guía semanal:

| Campo                              | Entrada                            |
| ---------------------------------- | ---------------------------------- |
| Horas de sueño                     | Número con medias horas            |
| Calidad del sueño                  | 1 a 5                              |
| Energía general                    | 1 a 5                              |
| Motivación para entrenar           | 1 a 5                              |
| Agujetas                           | «Ninguna» o 0 a 10 por zona tocada |
| Dolor articular, rigidez o espalda | No / sí, con zona                  |
| K-1 en las últimas 24 h            | No / sí, con intensidad 0 a 10     |
| Cómo recuperaste de la anterior    | Normal / peor de lo normal         |

Al terminar, la app muestra la fila que toca de «Cuándo modificar la sesión»:

| Situación                                                 | Nivel | Decisión que se muestra                                       |
| --------------------------------------------------------- | ----- | ------------------------------------------------------------- |
| Energía normal, agujetas leves, sin dolor                 | Verde | Realiza la sesión prevista y registra las cargas              |
| Cansancio moderado o K-1 intenso el día anterior          | Ámbar | Mantén 3 RIR y elimina primero la cinta                       |
| Agujetas altas o descenso claro del rendimiento           | Ámbar | Reduce un 25–30 % las series accesorias y no llegues al fallo |
| Dolor articular o técnica alterada desde el calentamiento | Rojo  | No fuerces el ejercicio, cambia la variante y avisa           |
| Mareo, dolor torácico o dificultad respiratoria anormal   | Rojo  | Detén la sesión y pide valoración sanitaria si no remite      |

Los umbrales (qué es «cansancio moderado» o «agujetas altas») se fijan en Guía y
reglas. La app recomienda; no cambia la sesión sola. Un check-in rojo avisa al
entrenador en Hoy.

### Durante la sesión

Por serie: peso, repeticiones (o segundos o metros) y **RIR real**. Calentamiento
y vuelta a la calma se marcan. El cardio registra duración, inclinación,
velocidad y RPE. «Añadir molestia» abre la hoja de molestia.

### Molestia

Zona, **lado** (izquierdo, derecho, ambos, no aplica; faltaba en el diseño),
intensidad 0 a 10, qué nota (rigidez, va a más, pinchazo o irradia, pérdida de
fuerza), ejercicio y serie (ya rellenos si se abre desde uno) y momento. El
servidor calcula el nivel con el semáforo de la guía:

- **Rojo:** pinchazo o irradia, pérdida de fuerza, intensidad 7 o más, o
  síntomas generales (mareo, dolor en el pecho, falta de aire). La app le dice
  al cliente que pare.
- **Ámbar:** va a más, rigidez o intensidad de 4 a 6.
- **Verde:** lo demás.

Se envía al momento («Avisar a mi entrenador»); sin red, queda en cola y la
pantalla lo dice. Es la única excepción a «el entrenador no ve nada antes del
envío», y se escribe como tal en el spec.

### Cierre

El registro mínimo después de entrenar: RPE global 0 a 10, energía al terminar
1 a 5, ejercicios que resultaron inestables o incómodos, K-1 de hoy (duración,
intensidad y si fue antes o después de la fuerza) y notas. Luego «Enviar».

## 5. Progresión sugerida y señales de ajuste

### Carga sugerida

Doble progresión, como la explica la rutina: se mantiene la carga hasta llegar al
máximo del rango en todas las series con el RIR previsto; entonces se sube el
incremento mínimo y se vuelve al mínimo del rango.

Por cada ejercicio con carga, tras cada envío, la app calcula la próxima vez:

Manda la primera regla que se cumple, en este orden:

| Orden | Qué pasó en la última sesión                                             | Próxima vez                                                        |
| ----- | ------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| 1     | Molestia ámbar o roja en ese ejercicio                                   | **Pendiente de ti**: no se sugiere nada                            |
| 2     | Alguna serie al fallo (RIR 0) o bajó la carga a mitad                    | **Revisa**: baja a la carga de la última serie completa            |
| 3     | Alguna serie con RIR por debajo de lo previsto                           | **Igual**, sin subir                                               |
| 4     | Todas las series hechas, al máximo del rango y con el RIR previsto o más | **Sube** el incremento (1–2,5 kg tren superior, 2,5–5 kg inferior) |
| 5     | Cualquier otro caso                                                      | **Igual**                                                          |

La sugerencia aparece al cliente como objetivo tenue de peso en la próxima sesión
y al entrenador en la columna «Próxima vez». Si el entrenador fija una carga, la
suya manda. El incremento sale del grupo muscular del ejercicio y se puede
cambiar por ejercicio.

### Señales de ajuste

Los criterios de ajuste de la rutina, calculados cada semana por cliente:

1. Rendimiento más bajo en dos sesiones seguidas del mismo ejercicio principal.
2. Agujetas de 7 o más en la misma zona durante más de 72 horas (check-ins).
3. Sueño o energía de 2 o menos en la mayoría de check-ins de la semana.
4. Molestia ámbar o roja, o técnica marcada como incómoda en el cierre.
5. Piernas pesadas que perjudican el K-1 (se pregunta al registrar el K-1).

Con dos o más en la misma semana, Hoy y la ficha muestran «2 señales para bajar
volumen esta semana», con la propuesta de la guía: bajar un 25–30 % el volumen o
quitar primero lo marcado como «se quita primero». El botón «Aplicar a la
semana» ajusta las sesiones todavía no empezadas; el entrenador lo revisa antes
de guardar. Nada se aplica solo.

## 6. Sistema visual

Se adopta el de Claude Design en toda la app.

Ya está en `src/tema.ts` y `src/componentes/diseno.tsx` de `dev`, con sus propios
nombres (`superficie`, `superficieAlta`, `superficieBaja`…). Falta añadir el ámbar
y el rojo del semáforo y un borde de controles con 3:1 (tarea P03).

| Token      | Valor                                                                          |
| ---------- | ------------------------------------------------------------------------------ |
| fondo      | `#0E0D0B`                                                                      |
| lateral    | `#151412`                                                                      |
| tarjeta    | `#1A1916`                                                                      |
| elevado    | `#1F1D19` (fila seleccionada, pestaña activa)                                  |
| campo      | `#26231E`                                                                      |
| borde      | `#2B2823`; en campos y controles, uno de 3:1 como mínimo                       |
| texto      | `#F2EDE1`; secundario `#A39C8F`                                                |
| oro        | `#FFC34C`; degradado `#FFF09A → #FFCF52 → #FFB53C → #E99A1F`                   |
| ámbar      | `#F0B44C` · verde `#5FB57A` · rojo `#E06A5F`                                   |
| Tipografía | Anton para títulos en mayúsculas; Archivo para todo lo demás; cifras tabulares |

Componentes base: tarjeta (radio 20), botón dorado (44 px, 52 en llamadas
principales del teléfono), botón de contorno, pestañas con subrayado dorado,
chips, selector de 1 a 5 como grupo de radio, deslizador de 0 a 10, tabla de
series con cabeceras reales.

## 7. Accesibilidad

Lo que la [auditoría](auditoria-accesibilidad.md) pide a estas pantallas:

- Tablas con cabeceras de verdad, no rejillas de cajas.
- Elegir un ejercicio en el constructor con botones que anuncian su selección,
  no solo con un fondo distinto.
- Controles con 3:1 de contraste como mínimo; nada que dependa solo del color.
- Pestañas con sus roles, la seleccionada anunciada y el estado en la URL.
- Selectores de una opción como grupos de radio; los de varias, como casillas.
- «Publicar», «Asignar» y «Aplicar a la semana» piden confirmación y avisan si
  hay cambios sin guardar.
- Recalculos (duración estimada, macros, nivel del semáforo) anunciados.
- Zonas táctiles de 44 puntos.

## 8. Qué queda fuera

Mensajes y comentarios entre entrenador y cliente, notificaciones push, el
cronómetro de descanso, integración con básculas o relojes (los datos se
teclean), y el mapa muscular con figuras hasta que se resuelva su licencia.
