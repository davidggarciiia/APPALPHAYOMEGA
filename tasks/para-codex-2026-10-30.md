# Encargo para Codex · 30-10-2026

Reparto de siempre: **Codex implementa; Claude revisa, verifica y hace los commits.** Rama de trabajo: `mejoras/base-2026-10-28-qxnjhw` (ya en GitHub). Antes de empezar, `git pull` de esa rama. La versión de K hecha en la nube (`6c3e457`) está revertida en la rama, así que el código vuelve a ser el de R1 (`ac6c79b`). En el escritorio, `git pull --rebase origin mejoras/base-2026-10-28-qxnjhw` deja `afee1c5` (K) encima sin conflictos. K (rendimiento en Android) está hecho.

## Reglas

- Sin commit ni staging; deja los cambios en el árbol y apunta al final de este archivo qué tarea cerraste y con qué evidencia.
- Cada cambio con prueba que falla antes y pasa después. No quitar, saltar ni debilitar aserciones ni subir plazos.
- E2E solo contra `alpha_omega_e2e_codex` (la guarda `exigir-base-de-pruebas` lo impone). Migraciones aditivas, nunca `reset` sobre `alpha_omega`.
- Antes de entregar: `npm run typecheck`, `npm run lint`, `npm test` y, si tocas la API, `npm run test:cobertura` (umbral 80 %). Anota las cifras.
- Cierra los procesos auxiliares que abras (Expo, API, Jest en modo vigilancia) al terminar cada tarea.
- No tocar los archivos personales de David (`PDF/`, el HTML de pantallas, `compass_artifact_*.md`, `.claude/launch.json`).
- No avanzar nada que dependa de una decisión de David (lista al final).

## Tareas, en orden

### 0. Rediseño del cliente ([ESPEC-rediseno-cliente-2026-10-30.md](diseno-movil/ESPEC-rediseno-cliente-2026-10-30.md)) — primero

Es lo que pidió el dueño tras probar la app en Android: sesión por bloques (calentamiento → principal → final, con «Siguiente»), interfaz sin subtítulos de relleno, Plan sin la pestaña «Bloque» y con tamaños de letra fijos, Nutrición más limpia y Progreso rehecho entero. Va antes que las reservas. Hacerlo en este orden y avisar aquí tras cada punto: 1.1 sesión por bloques, 2 Plan, 4 Progreso, 3 Nutrición, 1.2 Hoy.

### 1. Reservas R2–R6 ([plan-reservas.md](plan-reservas.md), [SPEC-reservas.md](../SPEC-reservas.md))

R1 está hecho (`ac6c79b`). **Decisión del dueño del 30-10, ya en la spec: RESERVA EL ENTRENADOR.** El cliente no reserva ni pide cancelar: el entrenador le asigna un hueco (que gasta su crédito o su cupo) y el cliente lo ve en su calendario con su saldo y cupo. Donde los criterios 6, 7, 9 y 11 dicen «el cliente reserva / pide cancelar», léase «el entrenador»; la pantalla del cliente es solo de consulta.

- **R2 · disponibilidad** (API + e2e): el entrenador abre huecos (día, hora, duración, servicios), los repite semanalmente N semanas y cierra los libres. Criterio 5. No hace falta un listado de huecos libres para el cliente; el cliente solo ve sus propias reservas.
- **R3 · reservas** (API + e2e): **el entrenador** asigna un hueco libre a un cliente con un servicio; personal gasta 1 crédito, seguimiento gasta la duración del cupo mensual; sin saldo se rechaza con motivo claro. Concurrencia: dos asignaciones simultáneas del mismo hueco → solo una gana y la otra no gasta nada. El entrenador cancela (decide si devuelve) y marca asistencia. Notificación al cliente en la campana cuando se le asigna o cancela una reserva. E2E de permisos: el cliente no puede reservar, cancelar ni ver reservas o saldos de otros. Criterios 7–10 reinterpretados.
- **Checkpoint 1:** API y e2e en verde → avisar aquí antes de pasar al móvil, para que Claude revise el contrato.
- **R4 · cliente (solo consulta):** en el calendario expandido de Hoy, sus reservas junto a las sesiones del plan, y su saldo de créditos y minutos de seguimiento del mes. Sin botón «Reservar». Criterio 11 reinterpretado.
- **R5 · entrenador:** agenda por día y semana que distingue personal y seguimiento; abrir huecos, asignar un hueco a un cliente, cancelar y marcar asistencia; desde la ficha («Datos del cliente» o fila «Bonos»), cargar bonos y activar el seguimiento. Criterio 12. Sin animaciones de entrada con desplazamiento (criterio 13 y commit J).
- **R6 · datos de demo:** David con bono de 10 entrenos, seguimiento activo y huecos de la semana (`build/manual-20261027/perfil-demo.mjs`, idempotente).
- **Checkpoint 2:** vídeo a 390 px de la agenda del entrenador asignando una reserva y del calendario del cliente mostrándola con el saldo.
- Actualizar `tasks/plan-reservas.md` (R2–R4) para que diga lo mismo que esta sección.

