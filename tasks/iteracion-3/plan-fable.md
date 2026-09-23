# Plan de Fable — ejercicios, entrenamiento, animaciones y nutrición

[Coordinación y límites](plan.md) · [Plan de Codex](plan-codex.md) · [Arranque](fable.md).
Fecha: 2026-09-23. Esta es tu lista de tareas de la iteración 3.
El trabajo de catálogo y editor de la iteración 2 ya está integrado.

## Objetivo

Asumir el catálogo de ejercicios y sus animaciones como un solo recorrido,
incluida la integración en el registro; terminar las vistas del entrenamiento,
revisar rutinas/asignación/resultados y comprobar el recorrido en dispositivo.
Después llevar nutrición de extremo a extremo. Codex termina los colores comunes,
acceso, perfil e inicio; corrige sesión, mantiene la infraestructura e implementa
seguimiento corporal. Trabajarás en una copia independiente y entregarás incrementos
comprobados. El catálogo y las rutinas existentes se conservan y se amplían o
corrigen: no se vuelven a construir desde cero.

Este reparto ampliado responde a la indicación de David: **más trabajo para Fable
y un único responsable para ejercicios y animaciones**. La antigua C06 pasa a
F03b, las cuatro vistas de C03 pasan a F08 y la ejecución física de C07b pasa a F10.

Skills de Agent Skills en `C:/Users/david/.claude/skills/`: empieza por
`using-agent-skills`; usa `source-driven-development` para medios/licencias y
dependencias; `incremental-implementation`, `frontend-ui-engineering`,
`test-driven-development` y `code-review-and-quality` para construir/verificar.
Para nutrición, primero `spec-driven-development` y `planning-and-task-breakdown`.

## Comandos de verificación

Desde la raíz de tu worktree, ajustando patrones a los tests realmente creados:

```powershell
npm run typecheck
npm run lint
npm run test --workspace apps/mobile -- --runInBand catalogo
npm run test --workspace apps/api -- --runInBand catalogo
npm run build --workspace apps/api
```

En checkpoints se ejecuta `npm test`. Si cambia API, ejecutar además
`npm run test:e2e --workspace apps/api -- --runInBand` con base propia o turno
acordado. No usar la base demo como base de tests ni migrarla por tu cuenta.

## F00 — Leer el encargo y registrar tu punto de partida

**Dependencias:** reparto revisado; C00 para editar en paralelo. **Tamaño:** S.
**Archivo:** `tasks/iteracion-3/entrega-fable.md` (nuevo, solo lo escribe Fable).

- [ ] Registrar tarea, rama, SHA y trabajo existente antes de tocar código.
- [ ] Leer este plan, coordinación y las secciones pertinentes de catálogo,
      identidad, investigación de animaciones y ADR 0005.
- [ ] Confirmar límites de archivos y necesidades de Codex; no retomar el encargo
      antiguo ni modificar tema, sesión, contratos, Prisma o lockfile.

**Verificar:** `git status --short`, `git rev-parse HEAD`, `git worktree list`;
resumen de lectura y dudas concretas en tu entrega.

Además del catálogo y nutrición, son tuyos `src/entrenamiento-entrenador/`, las
rutas `app/rutinas/` y `app/entrenador/`, y estas cuatro vistas de
`apps/mobile/src/entrenamiento/`: `agenda-semanal.tsx`, `tabla-series.tsx`,
`registro-cliente.tsx` y `resultado.tsx`. Los tests nuevos de esas vistas también.
El resto de lógica de registro/persistencia sigue siendo de Codex. Cambios fuera
de esa frontera se solicitan con reproducción/contrato, sin refactor cruzado.

## F01 — Evaluar una muestra gratuita y concretar su integración

**Dependencias:** F00; puede avanzar mientras Codex trabaja en colores.
**Tamaño:** S, documentación y muestra temporal.
**Archivos:** `docs/animaciones-ejercicios.md`, `tasks/iteracion-3/entrega-fable.md`.

- [ ] Partir de la investigación existente y verificar en fuentes oficiales los
      archivos y permisos concretos. David confirmó que esta iteración usa solo
      material gratuito. Evaluar RepDB Free sin asumir que sus imágenes estáticas
      equivalen por sí solas al movimiento que el cliente debe ver; no comprar.
