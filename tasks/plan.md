# Alpha & Omega — plan de corrección e integración para Claude

> **Encargo vigente del 24-09-2026:** David pide que Claude resuelva los cambios detectados en la revisión integral. Usar **Agent Skills**: `using-agent-skills` → `planning-and-task-breakdown` → `incremental-implementation` → `test-driven-development` → `code-review-and-quality`. Este es el único plan activo; se actualiza el mismo trabajo y se conservan sus tareas/evidencias anteriores. Entrada de ejecución: [para-claude.md](para-claude.md).

**Objetivo:** que lo mostrado, lo registrado y lo enviado coincidan; cerrar los recorridos de fotos y las integraciones pendientes antes de validar el uso real.

**Arquitectura:** reutilizar el controlador de entrenamiento, los contratos Zod y las APIs actuales. Corregir primero las interfaces que permiten ediciones ignoradas; después la lectura del histórico y los archivos temporales. El servidor decide permisos, revisiones y publicación; el cliente consulta y registra. Mantener migraciones aditivas y las copias privadas existentes.

**Stack:** TypeScript, Expo/React Native, NestJS, Prisma/PostgreSQL, Zod, Jest y React Native Testing Library.

## Primera parte que debe ejecutar Claude: revisión integral

### Base real y protección del trabajo

- Carpeta principal: `C:/Users/david/Desktop/APP-ALPHA_OMEGA`, rama `codex/cliente-intuitivo`, base revisada `f931b5c` más cambios locales. **No reiniciar T00 ni reemplazar esta carpeta por un worktree antiguo.**
- Ya están corregidos los dos P1 de consentimiento/fotos; sus regresiones y la continuación móvil están en el árbol de trabajo. La migración nueva es `20260924210000_intentos_foto`. Preservar UUID por intento, descarte duradero y ausencia de I/O de almacenamiento dentro de transacciones. No reutilizar una clave final compartida.
- `alpha_omega` y `alpha_omega_e2e_codex` tienen 26 migraciones aplicadas. API local reiniciada desde el build de la carpeta principal, puerto 3000; web 8181. Las pruebas HTTP nunca usan la base principal.
- Evidencia de esta base: 188 pruebas API, 452 móviles y 448 HTTP; tipos, lint y build API correctos. Esto no verifica modificaciones posteriores ni el código de otra rama.
- `claude/mejoras-pdf` continúa cambiando: últimos commits observados `e47e763`, `c5d22f4` y `2ff2594` activan y prueban metros. Volver a consultar su HEAD y cambios locales antes de integrar. No sobreescribir `registros.service.ts` ni copiar su `todo.md` entero, porque se perderían correcciones/estados de la carpeta principal.
- Las referencias HTML/PDF y archivos del usuario se conservan. No añadir imágenes, cuentas reales, secretos ni URLs firmadas a fixtures o Git.

### Decisiones de esta pasada

1. **RI01 — Cierre congelado:** una intención pendiente se presenta como resumen de solo consulta con su contenido persistido y un botón de reintento. No se añade cancelación/reedición del envío en esta pasada; así se conserva el protocolo que ya evita duplicados.
2. **RI02 — Guardado protegido:** bloquear edición, selección y cancelación mientras se guarda una medida/prueba; añadir guarda síncrona para dobles pulsaciones. Un fallo conserva el formulario. Cambiar el contenido después de un fallo no reutiliza un UUID vinculado a contenido anterior; un reintento idéntico sí lo reutiliza.
3. **RI04 — Nutrición:** distinguir `sinConexion`, `registroDesactivado` y edición habilitada. Con registro desactivado mostrar la pauta sin el botón de registrar; sin conexión mantener la selección y explicar el reintento. No cambiar los formatos internos ni la dieta publicada.
4. **RI05 — Origen de medidas:** una composición corporal calculada utiliza peso y grasa de la misma toma; mostrar las fechas reales si se presentan valores independientes. Un dato ausente no se rellena con otro mes ni con cero.
5. **RI06 — Histórico completo:** paginar la lectura sin eliminar registros. Mantener el formato anterior de los endpoints existentes y añadir rutas paginadas de lectura, para que los clientes con Zod estricto no fallen por campos nuevos. La API móvil reunirá las páginas y entregará a sus consumidores el formato actual, con orden explícito; no devolverá éxito con un histórico parcial si falla otra página. Esta solución evita cambiar todos los componentes de Progreso a la vez. Medir después la carga con 5.000 registros sintéticos antes de darla por cerrada.
6. **RI03 — Ejecución parcial:** conservar el acceso compacto de calentamiento/vuelta a la calma y reutilizar el registro por series al corregir. No crear otro modelo de series ni duplicar sus validaciones. Carga, tiempo, repeticiones, metros tras D01 y RIR conservan sus unidades/modos.
7. **RI07 — Temporales de fotos:** solo se eliminan archivos creados o copiados por la app; nunca un original de galería. Mantener el archivo necesario mientras haya un reintento pendiente y liberarlo al terminar, cancelar o sustituir. El borrado nativo no puede reducirse a perder la URI de memoria.

### Orden y dependencias

```text
RI00: consolidar instantáneas y preservar correcciones
  ├─ RI01 → RI02 → RI04 → control A
  ├─ RI05 → RI06a → RI06b → control B
  └─ integrar D01 verificado → RI03 → control C
RI07a → RI07b → F03b → F04b/F05b → control D
E02b → E02c: avisos del entrenador → E03
D04 y D07: continuar los desgloses existentes según alcance vigente
Q01 → Q02 → Q03; producción se valida por separado
```