### 2. P1/P2 pendientes de las auditorías ([informe-noche-2026-10-28.md](informe-noche-2026-10-28.md), «Pendiente»)

Comprobar primero si alguno ya quedó resuelto en D7–J (`bf15ed4` resolvió E-06/E-07, N-07 y el destello blanco de la web; `e0952a2` quitó las animaciones de entrada); marcar los resueltos con el commit.

- T-04: confirmar al quitar un ejercicio, una fase o un deporte.
- N-06: parpadeo al recargar Nutrición. N-04/N-05: copia sin conexión en nutrición.
- E-04/E-05: sondeos de 5 s con escritura cifrada.
- A-06/A-12: pestañas con `router.replace` y rutas públicas con sesión abierta.
- Los ~40 `Pressable` sueltos: migrar solo los que son botones (no tarjetas, chips ni filas) y proponer aquí dónde usar «mantener para confirmar» en los destructivos.

### 3. Verificaciones que solo se pueden hacer con la app arrancada

- **M11:** abrir Expo web + API y confirmar que la consola ya no muestra «Image: style.resizeMode/tintColor is deprecated». Anotar el resultado.
- `AbortError` de `play()` en la intro en web: corregir la carrera si es local y sencillo, si no documentarla.
- **Rendimiento:** medir el arranque en frío de la web, el tamaño del bundle y los endpoints más usados (Inicio, ficha, semana). Solo medir y anotar; nada de optimizar sin las cifras.

## Lo que hace Claude, no Codex

- Revisar cada entrega, preparar los commits atómicos y subirlos.
- M13 (documentación final) y M14 (revisión final y go/no-go en `tasks/cierre-mejoras-2026-10-28.md`) cuando terminen 1–3.
- Lanzar el CI en GitHub cuando David autorice abrir un PR.

## Bloqueado por decisiones de David (no tocar)

- D2 · borrado a petición, opción A o B ([ADR 0006](../docs/adr/0006-borrado-a-peticion.md)) → M08a–c.
- D3/D4 · las dos políticas de acceso de seguimiento → texto en `SPEC-seguimiento-corporal.md` (M09).
- D5 · login con Google en la v1 (M10).
- Si `PDF/ALPHA Y OMEGA.pdf` es del proyecto y se versiona.

## Entregas de Codex

<!-- Codex: añade aquí, por tarea, qué cambió, archivos y cifras de verificación. -->

### 1.1 · Sesión por bloques

- La sesión muestra una sección no vacía por pantalla, con navegación, indicador y anuncio accesible. Al reabrir comienza por el primer bloque pendiente; terminar cuenta todas las series. Se conserva la lista virtualizada y la edición local. Las entradas manuales incompletas se conservan al cambiar de bloque y se pide corregirlas antes de salir o enviar.
- Se retiraron de la cabecera el recorrido «x de y series» y el subtítulo de fase; los ajustes de fase que afectan a la pauta se mantienen junto al contenido. La prueba antigua del recorrido se actualizó al indicador de bloques con autorización de David, conservando la comprobación de la confirmación.
- Pruebas nuevas observadas fallar antes de implementar y pasar después: navegación, pendientes globales, reapertura, reconciliación remota, entrada manual y anuncio accesible. `npm run typecheck` y `npm run lint`: correctos. `npm test`: API 525/525, móvil 1634/1634, compartido 62/62.
- Capturas web de los cuatro bloques a 360 y 390 px: `C:/Users/david/.codex/visualizations/2026/10/30/01a18aa4-2d12-7212-9824-cf3f7cd70bfe/sesion-sintetica-{360|390}-bloque-{1..4}.png`. Datos y API simulados, sin acceso a bases; no sustituye la verificación con la cuenta demo ni M11. Pendiente: comprobación del lector de pantalla en Android.

### 2 · Plan

