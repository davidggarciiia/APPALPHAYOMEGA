# Alpha & Omega · Especificación de la ficha del cliente (entrenador, 390 px)

**Design (artboards «Ficha nueva · …» y «Cliente · Sugerencia de subir carga», sección «ENTRENADOR · ficha del cliente rediseñada», al final del lienzo):** https://claude.ai/artifact/4kQQfzvt4R7qkkAQQciNPq
(Privado: solo lo abre su dueño hasta que lo comparta desde Share.)

Para quien implemente en React Native (Codex). **Sustituye a la sección 5.3 de `tasks/diseno-movil/ESPEC.md`** (ficha con dos botones y seis pestañas). Hereda de ese documento los tokens, componentes (`BotonPrincipal` con corte de 13 px, `BotonSecundario`, `Esqueleto`, `Hoja`, `Dialogo`, `AvisoDeError`), la regla «un texto solo existe si cambia una decisión» y el lenguaje de movimiento. No se toca `packages/shared` salvo lo marcado «CONTRATO». Los nombres y cifras del Design son de ejemplo.

Estado: propuesta para implementar, sin aprobación pendiente (el dueño pidió seguir en automático). Los puntos que conviene que confirme están en la sección 12.

## 0. Por qué se rediseña y qué decidió el dueño

El dueño vio la ficha y dijo que era «súper poco intuitiva»: una línea larga y amontonada bajo el nombre, un botón «Semana» ambiguo, «Crear plan nuevo» como acción principal cuando casi nunca se viene a eso, cinco pestañas (una escondida) y un Resumen que mezcla la última sesión con una lista de envíos y los objetivos.

**Corrección posterior del dueño (manda sobre `SPEC-entrenador.md` criterio 8):** «el entrenador no va a subir cargas, eso lo hará el cliente; el entrenador solo pone el RIR que tendrían que hacer, como en el PDF». Consecuencias:

- En la ficha y en la progresión del **entrenador** no hay acción, botón ni chip «Sube carga». El entrenador **observa** el estado de cada ejercicio principal: **Progresa / Estancado / Baja**, con la mejor serie frente a la anterior.
- Lo único que el entrenador prescribe sobre el esfuerzo es el **RIR pedido**: se ve en la progresión («Pedido 4 × 8–10 · RIR 2») con el enlace «Ajustar», que abre la hoja «Editar ejercicio» del constructor. No hay «subidaKg» editable desde la ficha.
- La sugerencia «Llegaste al tope del rango con el RIR pedido: sube carga la próxima vez» es **del cliente** (sección 8, artboard «Cliente · Sugerencia de subir carga»).

### Las 5 decisiones clave

1. **Primero lo que hay que hacer.** Tarjetas de acción solo si hacen falta (molestia sin responder, sesiones por revisar, el bloque acaba). Sin nada, no ocupan sitio ni dicen «Nada pendiente».
2. **Después su semana.** Tira de lunes a domingo con el estado de cada día y «3 de 5 hechas»; tocar un día abre su sesión o su revisión. Sustituye al botón «Semana».
3. **Después sus cargas.** Los 3–4 ejercicios principales con la mejor serie de la semana frente a la anterior y el estado Progresa / Estancado / Baja. Tocar abre la progresión de ese ejercicio.
4. **Cabecera de una línea y menú ⋯.** Nombre y apellidos, estado, «Mes 2 · semana 1 de 4» y una barra del bloque que marca las semanas con ajuste (intensificación, descarga). «Datos del cliente», «Crear plan nuevo» y «Ver como cliente» viven en el menú ⋯.
5. **Sin pestañas.** Siete filas con un dato vivo cada una (Plan, Sesiones, Progreso, Valoraciones, Molestias, Nutrición, Datos del cliente). Siete destinos no caben en ≤ 4 pestañas visibles, y una fila con dato vivo informa sin abrirla.

## 1. Jerarquía de la pantalla (de arriba abajo)

Pantalla empujada, sin barra de pestañas inferior (igual que hoy). Scroll vertical; `gap` 22 entre bloques; márgenes 20.

| #   | Bloque                                                                                                  | Cuándo aparece                                                                                                                                                                                        | Artboard                        |
| --- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| 1   | Barra superior: volver (44) y **⋯** (44)                                                                | siempre                                                                                                                                                                                               | todos                           |
| 2   | Cabecera: nombre y apellidos (Anton 34), insignia de estado, «Mes 2 · semana 1 de 4», **BarraDeBloque** | siempre; sin plan: solo nombre + «Sin plan todavía»                                                                                                                                                   | Ficha nueva · David García      |
| 3   | Aviso de consentimiento (`AvisoDeError` variante `aviso`, una línea)                                    | solo si `consentimiento.vigente === false`; texto: «Sin consentimiento de salud: no se pueden guardar medidas ni fotos hasta que lo acepte.» No está dibujado; usa el componente de avisos del Design | —                               |
| 4   | **Tarjetas de acción** (0–3)                                                                            | solo las que apliquen; orden: molestia, revisión, fin de bloque                                                                                                                                       | David García / Molestia abierta |
| 5   | **TiraSemana**                                                                                          | si hay plan o sesiones en la semana                                                                                                                                                                   | David García                    |
| 6   | **Cargas**                                                                                              | si hay al menos un ejercicio principal con historial o prescrito                                                                                                                                      | David García                    |
| 7   | **Destinos** (7 filas con dato vivo)                                                                    | siempre; una fila solo aparece si lleva a algo (ver 2.5)                                                                                                                                              | David García / Cliente nuevo    |
| —   | Estado vacío (sin plan ni valoración)                                                                   | sustituye a 4–6                                                                                                                                                                                       | Cliente nuevo                   |

