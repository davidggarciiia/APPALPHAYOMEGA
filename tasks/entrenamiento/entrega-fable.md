# Entrega de Fable — entrenamiento, segunda iteración

> Archivo de Fable según el [desglose](todo-fable.md). Codex actualiza el
> seguimiento común a partir de estas entregas. Vive en la rama
> `codex/fable-catalogo`, worktree `APP-ALPHA_OMEGA-fable`.

## Estado a 2026-09-18

| Tarea             | Estado                                                                           |
| ----------------- | -------------------------------------------------------------------------------- |
| F01 API           | Terminada y probada contra PostgreSQL real. Pendiente de revisión e integración  |
| F02 móvil         | Pantallas preparadas con datos de prueba. **No integrada:** falta conectar a C03 |
| F03 API           | Retirar y reponer terminados y probados contra PostgreSQL real                   |
| F03 móvil         | Preparado con datos de prueba. **No integrado**, igual que F02                   |
| Checkpoint F-A    | No alcanzado: exige F02 contra la API real                                       |
| Dispositivo / web | Nada comprobado en pantalla todavía                                              |

**Base:** `9fc9003` de `codex/entrenamiento-iteracion-2` (C00, C01, C02 y el
contrato de errores). Los commits se ven con
`git log --oneline 9fc9003..codex/fable-catalogo`. Rebaso sobre cada entrega de
Codex, así que los hash cambian; los asuntos no:

1. `feat(catalogo): lista del catalogo en el movil contra el contrato fijo`
2. `feat(catalogo): formulario de alta y edicion de ejercicios en el movil`
3. `feat(catalogo): retirar y reponer ejercicios desde el movil`
4. `feat(catalogo): F01, crear, leer, editar y buscar ejercicios en la API`
5. `feat(catalogo): retirar y reponer ejercicios en la API`
6. `feat(catalogo): el 409 de nombre repetido cumple el contrato de errores`
7. Los commits `docs(entrenamiento)` de este archivo.

### Desviaciones que conviene revisar

- El encargo pide crear el worktree desde el commit común C00–C03. Lo creé
  antes, desde C01, y he rebasado sobre C02 y sobre `9fc9003` sin conflictos.
  C03 sigue sin commit; cuando llegue, rebaso otra vez.
- He hecho la parte de API de F03 antes de integrar F02, porque no dependía de
  C03. La parte móvil de F03 sigue sin contar.
- En la carpeta de Codex no he cambiado de rama, ni instalado paquetes, ni
  editado archivos suyos. Un primer borrador de este documento estuvo allí sin
  añadir a git y ya lo he movido aquí.

## Archivos

Todos dentro de mis límites de escritura:

- `apps/api/src/catalogo-ejercicios/`: `catalogo-ejercicios.service.ts`,
  `.controller.ts`, `.service.spec.ts` y `.module.ts`. El módulo lo creó Codex
  vacío en C02 para este fin; solo registra controlador y servicio.
- `apps/api/test/catalogo-ejercicios.e2e-spec.ts`.
- `apps/mobile/src/catalogo-ejercicios/`: `api.ts`, `catalogo.tsx`,
  `formulario-ejercicio.tsx`, `catalogo-en-memoria.ts` y las dos specs.
- Este documento.

## F01 y parte de API de F03

Rutas: `GET/POST /ejercicios`, `GET/PATCH /ejercicios/:id`,
`POST /ejercicios/:id/retirar` y `/reponer`. No hay ruta `DELETE`.

### Criterios cubiertos por pruebas HTTP

- El cliente lee ficha y listado. Crear, editar, retirar y reponer son solo del
  entrenador. Nutricionista y empleado reciben 403 en todas las rutas, también
  en lectura. Sin sesión, 401. No se usa ni se toca `AlcanceClienteGuard`.
- Alta sin figura ni vídeo: viajan como `null`, no omitidos.
- Nombre único por `nombreNormalizado`: 409 con `codigo: "nombre_duplicado"`
  según `ErrorDeApiSchema`, en alta y en edición, sin crear ni cambiar nada.
  Guardar sin cambiar el nombre no choca consigo mismo, y un nombre liberado se
  puede reutilizar.
- 400 sin crear nada: grupo fuera del vocabulario, principal repetido como
  secundario, secundario repetido, nombre o instrucciones vacíos y campos que
  el formulario no edita. Id mal formado, 400; id inexistente, 404.
- Búsqueda por trozo del nombre sin distinguir mayúsculas, filtro por grupo
  principal o secundario, orden estable y total real con límite y desplazamiento.
- Retirar saca el ejercicio de la búsqueda de todos y no de la base. El
  entrenador lo pide con `estado=retirado` o `todos`; el cliente recibe 403 si
  pide otro estado que `publicado`. Un retirado se abre por id, también para el
  cliente, y lo dice. Reponer lo devuelve y limpia `retiradoEn`. Repetir la
  operación devuelve 200 y no mueve la fecha. Editar un retirado no lo repone.