RI01, RI02 y RI04 son independientes en producto; ejecutarlas secuencialmente simplifica la revisión. Contratos compartidos, dependencias y migraciones tienen un único responsable. Si se delega, asignar archivos exclusivos; no ejecutar dos agentes sobre Progreso, el controlador de registro o el esquema a la vez.

### Contratos de implementación que hay que conservar

El cierre obtiene primero el contenido ya comprometido y solo usa la edición si no existe intención:

```ts
const comprometido = documento.envioPendiente?.registro ?? documento.intencionEnvio?.registro
const cierreVisible = comprometido?.cierre ?? edicion.cierre ?? null
const notasVisibles = comprometido?.notas ?? edicion.notas
const pendiente = comprometido !== undefined
```

`CierreDeSesion` debe recibir `cierreInicial: Cierre | null` además de las notas, inicializar sus controles al abrir y mostrar un resumen fijo cuando esté pendiente. El botón de reintento llama al controlador sin exigir respuestas nuevas. Si un registro antiguo no contiene cierre, mostrar «Sin feedback registrado» y reintentar el contenido existente; no inventar esfuerzo o energía. Mientras el primer envío esté en curso, mostrar los valores enviados y bloquear cambios.

Para los listados, preparar estos contratos adicionales en `packages/shared/src/seguimiento.ts`, exportados mediante el mecanismo actual de `packages/shared/src/index.ts`:

```ts
export const ConsultarPaginaSeguimientoSchema = z.strictObject({
  cursor: z.string().min(1).max(1000).optional(),
  limite: z.coerce.number().int().min(1).max(500).default(500),
})
export const PaginaMedidasSchema = z.strictObject({
  medidas: z.array(MedidaSchema),
  fechaNacimiento: FechaAgendaSchema.nullable(),
  siguienteCursor: z.string().nullable(),
})
export const PaginaPruebasSchema = z.strictObject({
  pruebas: z.array(PruebaFisicaSchema),
  siguienteCursor: z.string().nullable(),
})
```

Rutas nuevas: `GET /seguimiento/clientes/:clienteId/medidas/pagina` y `GET /seguimiento/clientes/:clienteId/pruebas/pagina`. Mantener los roles y `AlcanceClienteGuard` de sus listados actuales. Cursor opaco de fecha de toma, creación e ID, validado al decodificar; orden descendente por esa tupla y `limite + 1` para determinar si hay más. No depender de que siga existiendo la fila del cursor ni aceptar campos del cursor como nombre de tabla/columna. Un cursor manipulado nunca cambia el cliente filtrado. Las pruebas físicas se agrupan/ordenan por nombre al presentar el resultado, no al paginar por fecha.

El adaptador móvil mantiene las firmas `medidas(clienteId)` y `pruebas(clienteId)`: reúne páginas, deduplica por ID, detecta un cursor repetido como error y ordena medidas por fecha/creación/ID ascendente y pruebas por nombre/fecha/ID. No transformar un fallo de página en una lista aparentemente completa. Los endpoints antiguos continúan aceptando sus peticiones sin parámetros y devolviendo únicamente su contrato anterior. Corregir en ellos el recorte que oculta lo reciente sin agregar campos; la aplicación actual usa las nuevas rutas para recuperar el histórico completo.

### Criterios de cierre de esta parte

- Cada RI tiene prueba que falla por el escenario descrito antes del cambio y pasa después; se conserva evidencia y un commit acotado. Los detalles, archivos y comandos están al principio de [todo.md](todo.md).
- No hay acciones que acepten visualmente una edición pero entreguen otra, ni mezcla de fuentes/fechas en el progreso. Calentamiento admite registro parcial y las fotografías tienen un ciclo de vida recuperable.
- El catálogo/figuras se comprueba en el servidor efectivo; no se da por instalado basándose en una nota anterior. Importar archivos y sembrar la base principal son acciones distintas; PR3 conserva su autorización pendiente para la carga inicial.
- Tipos, lint, unitarias, HTTP y build pasan tras integrar todas las ramas. Los checkpoints muestran un recorrido completo cada dos o tres tareas; no son peticiones repetidas de permiso para acciones ya autorizadas.
- T05/T06/T17, C01/E03 y Q03 siguen abiertos hasta obtener evidencia auténtica del navegador, móvil y participantes. Preparar infraestructura, texto legal o builds no equivale a desplegar ni a validar políticas de tienda.

### Alcance de los PDF y trabajo ya planificado

La decisión posterior registrada en `coordinacion-claude-codex.md` y `a79cfc5` reduce las D a **D01, D04 y D07**; D02/D03/D05/D06 figuran excluidas. Al integrar, reconciliar esa decisión con los párrafos históricos de abajo y conservar el rastro de lo aplazado. No volver a implementar la valoración inicial ya construida ni reabrir extras porque sobreviva su especificación en este archivo. Si otra sesión de David ha cambiado de nuevo el alcance, anotar su decisión antes del tramo afectado; las RI pueden completarse independientemente.

### Producción y comprobaciones externas

Después de Q02: sesión de prueba en la base correcta, 360/390 px, Android/iOS físico, tres personas, almacenamiento privado real, correo/dominio y enlaces asociados, copia/restauración y builds de distribución. Confirmar con los responsables el texto de consentimiento, privacidad y procedimiento de exportación/borrado. Estas tareas conservan sus límites en [la revisión integral](revision-integral-2026-09-24.md) y [la lista de producción](../docs/PENDIENTE-PARA-PRODUCCION.md); no contratar ni publicar servicios como consecuencia automática de este documento.

---

## Especificación de producto que se conserva

