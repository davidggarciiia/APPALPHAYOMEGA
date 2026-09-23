# Plan de Codex — diseño, estabilidad, integración y seguimiento corporal

[Coordinación y límites](plan.md) · [Plan de Fable](plan-fable.md).
Fecha: 2026-09-23. Lista de tareas de Codex para esta iteración; casillas sin ejecutar.
La etapa nueva de seguimiento sigue SPECIFY → PLAN → TASKS → IMPLEMENT.
Reparto revisado por David: las vistas y las pruebas físicas del entrenamiento,
además de la conexión de animaciones, pasan a Fable. Codex conserva los cambios
comunes, la lógica de sesión/persistencia, seguimiento corporal e integración.

## Comandos de verificación

Desde la raíz de la copia correspondiente:

```powershell
npm run typecheck
npm run lint
npm test
npm run build --workspace apps/api
npm run test --workspace apps/mobile -- --runInBand
npm run test:e2e --workspace apps/api -- --runInBand
```

El último comando usa solo una base de pruebas identificada, con turno o aislada.
En cambios visuales basta inspección de pantallas, tests existentes afectados,
typecheck y lint; no añadir tests que solo copien colores. Cambios de comportamiento
sí requieren regresión que falle antes y pase después. La comprobación completa se
hace en checkpoints, sin repetirla después de cada edición puramente documental.

## C00 — Preparar el trabajo simultáneo

**Dependencias:** revisión del reparto. **Tamaño:** S, documentación/aislamiento.
**Archivos:** este plan y `tasks/iteracion-3/integracion.md` (nuevo).

- [ ] Registrar ramas, SHA base, trabajo previo de Fable si existe y rutas asignadas.
- [ ] Preparar worktree de Fable sin mover los cuatro cambios de diseño de Codex;
      facilitar los documentos vigentes si aún no están en el SHA de su copia.
- [ ] Acordar bases/puertos y registrar la línea base de verificación y sus límites.

**Verificar:** `git status --short`, `git worktree list`, `git diff --check` en cada
copia; comprobar que el trabajo pendiente y `PDF/` siguen intactos.

## C01 — Terminar la paleta y los componentes comunes

**Dependencias:** C00. **Tamaño:** M, cuatro archivos existentes.
**Archivos:** `apps/mobile/src/tema.ts`, `src/componentes/armazon.tsx`,
`src/componentes/formulario.tsx`, `apps/mobile/app/_layout.tsx`.

- [ ] Contrastar los cambios pendientes con el HTML del ZIP: fondo crema, tarjetas
      blancas, botones dorados y estado completado verde, con textos legibles.
- [ ] Mantener contraste en formularios claros y acceso oscuro, incluidos errores,
      foco, deshabilitados y el estado seleccionado de navegación.
- [ ] Comprobar en web y separar cualquier limitación de gradientes nativos;
      no cambiar sesión ni datos para resolver un estilo.

**Verificar:** `npm run test --workspace apps/mobile -- --runInBand formulario`;
`npm run typecheck`; `npm run lint`; inspección a 390 y 1440 px.

## C02 — Ajustar acceso y perfil a la referencia

**Dependencias:** C01. **Tamaño:** M, cinco rutas.
**Archivos:** `apps/mobile/app/login.tsx`, `activar.tsx`, `recuperar.tsx`,
`restablecer.tsx`, `perfil.tsx`.

- [ ] Enlaces y mensajes visibles sobre el fondo oscuro; avatar y acciones del
      perfil con el color de su función en el ZIP.
- [ ] Editar, guardar y cancelar siguen funcionando; renovar acceso no borra el
      formulario. No alterar credenciales ni repoblar datos editados por David.
- [ ] Teclado y anchura de 320 px no tapan campos o acciones esenciales.

**Verificar:** `npm run test --workspace apps/mobile -- --runInBand perfil`;
typecheck/lint y recorrido login → perfil → editar/cancelar/guardar.

### Checkpoint visual inicial

- [ ] C01–C02 revisados contra la referencia con evidencia de pantallas.
- [ ] Cambios de estilo separados de cualquier corrección funcional descubierta.

## C03 — Ajustar el inicio y entregar el tema a Fable

**Dependencias:** C01; C02 puede avanzar de forma independiente. **Tamaño:** S.
**Archivos:** `apps/mobile/app/index.tsx`, `tasks/iteracion-3/integracion.md`.