Se eliminan de esta pantalla: botones «Semana» y «Crear plan nuevo», pestañas, «Última sesión», lista «Novedades», «Qué buscamos» y el subtítulo de una línea larga (sección 11).

## 2. Componentes

Medidas en px sobre 390 de ancho. Todos los tokens ya existen (`tema.ts`); sin tokens nuevos salvo los ya añadidos por `ESPEC.md` 1.2.

### 2.1 `CabeceraFicha` y `BarraDeBloque`

- Nombre: `[nombre, apellidos].join(" ")`, Anton 34/38, hasta 2 líneas. Debajo, fila de `InsigniaDeEstado` (24 de alto) + «Mes 2 · semana 1 de 4» (13, `textoSecundario`): `plan.nombre` y `semanaDelBloque(plan, lunes)` de `plan.semanas`. Sin deportes, sin fase, sin «Semana 5».
- `BarraDeBloque`: una barra de `plan.semanas` segmentos (flex 1, `gap` 3, alto 10, radio 2, inclinados −20° como `Seg`). Hechas: `degradadoOro`; actual: `acento` y pulso; futuras: `superficieAlta`; **semana con ajuste** = su fase tiene `ajustes` (`faseDeSemana(fases, n)?.ajustes`): contorno discontinuo 1,5 `aviso`, sin relleno (si es la actual, relleno `acento` y la etiqueta la marca). Debajo, una etiqueta por semana (12/16): «S1», «S2»… y, en las de ajuste, «S3 intensif.», «S4 descarga» en `aviso` (nombre de la fase en minúsculas; si pasa de 9 letras, 8 + «.»). La actual va en `texto` semibold.
- Más de 8 semanas: las etiquetas solo en la actual y en las de ajuste (el resto, vacías); más de 12 segmentos: sin etiquetas, solo `accessibilityLabel`.
- `accessibilityRole="image"` con etiqueta «Semana 1 de 4. La semana 3 es de intensificación y la 4 de descarga».
- Sin plan: no hay barra ni «Mes n».

### 2.2 `TarjetaDeAccion`

Fila: marca cuadrada 8×8 (radio 2) · texto (título 15 bold, detalle 13 tenue, máx. 2 líneas) · botón compacto 48 de alto. Radio 20, relleno 14/14/14/16, borde 1.

| Tarjeta                | Marca y borde                        | Título · detalle                                                                                                              | Botón → destino                                                                      |
| ---------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Molestia sin responder | `error` si nivel ≥ 7; `aviso` si 4–6 | «Hombro · 7 de 10» · «Press inclinado, serie 2 · desde el lun 26» (si hay más: «· y 1 más»)                                   | **Responder** → hoja `DialogoResponder` de la molestia más grave (ya existe)         |
| Sesión por revisar     | `acento`                             | 1: «Pierna por revisar» · «Mié 28 · 16 de 16 series · enviada ayer». ≥ 2: «3 sesiones por revisar» · «La más antigua: lun 26» | **Revisar** → `/entrenamiento/[id]` (1) o Sesiones con el filtro «Sin revisar» (≥ 2) |
| Fin de bloque          | `aviso`                              | «El Mes 2 acaba el domingo» · «Semana 4 de 4 · prepara el siguiente»                                                          | **Preparar** → constructor (`/entrenador/cliente/[id]/plan`)                         |

- **Un solo botón dorado por pantalla**: la primera tarjeta usa `BotonPrincipal` (corte 13, `destello`), las demás `BotonSecundario` compacto. Si solo hay una tarjeta, esa es la principal.
- Fin de bloque: la semana actual es la última (`semanaDelBloque === plan.semanas`) **y** `api.plan(clienteId, lunes+7)` devuelve `null` o el mismo plan. Si `api.plan(clienteId, lunes)` es `null` pero el cliente tuvo planes (hay resultados): tarjeta «Sin plan esta semana» · «Crea el siguiente bloque», botón **Crear plan**, y no se pinta la tira.
- Máximo 3 tarjetas; ninguna si no aplica ninguna.

### 2.3 `TiraSemana`

- Cabecera: «26 oct – 1 nov» (13 tenue) y «3 de 5 hechas» (14; el 3 en `acento`). Sin título «Esta semana».
- 7 celdas `flex: 1`, `gap` 4, mínimo 46×102, radio 14, fondo `superficie`, borde `borde`; **hoy**: fondo `superficieAlta`, borde `acento`, `accessibilityState.selected`. Contenido: día (12, tenue), número (16, semibold), cuadrado de estado 24×24 (radio 8) y, abajo, «K-1» (11/14 bold, `naranja`) si el día tiene deporte.
- Estado de la sesión de fuerza del día (la forma varía además del color):