El resto del documento recoge las decisiones y el diseño de las iteraciones anteriores de este mismo trabajo. Su estado de implementación se consulta en `todo.md`, y la primera parte de este plan fija el orden de la nueva pasada.

> Iteración aprobada por David el 24-09-2026. Base: `d7d8ef0`, integrada mediante avance directo en `codex/cliente-intuitivo`. [Tareas y verificaciones](todo.md) · [Planes anteriores](planes%20antiguos/2026-09-24/INDEX.md).

## Objetivo

El entrenador o nutricionista configura; el cliente entiende qué le toca, registra lo realizado y recibe respuesta. Las pantallas conservan el tema dorado y oscuro actual y las cuatro pestañas Entreno, Plan, Nutrición y Progreso. El borrador del entrenamiento continúa privado hasta el envío.

## Decisiones de producto

- El cliente puede mover una sesión dentro de su misma semana; el entrenador ve el cambio. No necesita aprobarlo.
- Por ejercicio, el entrenador elige RIR desactivado, al acabar ejercicio o en cada serie. La respuesta del cliente es opcional.
- La prescripción distingue ejercicios con y sin carga externa. Se registran kilos solo donde corresponde; repeticiones y segundos mantienen su unidad.
- Un ejercicio activo ocupa la pantalla principal del entrenamiento; el resto aparece en una lista plegable. El cliente puede marcar, corregir u omitir series y saltar a otro ejercicio. Omitida y pendiente se distinguen.
- Salir de la pantalla de entrenamiento pausa el cronómetro; bloquear el móvil o abrir otra app no lo pausa. Se guarda tiempo acumulado, tramo activo y estado de pausa. Los registros antiguos sin estos campos conservan su tiempo transcurrido sin presentarlo como activo.
- «Empezar», «Continuar» y «Ver resumen» dependen del estado real. Si hay varios borradores, se destaca el más reciente y se accede a los otros.
- Guardado local y entrega al entrenador son estados diferentes. La intención de envío y su UUID se conservan antes de operar con la red; el servidor confirma antes de enseñar «Enviado».
- La subida automática de carga es propuesta interna para el entrenador. El cliente ve solamente la prescripción que el entrenador haya publicado.
- El entrenador marca una sesión «Revisada» con una acción explícita. Abrirla o comentarla no la revisa. Cliente y entrenador tienen avisos dentro de la app, con lectura individual persistida.
- En nutrición cada comida puede ser de platos completos (`alternativas`) o intercambio por grupos (`intercambio`). Platos completos permiten uno o varios platos con cantidades profesionales. Comida y Cena proponen intercambio al crear; el profesional puede cambiar la forma.
- El cliente elige explícitamente un plato o un alimento por grupo antes de registrar; nunca se registra la primera opción de manera silenciosa. Los suplementos del inicio salen de la dieta publicada y comparten el registro con Nutrición.
- El entrenador configura por cliente indicadores visibles, orden, frecuencia diaria/semanal, día de registro semanal, objetivo y rango de peso opcional, y pruebas prescritas. El cliente registra resultados, sin configurar las pruebas.
- La evolución de peso usa un indicador de dirección neutral salvo que el objetivo y el rango del entrenador permitan interpretar el resultado.

## Arquitectura y compatibilidad

`packages/shared` define contratos Zod opcionales y compatibles con documentos antiguos. Los campos nuevos de prescripción y registro se persisten en JSON existente cuando procede; las configuraciones, revisiones y lecturas requieren migraciones aditivas y una estrategia de recuperación verificada que conserve los datos. No se presupone que cada migración tenga una operación inversa segura. `apps/api` valida rol y alcance de cliente; `apps/mobile` conserva su copia local y las revisiones optimistas. Las dos formas actuales de comida y sus IDs permanecen. Las cuentas, dietas, sesiones, medidas y registros existentes continúan legibles.

Interfaces nuevas: `PUT /entrenamiento/sesiones/:id/revision` (entrenador), `GET /entrenamiento/clientes/:clienteId/novedades` (alcance vigente), `POST /entrenamiento/sesiones/:id/novedades/leidas` (actor), `GET` y `PUT /seguimiento/clientes/:clienteId/configuracion` (lectura según alcance; escritura entrenador con revisión). Las rutas actuales de borrador, envío, fecha y comida siguen operativas.

La intención de envío congela el contenido visible, reutiliza el identificador de operación y procesa antes los borradores pendientes. Si hay conflicto entre versiones, se conservan ambas y se ofrece resolución; no se informa «Enviado» hasta confirmación. La lectura de novedades es por usuario y sesión, sin marcar como leído lo de otra persona.

Las pruebas HTTP se ejecutan en una base desechable separada de `alpha_omega`. El recorrido visual se comprueba a 360 y 390 px y en el panel profesional. La prueba física del teléfono y la prueba observada con tres personas se registran como pendientes hasta ejecutarse, sin afirmaciones de verificación por una captura web.

## Orden y puntos de control

1. **T00:** integrar base, archivar documentos, fijar plan y especificaciones.
2. **T01–T06:** prescripción, panel profesional, sesión guiada, reloj, inicio y agenda. Punto de control: configurar → iniciar → registrar → salir → continuar → mover de día.
3. **T07–T10:** envío, cierre, revisión profesional y novedades. Punto de control: enviar sin pérdida → revisar → responder → ver en el cliente.
4. **T11–T13:** editor de comidas, registro del cliente y suplementos pautados.
5. **T14–T16:** configuración de seguimiento, panel profesional y Progreso.
6. **T17:** integración, limpieza de código sustituido, pruebas completas y comprobación móvil.

