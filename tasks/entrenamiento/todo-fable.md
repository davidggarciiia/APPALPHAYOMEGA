# Borrador de tareas de Fable — catálogo y pantallas del entrenador

> Preparado el 2026-09-18 con Agent Skills, `planning-and-task-breakdown`.
> **Estado: borrador anticipado, no validado ni habilitado para ejecución.**
> Se revisará en la fase TASKS, después de aprobar el [plan de Fable](plan-fable.md)
> y la [coordinación con Codex](plan.md). Ninguna tarea está iniciada.
> [Encargo y contexto de arranque](fable.md). No sustituye el plan de identidad.

## Resultado a entregar

El entrenador crea y encuentra ejercicios, prepara una rutina desde cero o
elige una guardada, la adapta al cliente, asigna varias semanas y consulta
los resultados que el cliente ha enviado. Tus pantallas conservan negro y oro.

## Dependencias que aporta Codex

- C00: contratos Zod, rutas y ejemplos de respuesta con tipos compartidos.
- C01: dependencias y entorno de tests de componentes.
- C02: modelo/migración del catálogo y módulo registrado.
- C03 y C06: transporte común y renovación coordinada de sesión.
- C09: asignación de una sesión y consultas semanales.
- C13a–C13b: movimiento de fechas y componente reutilizable.
- C14: resultado enviado y separación de borradores privados.
- C16a, C16b y C17: bloques de semanas, biblioteca y ajustes.

Lee cada entrega integrada antes de conectarla. Puedes preparar componentes con
datos de prueba que validen contra Zod, pero no marcar un flujo completo terminado
hasta comprobarlo contra su endpoint real.

## Archivos y trabajo simultáneo

Trabaja en un worktree independiente desde el commit común que entregue Codex,
rama `codex/fable-catalogo`. No cambies la rama de la carpeta principal.
Los cambios comunes (Prisma, migraciones, shared, módulos raíz, dependencias y
lockfile) los integra Codex. No añadas otra librería de formularios, navegación,
estado o componentes: usa las existentes.

Propios: `apps/api/src/catalogo-ejercicios/`, tests del catálogo,
`apps/mobile/src/catalogo-ejercicios/`, `apps/mobile/app/catalogo/`,
`apps/mobile/src/entrenamiento-entrenador/`, `apps/mobile/app/entrenador/`.

Coordina un turno para las pruebas HTTP si usas la base local de Codex. Tus
pruebas unitarias y de componentes pueden ejecutarse de forma independiente.
Los archivos de tests van fuera de `app/`.

## Cómo ejecutar y verificar

Usa `incremental-implementation` y `test-driven-development`: reproduce con una
prueba el comportamiento que falta, implementa el incremento y compruébalo.
Revisa con `code-review-and-quality` antes de entregar.

Antes de ejecutar, David debe haber validado primero el plan y después las tareas.
La revisión cruzada de Codex no sustituye esos pasos. En cada checkpoint se revisa
con David la entrega del incremento antes de avanzar al siguiente.

Antes de cada test enfocado: `npm run build:shared`.
Antes de cada commit: `npm run test`, `npm run typecheck`, `npm run lint`.
Las rutas de archivos siguientes son relativas al repositorio de tu worktree.
Cada tarea toca como máximo cinco archivos; divide cualquier ampliación antes
de ejecutarla. Los patrones de tests se crean en la tarea correspondiente.

## F01 — Crear y consultar ejercicios desde la API

- [ ] Alta, detalle, edición y búsqueda paginada por nombre/grupo; nombre
      normalizado único, instrucciones de texto y figura/vídeo ausentes.
- [ ] Cliente lee y entrenador escribe; nutricionista, empleado y petición
      sin sesión reciben denegación. No se usa el acceso por cliente del nutricionista.
- [ ] Devolver filas y total; validar entradas y conservar ids estables.

**Dependencias:** C00–C02 entregados e integrados. **Alcance:** M, cinco archivos.
**Archivos:** `apps/api/src/catalogo-ejercicios/catalogo-ejercicios.service.ts`,
`catalogo-ejercicios.controller.ts`, `catalogo-ejercicios.module.ts`,
`catalogo-ejercicios.service.spec.ts`, `apps/api/test/catalogo-ejercicios.e2e-spec.ts`.
**Verificar:** `npm run test --workspace apps/api -- --runInBand catalogo-ejercicios`;
`npm run test:e2e --workspace apps/api -- --runInBand catalogo-ejercicios`;
`npm run build --workspace apps/api`; `npm run typecheck`.

## F02 — Gestionar el catálogo desde el móvil