| Estado                           | Cuadrado                   | Regla                             |
| -------------------------------- | -------------------------- | --------------------------------- |
| Hecha                            | `exito` con ✓              | `enviadoEn !== null`              |
| Pendiente (hoy o futuro)         | borde `bordeFuerte`, vacío | `fechaActual >= hoy` y sin enviar |
| No hecha                         | borde `error` con ×        | `fechaActual < hoy` y sin enviar  |
| Sin fuerza (descanso o solo K-1) | «−» `marcador`             | no hay sesión ese día             |

- Marca 8×8 arriba a la derecha: `acento` = hecha **sin revisar**; `error` = la sesión tiene una molestia abierta. Ambas pueden faltar.
- K-1 sale de `plan.bloque.deportes[].dias` (1 = lunes). Los deportes no tienen estado: solo se marcan.
- Toque: hecha → `/entrenamiento/[id]` (revisión, 5.4); pendiente / no hecha → `/entrenamiento/[id]` en su estado «Aún no ha terminado el entrenamiento» (5.4); día sin sesión: no es tocable. _Nota:_ en el Design los días pendientes enlazan al artboard del Constructor porque no hay artboard de ese estado.
- `accessibilityLabel` de cada celda: «Lunes 26, Empuje: hecha y revisada. Además K-1.»
- «3 de 5» = enviadas / `ListadoSesiones.total` de la semana.

### 2.4 `FilaCarga` y bloque «Cargas»

- Microetiqueta (11 mayúsculas tenue) «Mejor serie · kg × reps» a la izquierda y «esta semana vs anterior» (12 tenue) a la derecha. Es una leyenda que cambia cómo se lee la cifra, no un título.
- Tarjeta de filas de 68: izquierda nombre (15 bold) y debajo «60 × 10 · RIR 2» (13 tenue, tabulares); derecha, el **delta** y el **estado**; chevrón 18.
- Delta: `↑ +2,5 kg` (`#7FE08F`), `= Igual` (`textoSecundario`), `↓ −2,5 kg` (`aviso`). Si el peso es igual y cambian las reps: `↑ +1 rep` / `↓ −1 rep`. Flechas como iconos de trazo 16, no caracteres.
- Estado: `Progresa` (insignia `exitoSuave`), `Estancado` (insignia neutra), `Baja` (insignia `acentoSuave` + `aviso`). Sin color solo: el estado va escrito y la flecha cambia de forma.
- Esta semana sin sesión de ese ejercicio: «Sin hacer · antes 40 × 8», sin delta ni insignia, guion «—» a la derecha. Primera semana con datos (no hay anterior): se muestra la serie y ningún estado.
- Qué ejercicios: los de la parte principal (`seccion === "principal"`) con `compuesto === true`, en el orden de la semana (lunes → domingo) y como máximo 4; si el plan no marca compuestos, el primer ejercicio de cada sesión. Tocar → `/entrenador/cliente/[id]/ejercicio/[ejercicioId]`.
- **Regla del estado (función pura en `packages/shared/src/progresion.ts`, CONTRATO aditivo):** `estadoDeEjercicio(actual, anterior)` compara, por este orden, `pesoKg` y `repeticiones` de la **mejor serie de la semana** (la de mayor 1RM estimado, Epley `peso × (1 + reps / 30)`, la misma que ya usa `fuerzaEstimada` en `sesiones.service.ts`): mayor → `progresa`, igual → `estancado`, menor → `baja`; sin `actual` → `sinDatos`. «Anterior» es la última semana anterior con datos, no necesariamente la inmediata. Pruebas unitarias de cada caso, de series omitidas y de RIR nulo. **No existe** aquí ninguna regla «sube carga»: ver sección 8.

### 2.5 `FilaDestino` (lista de destinos)

Tarjeta de filas de 64: icono de trazo 22 `textoTenue`, título 15 bold, dato vivo 13 tenue, chevrón. Sin círculos ni rellenos dorados. En el dato vivo, lo que pide acción va en color (`acento` «1 sin revisar», `aviso` «2 abiertas»).

| Fila              | Destino                                                                      | Dato vivo (ejemplo)                                                              | De dónde sale  |
| ----------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | -------------- |
| Plan              | `/entrenador/cliente/[id]/plan`                                              | «Mes 2 · descarga en S4» (sin ajuste: «Mes 2 · 4 semanas»; sin plan: «Sin plan») | plan + `fases` |
| Sesiones          | `/entrenador/cliente/[id]/sesiones` (nueva, antigua pestaña)                 | «18 enviadas · 1 sin revisar»                                                    | resultados     |
| Progreso          | `/entrenador/cliente/[id]/progreso` (`ProgresoCliente`, `modo="entrenador"`) | «−0,8 kg desde el inicio»                                                        | medidas        |
| Valoraciones      | `/entrenador/cliente/[id]/valoraciones` (`ValoracionesProfesional`)          | «2 hechas · última 26 oct» / «Ninguna todavía»                                   | valoraciones   |
| Molestias         | `/entrenador/cliente/[id]/molestias`                                         | «Ninguna abierta · 3 atendidas» / «2 abiertas · 1 atendida»                      | molestias      |
| Nutrición         | `/nutricion/cliente/[id]` (existe)                                           | «Dieta vigente · 2.450 kcal hoy» / «Sin dieta»                                   | dieta vigente  |
| Datos del cliente | abre la hoja (sección 7)                                                     | el correo                                                                        | ficha          |