- [ ] Mantener cabecera oscura y texto legible del entrenador conforme al ZIP,
      con acciones operativas y datos reales.
- [ ] Entregar a Fable el SHA de C01 y roles de color para F08, sin editar sus
      vistas de agenda, series, registro o resultado.
- [ ] Comprobar que inicio compone las vistas entregadas por Fable y respeta
      navegación por rol, fecha actual y estados reales.

**Verificar:** tests móviles existentes, typecheck/lint e inicio de cliente y
entrenador en la versión integrada. El recorrido de registro se comprueba en F09.

## C04a — Reproducir la renovación concurrente web

**Dependencias:** C00; independiente de C01–C03. **Tamaño:** S.
**Archivos:** pruebas junto a `apps/mobile/src/sesion.tsx` y al almacén seguro.

- [ ] Reproducir dos instancias con la misma sesión persistida y renovación a la
      vez, incluida una respuesta atrasada y el cierre de una pestaña.
- [ ] Añadir regresión que demuestre el fallo y describa el resultado correcto.
- [ ] Separar el caso de dos pestañas del de dos dispositivos con sesiones propias.

**Verificar:** prueba enfocada falla por la carrera esperada, no por configuración;
recorrido con dos pestañas y cuenta sintética. No reducir caducidad en producción.

## C04b — Corregir la coordinación entre pestañas

**Dependencias:** C04a. **Tamaño:** M, máximo cinco archivos por incremento.
**Archivos previstos:** `src/sesion.tsx`, `src/lib/almacen-seguro.ts`, coordinador
web y tests correspondientes. Si necesita más, dividir antes de implementar.

- [ ] Coordinar la renovación y adoptar la credencial vigente sin revocar una
      sesión válida ni dejar un bloqueo colgado cuando desaparece una pestaña.
- [ ] Propagar logout/cambio de cuenta sin mezclar identidades ni recuperar
      tokens antiguos; no relajar protecciones del servidor.
- [ ] Conservar edición local y regla de no repetir mutaciones inseguras al renovar;
      la rama nativa conserva su comportamiento.

**Verificar:** regresión C04a pasa, suite de sesión/transporte y prueba real con
dos pestañas. `npm run typecheck`; `npm run lint`.

### Checkpoint A — Pantallas y sesión

- [ ] C01–C04 y F08 verificados; `npm test`, typecheck y lint pasan.
- [ ] Revisión de David de las pantallas y evidencia web de la carrera corregida.

## C05 — Acordar y entregar la base común de la muestra de animación

**Dependencias:** F01, decisión de muestra validada. **Tamaño:** S para diseño;
la implementación se desglosa después en tareas de 1–5 archivos.
**Archivos de planificación:** adenda en `SPEC-catalogo-ejercicios.md` y
`tasks/iteracion-3/contratos-medios.md` (nuevo).

- [ ] Fijar con Fable formato, entrega privada, autorización, ausencia, identidad
      y versión del medio, caché y límites de licencia/offline. El estado ausente
      sigue admitido; no derivar la asociación por nombre aproximado del ejercicio.
- [ ] Publicar el cambio de contrato Zod (hoy `figura`/`video` son solo `null`),
      modelo/migración si procede y dependencia comprobada con documentación oficial.
      Separar esa base en incrementos pequeños, con comandos y criterios propios.
- [ ] Compartir el SHA verificado y ejemplos válidos/inválidos antes de F02.
      Si hacen falta objetos privados, Codex entrega también una prueba funcional
      del adaptador, sin contratar proveedor ni usar URLs públicas de fotos.

**Verificar:** revisión del contrato por ambos responsables; pruebas de esquema,
`npm run typecheck`, compilación API y migración aditiva en base de pruebas cuando
corresponda. No marcar la base entregada por haber escrito solo este documento.

## C06 — Trasladada a Fable F03b

La conexión de la figura con el registro la implementa el mismo responsable que
el catálogo de ejercicios: Fable, en F03b. No queda una tarea paralela de código
para Codex. La integración de su entrega se revisa en C07a.

### Checkpoint B — Primera animación integrada

- [ ] C05 y F02–F04, incluido F03b, completados con contenido autorizado y API real.
- [ ] Separar evidencia web/nativa; no llamar catálogo completo a una muestra.

## C07a — Integrar y actualizar la documentación de cierre

