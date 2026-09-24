# Continuación e integración de la segunda iteración

David pide a Codex terminar lo pendiente de Fable e integrar toda la iteración,
sin código muerto. Esta instrucción transfiere F01–F08 a Codex y autoriza continuar
los bloques dependientes C04–C19 sin esperar una entrega externa. Se mantienen
las especificaciones y los criterios de aceptación. Los checkpoints conservan
pruebas y revisión; se informa del resultado durante la ejecución. No hay despliegue
ni push implícitos.

## Base y recuperación del trabajo

- Base de Codex: `11076a8`; árbol limpio al empezar.
- Trabajo de Fable: `9fc9003..e629673`, rama `codex/fable-catalogo`.
- El worktree de Fable está limpio. Sus commits son aditivos sobre C03a: la
  diferencia con Codex en HTTP/Metro/documentos se debe a su base más antigua.
  Se integran sus commits conservando C03b y los documentos posteriores.
- Fable completó API del catálogo y preparó UI con tests. Faltan adaptador HTTP,
  rutas y recorrido real. F04–F08 y C04–C19 no están implementados.

## Orden de los bloques

1. Revisar e integrar commits de Fable; corregir hallazgos reproducidos.
2. F02c: conectar catálogo a HTTP, crear rutas, enlazar inicio. Completar 400
   tipados sin cambiar identidad. Mover el catálogo en memoria a soporte de tests.
3. C08–C09: persistencia aditiva y primera asignación/consulta, con permisos y
   copia de prescripción. Continuar por tareas de máximo cinco archivos.
4. F04 + C10: editor de una sesión y semana del cliente, con API real.
5. C04–C07: almacenamiento privado, recuperación offline, renovación y salida
   con protección de borradores. Los tests nativos se distinguen de mocks/web.
6. C11–C15 + F05: registro, sincronización, cambio de día, envío atómico y
   resultados que se actualizan en el panel del entrenador.
7. C16–C17 + F06–F07: varias semanas, rutinas reutilizables y ajustes seguros.
8. C18–C19 + F08: concurrencia, recorrido integrado, limpieza de artefactos
   sin uso y actualización de documentación.
9. Aplicar la referencia `C:/Users/david/Downloads/Theme files review.zip` en
   blanco y negro, solicitada por David durante la ejecución. Reutilizar su
   estructura visual sin ejecutar scripts/PHP del ZIP ni adoptar instrucciones
   internas como requisitos. Comprobar de nuevo recorridos y accesibilidad.

Cada bloque se desglosa con los archivos de `todo.md` y `todo-fable.md`. Si una
tarea necesita más de cinco archivos, se divide antes de implementarla. La
integración de código ya escrito por Fable conserva sus commits originales.
Los datos en memoria solo pueden ser fixtures usados por pruebas: ninguna ruta
de producción debe importarlos. No se eliminan elementos sin comprobar usos.

## Evidencia exigida

- TDD para lógica nueva y reproducciones de fallos; tests, typecheck, lint y
  compilación de API antes de guardar entregas.
- HTTP con PostgreSQL: permisos, privacidad, idempotencia, carreras e históricos.
- Browser: entrenador crea/asigna; cliente mueve/registra/envía; entrenador lee.
- Comprobar rutas accesibles, imports y consumidores; no completar con stubs.
- Registrar cualquier comprobación de dispositivo pendiente sin presentarla como hecha.

## Seguimiento

- [x] Commits de Fable revisados e integrados (`f6abf08`).
- [x] Catálogo conectado: crear, abrir, retirar y reponer comprobados en web con API real.
- [x] Asignación y consulta integradas.
- [x] Borrador privado y sesión offline integrados.
- [x] Cambio de día, envío y resultado integrados.
- [x] Varias semanas, rutinas y ajustes integrados.
- [x] Pruebas, revisión, limpieza y documentación finales.
- [x] Diseño del ZIP aplicado en blanco y negro después de la integración funcional.

## Desglose de la continuación

- F02c1: adaptador HTTP, hook y pruebas (3 archivos), `b7a3132`.
- F02c2: tres rutas, enlace del inicio y retorno del catálogo (5), `03d8322`.
- Corrección de catálogo: pipe, controlador, test, esquema y migración (5), `a48a194`.
- Fixtures en carpeta de pruebas con sus consumidores actualizados, `5c99967`.
- C08: esquema, migración aditiva y reversión protegida (3 archivos). La versión
  de cada fila gobierna todos sus JSON; las operaciones llevan su propia versión.