- [ ] Proponer uno o dos ejercicios reales, mapeo inequívoco al catálogo, formato,
      tamaño y evidencia de licencia para app, distribución y uso offline. Registrar
      limitaciones; no confundir una preview pública con permiso de integración.
- [ ] Proponer a Codex el contrato y la entrega del medio; comprobar compatibilidad
      del reproductor candidato con Expo instalado usando documentación oficial.
      Presentar la decisión de muestra para validación antes de incorporarla.

**Verificar:** archivos y licencia inspeccionados, procedencia enlazada y decisión
revisable. Si no se acredita un permiso necesario, registrar el bloqueo y continuar
la preparación de nutrición; no sustituirlo por assets de origen incierto.

### Checkpoint de muestra

- [ ] F01 validado: contenido elegido, derechos y alcance concretados.
- [ ] C05 entregado con SHA, contrato y dependencias antes de F02–F03.

## F02 — Exponer la figura de un ejercicio real

**Dependencias:** C05 y decisión F01 validada. **Tamaño:** M, hasta cinco archivos.
**Archivos:** servicio/controlador de `apps/api/src/catalogo-ejercicios/`, servicio
de lectura de medios si lo requiere el contrato y tests unitarios/HTTP del catálogo.

- [ ] Asociar el medio autorizado al identificador real del ejercicio y devolver
      el contrato común; ejercicios sin medios y retirados siguen siendo legibles
      según las reglas existentes, sin alterar prescripciones históricas.
- [ ] Aplicar permisos del catálogo antes de emitir acceso al medio privado;
      nutricionista/empleado no heredan acceso por tener un token válido.
- [ ] Guardar origen/licencia conforme al modelo común. No añadir URLs arbitrarias,
      catálogo paralelo ni escritura de esquema fuera de la entrega de Codex.

**Verificar:** tests de presente/ausente/retirado y denegaciones por rol, build API,
typecheck y respuesta HTTP real. Si el alcance supera cinco archivos, dividir el
servicio y su integración en tareas enlazadas antes de empezar.

## F03 — Mostrar la animación en la ficha

**Dependencias:** F02. **Tamaño:** M, hasta cinco archivos.
**Archivos:** componente de medios y test en `apps/mobile/src/catalogo-ejercicios/`,
cliente API si cambia y `apps/mobile/app/catalogo/[id].tsx`.

- [ ] La ficha reproduce el medio recibido para ese ejercicio, con carga, error,
      ausencia y reintento; sin bloquear la información textual.
- [ ] Pausar al salir/ocultar y evitar audio o reproducción residual. Usar el tema
      común; sin botones de vídeo que aparenten tener contenido cuando no existe.
- [ ] Exportar el componente y reutilizarlo tú mismo en el registro mediante F03b;
      no duplicar reproductores, consultas ni la asociación entre ejercicio y figura.

**Verificar:** tests de estados/ciclo de vida, typecheck/lint; entrar y salir de
la ficha con API real y comprobar consumo desde el recorrido de F03b.

## F03b — Conectar la animación con el ejercicio del entrenamiento

**Dependencias:** F02–F03 y F08. **Tamaño:** M, hasta cinco archivos.
**Archivos:** `apps/mobile/src/entrenamiento/registro-cliente.tsx`, componente de
medios de Fable, cliente de lectura del catálogo si precisa adaptación y sus tests.

- [ ] Abrir la figura asociada al identificador real del ejercicio de la sesión;
      conservar los casos sin figura y los ejercicios retirados del histórico.
- [ ] Volver al registro conserva kg, repeticiones/segundos, marcas y notas;
      cerrar/ocultar la figura pausa la reproducción sin cambiar el estado del entreno.
- [ ] Un error, descarga pendiente o falta de red del medio no bloquea registrar
      ni enviar. La integración respeta las APIs de registro que mantiene Codex.

**Verificar:** regresiones de ida/vuelta y error del medio, typecheck/lint, recorrido
con API real; F04 comprueba la disponibilidad offline. Esta tarea sustituye C06.

## F04 — Comprobar disponibilidad sin conexión de la muestra

**Dependencias:** F03b y contrato offline de C05.
**Tamaño:** M, hasta cinco archivos propios de medios y tests.

- [ ] Si la licencia lo permite, la muestra previamente descargada se abre en modo
      avión tras cerrar/reabrir. Diferenciar caché eliminable de disponibilidad garantizada.