- Semana, Rutina y Guía sustituyen la pestaña Bloque; Rutina agrupa sesiones por día y abre el detalle al tocar una fila. Objetivos y notas del entrenador se conservan en una sola fila desplegable. Se eliminaron el componente antiguo de Bloque y sus pruebas específicas con autorización de David.
- Se eliminó el autoescalado y el tamaño elegido por longitud en los puntos detectados, y se añadió una guarda estática de las propiedades prohibidas en `src/` y `app/`. David autorizó actualizar las pruebas antiguas incompatibles; se mantienen las verificaciones de accesibilidad y edición.
- Capturas web de Semana, Rutina, detalle, indicaciones y Guía a 360 y 390 px: `C:/Users/david/.codex/visualizations/2026/10/30/01a18aa4-2d12-7212-9824-cf3f7cd70bfe/plan-sintetico-{360|390}-{semana|rutina|detalle|indicaciones|guia}.png`. Son datos sintéticos sin conexión a bases; no sustituyen la cuenta demo ni Android nativo.
- `npm run typecheck` y `npm run lint`: correctos. `npm test`: API 525/525, móvil 1638/1638, compartido 62/62. La vista previa del entrenador mantiene sus pruebas. Después de la batería, David autorizó cambiar el rol accesible de las filas a botón; las 6 pruebas enfocadas de ruta, selección y vista previa pasan. La batería completa posterior consta en la entrega de Progreso.

### 4 · Progreso

- Por indicación posterior de David se ha seguido la imagen del diseño de Claude: fotos antes/ahora, peso, medidas, composición, fuerza y pruebas, con comparaciones y tarjetas continuas. Se mantienen las secciones y filas solo cuando hay datos y están activadas; el detalle sigue accesible al pulsar. Se eliminaron las pestañas por indicador y las leyendas redundantes. El entrenador conserva su pantalla anterior.
- Los datos se comparan por indicador y fuente, sin inventar valores ni mezclar protocolos; las marcas de fuerza muestran también las repeticiones. Las fotos usan la misma pose y conservan permisos, solicitudes pendientes y galería. El acceso a la galería y los reintentos de carga son botones independientes; la nueva prueba falló antes de la corrección y pasó después.
- Capturas web con datos sintéticos a 360 y 390 px: `C:/Users/david/.codex/visualizations/2026/10/30/01a18aa4-2d12-7212-9824-cf3f7cd70bfe/claude-progreso-{360|390}-contenido-completo.png`. Actualizadas con el acceso independiente a la galería y las repeticiones de fuerza; sin errores ni peticiones sin simular en el log final. No sustituyen la cuenta demo ni Android nativo.
- Tras el rediseño, `npm run typecheck` y `npm run lint` pasaron; `npm test`: API 525/525, móvil 1720/1720, compartido 62/62. Posteriormente se corrigieron la accesibilidad de los reintentos de fotos (3 suites y 19 pruebas enfocadas) y la acción «Añadir» cuando solo hay pasos o sueño (2 suites y 19 pruebas enfocadas); ambas correcciones tienen prueba observada fallar antes y pasar después. Queda repetir la batería final tras las tareas restantes.
- La galería conserva además el acceso a la constancia de fotos retiradas y al reintento de retiradas pendientes, incluso si no quedan imágenes disponibles. Las pruebas de ambos estados fallaron antes y pasaron después; recorrido de borrar la última foto, volver y reabrir verificado: 4 suites y 26 pruebas.
- Comparación visual posterior: Fuerza y Pruebas usan la barra única segmentada de la referencia (marca inicial gris y aumento dorado); el cambio sigue en la etiqueta accesible sin añadir un chip visual. Para descensos se conservan dos valores y barras comparables. Pruebas de tarjeta e integración observadas fallar antes y pasar después: 4 suites y 38 pruebas enfocadas.

### 3 · Nutrición

- Se conserva la estructura Hoy/Semana. La comida actual o siguiente aparece primero; el objetivo nutricional se consulta desde una fila desplegable después de las comidas, conservando sus cifras y la suplementación. Las pruebas de datos del objetivo se mantienen al abrir su detalle.
- Las recargas concurrentes descartan respuestas antiguas y serializan la copia local; el cambio de cuenta desmonta los datos anteriores. Las capturas a 360 px detectaron un recorte del domingo en la tira semanal: se corrigió la separación conservando áreas táctiles de 44 px. La prueba reprodujo 332 px de contenido frente a 320 disponibles antes de la corrección y pasó después. Pruebas enfocadas: 22/22; typecheck móvil correcto.
- Capturas antes y después a 360 y 390 px: `C:/Users/david/.codex/visualizations/2026/10/30/01a18aa4-2d12-7212-9824-cf3f7cd70bfe/nutricion-{antes|despues}-{360|390}.png`. El antes usa una copia temporal de HEAD; dieta y API simuladas, sin bases. Sin errores en la ejecución final; servidores auxiliares cerrados. Pendiente Android nativo y cuenta demo.