- Unitarias: normalización, traducción de errores de Prisma sin disfrazar fallos
  desconocidos, y el criterio 18 de la spec: ninguna tabla del módulo referencia
  a un usuario.

### Comandos y resultado

Dentro del worktree, sobre el último commit de código:

- `npm run test:e2e --workspace apps/api -- --runInBand catalogo-ejercicios`:
  35 pruebas pasan. **Con PostgreSQL real, en una base separada**
  (`alpha_omega_fable`, mismo contenedor) para no compartir la que usa Codex. El
  `.env` del worktree es una copia del de la carpeta principal con otro
  `POSTGRES_DB`; está ignorado por git. Migraciones con `prisma migrate deploy`.
- `npm run test`: 76 pruebas de API y 31 móviles pasan.
- `npm run typecheck`, `npm run lint` y `npm run build --workspace apps/api`: pasan.
- El resto de la suite HTTP (identidad) no la he ejecutado.

## Preparación de F02 y F03 en el móvil

Probado **solo con un catálogo en memoria** que valida contra los esquemas
compartidos. No consta como integrado.

- Lista: búsqueda con espera, filtro por grupo, carga, vacío, error con
  reintento, aviso «mostrando X de Y» y acceso al alta y a la edición.
- Formulario único para alta y edición: nombre, grupo principal, secundarios e
  instrucciones, sin figura ni vídeo. El principal no se puede marcar como
  secundario. El nombre repetido se pinta en su campo. Un fallo de red conserva
  lo escrito y permite volver a guardar.
- Retirados: fuera de la lista normal; el entrenador los pide con RETIRADOS y
  salen señalados. La ficha de un retirado lo dice y ofrece REPONER. RETIRAR
  pide confirmación en dos pasos, como la baja de un cliente.
- Las pantallas reciben la API por props (`ApiDeCatalogo`) y no conocen rutas
  ni sesión. Campos, grupos y botones tienen nombre y rol accesibles.
- Comprobé que las pruebas del formulario fallan si se rompe el comportamiento
  antes de darlas por buenas.

### Qué falta para que cuenten

- `api.ts` solo declara el tipo. El adaptador HTTP real espera a C03; traducirá
  el 409 con `codigo: "nombre_duplicado"` a `ErrorDeNombreDuplicado`.
- Rutas `app/catalogo/`: sin crear, porque necesitan el adaptador y la sesión.
- Crear un ejercicio desde el móvil y volver a encontrarlo, con API real.

## Propuestas y dudas para Codex

1. **400 de los módulos nuevos.** `ErrorDeApiSchema` fija
   `codigo: "solicitud_invalida"`, pero `comun/zod.pipe.ts` responde
   `{ mensaje, campos }` y es un archivo común que usa identidad. Mis 400 salen
   hoy con esa forma antigua. Necesito que Codex aporte la variante del pipe para
   los módulos nuevos, o que me autorice a crear una dentro de mi módulo.
2. **404 y 403.** El esquema no los contempla. Los míos usan el cuerpo por
   defecto de Nest. Si se van a tipar, que sea en `shared`.
3. **Normalización.** La regla vive en mi servicio: recortar, colapsar espacios
   y minúsculas con locale `es`, sin plegar acentos. `buscar` se normaliza igual,
   así que «bulgara» no encuentra «búlgara». Aceptado para esta iteración.
4. **División de F02**, sin cambiar el alcance, porque lista y formulario no
   caben en los cuatro archivos previstos:
   - F02a lista: `catalogo.tsx`, `catalogo.spec.tsx`, `api.ts`.
   - F02b formulario: `formulario-ejercicio.tsx`, su spec y `catalogo-en-memoria.ts`.
   - F02c conexión: adaptador en `api.ts` sobre C03 y tres rutas finas,
     `app/catalogo/index.tsx`, `nuevo.tsx` y `[id].tsx`, como ya hace
     `app/cliente/`. Con pantalla propia, el botón atrás de Android vuelve a la lista.
5. Ruta que Codex enlazará desde el inicio: `/catalogo`.

Decisiones de mi servicio ya aplicadas y probadas, por si hay objeción: `grupo`
coincide con principal o secundario; el cliente recibe 403 al pedir un estado
no publicado; retirar y reponer responden 200 y son idempotentes;
`PATCH` sustituye la ficha completa y no lleva revisión, de modo que con varios
entrenadores gana la última escritura.

## Siguiente tarea

F02c en cuanto C03 tenga commit: adaptador, rutas y comprobación con la API
real. Con eso se puede presentar el checkpoint F-A a David.