- [ ] Medio ausente, descarga interrumpida, versión nueva, falta de espacio y enlace
      caducado tienen salida recuperable; ningún fallo borra un borrador de entrenamiento.
- [ ] Respetar políticas de acceso y limpieza acordadas, sin meter vídeos dentro
      del JSON cifrado de series ni prometer todo el catálogo offline por probar dos clips.

**Verificar:** tests de caché/versiones y prueba de reapertura en dispositivo;
documentar aparte web, Android e iOS. Sin permiso offline, este criterio queda
pendiente de una alternativa validada, no se marca completado con un streaming.

### Checkpoint de animación integrada

- [ ] F02–F04, incluido F03b, funcionan con API real; pruebas y permisos pasan.
- [ ] Demostración revisada y limitaciones de muestra/plataforma registradas.

## F05 — Entregar e inspeccionar el resultado integrado

**Dependencias:** F02–F04, F08 y F09 para la primera entrega; F10 para añadir
evidencia nativa. **Tamaño:** S. No esperar a F10 para entregar código a C07a.
**Archivo:** `tasks/iteracion-3/entrega-fable.md`; correcciones concretas en sus archivos.

- [ ] Entregar commits pequeños con comandos/resultados y archivos, sin cambios
      comunes ni datos demo inventados dentro de componentes.
- [ ] Volver a comprobar en el SHA integrado: catálogo → figura → entrenamiento,
      ausencia, vuelta atrás y guardado; avisar si la integración cambia el resultado.
- [ ] No dejar componentes sin conectar o helpers provisionales sin uso. Si hay
      defectos, enumerarlos con reproducción y corregirlos antes del cierre.

**Verificar:** revisión de diff, `npm test`, typecheck/lint; coordinación con C07.
Una entrega pendiente de integración no se declara terminada en la app.

## F08 — Terminar el diseño de las vistas de entrenamiento

**Dependencias:** C01 entregado; puede hacerse mientras se prepara la base C05.
**Tamaño:** M, cuatro vistas. Se conservan los identificadores anteriores de tareas;
el orden de ejecución es por dependencias, no por número.
**Archivos:** `apps/mobile/src/entrenamiento/agenda-semanal.tsx`, `tabla-series.tsx`,
`registro-cliente.tsx`, `resultado.tsx`.

- [ ] Aplicar los tokens comunes y contrastar el ZIP nuevo: fotografía en color,
      CTA dorado, día seleccionado según referencia, series verdes y objetivos tenues.
      No volver a la versión monocroma ni convertir todos los elementos en dorados.
- [ ] Mantener tipos de medición, valores vacíos, edición y marcado; los datos de
      semana, fecha y resultados siguen viniendo de API, sin estadísticas inventadas.
- [ ] Verificar legibilidad y acciones a 320/390/768/1440 px, con teclado y contenido
      largo. Pedir a Codex ajustes de tokens/componentes comunes si son necesarios.

**Verificar:** comparación visual con `Theme files review (1).zip`, tests móviles
existentes afectados, typecheck/lint; no añadir tests que solo repitan los colores.
Guardar/reabrir un borrador sintético y consultar un resultado ya enviado.

## F09 — Revisar ejercicios, rutinas y resultados de extremo a extremo

**Dependencias:** F08 y funcionalidades ya integradas de la iteración 2. La parte
de animación se añade tras F03b. **Tamaño:** S de comprobación; correcciones separadas.
**Archivo:** `tasks/iteracion-3/pruebas-entrenamiento-fable.md` (nuevo).

- [ ] Crear/buscar/editar/retirar/reponer un ejercicio de prueba; reutilizar una
      rutina, adaptarla y asignar varias semanas sin alterar otros clientes ni
      históricos. Revisar selector, editor y resultados del entrenador.
- [ ] Cliente mueve el día y registra una serie; el entrenador ve el cambio de
      fecha pero no el borrador. Tras enviar, ve exactamente el resultado publicado;
      funcionan repeticiones y tiempo, errores, vacíos y reintentos.
- [ ] Registrar fallos con pasos y dueño. Corregir los de catálogo/vistas propias
      en tareas de 1–5 archivos y con regresión cuando cambie comportamiento;
      trasladar a Codex problemas de servicios de entrenamiento, sesión o persistencia.

**Verificar:** recorrido con API real y cuentas sintéticas; pruebas enfocadas de
cada fallo y repetición del caso tras integrar. No añadir funciones nuevas ni
reescribir un editor que ya funciona. No enviar o borrar entrenos del usuario.