- Regla de aparición: Sesiones, Progreso y Molestias solo aparecen cuando tienen datos (sin sesiones enviadas, sin medidas, sin molestias nunca registradas). Plan, Valoraciones, Nutrición y Datos del cliente siempre. Así el cliente nuevo ve 4 filas y no 7 destinos vacíos.
- «Progreso» y «Valoraciones» se separan: hoy la pestaña Progreso apila `ValoracionesProfesional` y `ProgresoCliente`. «Cuerpo» es un nombre alternativo para «Valoraciones» si el dueño lo prefiere.

### 2.6 Menú ⋯

`Hoja` inferior (radio 28, asa) con tres filas de 64 y «Cancelar» (secundario 48): **Datos del cliente** («Nombre, correo y acceso»), **Crear plan nuevo** («Empieza un bloque nuevo» → constructor), **Ver como cliente** («Su semana, solo lectura» → `/entrenador/cliente/[id]/entrenos`, la ruta del antiguo botón «Semana»). Botón ⋯: 44×44, `aria-haspopup="menu"` en el Design; en RN `accessibilityLabel="Más acciones"`. Sin gesto de arrastre (no hay `gesture-handler`): se cierra con «Cancelar», el scrim o atrás de Android.

## 3. Datos de cada bloque y de qué endpoint salen

Una sola carga con `Promise.allSettled` al enfocar (`useFocusEffect`), como hoy. Cambio de cadencia: el **núcleo de actividad** se refresca cada 10 s mientras la app está activa; el resto, al enfocar y cada 60 s (hoy se pide todo cada 10 s, incluidas dieta y medidas, que casi no cambian). El refresco **no repite la animación de entrada** ni pinta esqueletos: solo sustituye datos.

| Bloque                                                           | Petición                                                                                                                                                   | Cadencia   | Notas                                                                                                                                                                                                                                                                                                   |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nombre, apellidos, estado, correo, teléfono, fecha de nacimiento | `GET /usuarios/:id` (`FichaDeUsuario`)                                                                                                                     | 60 s       | Ya se pide                                                                                                                                                                                                                                                                                              |
| Plan, semana del bloque, fases, deportes (K-1)                   | `GET /entrenamiento/clientes/:id/plan?semana=<lunes>` (`PlanVigenteRespuesta`)                                                                             | 60 s       | `semanaDelBloque`; semanas con ajuste = `bloque.fases[].ajustes`                                                                                                                                                                                                                                        |
| ¿Hay plan siguiente? (tarjeta de fin de bloque)                  | mismo endpoint con `semana=<lunes+7>`, solo cuando es la última semana                                                                                     | 60 s       | Una llamada extra y condicional                                                                                                                                                                                                                                                                         |
| Sesiones de la semana (tira, «3 de 5»)                           | `GET /entrenamiento/clientes/:id/sesiones?semana=<lunes>` (`ListadoSesiones`: `agenda.fechaActual`, `enviadoEn`, `nombre`, `total`)                        | 10 s       | **Petición nueva en la ficha** (existe en `api.semana`); hoy la ficha no la usa                                                                                                                                                                                                                         |
| Resultados enviados (cargas, «sin revisar», conteos)             | `GET /entrenamiento/clientes/:id/resultados?limite=60` (máx. del contrato)                                                                                 | 10 s       | Hoy pide 30; 60 cubre ~8 semanas de 5 sesiones                                                                                                                                                                                                                                                          |
| Sesión sin revisar                                               | `revisadaEn` de la sesión                                                                                                                                  | 10 s       | **CONTRATO aditivo recomendado:** añadir `revisadaEn: iso \| null` a cada elemento de `ListadoResultadosSchema.resultados`. Hoy solo viene en `GET /entrenamiento/sesiones/:id` y cada fila hace su propia petición (`UltimaSesion`, `SesionesDelCliente`): con la tira serían hasta 5 más por refresco |
| Molestias (tarjeta, marca de la tira, fila)                      | `GET /entrenamiento/clientes/:id/molestias?estado=todas&limite=100`                                                                                        | 10 s       | `estado: "abierta" \| "atendida"`; responder: `POST /entrenamiento/molestias/:id/atender` (ya existe)                                                                                                                                                                                                   |
| Mejor serie semanal por ejercicio, estado, delta                 | derivado de `resultados`: por `ejercicioId` y lunes de `agenda.fechaActual`, mejor serie hecha (`valores.pesoKg`, `repeticiones`, `rir`)                   | —          | Mismo cálculo en `shared/progresion.ts`; descarta borradores (solo ENVIADOS)                                                                                                                                                                                                                            |
| Progresión de un ejercicio (gráfica)                             | `GET /entrenamiento/clientes/:id/fuerza` (`ProgresionFuerza`: por ejercicio, puntos `{fecha, pesoKg, repeticiones, estimado}` de las últimas 200 sesiones) | al abrir   | Se agrupa por lunes y se toma el mayor `estimado`; el servidor ya calcula Epley                                                                                                                                                                                                                         |
| Últimas sesiones del ejercicio (series, RIR)                     | `resultados` filtrado por `ejercicioId` (`prescripcion.ejercicios[].rir` para el RIR pedido)                                                               | al abrir   | `fuerza` no trae RIR ni todas las series                                                                                                                                                                                                                                                                |
| Valoraciones (total y fecha de la última)                        | `GET /seguimiento/clientes/:id/valoraciones?limite=1&desplazamiento=0`                                                                                     | 60 s       | `total` decide el estado vacío                                                                                                                                                                                                                                                                          |
| Progreso (delta de peso)                                         | `GET /seguimiento/clientes/:id/medidas/pagina` (`seguimiento.medidas`)                                                                                     | 60 s       | Primera y última medida de peso                                                                                                                                                                                                                                                                         |
| Nutrición (fila)                                                 | `GET /nutricion/clientes/:id/dieta` (`nutricion.vigente`)                                                                                                  | 60 s       | `tipoDelDia(documento, hoyAgenda()).objetivo.kcal`                                                                                                                                                                                                                                                      |
| Consentimiento (aviso)                                           | `GET /seguimiento/clientes/:id/consentimiento`                                                                                                             | 60 s       | Ya se pide                                                                                                                                                                                                                                                                                              |
| Datos del cliente (hoja)                                         | `PATCH /usuarios/:id`, `PATCH /usuarios/:id/correo`, `POST /usuarios/:id/reenviar-activacion`, `/desactivar`, `/reactivar`                                 | al guardar | Ya existen; ver sección 7                                                                                                                                                                                                                                                                               |

