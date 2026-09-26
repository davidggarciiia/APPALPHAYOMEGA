# Tareas — panel del entrenador

> [Plan](plan.md) · [Diseño](../../docs/diseno/panel-entrenador.md) ·
> [Prototipo](../../docs/diseno/prototipo-entrenador.html).
> Rama de trabajo: sale de `dev`; cada fase se entrega con un PR contra `dev`.

## Regla de ejecución

Una tarea cada vez, de cinco archivos como máximo; si crece, se divide antes de
empezar. Antes de cada commit: `npm run lint`, `npm run typecheck` y `npm test`;
si toca la API, también `npm run test:e2e` con la base levantada. Cada ruta
nueva lleva pruebas de denegación para cliente ajeno, nutricionista, empleado y
petición sin sesión. Cada checkpoint se presenta a David con evidencia antes de
seguir.

## Fase 0 — Rama `dev`

- [x] **P00.** Crear `dev` desde `claude/sleepy-goodall-go7nzc` y fusionar
      `claude/modest-knuth-ezk1cv`. Lockfile regenerado, doble de
      `useReducedMotion` en Jest. Verde sobre `npm ci`: lint, typecheck, 78
      unitarios de API, 46 de la app y 264 e2e.

## Fase 1 — Diseño y specs

- [x] **P01.** Documento de diseño, prototipo, enmiendas de `SPEC-entrenamiento`
      y `SPEC-catalogo-ejercicios`, borrador de `SPEC-nutricion`, decisiones en
      la intención, mapa de capacidades y este plan.

### Checkpoint A

- [ ] David revisa el prototipo y responde las preguntas abiertas de las
      enmiendas. Con el prototipo aprobado empiezan las fases 2 y 3; con las
      enmiendas aprobadas, la 4 y la 5.

## Fase 2 — Sistema visual y navegación

- [ ] **P02. Tokens y fuentes.** `src/tema.ts` con los tokens de Claude Design;
      Anton y Archivo cargadas en `app/_layout.tsx` sin parpadeo; dependencias en
      `package.json` y lockfile. _Verificar:_ typecheck, tests y la app en web.
- [ ] **P03. Botón dorado, tarjeta, chip y pestañas.** En `src/componentes/`,
      con el degradado probado en web y nativo, pestañas con sus roles y
      zonas de 44 puntos. _Verificar:_ spec de componentes que comprueba roles y
      estado seleccionado.
- [ ] **P04. Tabla de series y selector de semana.** `TablaSeries` con cabeceras
      reales; `SelectorSemana` sale de `entrenamiento-cliente/semana.tsx`;
      `formatearNumero` pasa a `src/lib/`. _Verificar:_ tests de la semana del
      cliente siguen verdes.
- [ ] **P05. Navegación adaptable.** `app/(entrenador)/_layout.tsx` con pestañas
      abajo y lateral desde 1024 px, `hoy.tsx` y `mas.tsx` de partida, lista de
      secciones en `src/navegacion/`. _Verificar:_ spec que cambia el ancho y
      comprueba la posición; capturas a 390 y 1440 px.
- [ ] **P06. Mover la cartera y la ficha al grupo.** `clientes/index`,
      `clientes/[id]`, `clientes/nuevo`, con sus rutas internas corregidas.
      _Verificar:_ alta, edición, baja y reactivación siguen funcionando en web.
- [ ] **P07. Entrada por rol.** El `Enrutador` manda al entrenador a `/hoy`;
      nutricionistas y perfil dentro del grupo; `app.json` admite tablet.
      _Verificar:_ los cuatro roles aterrizan donde toca.
- [ ] **P08. Estilo nuevo en las pantallas existentes.** Componentes de
      formulario, cabecera e insignias primero; después login, activar,
      recuperar, restablecer y perfil; al final las del cliente. Se divide en
      tres tareas al empezarla. _Verificar:_ capturas antes y después.

### Checkpoint B

- [ ] Navegación y estilo en web a 390 y 1440 px y en Expo Go.

## Fase 3 — Pantallas del entrenador sobre la API existente

- [ ] **P09. Detalle de un plan.** `GET /entrenamiento/planes/:id` devuelve su
      patrón. _Archivos:_ contrato, `planes.service.ts`, controlador, e2e.
- [ ] **P10. Archivar rutinas.** Campo `archivadaEn` con migración aditiva,
      filtro en el listado y operación de archivar. _Verificar:_ e2e, incluido
      que archivar no toca los planes que salieron de ella.
- [ ] **P11. Panel sin bajas.** El panel excluye por defecto a los clientes dados
      de baja. _Verificar:_ e2e.
- [ ] **P12. Cliente HTTP del entrenador y sondeo.** `src/entrenamiento-entrenador/api.ts`
      y `useSondeo` (solo con pantalla visible y app activa, se limpia al salir o
      cambiar de cuenta). _Verificar:_ spec con temporizadores falsos.
- [ ] **P13. Hoy.** Semana de todos los clientes agrupada, sesiones de hoy y
      enviadas recientes. _Verificar:_ spec; en web, un envío del cliente aparece
      en menos de 10 s.
- [ ] **P14. Ficha: pestañas y Resumen.** La ficha de cuenta actual pasa a ser
      la pestaña Resumen; la pestaña va en la URL.
- [ ] **P15. Ficha: Sesiones.** Semana, resultado previsto frente a hecho,
      cambiar día y anular una sesión sin empezar.
