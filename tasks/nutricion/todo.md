# Tareas: `nutricion`

> Plan: [plan.md](plan.md) · Spec: [SPEC-nutricion.md](../../SPEC-nutricion.md).
> Los identificadores N son de este módulo. Las tareas de Codex se marcan como tales.
> Ninguna tarea se marca hecha sin su verificación.

Comandos comunes, desde la raíz del worktree:

```bash
npm run build:shared
npm run test --workspace apps/api -- --runInBand nutricion
npm run test:e2e --workspace apps/api -- --runInBand nutricion
npm run test --workspace apps/mobile -- --runInBand nutricion
npm run build --workspace apps/api
npm run typecheck
npm run lint
```

Los tests HTTP usan una base de pruebas propia, nunca la base demo.

## Fase 0 · Base común

- [ ] **N00 (Codex, C09): contrato, modelo, migración y esqueleto**

  Publica lo propuesto en `plan.md`: `packages/shared/src/nutricion.ts`, el
  modelo `Dieta`, la migración aditiva con los dos índices únicos parciales y
  `apps/api/src/nutricion/nutricion.module.ts` vacío y registrado en `AppModule`.

  **Aceptación**
  - Tests del esquema con ejemplos válidos e inválidos: semana con tipo
    inexistente, tipo sin comidas y sin números, ids repetidos, campos desconocidos.
  - Migración aplicada en la base de pruebas sin tocar tablas existentes.
  - SHA registrado en `integracion.md`.

  **Dependencias:** SPEC aprobada y este plan revisado · **Alcance:** M (Codex)

### Checkpoint 0

- [ ] Fable ha revisado el contrato publicado y rebasado su rama sobre ese SHA.

## Fase 1 · API

- [ ] **N01: guardar y leer el borrador**

  `GET` y `PUT /nutricion/clientes/:clienteId/borrador`, con `@Roles` y
  `AlcanceClienteGuard`. La revisión `0` crea; cualquier otra actualiza si coincide.

  **Aceptación**
  - Crear, leer y actualizar funcionan. Una revisión obsoleta devuelve
    `409 revision_obsoleta`; un documento inválido, `400 solicitud_invalida`.
  - Denegado a: cliente propio, otro cliente, nutricionista sin asignación,
    nutricionista tras perderla, empleado y petición sin sesión. Una persona que
    no es cliente da 404.
  - Cliente dado de baja: `409 operacion_incompatible`. Cliente pendiente: permitido.

  **Verificación:** unitarios del servicio y
  `test:e2e ... nutricion-borrador`; build de la API.

  **Archivos:** `apps/api/src/nutricion/nutricion.controller.ts`,
  `dietas.service.ts`, `dietas.service.spec.ts`, `apps/api/test/nutricion-ayuda.ts`,
  `apps/api/test/nutricion-borrador.e2e-spec.ts`

  **Dependencias:** N00 · **Alcance:** M

- [ ] **N02: publicar, descartar y leer la vigente**

  `POST .../borrador/publicar`, `POST .../borrador/descartar` y
  `GET .../dieta`. Publicar archiva la vigente dentro de la misma transacción.

  **Aceptación**
  - El cliente no ve nada hasta que se publica. Una segunda publicación deja
    solo la nueva como vigente.
  - Repetir con el mismo `operacionId` devuelve el mismo resultado; con otro
    contenido, `409 operacion_incompatible`. Publicar a la vez que se guarda no
    deja dos borradores ni dos publicadas.
  - Permisos: el cliente solo lee su vigente; el resto, igual que en N01. Ninguna
    traza contiene el documento.

  **Verificación:** unitarios y `test:e2e ... nutricion-publicacion`, con una
  prueba de carrera.

  **Archivos:** `nutricion.controller.ts`, `dietas.service.ts`,
  `dietas.service.spec.ts`, `apps/api/test/nutricion-publicacion.e2e-spec.ts`

  **Dependencias:** N01 · **Alcance:** M

- [ ] **N03: histórico del profesional**

  `GET .../historico`, paginado y con el total, y `GET .../dietas/:dietaId`.

  **Aceptación**
  - Lista las publicadas y archivadas con fecha y autor; el cliente recibe 403.
  - Una dieta de otro cliente pedida por su id devuelve 404.
  - `total` es el real aunque el límite sea menor.

  **Verificación:** `test:e2e ... nutricion-historico`; cobertura del servicio ≥ 80 %.

  **Archivos:** `nutricion.controller.ts`, `dietas.service.ts`,
  `apps/api/test/nutricion-historico.e2e-spec.ts`

  **Dependencias:** N02 · **Alcance:** S