Si una petición del núcleo falla pero hay datos anteriores, se conservan los viejos (como hoy en `setDatos`) y aparece el banner «Sin conexión · copia de las 09:40». Un `ErrorDePermiso` o `ErrorDeSesion` sigue vaciando la ficha (comportamiento actual).

## 4. Estado vacío: cliente nuevo (sin plan ni valoración)

Artboard «Ficha nueva · Cliente nuevo». Condición: `plan === null && totalValoraciones === 0 && resultados.length === 0`.

- Cabecera: nombre, insignia, «Sin plan todavía». Sin barra, sin tarjetas de acción, sin tira, sin cargas.
- Dos pasos numerados con cuadrado 28 (radio 8, no círculo): **1 · Valoración inicial** («Peso, medidas y pruebas de partida.») con el botón principal dorado «Empezar valoración» (abre `/entrenador/cliente/[id]/valoraciones` con `valoracionInicial=1`, lo que hoy hace `valoracionInicial` en la ruta); **2 · Crear plan** («Rutina, bloque y fecha de inicio.») con botón secundario «Crear plan». El paso 1 lleva borde destacado; el 2 no se bloquea (se puede crear el plan sin valoración).
- Destinos: solo Plan, Valoraciones, Nutrición y Datos del cliente.
- Variantes: con valoración pero sin plan → un solo paso («Crear plan», principal); con plan pero sin valoración → ficha normal con una tarjeta de acción «Valoración inicial» («Aún no tiene la de partida», botón **Empezar**).

## 5. Estado con molestia abierta

Artboard «Ficha nueva · Molestia abierta». La tarjeta de molestia va la primera (borde `error`, botón principal **Responder**), la de revisión pasa a botón secundario, la celda del día de esa sesión lleva la marca roja y la fila Molestias dice «2 abiertas · 1 atendida». El resto no cambia. Atendida la molestia, la tarjeta desaparece sin avisos intermedios (`versionMolestias` actual se mantiene para no pisar la respuesta con un refresco).

## 6. Pantalla de progresión de un ejercicio

Artboard «Ficha nueva · Progresión del ejercicio». Ruta nueva `apps/mobile/app/entrenador/cliente/[id]/ejercicio/[ejercicioId].tsx`. Es de **lectura**, salvo «Ajustar».

Orden:

1. Barra: volver y «David García» (13 tenue). Título Anton 34 con el nombre del ejercicio.
2. Insignias: estado (`Progresa` / `Estancado` / `Baja`) y `Doble progresión` (neutra, si el ejercicio la usa). Debajo, una línea: «El cliente sube carga al llegar a 10 reps en todas las series con RIR 2.» (13 tenue; el tope y el RIR salen de la prescripción; es la única mención a la regla y explica por qué no hay botón).
3. **Hero** (`hero`, borde destacado): «Mejor serie · lun 26 oct» (11), «60 kg × 10» en Anton 48 `acento` y a la derecha el delta (`tag` éxito con flecha, «+2,5 kg»). Gráfica semanal (viewBox 330×156): mejor serie (kg) en trazo continuo `acento` 3 px y 1RM estimado (Epley) en trazo discontinuo `textoTenue` 2 px, ambas en kg sobre el mismo eje (cuadrícula a 60/70/80); punto final con halo, valor final rotulado, fechas de los lunes en el eje. Leyenda de dos entradas. Reutiliza `src/seguimiento/grafica.tsx`; si solo hay una semana se muestran las cifras sin gráfica (estado «Progreso», sección 8 de `ESPEC.md`).
4. Tarjeta de filas: **Pedido** «4 × 8–10 · RIR 2» con el enlace **Ajustar** (44; abre la hoja «Editar ejercicio» del constructor para ese ejercicio: parámetro nuevo `ejercicioId` en `/entrenador/cliente/[id]/plan`), **1RM estimado** «80,0 kg» con el delta en verde, **Semana anterior** «57,5 × 10 · RIR 3».
5. «Últimas sesiones» (microetiqueta): tarjetas de 4 sesiones (más con «Ver más», 10 por página). Cabecera «Lun 26 oct» y, a la derecha, lo pedido en esa sesión («4 × 8–10 · RIR 2»); debajo una rejilla de una columna por serie con «60 × 10» (14 bold) y «RIR 2» (12). El RIR por debajo del `rir.min` pedido va en `aviso`. Con texto del sistema > 1,3× la rejilla pasa a 2×2. Tocar abre la revisión (`/entrenamiento/[id]`).

