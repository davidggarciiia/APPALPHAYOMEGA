# Informe de la noche — 28-10-2026

## Actualización 30-10: remates, demo con David García y perfil de entrenador

Mismo reparto (Codex `gpt-6.1-sol` implementa; esta sesión revisa, verifica y commitea). Ciclo de agent skills para el entrenador: [SPEC-entrenador.md](../SPEC-entrenador.md) → [plan](plan-entrenador.md) → tareas → puntos de control con vídeo → revisión final.

| Commit                        | Qué                                                                                                                                       |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `bf15ed4`                     | D7 · enlaces centrados, web sin destello blanco, mover sesión de día (E-06/E-07) y comida con reintento (N-07)                            |
| `34bf996`                     | D8 · panel del entrenador, transiciones de marca, listas animadas, récord personal, novedades compactas, fuera la pestaña Molestias       |
| `060eeae`                     | D10 · prescripción por semana: fases con ajustes (estímulo, descarga, vuelta) que cambian series, cargas y RIR al asignar                 |
| `1676129`                     | D11 · grasa por pliegues (Jackson-Pollock 3/7, Durnin-Womersley, Faulkner), valoración inicial al crear cliente y vídeo lento de arranque |
| `a73dad6` `daf0f0b`           | D12/D13 · la intro solo en frío, sin botones anidados, kg opcional fuera de la parte principal                                            |
| `ad5abef`                     | D14 · tabla de series y recorrido Α→Ω sin saltos ni recortes                                                                              |
| `6d9c24d`                     | D15 · Inicio sin fotos, avisos en Notificaciones (campana con contador), nombre y apellidos                                               |
| `ef30d32` `f060efb`           | E1/E2 · reglas de progresión compartidas; el cliente recibe «Sube carga la próxima vez»; progreso por ejercicio en la ficha               |
| `a374e04` `c70acea` `963422b` | E3/E4/E4b/E5 · resumen semanal de cargas (API agregada, 153 ms con 15 clientes) en el Inicio; cartera con filtros y búsqueda              |
| `95cc0b4`                     | E6 · «Datos del cliente» desde la ficha; migración aditiva `sexo` opcional (solo bases de pruebas y demo)                                 |
| `f992b68`                     | F · ficha del cliente rediseñada en Claude Design; una sola regla de progresión en toda la app                                            |
| `1a79c9c`                     | G · fuera el flujo de revisar cada entrenamiento (decisión del dueño)                                                                     |
| `6bc5385`                     | H · barra del bloque, búsqueda sin tildes, demo coherente y revisión final de toda la rama                                                |

**Verificado:** 44 pruebas del paquete compartido, 1576 del móvil, 509 de la API y 544 e2e contra `alpha_omega_e2e_codex`, typecheck y lint. Vídeos y capturas a 390 px de cliente y entrenador con la cuenta de demo `demo-david@manual-20261027.test` (script idempotente `build/manual-20261027/perfil-demo.mjs`).

**Decisiones del dueño:** el entrenador solo prescribe el RIR y observa (Progresa / Estancado / Baja); el cliente sube la carga. Sin check-in ni cuestionario. Sin revisión de cada entreno. Sin fotos en Inicio. Novedades en la campana.

**Antes de usar la base real `alpha_omega`:** aplicar la migración nueva (`npx prisma migrate deploy` desde `apps/api`).

**No verificado / pendiente:** móvil real (teclado, hápticos, lectores, 60 fps); CI en GitHub (sin push); «+ Serie» y «anterior» por serie (amplían la API); vectorizar el emblema; búsqueda sin tildes en memoria (si la base de usuarios crece, pasar a `unaccent`); decisiones de borrado a petición y login con Google; Codex deja procesos auxiliares abiertos tras cada tarea (se cerraron a mano).

## Actualización 29-10: rediseño móvil y control de cargas