### Checkpoint 1 — API

- [ ] `npm test`, los tests HTTP de nutrición y los de identidad en verde; typecheck,
      lint y build.
- [ ] Matriz de permisos de la spec cubierta con una prueba por cada «No».

## Fase 2 · Tramo «solo objetivos»

- [ ] **N04: vista del cliente con objetivos**

  Cliente de API y pantalla `/nutricion` con «Hoy» y «Semana». Muestra las kcal
  y los macros de cada tipo de día, o el aviso de dieta no publicada.

  **Aceptación**
  - «Hoy» corresponde al día actual en `Europe/Madrid` (se prueba el paso de
    domingo a lunes con la fecha simulada).
  - Sin números no se muestra ninguna cifra; con números, tal cual se escribieron.
  - Los errores de red ofrecen reintentar. No se muestran datos inventados.

  **Verificación:** `test ... vista-dieta`; typecheck y lint; revisión visual en
  web a 320 y 390 px.

  **Archivos:** `apps/mobile/src/nutricion/api.ts`, `vista-dieta.tsx`,
  `vista-dieta.spec.tsx`, `apps/mobile/app/nutricion/index.tsx`

  **Dependencias:** N02 · **Alcance:** M

- [ ] **N05a: modelo del editor**

  Funciones puras: documento nuevo, añadir y quitar tipos de día, asignar la
  semana, editar objetivos y convertir a `DocumentoDietaSchema`.

  **Aceptación**
  - Los números escritos con coma o vacíos se convierten de forma explícita; un
    valor inválido no se convierte en 0.
  - Quitar un tipo de día que usa la semana obliga a reasignar esos días antes
    de guardar.
  - El resultado siempre pasa el contrato o devuelve errores por campo.

  **Verificación:** `test ... editor-dieta-modelo`.

  **Archivos:** `apps/mobile/src/nutricion/editor-modelo.ts`, `editor-modelo.spec.ts`

  **Dependencias:** N00 · **Alcance:** S

- [ ] **N05b: editor, guardado y publicación de objetivos**

  Pantalla del profesional `/nutricion/cliente/[id]`, con la vigente, el
  borrador y los botones Nuevo, Editar y Publicar. El editor
  (`/nutricion/cliente/[id]/editar`) cubre nombre, tipos de día, semana y objetivos.

  **Aceptación**
  - Guardar muestra «Guardado» solo cuando el servidor responde. Ante un
    conflicto se ofrece recargar sin perder lo escrito.
  - Publicar pide confirmación y no muestra «Dieta publicada» sin respuesta del
    servidor. Un reintento reutiliza el mismo `operacionId`.
  - «Editar» parte de una copia de la vigente (revisión `0`).

  **Verificación:** test de componente del editor (conflicto y publicación);
  recorrido web con la API real.

  **Archivos:** `apps/mobile/src/nutricion/editor-dieta.tsx`, `editor-dieta.spec.tsx`,
  `apps/mobile/app/nutricion/cliente/[id]/index.tsx`, `.../[id]/editar.tsx`

  **Dependencias:** N02, N05a · **Alcance:** M

### Checkpoint 2 — revisión de David

- [ ] En web y con la API real, un profesional publica objetivos para entreno y
      descanso, y el cliente los ve en «Hoy» y «Semana».
- [ ] Revisión de David de las pantallas antes de añadir las comidas.

## Fase 3 · Dieta completa

- [ ] **N06: comidas con alternativas**

  En el editor: comidas con hora e indicación, grupos, alternativas, alimentos
  con cantidad libre, nota y macros opcionales. En la vista del cliente: las
  mismas comidas en modo lectura.

  **Aceptación**
  - La estructura del PDF de referencia se reproduce con datos inventados: tres
    grupos de alternativas en el desayuno.
  - Las cantidades libres («1 ud», «al gusto») y los alimentos sin cantidad se
    muestran sin cambios.
  - Los límites del contrato se avisan en el campo afectado, no con un error
    genérico.

  **Verificación:** tests de modelo y de componentes (vista y editor); recorrido web.

  **Archivos:** `editor-modelo.ts`, `editor-comida.tsx`, `dia-dieta.tsx`,
  `dia-dieta.spec.tsx`, `editor-comida.spec.tsx`

  **Dependencias:** N05b · **Alcance:** M