Sin acciones de carga. «Ajustar» solo toca el RIR (y lo demás de la hoja del constructor, que ya existe).

## 7. Hojas: menú ⋯ y «Datos del cliente»

Artboard «Ficha nueva · Menú ⋯ y Datos del cliente». La hoja de datos es una `Hoja` (radio 28, asa, scrim) que aloja **el mismo formulario** que hoy vive en `app/cliente/[id].tsx`; no se duplica: se extrae a un componente `DatosDelCliente` usado por la hoja y por esa ruta, que pasa a redirigir a `/entrenador/cliente/[id]?datos=1` (que abre la hoja). Así la cartera y las notificaciones siguen funcionando.

- Cabecera: «Datos del cliente» (Anton 24) y cerrar (44). Cerrar con cambios sin guardar pide confirmación (`Dialogo`: «¿Salir sin guardar?»).
- Campos con `label` real: Nombre y Apellidos (dos columnas), Correo, Teléfono, Nacimiento (`numbers-and-punctuation`, `dd/mm/aaaa`) y Sexo (segmentado Hombre / Mujer, 52 de alto). El sexo y la edad son los que necesitan los protocolos de pliegues y el gasto (`SPEC-entrenador.md`, criterio 12): la edad se deriva de `fechaNacimiento` (ya existe) y el sexo es una **columna opcional nueva** (migración aditiva, editable aquí).
- Cambiar el **correo** pide confirmación y usa `PATCH /usuarios/:id/correo`; el resto, `PATCH /usuarios/:id` con `CambiosDeUsuarioSchema`.
- Fila de solo lectura «Consentimiento de salud» · «Dado el 28 sep» · insignia `Vigente` (el texto sale de `textoConsentimiento`). Retirarlo no se hace aquí.
- Acciones según el estado: **Guardar cambios** (principal, deshabilitado hasta que haya un cambio válido); **Dar de baja** (`BotonDestructivo`, requiere `Dialogo` de confirmación) si está activo; **Reenviar activación** (secundario) si está pendiente; **Reactivar** (secundario, con confirmación y el texto de a dónde vuelve: activo o pendiente, según `tieneContrasena`) si está de baja.
- Teclados: nombre y apellidos `default`, correo `email-address`, teléfono `phone-pad`, nacimiento `numbers-and-punctuation`.
- Con el teclado abierto la hoja sube y hace scroll; los botones quedan al final del scroll, no fijos.

## 8. La sugerencia «sube carga» es del cliente

Artboard «Cliente · Sugerencia de subir carga» (junto a la sesión del cliente). Cuando el cliente marca la última serie de un ejercicio principal y se cumple la regla, bajo la tabla aparece una banda (`acentoSuave`, flecha de trazo `acento`, 22) con dos líneas: «Llegaste al tope del rango con el RIR pedido» y «Sube carga la próxima vez: 62,5 kg».

- La regla **ya existe**: `proximaVez()` en `apps/mobile/src/entrenamiento/sesion/modelo.ts` (todas las series al tope, RIR ≥ `rir.min`, sin RIR 0–1, sin molestia, `subidaKg` definido) devuelve `tipo: "sube"` y «Sube a 62,5 kg». Se llama solo con el ejercicio recién completado; no hay lógica nueva.
- Aparece con el `destello` de marca una vez (clase `gl` del Design), sin sonido; no bloquea ni pide acción; desaparece si el cliente desmarca una serie. La carga de la siguiente sesión la elige el cliente en su celda «Kg».
- **Consecuencia para `SPEC-entrenador.md`:** el criterio 8 y la tarea E1 deben pasar a `estadoDeEjercicio` (entrenador, sección 2.4) y dejar «Sube carga» donde ya está (cliente). Sin reglas duplicadas en `shared`.

## 9. Estados (artboard «Ficha nueva · Carga, error y piezas»)

| Situación                       | Qué se ve                                                                                                                                                                                                        |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cargando (primera vez)          | Esqueletos: dos botones 44, nombre 230×38, línea 160×18, barra 10; tira de 7 celdas 102; microetiqueta + 4 filas de 68; 3 filas de 64. Sin esqueleto en refrescos. `accessibilityLabel="Cargando ficha"`, `busy` |
| Error sin copia                 | `AvisoDeError` «No se pudo cargar la ficha» + «Reintentar» (secundario)                                                                                                                                          |
| Error con copia                 | Banner `aviso` «Sin conexión · copia de las 09:40» sobre los datos viejos; los botones que escriben (Revisar, Responder) quedan deshabilitados al 45 %                                                           |
| Ejercicio sin datos esta semana | «Sin hacer · antes 40 × 8», sin delta ni insignia                                                                                                                                                                |
| Cliente nuevo                   | Sección 4                                                                                                                                                                                                        |
| Sin plan esta semana            | Cabecera «Sin plan esta semana», tarjeta «Crear plan», sin tira; las cargas se siguen mostrando con los últimos resultados                                                                                       |

El artboard incluye también las piezas: las tres tarjetas de acción juntas, la barra del bloque en semana 1, 3 y 4, y los tres estados de carga.