Nutrición y seguimiento son independientes del flujo de entrenamiento una vez consolidada la base. Un solo responsable edita cada contrato y migración compartidos. Cada tarea deja código que compila y pruebas focalizadas; se registra su evidencia en `todo.md` antes de marcarla hecha.

## Verificación final

Desde la raíz: `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:e2e`, `npm run build --workspace apps/api`. Se verifican prescripciones y copias antiguas; permisos; omisión/RIR; pausa/reanudación; reintentos y conflictos de envío; cambios de día; novedades; dos formas de comida; frecuencia y objetivos de seguimiento. En web y móvil se revisan foco, teclado, coma decimal y controles táctiles. Tres personas intentan sin explicación: continuar, registrar serie, mover sesión, registrar comida y encontrar respuesta del entrenador.

## Revisión incremental posterior

David solicita continuar revisando y corrigiendo poco a poco. La primera pasada se limita a cuatro fallos reproducibles: recuperación de series cuando cambia el tipo de carga, registros de Inicio que ignoran la configuración profesional, escrituras simultáneas de suplementos y edición del seguimiento durante un guardado. Cada corrección se reproduce con una prueba, conserva los datos existentes y se entrega en cambios pequeños. Se mantienen el diseño y las decisiones aprobadas. Los recorridos que todavía no se hayan comprobado en navegador autenticado o móvil físico permanecen pendientes en la lista de tareas.

## Ampliación propuesta: valoración inicial y revisiones del entrenamiento personal

### Objetivo

El entrenador realiza una valoración inicial completa y la repite durante el proceso. Registra medidas corporales, pliegues con plicómetro, bioimpedancia, pruebas físicas y fotografías. El cliente consulta una evolución comprensible y las indicaciones publicadas por su entrenador desde Progreso; mantiene los registros cotidianos y el feedback ya aprobados.

Aquí «registro» significa la ficha de valoración y sus resultados, no el alta de una cuenta. La valoración se puede crear después de dar de alta al cliente, completar por partes y repetir sin sobrescribir la anterior.

### Qué existe y qué falta

| Capacidad                     | Evidencia actual                                                                                           | Trabajo necesario                                                                                                                                   |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Configuración del seguimiento | Indicadores, orden, frecuencia diaria/semanal y pruebas prescritas en `packages/shared/src/seguimiento.ts` | Conectar la valoración profesional y su próxima revisión sin convertirla en una obligación diaria del cliente.                                      |
| Medidas corporales            | `MedidaCorporal`: peso, cintura, grasa y altura                                                            | Agrupar una visita, ampliar perímetros y pliegues, distinguir instrumentos y métodos.                                                               |
| Pruebas físicas               | `PruebaFisica`: nombre, unidad y un valor; `pruebaId` opcional para histórico                              | Protocolos con identidad estable, variantes y varios resultados cuando corresponda.                                                                 |
| Progreso                      | Lectura de medidas, pruebas, fuerza estimada y registros diarios                                           | Resumen de valoración, comparación coherente y detalle de cada fecha.                                                                               |
| Fotos                         | Decisión técnica en ADR 0005; no hay módulo de fotos de evolución implementado                             | Almacenamiento privado, carga, permisos, historial y comparación.                                                                                   |
| Acceso de prueba              | El navegador devolvió «Correo o contraseña incorrectos» al usar los datos facilitados                      | Diagnosticar entorno/cuenta/sesión antes de afirmar que se ha revisado la UI autenticada. Las credenciales no se guardan en documentos ni fixtures. |

### Enfoque elegido para este plan

Se propone **una valoración agrupada por visita, con una plantilla del entrenador y una copia de esa plantilla en cada valoración**. Permite repetir el mismo protocolo y deja una cronología clara para el cliente.

Ampliar únicamente los formularios sueltos sería más rápido, pero seguiría sin relacionar las fotos, medidas y pruebas de una visita. Un constructor genérico de formularios y una conexión directa a cada dispositivo añadirían complejidad innecesaria para esta entrega. Se reutilizan los componentes, roles, almacenamiento local y convenciones de la app; se añaden bloques específicos de valoración.

### Alcance confirmado y decisiones propuestas

**Confirmado por David:** el entrenador realiza la valoración, las medidas y las cinco pruebas enumeradas; pruebas, fotos y seguimiento se repetirán para observar la progresión. La experiencia del cliente debe seguir siendo visual, intuitiva y centrada en registrar lo solicitado y devolver feedback.

**Propuestas que el plan hace explícitas:**

- El entrenador configura y escribe las valoraciones profesionales. El cliente las consulta una vez publicadas; no modifica sus resultados ni sus protocolos.
- El cliente conserva sus registros diarios y puede aportar fotos cuando se las solicite el entrenador. Las fotos aportadas no se presentan como revisadas automáticamente.
- Las pruebas profesionales nuevas son de registro exclusivo del entrenador. Las pruebas y autorregistros prescritos existentes se conservan con su origen; no se cambian silenciosamente los permisos de toda la API histórica.
- Perímetros, puntos de pliegues, lateralidad y campos de bioimpedancia se configuran en la plantilla. No se inventa un protocolo antropométrico concreto.
- Cada revisión puede incluir solo los bloques seleccionados por el entrenador. La frecuencia y la próxima fecha son configurables; no se fija por defecto una revisión mensual ni se repiten automáticamente todas las pruebas.
- Los resultados de báscula y banda pectoral se introducen manualmente en esta entrega. Se guarda el instrumento y el protocolo para añadir una integración de dispositivos más adelante sin alterar el historial.
- El punto 6 de la lista del usuario está vacío. La plantilla incluye las cinco pruebas definidas y permite al entrenador añadir otra; no se inventa una sexta.