- [ ] **P16. Ficha: Plan de entrenamiento.** Planes asignados, anular lo no
      empezado y guardar como rutina.
- [ ] **P17. Ejercicios: lista y búsqueda.** Filtros por grupo y estado.
- [ ] **P18. Ejercicios: ficha, alta, edición, retirar y reponer.**
- [ ] **P19. Constructor: modelo del editor.** Estado del patrón y operaciones
      puras (añadir, ordenar, duplicar, quitar), con tests.
- [ ] **P20. Constructor: vista Día.** Tabla, panel del ejercicio y selector del
      catálogo.
- [ ] **P21. Constructor: vista Semana y varios días.**
- [ ] **P22. Asignar.** Vista previa con `fechasDelPlan`, aviso de coincidencias
      y confirmación con el mismo id de operación en los reintentos.
- [ ] **P23. Rutinas.** Biblioteca: listar, abrir, editar con revisión, usar
      para un cliente y archivar.
- [ ] **P24. Ajustar una sesión sin empezar.** `/sesiones/[id]` con el editor del
      día y el conflicto `sesion_iniciada` resuelto sin afirmar que se guardó.

### Checkpoint C

- [ ] Recorrido con API real en web a 390 y 1440 px: crear un ejercicio, montar
      un plan de dos días, asignarlo dos semanas, enviar desde el cliente y verlo
      en Hoy y en la ficha. Capturas y resultado de las suites.

## Fase 4 — Prescripción rica, fases, progresión y guía

Requiere el checkpoint A.

- [ ] **P25. Contratos de la prescripción rica.** Rangos, RIR, distancia,
      secciones, circuito, cardio, unilateral, recorte, alternativas, dosis y
      nota; RIR en el registro. _Verificar:_ un documento antiguo sigue
      validando; los campos incompatibles se rechazan.
- [ ] **P26. La API acepta y devuelve la prescripción rica.** Planes, ajustes,
      borradores, envíos y resultado. _Verificar:_ e2e.
- [ ] **P27. Catálogo ampliado.** Tipo, medición, «Evita», «Para si», carga,
      alternativas y grupos nuevos, con migración aditiva.
- [ ] **P28. Bloque con fases y deporte.** Objetivos, indicaciones, fases que se
      aplican a cada semana al asignar, deporte y NEAT.
- [ ] **P29. Registro de deporte.** Tabla, operación del cliente idempotente y
      lectura del entrenador.
- [ ] **P30. Progresión sugerida.** Servicio puro con la tabla del spec, origen
      de la carga (`inicial` o `fijada`) y exposición al cliente y al entrenador.
- [ ] **P31. Señales de ajuste y «Aplicar a la semana».** Propuesta, confirmación
      con revisión, sin tocar sesiones empezadas.
- [ ] **P32. Guía y reglas.** Versión general, sustitución por plan, umbrales del
      check-in, pantalla del entrenador y lectura del cliente.
- [ ] **P33. Notas de salud.**
- [ ] **P34. Constructor con la prescripción rica.** Secciones, rangos, fases,
      semana calculada y deporte.
- [ ] **P35. Registro del cliente con la prescripción rica.** Rango, RIR,
      distancia, calentamiento marcable, circuito por vueltas, cardio y deporte.
- [ ] **P36. Resultado con «Sugerido» y «Próxima vez», y señales en Hoy y en la
      ficha.**

## Fase 5 — Check-in, molestias, cierre, nutrición y PDF

Requiere el checkpoint A.

- [ ] **P37. Contratos y tablas de check-in y molestias; cierre en el envío.**
- [ ] **P38. API de check-in y molestias.** Operaciones del cliente idempotentes,
      bandeja y «vista» del entrenador. _Verificar:_ e2e de privacidad: el
      entrenador ve el check-in y las molestias, nunca los valores del borrador.
- [ ] **P39. Cola sin conexión de avisos en el cliente.**
- [ ] **P40. Check-in completo en el cliente**, con la recomendación calculada en
      el teléfono.
- [ ] **P41. Hoja de molestia y cierre en el cliente.**
- [ ] **P42. «Requiere tu atención» y pestaña Check-ins y molestias.**
- [ ] **P43. Pauta nutricional: API.** Módulo `nutricion`, versiones y publicar.
- [ ] **P44. Pauta nutricional: ficha del entrenador y lectura del cliente.**
- [ ] **P45. Exportar a PDF.** Propone `expo-print` y pide aprobación de la
      dependencia al empezar.

### Checkpoint D

- [ ] Recorrido completo: bloque con fases, asignar, check-in, series con RIR,
      molestia en directo, cierre, sugerencia y señal en el panel, pauta y PDF.

## Fase 6 — Horarios y reservas

- [ ] Ejecutar [tasks/horarios/todo.md](../horarios/todo.md) (H05–H17) después de
      que David revise sus specs (H00). Las pestañas de H09 son las de la
      navegación de la fase 2: Agenda, Cobros, Boxeo y Ajustes.

## Fase 7 — Módulos sin spec

- [ ] `seguimiento-corporal` (pestaña Progreso), nutrición del nutricionista,
      `leads` y `fichajes`, en ese orden. Cada uno: entrevista, spec, plan y
      tareas con aprobación de David antes de programar.

## Registro de entregas

| Fecha      | Tarea | Commit o PR                  |
| ---------- | ----- | ---------------------------- |
| 2026-09-26 | P00   | `e160da7` en `dev`           |
| 2026-09-26 | P01   | PR de la fase 1 contra `dev` |