## 10. Movimiento y movimiento reducido

Lenguaje de marca de `ESPEC.md` sección 3 (reanimated 4). Nada nuevo salvo el uso:

| Qué                                                   | Movimiento                                                                                                                                                                           | Reducido                                               |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| Entrada de bloques (tarjetas, tira, cargas, destinos) | `caida` (−22 en Y, +8 en X, opacidad, 300 ms, `cubic-bezier(.2,.8,.2,1)`), escalonada 70–80 ms entre bloques, **solo la primera vez que llegan datos** (no en cada refresco de 10 s) | Aparecen sin desplazamiento, 0 ms                      |
| BarraDeBloque                                         | segmento actual con `pulso` 1,4 s (opacidad 1 → .45); al montar, las hechas se rellenan en 400 ms como el recorrido Α → Ω                                                            | Segmento actual fijo, sin relleno animado              |
| Botón principal dorado                                | `destello` (haz inclinado 20°) en bucle de 3,4 s, solo si es el único principal visible                                                                                              | Sin destello                                           |
| Gráfica de progresión                                 | trazo de la serie de kg en 900 ms (`stroke-dashoffset`); la de 1RM aparece con 200 ms de opacidad                                                                                    | Línea completa al instante                             |
| Sugerencia del cliente                                | `destello` único + `caida` de la banda                                                                                                                                               | Aparece sin destello                                   |
| Hojas                                                 | entrada con muelle 280 ms y scrim 150 ms                                                                                                                                             | Aparecen en 0 ms                                       |
| Esqueletos                                            | `barrido` 1,5 s                                                                                                                                                                      | Estáticos (`Esqueleto` ya usa `useMovimientoReducido`) |

Reglas: `useMovimientoReducido()` (`src/componentes/movimiento`) en cada componente nuevo (no un `if` global); ninguna animación bloquea una acción ni cambia el tamaño de la lista tras pintarse (sin saltos); la háptica solo en la confirmación de «Dar de baja».

## 11. Qué se elimina de la ficha actual y dónde va

Archivos: `apps/mobile/src/entrenamiento-entrenador/ficha/ficha-cliente.tsx` (547 líneas), `atencion.tsx`, `sesiones.tsx`, `apps/mobile/app/entrenador/cliente/[id]/index.tsx`.

| Hoy                                                                                                | Pasa a                                                                                                                                                                                                             |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Línea de subtítulo (`subtitulo`: plan · fase · semana · deportes)                                  | «Mes 2 · semana 1 de 4» + BarraDeBloque; deportes → marcas K-1 de la tira y pantalla Plan                                                                                                                          |
| Botón «Semana» (`verSemana`)                                                                       | Tira de la semana + «Ver como cliente» en ⋯ (misma ruta `entrenos`)                                                                                                                                                |
| Botón principal «Crear plan nuevo» (`editarPlan`)                                                  | Menú ⋯ y paso 2 del estado vacío / tarjeta «Sin plan esta semana»                                                                                                                                                  |
| `Pestanas`, `CambioDeContenido`, estado `pestana`, `bloquearCambio`, `editandoProgreso` y su aviso | Siete filas de destinos, cada una una pantalla empujada; el bloqueo de cambio de pestaña desaparece (cada editor vive en su pantalla)                                                                              |
| Resumen › «Valoración inicial» (botón secundario)                                                  | Paso 1 del estado vacío / tarjeta de acción                                                                                                                                                                        |
| Resumen › `RequiereAtencion`                                                                       | `TarjetaDeAccion` (molestia, revisión, fin de bloque). La línea de señales de volumen («1 de 2 señales para bajar volumen») no se dibuja en la ficha: queda dentro de Plan (fuera de este alcance; ver sección 12) |
| Resumen › «Última sesión» + «REVISAR SESIÓN» (`UltimaSesion`)                                      | Tarjeta «X por revisar» solo si falta revisar; el resto está en Sesiones y en la tira                                                                                                                              |
| Resumen › lista de envíos («David envió…»)                                                         | Campana de notificaciones (`app/notificaciones.tsx`, ya en curso); no se pinta en la ficha                                                                                                                         |
| Resumen › «Qué buscamos» (objetivos del bloque)                                                    | Pantalla Plan (el bloque ya muestra los objetivos); sin título extra                                                                                                                                               |
| Pestaña Sesiones (`SesionesDelCliente`)                                                            | Pantalla `/sesiones` (fila Sesiones) con el filtro Todas / Sin revisar                                                                                                                                             |
| Pestaña Progreso (`ValoracionesProfesional` + `ProgresoCliente`)                                   | Dos pantallas: `/valoraciones` y `/progreso`                                                                                                                                                                       |
| Pestaña Nutrición (resumen de dieta + «Abrir ficha de nutrición»)                                  | La fila Nutrición abre directamente `/nutricion/cliente/[id]`; el resumen se pinta como dato vivo                                                                                                                  |
| Pestaña Salud › Datos (edad, altura, peso, grasa, teléfono, consentimiento)                        | Teléfono, nacimiento, sexo y consentimiento → hoja Datos del cliente; altura, peso y grasa → Valoraciones / Progreso                                                                                               |
| Pestaña Salud › «Molestias por zona»                                                               | Pantalla `/molestias` (agrupable por zona)                                                                                                                                                                         |
| Pestaña Salud › enlace «Datos y acceso»                                                            | Fila «Datos del cliente» y menú ⋯                                                                                                                                                                                  |
| Petición de dieta y de medidas cada 10 s                                                           | Solo cada 60 s (sección 3)                                                                                                                                                                                         |