La revisión de los tres PDF del ZIP de WhatsApp confirma que hay un resultado atribuido a plicometría, pero no una ficha con sus puntos anatómicos ni el desglose de bioimpedancia. No se presentará ninguna lista de pliegues como extraída de esos documentos. Las referencias originales se conservan localmente en `PDF/referencias-entrenador/`, sin copiarlas a fixtures ni incorporar datos personales al código.

### Recorrido del entrenador

1. En la ficha del cliente, dentro de Progreso, abrir **«Nueva valoración»** o **«Continuar valoración»**.
2. Elegir inicial o revisión. En una revisión se reutilizan definiciones, unidades y protocolo; todos los resultados nuevos empiezan vacíos. Los anteriores se muestran solo como referencia con su fecha.
3. Completar cinco bloques con un bloque abierto cada vez: **medidas → pliegues → bioimpedancia → pruebas → fotos**. Se puede volver, guardar y continuar más tarde.
4. Cada dato distingue pendiente, registrado y no realizado, con motivo opcional. Un cero es un resultado real, nunca un sustituto de «sin dato».
5. Revisar el resumen, añadir una conclusión para el cliente y publicar. Las notas internas se guardan aparte y no aparecen en la respuesta de la API del cliente.
6. Seleccionar una próxima fecha o un intervalo de revisión y qué se repetirá. «Sin programar» es válido. Una revisión pendiente no se marca realizada por abrir su pantalla.

El estado de guardado será visible. Un fallo conserva el borrador; una revisión concurrente ofrece recargar o recuperar la edición sin sobrescribir. Se reutiliza la protección de guardado aplicada al editor actual. Publicar requiere confirmación del servidor: no se muestra una valoración como publicada solo por pulsar el botón.

### Datos de la valoración

| Bloque        | Datos propuestos                                                                                                                                                                      | Regla de comparación                                                                                                                                 |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Medidas       | Peso (kg), altura (cm), perímetros configurados (cm), zona y lateralidad cuando corresponda, fecha e instrumento                                                                      | Misma magnitud, zona, unidad y método; diferenciar peso doméstico de la medida profesional.                                                          |
| Pliegues      | Puntos seleccionados por el entrenador (mm), lateralidad, lecturas repetidas opcionales y valor adoptado; porcentaje calculado por el profesional opcional, con método y fecha        | Conservar lecturas originales y protocolo. No convertir a grasa corporal con una fórmula implícita ni reconstruir lecturas a partir del porcentaje.  |
| Bioimpedancia | Modelo de báscula, peso y campos habilitados: por ejemplo grasa %, masa muscular kg o agua %. Cada campo tiene unidad explícita; los índices del fabricante se identifican como tales | Distinguir el resultado de bioimpedancia del calculado por pliegues y conservar el equipo utilizado. No mezclar masa muscular y masa libre de grasa. |
| Pruebas       | Protocolo, variante, fecha, resultados, notas y motivo si no se realiza                                                                                                               | Comparar únicamente protocolos y unidades equivalentes.                                                                                              |
| Fotos         | Fecha, vista, autor, origen y vínculo a la valoración o solicitud                                                                                                                     | Misma vista entre dos fechas; no exigir todas las vistas ni mostrar como foto nueva una imagen heredada.                                             |

Una plantilla tiene identificadores estables para puntos y pruebas. Cambiar el nombre visible no rompe las series históricas; cambiar unidad, variante o protocolo genera una nueva versión. Los campos se pueden desactivar para futuras valoraciones sin borrar sus resultados antiguos. Una definición arbitraria no puede introducir fórmulas ejecutables, HTML o accesos externos.

### Las cinco pruebas

| Prueba                          | Registro                                                                                   | Condiciones que se guardan                                                                                                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dominadas o aguante en barra    | Repeticiones de dominadas **o** duración del aguante en segundos, como variantes distintas | Agarre, modalidad de aguante e indicaciones elegidas por el entrenador; no se unen segundos y repeticiones en una gráfica.                                                          |
| Flexiones máximas en 1 minuto   | Repeticiones válidas, con duración prescrita de 60 s                                       | Variante utilizada y si se completó el protocolo. No confundir con el histórico «flexiones seguidas» sin duración.                                                                  |
| Sentadillas máximas en 1 minuto | Repeticiones válidas, con duración prescrita de 60 s                                       | Variante y condiciones definidas por el entrenador.                                                                                                                                 |
| Press banca máximo, 1RM         | Carga lograda en kg; resultado marcado como medido                                         | Separar el 1RM medido de la estimación de fuerza que ya calcula la app. Si se incorpora un valor estimado, debe identificar método y serie de origen, en otra serie de comparación. |
| Cooper con banda pectoral       | Distancia (m), duración del protocolo y registros de frecuencia cardiaca disponibles (lpm) | Superficie/equipo, protocolo e instrumento; media, máxima, final o recuperación solo si se recogieron. La recuperación incluye cuánto tiempo pasó desde el final.                   |

La app registra lo realizado y el contexto. No añade baremos, diagnósticos, cálculo automático de VO₂máx, porcentaje de grasa por pliegues ni instrucciones para realizar esfuerzos máximos sin supervisión. Esas capacidades necesitarían un protocolo y validación específicos del profesional.

### Experiencia del cliente