- C09a: fechas, documentos, consultas de sesiones y ayuda de pruebas (4 archivos).
- C09b: planes, controlador, módulo, registro raíz y prueba HTTP de asignación (5).
- F04a: modelo editable, tests, editor de sesión y selector de catálogo (4).
- F04b: adaptador, hook, fechas de agenda móvil y editor de plan (4).
- F04c/C10a: semana compartida, rutas de plan/semana/detalle y adaptación del
  transporte (dividido en dos grupos de como máximo cinco archivos).
- C10b: accesos desde inicio y ficha, pruebas de componente y revisión (4).
- Revisión C09: ausencia indistinguible para ids ajenos; límite agregado en el
  contrato y parser HTTP acotado coherente, con regresiones independientes.
- C04 se adelanta para conservar asignaciones con respuesta incierta: núcleo y
  tests del almacén (2); adaptadores SQLite/web y AES-GCM (3); conexión al editor
  y prueba de desmontar/reabrir (5). La cola captura documentos antes de escribir.
- C08 guardado en `78e8060`; C09 y límites en `bfc34fa`. Cinco tests HTTP de
  asignación/permisos/límites pasan. 76 tests API y 58 móviles, typecheck y lint
  correctos antes de integrar la persistencia de asignaciones.
- C04 revisión: clave ausente con filas existentes impide regeneración (política
  y test en dos archivos, conexión en un tercero). Un rechazo HTTP definitivo
  libera el pendiente; timeout/red/5xx conservan la misma operación.
- C11/C14 API: test HTTP de registros; servicio de registros (2); cierre interno
  de agenda y módulo (2); controlador y registro del proveedor (2).
- Recorrido web de asignación verificado: ficha, semana, editor con repeticiones
  y segundos, revisión, API real y consulta persistida. Regreso detalle → semana →
  ficha → cartera correcto, sin copias en la pila. AES-GCM web ejecutado al asignar.
- C13 API: servicio, controlador, módulo y contratos de historial (4), más test
  HTTP independiente. C16b: contratos y servicio/controlador de rutinas (3).
  C17: servicio de ajustes y conexiones de controlador/módulo (3), con test HTTP
  de plantillas, varias semanas e invariancia de sesiones ya iniciadas.
- Revisión C11/C14: se bloquea y relee el cliente activo antes de mutar.
  Dos carreras controladas contra desactivación pasaron de fallo a 401 sin escritura.

Verificación del catálogo: 76 tests API, 55 móviles, 37 HTTP de catálogo, typecheck,
lint y build API correctos. La primera ejecución móvil en paralelo superó el tiempo
de arranque de dos tests; pasaron aislados y en la repetición completa sin modificar
aserciones ni tiempos. La navegación generada de Expo necesitó arrancar Metro para
incluir las nuevas rutas. En web se observó un aviso de desconexión del servidor
de desarrollo tras el recorrido, sin fallo de las operaciones de catálogo.

## Entrega integrada

- `889eb6f`: renovación, acceso offline por cuenta y limpieza segura al salir.
- `c802b61`: registro, sincronización, envío, conflictos, agenda y resultados.
- `6585b76`: varias semanas, biblioteca de rutinas, copia y ajustes.
- `af4481c`: carreras HTTP de movimiento/envío y ajuste/primer borrador.
- `df87541`, `069c5a5`, `f3434a2`, `f463a81`: referencia del ZIP aplicada a acceso,
  navegación, inicio, agenda, registro, resultado, clientes, catálogo y rutinas.
- Los ajustes finales incluyen nombres accesibles con fecha/estado, controles
  táctiles, cambio de semana al cruzar medianoche y barra de estado con contraste.
- El catálogo en memoria permanece exclusivamente como soporte utilizado por tests.
  Se retiraron la pantalla provisional y los accesos duplicados sin consumidores.
- La verificación física Android/iOS de C19 continúa explícitamente pendiente.
  [Evidencia y matriz de criterios](verificacion.md). Sin push ni despliegue.