Parámetros de ruta que se conservan: `valoracionInicial=1` (ahora abre `/valoraciones` en modo inicial) y `pestana=progreso` (abre `/progreso`); el alta de cliente (D11) sigue funcionando.

## 12. Accesibilidad, riesgos y preguntas abiertas

- Objetivos ≥ 44 (celdas de la tira 46×102; filas ≥ 64; botones de tarjeta 48). Texto ≥ 4,5:1, incluidos los 11–12 px tenues. Estados nunca solo por color: forma (✓, ×, vacío, −), flecha y texto. Etiquetas de campo reales en la hoja de datos; `accessibilityRole="header"` solo en el nombre.
- 360 px: la tira mantiene 7 celdas (44 mín.); si el texto del sistema > 1,3×, la tira pasa a scroll horizontal con celdas de 56.
- **Riesgo, `revisadaEn`:** sin añadirlo a `resultados` el recuento «sin revisar» cuesta una petición por sesión. Recomendado el cambio aditivo; si no se hace, limitar a las sesiones de la semana y cachear por `id` (una sesión revisada no vuelve a pedirse).
- **Riesgo, 60 resultados:** un ejercicio con muy poco historial reciente puede quedarse sin «anterior». Se acepta; la fila lo muestra como «Primera semana».
- **Pregunta 1:** en la revisión de sesión del entrenador (5.4 de `ESPEC.md`) la etiqueta «Próxima vez · Sube a 62,5 kg» sigue mostrando lo que verá el cliente. Recomendado dejarla como información sin estilo de acción, o retirar la variante «sube» para ser coherentes con la corrección del dueño. No está dibujado.
- **Pregunta 2:** las señales de volumen y los estancamientos de dos semanas seguidas (hoy «Revisa») no tienen tarjeta propia en este diseño. Si el dueño quiere que «Baja dos semanas seguidas» entre como tarjeta de acción, es un cuarto tipo con la misma estructura.
- **Pregunta 3:** «Valoraciones» o «Cuerpo» como nombre de la fila.
- **Pregunta 4:** el Design muestra el ejemplo en viernes 30 oct para enseñar a la vez los cuatro estados de día; los datos son inventados.

## 13. Criterios de aceptación

1. La ficha no usa pestañas ni el subtítulo largo; muestra, por este orden, cabecera, tarjetas de acción (solo si aplican), tira, cargas y siete (o cuatro) destinos.
2. Con un cliente sin pendientes no se pinta ninguna tarjeta ni texto de «nada pendiente».
3. La tira muestra los cuatro estados de día y K-1 desde `plan.bloque.deportes`; «N de M hechas» cuenta solo sesiones enviadas.
4. Cada carga muestra mejor serie, delta y estado `Progresa` / `Estancado` / `Baja` por la función pura de `shared` (pruebas unitarias de los tres estados, `sinDatos`, series omitidas y RIR nulo). **No existe** ningún texto «Sube carga» en pantallas de entrenador (prueba que lo busque en `ficha/**`).
5. La BarraDeBloque marca las semanas cuya fase tiene `ajustes` y no las de solo texto.
6. El estado vacío (sin plan ni valoración) pone «Valoración inicial» como única acción dorada y «Crear plan» como secundaria.
7. La progresión del ejercicio usa `fuerza` para la gráfica y `resultados` para las series; nunca lee borradores.
8. «Datos del cliente» reutiliza el formulario y los endpoints existentes; baja y reactivar piden confirmación.
9. Con movimiento reducido no hay pulso, destello, trazo ni desplazamientos; los refrescos de 10 s no vuelven a animar.
10. Suites del móvil, typecheck y lint en verde; ninguna prueba de `ficha-cliente.spec.tsx` borrada sin su sustituta (se reescriben las de pestañas).

## 14. Mapa de artboards

| Artboard (Design)                        | Qué enseña                                                                                                                                                                      |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ficha nueva · David García               | Ficha completa: cabecera con barra, tarjeta de revisión, tira (hecha, sin revisar, no hecha, hoy, K-1, descanso), cargas (Progresa, Estancado, Baja, Sin hacer), siete destinos |
| Ficha nueva · Molestia abierta           | Molestia 7/10 como tarjeta principal + revisión secundaria; marca roja en la tira                                                                                               |
| Ficha nueva · Cliente nuevo              | Estado vacío con «Valoración inicial» y «Crear plan»                                                                                                                            |
| Ficha nueva · Progresión del ejercicio   | Gráfica semanal (kg y 1RM estimado), pedido y RIR con «Ajustar», últimas sesiones                                                                                               |
| Ficha nueva · Menú ⋯ y Datos del cliente | Hoja de acciones y hoja de datos con baja                                                                                                                                       |
| Ficha nueva · Carga, error y piezas      | Esqueleto, error sin y con copia, tarjetas de acción, barra del bloque, estados de carga                                                                                        |
| Cliente · Sugerencia de subir carga      | La banda «Llegaste al tope del rango…» al terminar el ejercicio                                                                                                                 |