- Se mantienen las pestañas, colores y tipografías actuales. Las nuevas funciones se integran en **Progreso**.
- Primera vista: última valoración publicada, fecha, breve conclusión del entrenador y principales cambios seleccionados por él. Una acción principal: **«Ver mi evolución»**.
- Comparación sencilla entre inicial y última valoración; se puede elegir otra fecha y abrir los datos completos. Mostrar unidades, origen y fechas de cada punto.
- Fotos con selector de vista y dos fechas. Si solo existe una foto o no hay una vista coincidente, explicarlo sin rellenar huecos con imágenes de otras fechas.
- Próxima revisión cuando esté programada y acceso a los registros cotidianos que correspondan. El cliente no recibe controles para configurar pliegues, instrumentos o pruebas profesionales.
- En Inicio, un aviso de valoración publicada y las solicitudes que requieran una acción del cliente. Lectura persistida y autor identificable; sin crear otra bandeja de navegación.
- Estado vacío y primer uso comprensibles; mostrar lo disponible de valoraciones parciales sin un porcentaje de progreso engañoso. Un valor desconocido no se convierte en cero.

### Responsabilidades y arquitectura

| Área                                | Responsabilidad                                                           | Dependencia                                                |
| ----------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `identity` existente                | Acceso y alcance de clientes                                              | Ninguna nueva                                              |
| `seguimiento-corporal` existente    | Plantillas, valoraciones, resultados, revisiones y consultas de evolución | `identity`                                                 |
| Servicio interno de medios privados | Subida, verificación, lectura autorizada y eliminación de fotos           | `identity`; guarda dueño y metadatos, no calcula evolución |
| `seguimiento-corporal` → medios     | Vincular solo medios confirmados y del mismo cliente                      | Medios privados                                            |
| Pantallas de Inicio y Progreso      | Componer resultados publicados y tareas pautadas                          | Seguimiento, entrenamiento y nutrición existentes          |

No se crea un segundo módulo de usuarios ni una tabla paralela de ejercicios. Los nuevos contratos se aíslan en `packages/shared/src/valoraciones.ts` y, para fotos, `medios.ts`, exportados desde el índice compartido. Los archivos nuevos citados en este plan son propuestas; no existen todavía.

Modelo propuesto:

- **PlantillaValoracion:** documento validado, versión y revisión para controlar la concurrencia. Campos y protocolos con IDs estables.
- **Valoracion:** cliente, profesional, fecha de toma, inicial/revisión, referencia opcional a la anterior, estado, revisión y documento con copia de la plantilla y resultados. Identificar por separado fecha de toma, creación y publicación.
- **Publicación:** versión inmutable de la valoración, conclusión visible y autor/fecha. Corregir crea una nueva versión vinculada; se identifica como corrección y no duplica puntos de la gráfica. El cliente nunca recibe el documento interno del borrador.
- **Medio privado:** dueño, autor, clave de objeto, tipo/tamaño verificados, estado de carga y metadatos mínimos. La base no guarda enlaces firmados caducados ni rutas públicas.
- **Solicitud de revisión/fotos:** cliente, fecha o intervalo, bloques/vistas solicitados y estado. Al completar, se vincula la valoración o aportación; idempotencia evita solicitudes repetidas por reintentos.
- **Lectura de novedades de seguimiento:** identificador estable de publicación/solicitud y actor que la leyó. Abrir una valoración no publica, corrige ni marca revisadas las fotos. Integrar estos avisos en Inicio sin almacenarlos en tablas que exijan un `sesionId` de entrenamiento ficticio.

Las migraciones serán aditivas. `MedidaCorporal`, `PruebaFisica` y los registros diarios actuales permanecen legibles. La consulta de evolución adapta el histórico y los nuevos documentos sin duplicarlos; los datos antiguos sin método o protocolo se etiquetan como históricos no clasificados. No se deduce una valoración completa agrupando automáticamente filas que coincidan en fecha.

### Contratos de API propuestos

Mantener las rutas actuales de seguimiento. Añadir rutas bajo `/seguimiento/clientes/:clienteId`:

