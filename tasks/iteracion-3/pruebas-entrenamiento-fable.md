# Pruebas de entrenamiento y animaciones — Fable, iteración 3

Rama `codex/fable-iteracion-3`, rebasada sobre `codex/entrenamiento-iteracion-2`
(`bb0af41`). Base de datos propia `alpha_omega_fable_i3`; API del worktree en el
puerto 3101 (la 3100 seguía con un build anterior); 52 figuras importadas en un
`MEDIOS_DIR` privado fuera del repositorio. Fecha: 2026-09-24.

Qué acredita este documento y qué no:

- **Sí:** el comportamiento de la API real por HTTP con cuentas sintéticas, las
  pruebas automáticas y que los bundles web y Android compilan.
- **No:** ninguna pantalla vista en un navegador ni en un móvil. Para eso hay que
  iniciar sesión en la app, y Fable no escribe contraseñas en formularios. Esa
  parte queda como guion para David (abajo). Una prueba web no acredita un
  recorrido nativo.

## F09 — Recorrido con API real

Reproducible con `tasks/iteracion-3/recorrido-f09.mjs` (instrucciones en su
cabecera). Crea tres cuentas sintéticas y ejercicios con prefijo propio, y al
final borra solo eso. Resultado del 2026-09-24 contra el puerto 3101:
**29 de 29 pasos correctos, 0 cuentas sintéticas restantes**.

| Paso                                                                              | Resultado |
| --------------------------------------------------------------------------------- | --------- |
| Catálogo: crear, rechazar nombre repetido (409 `nombre_duplicado`)                | OK        |
| Catálogo: el cliente busca; editar la ficha; asignar figura `vital-0054`          | OK        |
| Catálogo: retirar oculta al cliente (y pedir retirados le da 403); reponer        | OK        |
| Rutinas: guardar, buscar; el cliente no las ve (403)                              | OK        |
| Plan: 2 semanas a Ana, 1 a Bruno; repetir la operación no duplica                 | OK        |
| Adaptar la rutina guardada no altera las sesiones ya asignadas                    | OK        |
| Ajustar la prescripción de Ana no cambia la de Bruno                              | OK        |
| Agenda: Ana mueve el día; el entrenador ve la fecha y quién la cambió             | OK        |
| Agenda: Bruno no ve la sesión de Ana (404)                                        | OK        |
| Registro: borrador privado; el entrenador no lo ve ni hay resultado               | OK        |
| Registro: enviar sin series hechas (400) o cambiando la unidad (400)              | OK        |
| Registro: enviar; repetir el mismo envío es idempotente                           | OK        |
| Resultado: el entrenador ve exactamente lo enviado (reps, omitida, tiempo, notas) | OK        |
| Tras enviar ya no se edita (409); Bruno no ve el resultado (404)                  | OK        |
| Retirar el ejercicio no rompe el histórico: resultado, ficha y figura             | OK        |

Figuras por HTTP (script aparte, mismo día): índice con 52 medios; el cliente
descarga el MP4 real (256 019 B, `video/mp4`, `Cache-Control: private`); rango
`bytes=0-1023` → 206; póster `image/jpeg`; nutricionista 403; sin sesión 401; el
cliente no asigna (403); cambiar a MoveKit devuelve `sinConexion: false`; quitar
→ 404 al pedir el vídeo. 11 de 11.

### Pruebas automáticas en el estado integrado

| Comando                      | Resultado                                 |
| ---------------------------- | ----------------------------------------- |
| `npm run typecheck`          | OK                                        |
| `npm run lint`               | OK (ESLint y Prettier)                    |
| `npm test`                   | API 14 suites / 89; móvil 24 suites / 136 |
| `npm run test:e2e`           | 25 suites / 289                           |
| `npx expo export -p web`     | Bundle web generado (2,6 MB)              |
| `npx expo export -p android` | Bundle Hermes generado (4,7 MB)           |