### Checkpoint de pantallas y ejercicios

- [ ] F08 contrastado visualmente y F09 trazado a comprobaciones reproducibles.
- [ ] Defectos resueltos o pendientes concretos, sin componentes sin uso.

## F10 — Comprobar entrenamiento en Android e iOS

**Dependencias:** primera entrega F05 integrada por C07a. **Tamaño:** S de
comprobación; arreglos separados por responsable.
**Archivos:** `pruebas-entrenamiento-fable.md` y `entrega-fable.md` en esta carpeta.

- [ ] En cada plataforma: asignar, cambiar día, registrar kg/reps/segundos, activar
      modo avión, cerrar/reabrir, recuperar borrador y enviar una sola vez al volver
      la red. Verificar figura y regreso al registro según F04.
- [ ] Probar borrador grande, cambio de cuenta, limpieza y privacidad antes del
      envío; comprobar con entrenador la fecha y las series finalmente enviadas.
- [ ] Registrar SHA, dispositivo, versión, pasos y resultado por plataforma. Si
      falta un dispositivo, preparar el guion para David y dejarlo pendiente;
      no sustituirlo por una prueba web ni afirmar que Codex lo verificó.

**Verificar:** observación física de cada caso; Fable ejecuta/corrige su ámbito y
Codex revisa la evidencia en C07b para cerrar las casillas antiguas correspondientes.
La falta de un móvil no impide preparar la spec de nutrición.

## F06 — Especificar nutrición con David

**Dependencias:** reparto revisado; siguiente etapa después del cierre funcional.
Puede prepararse documentación mientras se espera una prueba física o licencia.
**Tamaño:** S, especificación sin código.
**Archivos:** `SPEC-nutricion.md` (nuevo) y registro de decisiones en tu entrega.

- [ ] Conservar permisos aprobados: cliente solo lee su dieta; entrenador edita;
      nutricionista solo edita clientes asignados y activos; empleado no accede.
      El cliente no registra comidas.
- [ ] Resolver con David organización por día/semana o plan vigente, comidas y
      cantidades/unidades, origen de alimentos/macros, cálculo o entrada manual,
      edición/publicación/histórico, reutilización, notas y necesidad offline.
      No asumir base de alimentos externa, generador de dietas ni cálculo clínico.
- [ ] Redactar objetivo, comandos, estructura, estilo, pruebas, límites y criterios
      medibles; ejemplos sintéticos y matriz por operación. Obtener validación de
      la spec antes de pasar al plan técnico.

**Verificar:** dieta de cliente A nunca visible/editable por cliente B; retirada
de asignación/baja corta el acceso profesional; límites de edición y datos
definidos. Revisión humana de la spec; no basta la aprobación genérica del módulo.

## F07 — Planificar y entregar nutrición por recorridos completos

**Dependencias:** F06 aprobado y contratos comunes coordinados con Codex C09.
**Tamaño:** S de planificación; implementación posterior se divide en S/M.
**Archivos:** `tasks/nutricion/plan.md`, `todo.md` (nuevos), propuesta de contratos
en tu entrega. No editar Prisma ni `packages/shared` directamente.

- [ ] Desglosar tareas con 1–5 archivos, dependencias y pruebas; cada tramo necesita
      un SHA de contratos/migración de Codex antes de construir sus consumidores.
- [ ] Orden propuesto a validar: profesional prepara una dieta mínima → cliente
      la consulta → edición y estado/histórico aprobados → cantidades/macros/notas →
      reutilización u offline solo si quedaron incluidos en la spec.
- [ ] Implementar después API y UI propias, con datos reales del servidor y permisos
      negativos, incluyendo conflictos/reintentos según contrato; Codex conecta los
      accesos en inicio, ficha de cliente y lista del nutricionista.

**Verificar:** cada recorrido con dos clientes y roles distintos; corrección de
una dieta no afecta a otra por compartir plantilla. Revisión del plan y tareas
antes de código; revisión integrada con seguimiento al cerrar el módulo.

## Formato obligatorio de entrega a Codex

En `entrega-fable.md`: tarea/estado, rama/SHA base, commits, archivos, contrato
necesitado, comandos y resultados, pasos manuales/plataforma, pendientes y
siguiente tarea. Nunca secretos ni tokens. No marcar tareas de Codex como hechas.