Reparto: diseño en Claude Design ([Design](https://claude.ai/artifact/4kQQfzvt4R7qkkAQQciNPq), traducido a [ESPEC.md](diseno-movil/ESPEC.md)); implementación y revisión con Codex `gpt-6.1-sol` por el plugin, una tarea cada vez; cada tarea revisada (diff, pruebas borradas y sus sustitutas, supresiones), verificada y commiteada aquí. Codex no puede escribir en `.git` desde su sandbox, por eso los commits son de esta sesión.

| Commit    | Qué                                                                                                                                                                       |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `c5dc8f1` | Registro de cargas: el reloj no repinta la tabla, sin escrituras cifradas inútiles, deslizador con scroll, descansos bien leídos, kg con coma, tope de 4 h por tramo      |
| `4ca266c` | Semana del cliente: copia local primero, sin parpadeos ni sesiones duplicadas por doble toque                                                                             |
| `ae9e518` | Constructor: errores de carga al escribir y al publicar con el campo exacto, «Deshacer» al quitar ejercicio/fase/deporte, «Publicar» al pie, buscador sin parpadeo        |
| `cc59191` | Entrenador y nutrición: ficha que se refresca, «Ver sesión» de la molestia, revisar desde la ficha, suplementos sin red, confirmar al publicar valoración                 |
| `8de148c` | D1 · tokens, componentes y movimiento de marca (revelado con el ángulo del corte, destello de oro, marcador, recorrido Α→Ω, trazo del logo), todo con movimiento reducido |
| `d0ad9bc` | D2 · sesión con todas las series por ejercicio, descanso en franja, sin check-in ni cuestionario: empezar y terminar en un toque                                          |
| `6ad4a2f` | D3 · Acceso, Hoy, Plan, Nutrición, Progreso y Perfil limpios, con esqueletos de carga                                                                                     |
| `42d0ef8` | D4 · entrenador: Inicio, Cartera, Ficha, Revisión (prescrito frente a hecho por serie) y Perfil                                                                           |
| `ff2011c` | D5 · constructor del plan cómodo a 390 px: celdas táctiles, hojas de ajuste, acciones fijas                                                                               |
| `b90cbe0` | D6 · revisión crítica de toda la rama: 14 regresiones corregidas con su prueba (permisos, fichas mezcladas, navegación doble, duración, progresión prematura…)            |

**Verificado:** 1224 pruebas del móvil (126 suites) y 390 de la API (43 suites) en verde, typecheck y lint. Captura a 390 px de la pantalla de acceso, correcta.

**No verificado:** el resto de capturas y las e2e de la API (Docker Desktop no arranca el motor: tiene una actualización pendiente que debes aceptar tú); nada en un móvil real (teclado nativo, hápticos, lectores de pantalla, 60 fps).

**Decisiones del dueño aplicadas:** sin check-in ni cuestionario de cierre; «+ Serie» queda para después de la demo (amplía el contrato); el trazo del logo usa el vídeo hasta vectorizar el emblema.

**Pendiente:** «+ Serie» y «anterior» por serie (necesitan ampliar la API); vectorizar el emblema; E-06/E-07 (mover sesión de día) y N-07; detalles vistos en captura (subrayado corto de «He olvidado mi contraseña», destello blanco al cargar la web); antes de producción: CI en GitHub, prueba en dispositivo y las decisiones de borrado a petición y login con Google.

Rama de trabajo: `mejoras/base-2026-10-28` (solo commits locales; **ningún push ni despliegue**). Base de la rama: `codex/cliente-intuitivo`. La base `alpha_omega` no se ha tocado.

## Qué se hizo

### 1. Auditorías (solo lectura) — 126 hallazgos, ningún P0

- [flujos-entrenamiento.md](auditoria-noche-2026-10-28/flujos-entrenamiento.md): 71 hallazgos (cliente, entrenador, API, rendimiento, animación) con archivo, línea, causa y arreglo mínimo.
- [flujos-nutricion-seguimiento-acceso.md](auditoria-noche-2026-10-28/flujos-nutricion-seguimiento-acceso.md): 55 hallazgos (acceso, nutrición, seguimiento, fotos, catálogo).
- Cada informe termina con un top 10 en conjuntos de archivos disjuntos para repartir el trabajo.
- El informe de **rendimiento** y el de **skills y plugins** quedaron **parciales** (los agentes chocaron con el límite de uso): ver «Pendiente».

### 2. Correcciones aplicadas (cada una con prueba que falla antes y pasa después)

| ID de la auditoría | Qué arreglaba                                                                                                                                                                                                               | Commit    |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| A-01…A-05, A-07    | La puerta de consentimiento se abría ante cualquier error (500, sesión caducada); pantalla sin zona segura ni indicador; «Go» del teclado enviaba dos veces; activar cuenta no confirmaba el éxito ni dejaba salida         | `81e80b0` |
| N-01, S-02, T-17   | El teclado tapaba el campo y «Guardar» al apuntar peso, pasos, sueño, cintura o responder una molestia                                                                                                                      | `391be7c` |
| T-15               | La respuesta escrita para una molestia aparecía ya puesta en la siguiente (indicación de salud al cliente equivocado)                                                                                                       | `96244ed` |
| E-02               | «Hecha» sin peso no hacía nada visible: el aviso salía al pie, fuera de la vista                                                                                                                                            | `e1c324b` |
| E-01               | «Terminar» solo estaba en la cabecera; ahora hay «Terminar entreno» al pie al acabar la última serie                                                                                                                        | `d0faf4c` |
| S-01               | Salir de Progreso con una foto sin confirmar la perdía en silencio                                                                                                                                                          | `5bff1d0` |
| T-01               | El constructor de planes no autoguardaba: 10–30 min de trabajo perdidos si Android mataba el proceso                                                                                                                        | `d22ad0b` |
| T-02               | Elegir una plantilla machacaba el plan montado sin preguntar                                                                                                                                                                | `a471635` |
| N-02               | El editor de dieta solo guardaba al pulsar «Guardar borrador» (al final del formulario): cerrar la app o perder la red costaba todo lo escrito. Ahora autoguarda a los 2,5 s, en silencio y con un solo intento por edición | `892ed88` |
| T-04 (parcial)     | «Quitar día» borraba todos los ejercicios del día de un toque; ahora pregunta. Quitar un ejercicio, una fase o un deporte sigue sin confirmar                                                                               | `45d7604` |
| P-01               | Un 409 por falta de consentimiento se mostraba como «hay otra versión de esta sesión» con un botón que no arreglaba nada                                                                                                    | `0428926` |
| Capturas           | Botones del plan que se salían por la derecha en móvil (y aplastaban el título en escritorio), huecos en Fases y Otros deportes, estado vacío de Nutrición, enlaces de acceso con el botón nuevo                            | `7325b15` |
| N-03               | Inicio vaciaba la tarjeta de Hoy cada vez que recuperaba el foco y la rellenaba después (parpadeo en el caso más frecuente); ahora recarga en silencio                                                                      | `30c8419` |
| Enlaces            | VOLVER, CANCELAR y CORREGIR CORREO de Mis clientes, Nutricionista, Nuevo cliente y la ficha del cliente usan ya el botón de enlace nuevo                                                                                    | `455e8df` |

También: **pantalla de carga con el vídeo del logo** (agente, integrada tras revisar su código), CI de GitHub, plazos de PostgreSQL y correo, cobertura del 80 % ejecutable, guarda de E2E, pruebas de acceso, y exclusión de los worktrees de agentes de Git, Prettier y ESLint.

### 3. Pantalla de carga con el vídeo — decisión del agente que debes validar

- Se usó `logo-rapido-x3.mp4` (1,2 s) como pediste, **pero no tal cual**: el original (780×1688) lleva un marco redondeado gris y su fondo es `#0A0A0A`, no el `#0E0D0B` de la app. El agente lo recodificó a un **recorte cuadrado de 770×770 centrado en el logo**, con el negro llevado al fondo de la app, para que no se vea un rectángulo sobre el fondo. Tu archivo original **no se tocó**. Si prefieres el vídeo entero, se cambia en `apps/mobile/assets/video/` y en el componente.
- Splash nativo: imagen estática del logo (plugin `expo-splash-screen`). **En Expo Go no se ve** (Expo Go usa su propio splash); solo se ve en una build propia.
- Comportamiento: se cierra con fundido cuando fuentes, sesión y vídeo han terminado; se salta tocando; con «reducir movimiento» no reproduce el vídeo; tope duro de 1,5 s para no bloquear nunca la app.

## Verificación

- Antes de los cambios de la noche: 390 pruebas de API, 733 del móvil, 512 E2E; cobertura fusionada 96,06 % líneas / 86,56 % ramas.
- Última verificación completa (tras integrar carga y botones y la ronda de capturas): **tipos y lint en verde y 819 pruebas del móvil en 93 suites** (390 de API sin cambios). No se han vuelto a ejecutar los E2E ni la CI tras los cambios de la noche en el móvil: no tocan la API.
- **No se ha ejecutado la CI en GitHub.** La simulación local sin `.env` da 512/512 E2E.

## Lo que NO está comprobado

- **Nada se ha visto en un móvil.** Háptica, animaciones nativas, teclado en Android/iOS y rendimiento nativo solo se prueban en dispositivo (Expo Go).
- El aviso de `Image` de `react-native-web` se corrigió en el código pero no se volvió a mirar en la consola de un navegador.
- Las auditorías son **estáticas**: se leyó el código, no se ejecutó la app con datos reales. Cada hallazgo indica si es CONFIRMADO (leído) o SOSPECHADO.

## Pendiente (en orden de prioridad)

1. **Migrar el resto de botones sueltos**: quedan unos 40 `Pressable` (muchos son tarjetas, chips o filas que no deben cambiar; los enlaces de acceso, plan, ficha y listados ya están migrados) y decidir dónde usar «mantener para confirmar» en los destructivos.
2. **Resto de P1/P2 de las auditorías** (ver los dos informes): confirmar también al quitar un ejercicio, una fase o un deporte (T-04), parpadeo al recargar Nutrición (N-06; el de Inicio, N-03, ya está corregido), copia sin conexión en nutrición (N-04, N-05), sondeos de 5 s con escritura cifrada (E-04, E-05), pestañas con `router.replace` y rutas públicas con sesión (A-06, A-12).
3. **Ruido en consola:** un `AbortError` de `play()` aparece de vez en cuando en la intro del vídeo en web; es una carrera benigna, no está corregida.
4. **Rendimiento:** informe parcial; faltan las medidas de arranque, bundle y endpoints.
5. **Skills y plugins:** informe parcial; no se instaló nada de terceros esta noche.
6. **Decisiones tuyas de antes:** borrado a petición (A o B), login con Google, dos políticas de acceso.

## Cómo probarlo en tu móvil (Expo Go)

```bash
npm run db:up
npm run dev --workspace apps/api
npm run dev --workspace apps/mobile
```

Después escanea el QR con Expo Go. La dirección de la API se deduce sola del servidor de Metro. Necesitas el usuario del seed (`SEED_ENTRENADOR_EMAIL` de tu `.env`).