### 1.2 · Hoy y calendario

- La tarjeta de sesión muestra nombre y «Empezar»; las acciones de continuar y consultar el resumen se mantienen. Se retiraron «Hoy toca», la fecha repetida, los microtítulos de estado y la explicación redundante de reprogramación. El calendario y la lista semanal conservan fechas, estados y cambios de día; el descanso sigue ofreciendo la próxima sesión cuando existe.
- Pruebas observadas fallar antes y pasar después: tarjeta simplificada, nombre como encabezado accesible y continuación sin subtítulos. Las cuatro suites de tarjeta, agenda, calendario y semana pasan: 50/50 pruebas.
- Capturas web sintéticas sin recortes ni errores de consola a 360 y 390 px: `C:/Users/david/.codex/visualizations/2026/10/30/01a18aa4-2d12-7212-9824-cf3f7cd70bfe/hoy-sintetico-{360|390}-{semana|mes}.png`. No sustituyen Android ni la cuenta demo.
- Batería general posterior a estos cambios: `npm run typecheck` correcto; `npm test`: API 525/525, móvil 1729/1729, compartido 62/62. Lint detectó solo formato de `hoy-toca.tsx`, corregido con Prettier; pendiente repetición final junto a los siguientes incrementos.

### R2 · Disponibilidad

- Contratos en `packages/shared/src/disponibilidad.ts`; apertura idempotente, listado paginado por rango y cierre en `/disponibilidad/huecos`, solo para el entrenador titular. Los huecos admiten entreno personal, seguimiento o ambos; duración por defecto 60 minutos, hasta 52 repeticiones semanales.
- Fecha y hora locales de Madrid con instantes UTC: repetir conserva la hora local; horas inexistentes o ambiguas por cambio horario se rechazan antes de escribir. Aperturas serializadas por entrenador y solapes rechazados; cierre idempotente de libres, 409 estructurado si reservado y 404 si ajeno. El cierre bloquea la fila del hueco, candado compartido con R3.
- Migración aditiva `20261030130000_disponibilidad`, aplicada únicamente a `alpha_omega_e2e_codex`. Pruebas nuevas observadas fallar antes y pasar después: 12/12 e2e, 14/14 de horario, 66/66 compartidas. Typecheck API, ESLint y Prettier enfocados correctos. Sin procesos auxiliares, staging ni commits.

### R3 · Reservas (API)

- `/reservas` permite al entrenador asignar un hueco propio a un cliente, consultar su agenda, cancelar decidiendo la devolución y marcar asistencia. El cliente solo consulta lo suyo; no puede asignar, cancelar, marcar asistencia ni leer reservas o avisos de otros. Listados paginados y por rango; avisos persistentes de asignación/cancelación con lectura idempotente del titular. La conexión a la campana móvil corresponde al siguiente incremento, después del checkpoint del contrato.
- Hueco y saldo se bloquean en ese orden; la concesión de seguimiento reutiliza `BonosService`. Un reintento no duplica consumo ni aviso; dos asignaciones de hueco, dos consumos del último crédito o un cierre concurrente dejan un único ganador. Cancelar devuelve una sola vez al mes consumido; repetir una cancelación antigua no libera una asignación posterior. El mes de cupo es el de la cita (supuesto documentado en `SPEC-reservas.md`).
- Migración aditiva final `20261030140000_reservas`, detrás de disponibilidad. Pruebas nuevas observadas rojas antes y verdes después: 15/15 e2e, 3/3 de contrato. Revisión del servicio, permisos, orden de bloqueos y conservación de movimientos realizada; typecheck API y ESLint enfocados correctos.
- Incidencia de infraestructura de pruebas: la primera aplicación a `alpha_omega_e2e_codex` usó el nombre anterior `20261030060000_reservas`. Se corrigió el orden de los archivos, pero esa base conservaba el nombre anterior en el historial. La protección de Prisma bloqueó el primer intento de `migrate reset --force` y exigió consentimiento explícito; las pruebas previas a la autorización usaron las mismas tablas ya migradas, sin reinicializar la base ni alterar metadatos. No se ha aplicado ninguna migración a la base habitual.
- **Resolución autorizada el 30-10:** David respondió «Sí, reconstruir alpha_omega_e2e_codex». Se ejecutó `npx prisma migrate reset --force` con esa base fijada y el consentimiento literal exigido por Prisma. Las 30 migraciones se aplicaron desde cero, en el orden Bonos → Disponibilidad → Reservas; `npx prisma migrate status` confirmó historial actualizado. Una revisión estática independiente no encontró cambios en migraciones históricas ni operaciones destructivas en las dos nuevas. `POSTGRES_DB=alpha_omega_e2e_codex npm run test:e2e` repetido sobre la base reconstruida: 54 suites, 589/589 pruebas correctas; proceso finalizado.
- Verificación general de la tanda: `npm run typecheck` y `npm run lint` correctos; `npm test`: API 539/539, móvil 1731/1731, compartido 69/69. `git diff --check` sin incidencias. `POSTGRES_DB=alpha_omega_e2e_codex npm run test:cobertura`: 539 unitarias y 589 E2E correctas; 40 servicios/guardas, líneas 96,51 %, sentencias 94,70 %, funciones 98,60 %, ramas 87,46 %; umbral del 80 % cumplido en las cuatro métricas.
- **Checkpoint 1 comunicado:** API y E2E verdes, reconstrucción limpia e historial verificados con autorización; contrato listo para revisión de Claude antes del móvil. R4–R6 y las tareas posteriores no se han implementado en esta entrega. Capturas y procesos de comprobación finalizados; sin staging ni commits.