- [ ] Lista con búsqueda, filtro, vacío/error/carga y acceso a alta/edición.
- [ ] Campos accesibles con nombre, grupo principal/secundarios e instrucciones;
      el mismo formulario funciona sin figura ni vídeo.
- [ ] Conectar la pantalla a la API de F01 y gestionar errores del contrato.

**Dependencias:** F01, C03; C06 para la comprobación de sesión larga.
**Alcance:** M, cuatro archivos.
**Archivos:** `apps/mobile/app/catalogo/index.tsx`,
`src/catalogo-ejercicios/catalogo.tsx`, `src/catalogo-ejercicios/api.ts`,
`src/catalogo-ejercicios/catalogo.spec.tsx`.
**Verificar:** `npm run test --workspace apps/mobile -- --runInBand catalogo`;
`npm run typecheck`; crear un ejercicio desde la pantalla y volver a buscarlo.

### Checkpoint F-A — catálogo utilizable

- [ ] F01 y F02 probados con API real.
- [ ] Roles negativos y formulario validado; no depender de una lista simulada.
- [ ] Entregar commits y resultados para revisión de Codex.

## F03 — Retirar y reponer sin romper el histórico

- [ ] Retirar/reponer desde API y UI, sin endpoint de borrado ni eliminación física.
- [ ] Los retirados desaparecen del selector normal; el entrenador los puede
      filtrar, y siguen abriéndose por id con la indicación de retirado.
- [ ] El cliente no puede retirar/reponer y una repetición de la operación no
      provoca estados inconsistentes.

**Dependencias:** F02. **Alcance:** M, cinco archivos.
**Archivos:** servicio y controlador de catálogo; `apps/mobile/src/catalogo-ejercicios/catalogo.tsx`;
`apps/api/test/catalogo-ejercicios.e2e-spec.ts`;
`apps/mobile/src/catalogo-ejercicios/catalogo.spec.tsx`.
La llamada HTTP de retirar/reponer se declara en el adaptador de F02 durante
esa tarea, antes de conectar aquí la acción. Si su contrato cambia, dividir el ajuste.
**Verificar:** los dos comandos de catálogo de F01/F02; `npm run typecheck`;
retirar y reponer desde el móvil, comprobando la búsqueda tras cada operación.

## F04 — Preparar y asignar una sesión sencilla

- [ ] Pantalla para un cliente: nombre de sesión, día y selección de ejercicios;
      ordenar ejercicios, crear series y objetivos por repeticiones o segundos.
- [ ] Peso opcional, unidades visibles, validación y revisión de la sesión antes
      de asignar. Los objetivos no son valores ejecutados.
- [ ] Conectar C09 conservando id de operación tras errores; el cliente puede
      abrir la asignación desde C10.

**Dependencias:** F03, C00, C03 y C09. **Alcance:** M, cinco archivos.
**Archivos:** `apps/mobile/app/entrenador/cliente/[id]/plan.tsx`,
`src/entrenamiento-entrenador/editor-sesion.tsx`, `selector-ejercicios.tsx`,
`api.ts`, `editor-sesion.spec.tsx`.
**Verificar:** `npm run test --workspace apps/mobile -- --runInBand editor-sesion`;
`npm run typecheck`; asignar desde entrenador y abrir desde cliente con API real.

### Checkpoint F-B — primera asignación

- [ ] F03 y F04 funcionan sin editar archivos comunes.
- [ ] Codex integra enlaces desde la ficha existente; Fable entrega la ruta exacta.
- [ ] Demostración de sesión con un ejercicio y una serie, sin esperar al editor semanal.

## F05 — Consultar resultados enviados

- [ ] Panel por cliente/semana con fecha original/actual y resultado enviado;
      abrir objetivo frente a ejecución, notas y series omitidas.
- [ ] Actualizar cada cinco segundos solo en pantalla visible y app activa;
      refrescar al volver, limpiar temporizador y peticiones al salir o cambiar cuenta.
- [ ] No mostrar valores, notas ni indicios derivados del contenido del borrador.
      Reutilizar el control de cambio de día de Codex cuando esté disponible.

**Dependencias:** C09, C13b, C14. **Alcance:** M, cuatro archivos.
**Archivos:** `apps/mobile/app/entrenador/cliente/[id]/entrenos.tsx`,
`src/entrenamiento-entrenador/resultados.tsx`, `api.ts`, `resultados.spec.tsx`.
**Verificar:** `npm run test --workspace apps/mobile -- --runInBand resultados`;
`npm run typecheck`; comprobar antes/después de enviar desde el móvil del cliente.

## F06 — Ampliar el editor a varias semanas