| Ruta                                  | Comportamiento y acceso                                                                                                                         |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET/PUT plantilla-valoracion`        | Lectura propia/asignada; modificación profesional con `revision`. El cliente recibe únicamente la definición que necesite para tareas pautadas. |
| `POST valoraciones`                   | Crear borrador profesional con `operacionId`.                                                                                                   |
| `GET valoraciones`                    | Historial paginado: cliente solo publicaciones; profesional también sus borradores según alcance.                                               |
| `GET/PUT valoraciones/:id`            | Lectura filtrada por rol; edición de borrador exclusiva del entrenador con `revision`.                                                          |
| `POST valoraciones/:id/publicaciones` | Publicar una revisión concreta; mismo `operacionId` devuelve el mismo resultado. Una corrección debe indicar qué publicación sustituye.         |
| `GET evolucion`                       | Datos publicados y legado, con procedencia, unidades, comparabilidad y paginación/período.                                                      |
| `GET/PUT proxima-revision`            | Consultar la pauta y actualizarla como entrenador, con `revision`; permite dejar sin fecha.                                                     |
| `GET/POST solicitudes-fotos`          | Consultar solicitudes; el entrenador las crea. El cliente aporta únicamente a las suyas.                                                        |
| `GET/POST valoraciones/:id/fotos`     | Listar/vincular fotos autorizadas y confirmadas; no acepta una clave ajena ni un objeto pendiente.                                              |

Medios: `POST /medios/subidas`, `POST /medios/:id/confirmacion`, `GET /medios/:id/acceso` y `DELETE /medios/:id`. Validar rol, propietario y estado en todas las operaciones, incluidas miniaturas y confirmación. La creación de una intención de subida no concede permiso de lectura permanente. Las solicitudes del cliente pueden vincular fotos antes de que exista una valoración; el entrenador las incorpora posteriormente sin duplicar el objeto.

Un UUID de operación se reutiliza al reintentar la misma acción y contenido; reutilizarlo con contenido distinto devuelve conflicto. Los PUT llevan revisión. Publicación y vínculo de resultados son transaccionales. Una respuesta perdida no crea dos valoraciones, publicaciones ni fotos. No se confunde «Guardado» con «Publicado» ni «Foto recibida» con «Revisada».

Para corregir, `POST valoraciones` acepta `corrigePublicacionId`: el servidor crea un borrador de corrección desde esa publicación, con identidad y revisión propias. Publicar sustituye la versión vigente de esa misma valoración, preserva la anterior como auditoría y genera una única novedad de corrección. Para **repetir** la valoración se crea una visita nueva que copia solo definiciones, nunca resultados. Ambas acciones tienen rótulos y contratos distintos.

Permisos de esta entrega: entrenador con alcance, lectura/escritura de valoración y notas internas; cliente, lectura de publicaciones propias y escritura únicamente de las aportaciones solicitadas; nutricionista asignado, lectura de resultados corporales publicados y de la configuración pertinente. Por defecto, el nutricionista no recibe fotos, notas internas ni borradores. Ampliar ese acceso requiere una decisión expresa; no se hereda por compartir el controlador actual.

### Fotografías privadas

Seguir el patrón técnico del [ADR 0005](../docs/adr/0005-almacenamiento-de-fotos.md): almacenamiento compatible con S3 y acceso temporal tras comprobar permisos. La elección de proveedor sigue pendiente; el desarrollo usa un servicio local de pruebas compatible, sin contratar servicios ni subir imágenes reales a terceros durante las pruebas.

- Primera entrega: selección de imágenes, orientación y reducción de tamaño conservando calidad útil; retirar metadatos de localización. Los formatos admitidos y límites se declaran en el contrato y se validan en servidor, no solo por extensión.
- Flujo visible: seleccionada → subiendo → confirmando → disponible, o error recuperable. Reintentar la misma subida no duplica la foto; cancelar libera la intención.
- Confirmar exige que el objeto esperado exista y cumpla formato/tamaño antes de asociarlo. La URL de subida caduca y restringe el objeto autorizado.
- Borradores fotográficos profesionales son privados hasta publicarse. Las aportaciones del cliente son visibles para él y el entrenador responsable; el nutricionista no recibe fotos en esta entrega. No ampliar permisos por reutilizar un DTO.
- No cachear fotos corporales para uso sin conexión en esta primera entrega ni incluirlas en logs, analítica o fixtures reales. Tras salir de la cuenta, retirar referencias de la UI y cachés de imágenes controladas por la app.
- Eliminar una foto requiere una acción explícita y retira original y miniaturas; registrar estado pendiente si falla el almacenamiento. La limpieza de subidas incompletas no elimina objetos ya vinculados ni se interpreta como eliminación de una valoración entera.

### Orden de ejecución

1. **C00–C03:** resolver el acceso y completar la revisión incremental pendiente: pantallas reales, RIR por serie y acceso a cintura pautada.
2. **V01–V04:** contratos, persistencia, API y primera valoración básica guardable de extremo a extremo.
3. **M01–M03:** plantilla corporal, pliegues y bioimpedancia integrados.
4. **P01–P02:** protocolos y registro de las cinco pruebas.
5. **V05–V07:** publicación/corrección, presentación al cliente y revisiones repetibles.
6. **F01–F05:** fotografías privadas, solicitudes y comparación.
7. **E01–E02:** comparaciones completas y avisos de valoraciones y solicitudes.
8. **D01, D04 y D07:** ampliaciones de metros, chequeo y fases según el alcance posterior registrado. D02/D05/D06 se conservan descritas como propuestas excluidas de esta entrega; D03 (nuevo registro de K-1) también queda fuera.
9. **E03:** revisión final de los recorridos del cliente, incluidas las ampliaciones D aprobadas.
10. **Q01–Q03:** compatibilidad, controles completos, móvil físico y usabilidad observada.

Las tareas, archivos previstos, criterios y comandos se detallan en [todo.md](todo.md). Se verifica cada tramo antes de ampliar. Las tareas que excedan cinco archivos se subdividen antes de escribir código; no se acumula una implementación incompleta detrás de una pantalla que parezca terminada.

### Mejoras de los PDF aprobadas: todo salvo K-1

La primera respuesta de David fue «todo menos k1». La decisión posterior registrada en coordinación y `a79cfc5` limita esta entrega a D01, D04 y D07; las descripciones D02/D05/D06 siguientes se conservan como historial, sin tareas obligatorias ni dependencias del cierre. D03 queda excluido. Esto no autoriza cambios de tema, menú de perfil ni otros extras de una maqueta antigua. Tampoco elimina los datos de deportes que ya estén en planes existentes.

**D01 · Ejercicios por distancia.** Extender las series con una variante de distancia en metros. Mostrar «m» y la carga solo si corresponde, sin representar metros como repeticiones o segundos. El farmer carry podrá registrarse como carga y distancia. Actualizar editor, duplicación, publicación, registro local, envío, resumen y lectura del entrenador. Los contratos antiguos siguen funcionando; una copia cuyo tipo de medición cambie conserva el respaldo y no convierte unidades por su cuenta.

**D02 · Cardio.** El entrenador selecciona qué pautar y qué registrar: duración, velocidad en km/h, inclinación en porcentaje y esfuerzo percibido del tramo. Las referencias pueden ser rangos; los resultados son valores de la ejecución. Mostrar un bloque compacto solo cuando haya cardio, con el mínimo de campos necesario. Distinguir duración del tramo y tiempo total de sesión, y esfuerzo del cardio y RPE global del cierre. Si el cliente omite el cardio, queda registrado como omitido, no como cero minutos realizados.

**D04 · Chequeo previo.** Configuración profesional por cliente: sensación actual, energía previa, motivación, calidad del sueño y agujetas por zona según lo que se necesite. Mantener el chequeo actual como valor inicial; ampliar solo los campos habilitados. Reutilizar la duración del sueño ya registrada hoy, sin pedirla dos veces ni sobrescribirla al responder sobre su calidad. La vista inicial tendrá pocas preguntas; detalle por zonas solo si la respuesta lo necesita. Responder seguirá siendo opcional. La configuración no añade una pregunta de K-1.

**D05 · Recuperación profesional.** Resumen semanal que reúna registros disponibles de sueño, chequeos, esfuerzo, molestias y rendimiento comparable. Mostrar fechas y ausencia de datos; no interpretar silencio como buena recuperación. Presentar cambios entre sesiones comparables y respuestas fechadas de energía, sueño y agujetas, con cobertura visible. Esta entrega ofrece un resumen descriptivo; no incorpora otro editor de umbrales ni una clasificación automática de recuperación. No diagnosticar ni recortar automáticamente volumen, cardio o cargas. El entrenador confirma y publica cualquier ajuste. Los porcentajes y umbrales personales de los PDF no se convierten en reglas globales.

**D06 · Prioridades cuando falta tiempo.** El entrenador puede indicar prioridad de ejercicios/bloques y una instrucción breve. El cliente encuentra esa indicación en el recorrido activo y, al omitir, puede señalar «Falta de tiempo». Reutilizar la omisión y el feedback existentes; no crear un selector libre de nueva rutina ni reordenar automáticamente la prescripción. El entrenador recibe motivo y trabajo no realizado.

**D07 · Fases y descarga.** Permitir al entrenador definir cambios de series, rango/RIR y descanso por fase y previsualizar las sesiones afectadas sin escribir. La acción explícita **«Aplicar y publicar»** confirma la propuesta sobre las revisiones de prescripción vigentes, de forma transaccional e idempotente. No se reutiliza `SesionEntrenamiento.borrador`: ese documento pertenece a la ejecución privada del cliente, no a la edición profesional. Separar las notas informativas del bloque de los cambios efectivos de prescripción. Actuar solo sobre sesiones elegibles futuras; conservar las empezadas, enviadas y con envío pendiente conocido, y detectar conflictos de revisión. Si existe un borrador offline aún desconocido por el servidor, el cliente conserva las dos versiones y usa la recuperación ya implementada. La app no modifica resultados pasados ni sube/baja cargas por decisión propia. Se reutiliza la propuesta actual de doble progresión.

Estas extensiones deben seguir la misma disciplina de envío, guardado, privacidad e idempotencia del entrenamiento actual. Los nuevos registros se integran en el resultado que recibe el entrenador; no basta con dibujar campos que no se envíen ni con guardar valores que luego ninguna pantalla consulte.

### Riesgos y decisiones abiertas resueltas para planificar

| Riesgo o desconocido                          | Tratamiento en esta entrega                                                                        |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Puntos de pliegues y perímetros sin definir   | Plantilla configurable; ningún listado concreto se presenta como aprobado por el entrenador.       |
| Modelo de báscula y banda sin especificar     | Registro manual e instrumento identificado; no prometer sincronización automática.                 |
| Variantes o duración distinta de una prueba   | Versionar el protocolo y separar las series no comparables.                                        |
| Peso y grasa de varias fuentes                | Origen explícito y selección de serie; no sobrescribir ni promediar entre métodos.                 |
| Demasiados controles para el cliente          | Progreso de consulta; solo los registros y aportaciones expresamente solicitados se editan.        |
| Pérdida de datos al repetir o corregir        | Copiar definiciones, nunca resultados; publicaciones versionadas y correcciones identificadas.     |
| Fotos privadas expuestas o cargas abandonadas | Alcance en API, enlaces temporales, validación de objetos y limpieza controlada.                   |
| Elección de almacenamiento de producción      | Adaptador local para probar; proveedor, región y coste se deciden antes de desplegar fotos reales. |

### Fuera de esta ampliación

Integración Bluetooth de dispositivos, importación automática de informes de básculas, análisis corporal por IA, baremos clínicos, fórmulas fisiológicas sin protocolo validado, exportación PDF, pagos, leads, fichajes y cambios generales de diseño. La foto de perfil puede reutilizar el servicio de medios posteriormente, pero no se mezcla con la entrega de evolución corporal.

### Entrega verificable

Un entrenador puede completar una valoración inicial, guardar y continuar, publicar, programar y realizar una revisión con medidas/pruebas/fotos distintas. El cliente ve exactamente lo publicado y compara resultados equivalentes, con acceso al historial previo. No puede editar el protocolo ni los resultados profesionales ni consultar otro cliente. Los reintentos, el uso simultáneo de dos dispositivos y los cambios de versión no pierden ni duplican datos.

Las pruebas de código, visuales y físicas se registran por separado. Se siguen pendientes hasta existir evidencia real, incluidas las comprobaciones T05/T06/T17 de la entrega anterior. Preparar este plan no ejecuta migraciones, modifica cuentas, publica valoraciones ni introduce datos de salud de prueba en la cuenta principal.