### QA urgente posterior · 30-10

- David pidió probar y corregir antes de una posible salida en una hora. Evidencia y límites completos en [evidencia-pruebas-2026-10-30.md](evidencia-pruebas-2026-10-30.md). No se cambia el reparto: Claude revisa, prepara commits y cierra el go/no-go.
- Corregidos con regresiones observadas rojas y verdes: rutas públicas con sesión abierta (`app/_layout.tsx`, `arranque.spec.tsx`), espera visible de Inicio, carrera `AbortError` de la intro web (reproductores por plataforma y prueba nueva), nombre/dosis de suplemento a 360 px, medidas publicadas omitidas y borde de tarjeta de Progreso. La prueba real de entrenamiento detectó y corrigió además el contador de ENVIADO/GUARDADO, que contaba solo Principal aunque guardaba todas las series; ahora ambas confirmaciones muestran 1 de 8 en el fixture de cuatro bloques.
- `package-lock.json` corrige Zod anidado de la CLI conservando `package.json`, Expo y React Native. Auditoría: cero altas, críticas o moderadas; 17 avisos bajos transitivos sin parche disponible en el aviso. No se ha aplicado una degradación del SDK.
- `npm run typecheck`, `npm run lint` y `npm test`: código 0 con las fuentes finales; API 539/539, móvil 1758/1758, compartido 69/69. Repetición aislada de `POSTGRES_DB=alpha_omega_e2e_codex npm run test:cobertura`: 589/589 HTTP, líneas 96,51 %, sentencias 94,70 %, funciones 98,60 %, ramas 87,46 %, umbral 80 % cumplido. Una primera pasada bajo carga simultánea tuvo un timeout de 5 s; no se aumentó el límite ni se cambiaron sus aserciones.
- Exportaciones web/Android/iOS terminadas con código 0 y fuentes actuales verificadas. Recorrido real del export web con ambos roles, sin conexión y recuperación: código 0; M11 sin avisos de Image. Entrenamiento de cuatro bloques probado con escritura solo en E2E: borrador conservado, siete pendientes globales, un envío, resultado legible al entrenador y fixture eliminado. Capturas a 360/390 px, mediciones locales de arranque y endpoints, metodología y hashes en el informe. Los bundles nativos no sustituyen una instalación física.
- Docker recuperado sin borrar bases ni volúmenes. Se mantienen API 3000 y Expo 8081 por petición posterior de David de disponer del QR; el servidor estático de pruebas 8189 y la API aislada 3109 se cerraron. **Bloqueo público comprobado:** `api.alphayomegatraining.com` no resuelve por DNS en Google/Cloudflare. No se ha publicado ni aplicado migraciones fuera de E2E. R4–R6, proveedor real, dispositivo físico y decisiones del dueño siguen fuera de lo verificado; sin staging ni commits.
- **Aclaración posterior de David:** el destino es una prueba privada con Expo Go. El DNS público no bloquea esta prueba. El 30-10 a las 07:46 UTC se verificaron de nuevo API/base y Metro por LAN (HTTP 200) y el manifiesto Android con `192.168.68.51:8081`. Se conserva el QR y los procesos de la demo para probar desde la misma red; no equivale a una publicación en tiendas.