- [ ] Varias sesiones en el patrón semanal, elección de semana inicial y número
      de semanas, con resumen de las fechas que se crearán.
- [ ] Avisar de sesiones ya existentes sin sustituirlas; cambiar una sesión
      posteriormente no propaga el movimiento a otras semanas.
- [ ] Asignación repetida/reintentada mantiene la misma operación y no duplica el plan.

**Dependencias:** F04, C16a. **Alcance:** M, cinco archivos.
**Archivos:** `apps/mobile/src/entrenamiento-entrenador/editor-plan.tsx`,
`editor-sesion.tsx`, `api.ts`, `editor-plan.spec.tsx`,
`apps/mobile/app/entrenador/cliente/[id]/plan.tsx`.
**Verificar:** `npm run test --workspace apps/mobile -- --runInBand editor-plan`;
`npm run typecheck`; asignar dos semanas y comprobar fechas desde ambas cuentas.

### Checkpoint F-C — plan y resultado

- [ ] F05 y F06 conectados a API, con errores y reintentos probados.
- [ ] Panel actualiza sin mostrar borradores; las fechas de varias semanas son correctas.
- [ ] Entrega de commits, evidencia y contratos pendientes, si los hubiera.

## F07a — Elegir y adaptar una rutina guardada

- [ ] Guardar la estructura de una rutina con nombre y elegir una existente.
- [ ] Personalizar la copia sin editar otra asignación, ni arrastrar valores
      reales o notas del cliente.
- [ ] Señalar ejercicios retirados y exigir corregir la copia antes de asignar.

**Dependencias:** F06, C16b. **Alcance:** M, cuatro archivos.
**Archivos:** `apps/mobile/src/entrenamiento-entrenador/rutinas.tsx`,
`editor-plan.tsx`, `api.ts`, `rutinas.spec.tsx`.
**Verificar:** `npm run test --workspace apps/mobile -- --runInBand rutinas`;
`npm run typecheck`; adaptar para otro cliente y comprobar el primer plan intacto.

## F07b — Ajustar una sesión todavía no iniciada

- [ ] Desde el panel abrir y editar objetivos de una sesión permitida usando
      el editor existente; enviar revisión de prescripción.
- [ ] Una sesión iniciada o enviada queda en consulta. Si se inicia durante la
      edición, el conflicto permite volver a leer sin afirmar que se guardó.
- [ ] El ajuste afecta a esa sesión, conservando las demás semanas y resultados.

**Dependencias:** F05, F07a, C17. **Alcance:** M, cinco archivos.
**Archivos:** `apps/mobile/app/entrenador/sesion/[id].tsx`,
`src/entrenamiento-entrenador/editor-sesion.tsx`, `resultados.tsx`, `api.ts`,
`ajustar-sesion.spec.tsx`.
**Verificar:** `npm run test --workspace apps/mobile -- --runInBand ajustar-sesion`;
`npm run typecheck`; iniciar el borrador del cliente mientras el entrenador edita.

### Checkpoint F-D — rutinas y ajustes

- [ ] F07a–F07b probados con dos clientes y varias semanas.
- [ ] Editar plantillas o futuras sesiones no altera resultados ya enviados.
- [ ] Revisión cruzada antes de la comprobación final.

## F08 — Verificar y entregar las pantallas completas

- [ ] Comprobar teclado, desplazamiento, tamaños táctiles, unidades, errores y
      navegación en las pantallas del entrenador y el catálogo.
- [ ] Ejecutar el recorrido con la versión integrada de Codex; registrar qué
      se comprobó en Android/iOS/web y qué permanece pendiente.
- [ ] Entregar hallazgos con archivo y reproducción; las correcciones que
      excedan esta tarea se separan, sin invadir archivos de Codex.

**Dependencias:** F07b y C18 integrado. **Alcance:** S para evidencias; los arreglos
se desglosan en tareas propias si hacen falta.
**Archivos:** `tasks/entrenamiento/entrega-fable.md` y como máximo dos tests de
componentes de Fable que reproduzcan fallos encontrados.
**Verificar:** `npm run test --workspace apps/mobile -- --runInBand`;
`npm run test:e2e --workspace apps/api -- --runInBand catalogo-ejercicios`;
`npm run typecheck`; `npm run lint`; recorrido en dispositivo con evidencia.

## Formato de entrega a Codex

En `entrega-fable.md`, registra base, commits, tareas terminadas, comandos y
resultado, pruebas en dispositivo y pendientes. Codex actualizará el seguimiento
común a partir de esa entrega. Una tarea probada solo con datos simulados no
consta como integrada. No hagas push, merge a main ni publicación por este encargo.