### Fallos encontrados

| Fallo                                                                                                                            | Reproducción                                     | Dueño          | Estado                                                                       |
| -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | -------------- | ---------------------------------------------------------------------------- |
| `carrera-refresco.e2e-spec.ts` («cuatro canjes simultáneos no bifurcan la sesión») falló una vez con toda la suite e2e en marcha | `npm run test:e2e` completo; aislado pasa 3 de 3 | Codex (sesión) | Intermitente bajo carga; no lo toca este trabajo. Pasó en la ejecución final |
| La prueba e2e de figuras no pasaba `npm run typecheck` del monorepo (firma del parser binario de supertest)                      | `npm run typecheck`                              | Fable          | Corregido en `fix(test): tipar el parser binario…`                           |

No se han encontrado defectos de catálogo, rutinas, agenda, registro ni resultados.

## Guion para David (pantallas)

Con la API y la web en marcha (`npm run dev --workspace apps/api` y
`npx expo start --web` en `apps/mobile`), entrando con su cuenta de entrenador
y una de cliente de prueba. Anotar en cada punto OK o lo que se vea mal.

**Entrenador**

1. Catálogo → abrir un ejercicio → sección «Animación de la técnica»: sin figura
   dice «Sin animación»; «Elegir animación» lista las 52; buscar «bulgara» (sin
   tilde) encuentra la sentadilla búlgara; «Dominadas» lleva «Solo con conexión».
2. Elegir una: aparece la animación en bucle, sin sonido, con «Pausar». Pausar y
   reanudar. Cambiar por otra. «Quitar animación».
3. Salir de la ficha con la animación puesta y volver: no debe seguir sonando ni
   moviéndose en segundo plano.
4. Crear un ejercicio: debe avisar de que la animación se elige al editar.
5. Rutinas: editar una, asignar varias semanas a un cliente y revisar sus
   resultados.

**Cliente**

6. Entrenamiento de hoy → «Ver técnica» en un ejercicio con figura: se abre
   encima; la animación y «Cómo se hace». «Volver al entrenamiento» deja kg,
   series marcadas y notas como estaban.
7. «Ver técnica» en un ejercicio sin figura: «todavía no tiene animación», sin
   reproductor falso.
8. Con la sesión ya marcada para enviar (resumen abierto), cerrar el resumen y
   «Ver técnica» sigue funcionando.
9. Tamaños: 320, 390, 768 y 1440 px de ancho; nada cortado.

## F10 — Guion para Android e iOS (sin dispositivo en esta sesión)

Pendiente de un móvil físico. Registrar SHA, modelo, versión del sistema y
resultado por paso. Vale Expo Go del SDK 57 (expo-video es un paquete del SDK) o
un build de desarrollo; si Expo Go no reproduce la figura, repetir con el build.

1. Entrenador asigna una rutina con un ejercicio con figura de Vital y otro de
   MoveKit.
2. Cliente: cambiar el día de una sesión; registrar kg, repeticiones y segundos.
3. «Ver técnica» del ejercicio de Vital con conexión (debe verse). Cerrar.
4. Modo avión. Cerrar la app del todo y reabrirla.
5. El borrador sigue ahí. «Ver técnica» del de Vital: la ficha dice «Sin conexión:
   mostramos la ficha guardada» y **la animación se reproduce desde la caché**
   (criterio F04). El de MoveKit: aviso «solo se ve con conexión» y el registro
   sigue funcionando.
6. Quitar el modo avión y enviar una sola vez. El entrenador ve la fecha nueva y
   exactamente las series enviadas.
7. Borrador grande (muchas series), cambio de cuenta y limpieza: la otra cuenta
   no ve ni la ficha guardada ni el borrador.
8. Si en el paso 5 el sistema ya había vaciado la caché, anotarlo: es el caso
   «caché eliminable» documentado, no un fallo, y la app debe mostrar el aviso
   con «Reintentar».
