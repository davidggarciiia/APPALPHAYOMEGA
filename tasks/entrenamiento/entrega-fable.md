# Entrega de Fable — entrenamiento, segunda iteración

> Archivo de Fable según el [desglose](todo-fable.md). Codex actualiza el
> seguimiento común a partir de estas entregas. Vive en la rama
> `codex/fable-catalogo`, worktree `APP-ALPHA_OMEGA-fable`.

## Estado a 2026-09-18

**Ninguna tarea F consta como terminada ni integrada.** Lo entregado es
preparación de pantallas contra el contrato fijo de C00, que el plan permite
mientras el proveedor no existe. Todo está probado solo con datos de prueba.

| Condición del encargo | Estado                                                                   |
| --------------------- | ------------------------------------------------------------------------ |
| PLAN                  | Aprobado                                                                 |
| TASKS de Fable        | David indica ejecutar `todo-fable.md`; Codex lo marca «reparto aprobado» |
| C00 contratos         | Entregado: `0f07539`                                                     |
| C01 tests móviles     | Entregado: `b456523`                                                     |
| C02 persistencia      | En curso en la carpeta de Codex, sin commit                              |
| C03 transporte        | Sin empezar                                                              |

F01 sigue bloqueada hasta el commit de C02: Prisma, migraciones y
`app.module.ts` son de Codex y no los he tocado.

### Desviación que conviene revisar

El encargo pide crear el worktree desde el commit común C00–C03. Lo he creado
antes, desde `b456523` (C00 + C01), para no esperar parado. Mis archivos están
solo en `apps/mobile/src/catalogo-ejercicios/` y en este documento, así que
rebasar sobre el commit común no debería dar conflictos. En la carpeta de Codex
no he cambiado de rama, ni instalado paquetes, ni editado archivos suyos;
`npm ci` se ejecutó dentro del worktree y no modificó el lockfile.

## Preparación de F02 y F03 en el móvil

**Base:** `b456523`. **Commits:** `f1c9575` lista, `203da2c` formulario y
`062856d` retirar y reponer.

**Archivos** (todos nuevos, en `apps/mobile/src/catalogo-ejercicios/`):
`api.ts`, `catalogo.tsx`, `formulario-ejercicio.tsx`, `catalogo-en-memoria.ts`,
`catalogo.spec.tsx`, `formulario-ejercicio.spec.tsx`.

### Qué hace ya, con datos de prueba

- Lista: búsqueda con espera, filtro por grupo, carga, vacío, error con
  reintento, aviso «mostrando X de Y» y acceso al alta y a la edición.
- Formulario único para alta y edición: nombre, grupo principal, secundarios e
  instrucciones, sin figura ni vídeo. El principal no se puede marcar como
  secundario. El nombre repetido se pinta en su campo. Un fallo de red conserva
  lo escrito y permite volver a guardar.
- Retirados: fuera de la lista normal; el entrenador los pide con RETIRADOS y
  salen señalados. La ficha de un retirado lo dice y ofrece REPONER. RETIRAR
  pide confirmación en dos pasos, como la baja de un cliente. Editar el texto de
  un retirado no lo repone.
- Las pantallas reciben la API por props (`ApiDeCatalogo`) y no conocen rutas
  ni sesión. Campos, grupos y botones tienen nombre y rol accesibles.

### Qué falta para que F02 y F03 cuenten

- `api.ts` solo declara el tipo. El adaptador HTTP real espera a C03.
- Rutas `app/catalogo/`: sin crear, porque necesitan el adaptador y la sesión.
- Ninguna comprobación con API real ni en dispositivo. No se ha visto en
  pantalla: solo pruebas de componentes con `jest-expo`.

### Comandos y resultado

Todos dentro del worktree, sobre el último commit:

- `npm run test`: 65 pruebas de API y 31 móviles (27 son del catálogo). Pasan.
- `npm run typecheck`: pasa. `npm run lint`: pasa.
- Pruebas HTTP: no ejecutadas. No he usado la base de datos de Codex.

Comprobé que las pruebas del formulario fallan si se rompe el comportamiento
(grupo principal repetido y nombre duplicado) antes de darlas por buenas.

## Dudas sobre el contrato del catálogo

Revisadas tras leer el C02 en curso de Codex (solo lectura).

**Resueltas por C02**

1. Nombre único: columna `nombreNormalizado` con `@unique`. La regla la pongo en
   mi servicio: recortar, colapsar espacios internos y minúsculas con locale
   `es`, sin plegar acentos. Si Codex prefiere otra, que lo diga antes de F01.
2. Grupos secundarios: tabla `GrupoSecundarioDeEjercicio`. Escribo el servicio
   contra esa forma.

**Ya no bloquea**

3. Error de nombre duplicado: la pantalla solo conoce `ErrorDeNombreDuplicado` y
   el adaptador decide cómo reconocerlo. En estas rutas un 409 solo puede
   significar nombre repetido, así que basta el código HTTP. Un `codigo` estable
   en el cuerpo sigue siendo preferible si C03 define un esquema de error.

**Las decido yo salvo objeción (son de mi servicio)**

4. `grupo` coincide con principal **o** secundario (spec, req. 6). El mapa
   muscular, fuera de esta iteración, pediría un parámetro propio.
5. Un cliente que pide `estado` distinto de `publicado` recibe 403. Abrir un
   retirado por id sigue permitido (req. 3).
6. `buscar` por contenido sobre el nombre normalizado. Orden por nombre y
   desempate por id.
7. Retirar y reponer devuelven 200 con `EjercicioSchema` y son idempotentes. Las
   pantallas ya cuentan con ello.
8. `:id` validado con `z.uuid()` en el controlador.

**Para dejar constancia**

9. `PATCH /ejercicios/:id` sustituye la ficha completa y no lleva revisión: con
   varios entrenadores gana la última escritura. Lo acepto en esta iteración.
10. Las pruebas HTTP del catálogo limpiarán por prefijo de nombre
    (`e2e-catalogo-`). Pediré turno a Codex o una base separada antes de
    ejecutarlas.

## Cambios de tareas que propongo

F02 y F03 no caben en los archivos previstos sin mezclar lista y formulario en
uno solo. Propongo, sin cambiar el alcance:

- **F02a** lista: `catalogo.tsx`, `catalogo.spec.tsx`, `api.ts`.
- **F02b** formulario: `formulario-ejercicio.tsx`, su spec y
  `catalogo-en-memoria.ts`.
- **F02c** conexión: adaptador en `api.ts` sobre C03 y tres rutas finas,
  `app/catalogo/index.tsx`, `nuevo.tsx` y `[id].tsx`, como ya hace `app/cliente/`.
  Con pantalla propia para el alta, el botón atrás de Android vuelve a la lista.

Ruta que Codex enlazará desde el inicio: `/catalogo`.

## Siguiente tarea

F01 en cuanto exista el commit de C02: rebaso sobre él y empiezo por la prueba
del servicio. Cuando llegue C03, F02c y la comprobación con la API real.