**Dependencias:** C04b y primera entrega F05 con F03b, F08 y F09.
**Tamaño:** M, cinco documentos. F10 se ejecuta después de esta integración.
**Archivos:** `README.md`, `SPEC.md`, `tasks/diseno-v2.md`,
`docs/PENDIENTE-PARA-PRODUCCION.md`, `tasks/iteracion-3/verificacion.md` (nuevo).

- [ ] Integrar entregas concretas, revisar contratos y retirar solo prototipos
      reemplazados sin usos; fixtures de tests siguen siendo de tests.
- [ ] Actualizar colores y pendientes a partir de evidencia, evitando arrastrar
      fallos antiguos ya corregidos o declarar nuevas funciones que no existen.
- [ ] Registrar SHA, comandos, resultados y límites; conservar datos demo.

**Verificar:** revisión del diff, suite completa, typecheck/lint y build API;
tests HTTP si cambiaron API/contratos, siempre sobre base de pruebas.

## C07b — Revisar la evidencia física entregada por Fable

**Dependencias:** C07a y F10. **Tamaño:** S, evidencia y listas anteriores.
**Archivos:** `tasks/iteracion-3/verificacion.md`, `tasks/entrenamiento/todo.md`,
`tasks/entrenamiento/verificacion.md`.

- [ ] Revisar el registro F10 de Android/iOS, su SHA, dispositivo, pasos y
      resultados contra los criterios pendientes de la iteración 2.
- [ ] Atender incidencias reproducidas de sesión/persistencia/API propias;
      Fable corrige sus pantallas y vuelve a verificar los casos afectados.
- [ ] Actualizar las listas anteriores solo con evidencia suficiente. Una
      plataforma sin probar conserva su pendiente y el guion preparado por Fable.

**Verificar:** trazabilidad de F10 a C04/C19 de la iteración 2. No duplicar la
ejecución de Fable salvo un fallo, cambio posterior o duda concreta que lo justifique.

### Checkpoint C — Cierre del entrenamiento

- [ ] Evidencia nativa real y revisión humana, o límites pendientes expresos.
- [ ] Puede avanzarse la definición de módulos sin ocultar una prueba pendiente.

## C08 — Especificar seguimiento corporal con David

**Dependencias:** reparto revisado; siguiente etapa después del cierre funcional.
**Tamaño:** S, especificación y decisiones, sin código.
**Archivos:** `SPEC-seguimiento-corporal.md` (nuevo), actualización del mapa.

- [ ] Conservar alcance ya acordado: peso, bioimpedancia manual, pliegues, medidas,
      fotos de evolución y foto de perfil; sin integración con báscula.
- [ ] Resolver quién introduce/corrige cada dato, unidades y lista exacta de
      campos, fechas/histórico, duplicados, acceso del nutricionista a fotos,
      comparaciones y requisitos offline. Lectura corporal de asignados ya está
      aprobada; no inferir de ella permiso de escritura o acceso a todas las fotos.
- [ ] Redactar spec con objetivo, comandos, estructura, estilo, pruebas, límites y
      criterios verificables. Mantener datos sintéticos y ADR 0005 para fotos privadas;
      presentar a David las decisiones antes de pasar al plan de implementación.

**Verificar:** trazabilidad al mapa/identidad, matriz por operación y casos de
cliente ajeno, baja y retirada de asignación. Revisión humana de la spec.

## C09 — Desglosar seguimiento y coordinar contratos de los dos módulos

**Dependencias:** C08 aprobado; la base de nutrición depende además de F06 aprobado.
**Tamaño:** S de planificación. No es una tarea gigante de implementación.
**Archivos:** `tasks/seguimiento-corporal/plan.md`, `todo.md` y documento común de
contratos de nutrición acordado con Fable (nuevos).

- [ ] Crear tareas S/M, con 1–5 archivos, aceptación y verificación; separar
      migraciones comunes y publicar cada base antes de que Fable la consuma.
- [ ] Orden propuesto a validar: una medición de extremo a extremo → histórico y
      corrección → resto de campos aprobados → una foto privada → evolución y avatar.
- [ ] Cada incremento termina en API y pantalla reales con permisos; almacenamiento
      de fotos reutiliza la base de medios si encaja, sin mezclar autorización de
      contenido del negocio con autorización sobre cuerpos de clientes.

**Verificar:** dependencias sin ciclos, revisiones de specs/planes registradas y
contratos compatibles. La ejecución posterior cumple la definición de terminado
de Agent Skills y añade revisión integrada con nutrición antes de darla por completa.