- [ ] **N07: tabla de intercambio**

  Comidas en forma de columnas («Hidratos de carbono», «Proteína», «Grasas»)
  con sus alimentos, en el editor y en la vista.

  **Aceptación**
  - Una comida se puede cambiar entre alternativas e intercambio, avisando antes
    de descartar lo escrito.
  - En el móvil, la vista del cliente muestra las columnas en una forma legible
    a 320 px y la indicación de combinar una de cada una.

  **Verificación:** tests de componentes; revisión visual a 320, 390 y 768 px.

  **Archivos:** `editor-modelo.ts`, `editor-comida.tsx`, `dia-dieta.tsx`, sus specs

  **Dependencias:** N06 · **Alcance:** M

- [ ] **N08: indicaciones generales**

  Secciones de título y texto («Cómo seguir el plan», «Recomendaciones») en el
  editor y al final de la vista del cliente.

  **Aceptación**
  - Se pueden añadir, ordenar y quitar hasta 10 secciones.
  - El texto largo mantiene los saltos de línea y no desborda la pantalla.

  **Verificación:** tests de componentes.

  **Archivos:** `editor-dieta.tsx`, `vista-dieta.tsx`, sus specs

  **Dependencias:** N06 · **Alcance:** S

### Checkpoint 3

- [ ] Una dieta inventada con la estructura completa de la referencia se
      publica y se lee en web con la API real.

## Fase 4 · Histórico y sin conexión

- [ ] **N09: histórico, descartar y editar desde la vigente**

  Lista del histórico con fecha y autor, detalle en modo lectura y botón para
  descartar el borrador con confirmación.

  **Aceptación**
  - El cliente no tiene ninguna ruta hacia el histórico.
  - Descartar con una revisión obsoleta muestra el conflicto y no borra nada.

  **Verificación:** tests de componentes; recorrido web.

  **Archivos:** `apps/mobile/src/nutricion/historico.tsx`, `historico.spec.tsx`,
  `apps/mobile/app/nutricion/cliente/[id]/index.tsx`, `api.ts`

  **Dependencias:** N03, N05b · **Alcance:** M

- [ ] **N10: copia sin conexión del cliente**

  Al leer la vigente, se guarda cifrada en `almacenDispositivo` con la fecha. Si
  falla la red, se muestra la copia con «Actualizada el…».

  **Aceptación**
  - En modo avión, tras cerrar y reabrir la app, se lee la última vigente
    descargada. Sin copia previa, se avisa de que hace falta conexión.
  - Tras cerrar sesión, la copia desaparece y otra cuenta del mismo dispositivo
    no la ve.
  - La copia no cuenta como cambio pendiente al cerrar sesión.

  **Verificación:** tests con almacén doble; prueba en web sin API y en
  dispositivo físico.

  **Archivos:** `apps/mobile/src/nutricion/copia-local.ts`, `copia-local.spec.ts`,
  `vista-dieta.tsx`

  **Dependencias:** N04, N11 · **Alcance:** S

- [ ] **N11 (Codex): accesos y ruta sin conexión**

  Pestaña «Dieta» del cliente (también en `fase: "local"`), `_layout.tsx`
  permitiendo `/nutricion` sin conexión, botón «Dieta» en la ficha del cliente y
  filas de «Mis clientes» que abran `/nutricion/cliente/[id]`.

  **Aceptación**
  - Cada rol llega a su pantalla; el empleado no ve ninguna entrada.
  - Sin conexión, el cliente puede abrir entrenamiento y dieta.

  **Dependencias:** N04 · **Alcance:** S (Codex)

## Fase 5 · Cierre

- [ ] **N12: recorrido completo y evidencia**

  Se trazan los 15 criterios de la spec a pruebas. Recorrido:
  - un profesional publica y el cliente la lee;
  - una segunda publicación pasa la primera al histórico;
  - el nutricionista pierde el acceso al retirarle la asignación;
  - modo avión;
  - cierre de sesión y cambio de cuenta.

  **Aceptación**
  - Evidencia en `tasks/iteracion-3/entrega-fable.md` con SHA, comandos,
    plataforma y resultados.
  - Web, Android e iOS registrados por separado. Si falta un dispositivo, queda
    pendiente y con guion, sin sustituirlo por una prueba web.

  **Dependencias:** N01–N11 · **Alcance:** S

### Checkpoint final

- [ ] `npm test`, tests HTTP completos, typecheck, lint y build en el SHA integrado.
- [ ] Revisión de David y de Codex (C07) del módulo.
