# Lista de tareas — mejoras post-revisión (M00–M14)

> Plan: [plan-mejoras-2026-10-27.md](plan-mejoras-2026-10-27.md). Plan RI anterior: [todo.md](todo.md) (intacto). Tamaños: XS 1 archivo · S 1–2 · M 3–5. Ninguna tarea toca más de ~5 archivos. Comandos desde la raíz del repositorio.
> Estado: `[ ]` pendiente · `[x]` hecho con evidencia · `[~]` bloqueado por decisión (ver plan).

## Fase 1 — Base segura

### M00 · Línea base verificada (XS)

**Descripción:** medir tipos, lint, unitarias y E2E del árbol actual antes de cambiar nada, para distinguir lo roto de lo nuevo.
**Criterios:**

- [x] `npm run typecheck`, `npm run lint`, `npm test` ejecutados y sus cifras anotadas aquí. E2E: ver M05 (se ejecutan dentro de `test:cobertura`).
- [x] `docker ps` muestra `alpha-omega-db` sano y los E2E usan solo `alpha_omega_e2e_codex` (la base existe con 26 migraciones).
- [x] Todo fallo previo se registra como "ya existía", sin arreglarlo en esta tarea.

**Verificación:** logs en `%TEMP%/aoplan/`. **Dependencias:** ninguna. **Archivos:** solo esta lista.

**Evidencia (28-10-2026), línea base antes de cualquier cambio de código:**

- `npm run typecheck`: correcto (raíz y 3 workspaces). `npm run lint` (ESLint + Prettier): correcto.
- `npm test` a secas: API **352/352 en 40 suites**; móvil **725/728**, 2 suites fallan por **timeout de 5 000 ms** (`catalogo.spec.tsx` ×2, `constructor.spec.tsx` ×1), no por aserciones.
- Esas dos suites repetidas con `--runInBand`: **36/36 en 9,5 s**. Conclusión: inestabilidad bajo carga con workers en paralelo → tarea **M00b**.

### M00b · Estabilizar las pruebas móviles bajo carga (S)

**Descripción:** tres pruebas que escriben cadenas largas o esperan promesas superan los 5 s por defecto cuando Jest reparte la suite en varios workers; con `--runInBand` pasan en segundos. La CI (M06) heredaría el problema.
**Criterios:**

- [x] `npm test --workspace apps/mobile` (sin flags) pasa 3 veces seguidas en esta máquina.
- [x] La solución es de configuración (`"maxWorkers": "50%"` en la clave `jest` de `apps/mobile/package.json`), **sin** quitar, saltar ni debilitar ninguna aserción ni subir ningún plazo (`constraint-driven-development`).
- [x] No se sube ningún plazo, así que no hay comentario que justificar; el dato queda aquí.

**Verificación:** 3 ejecuciones completas de `npm test --workspace apps/mobile`. **Dependencias:** M00. **Archivos:** 1 (`apps/mobile/package.json`).

**Evidencia:** con 7 workers (8 CPU) fallaban 3 pruebas por plazo de 5 s; con `--maxWorkers=4` una pasada completa dio **728/728 en 22 s**; con el cambio aplicado, tres pasadas de `npm test --workspace apps/mobile`: **728/728, 728/728, 728/728, 25 s cada una**. Hipótesis (contención de CPU con demasiados workers de React Native) apoyada por esos datos, no demostrada en otra máquina; la CI usará la mitad de los CPU de su runner (no medido todavía).

### M01 · Propuesta de commits atómicos del trabajo de Codex (S) — necesita tu OK para ejecutarse

**Descripción:** el árbol lleva 225 archivos sin commit; un fallo de disco o un `git checkout` los pierde. Proponer (sin ejecutar) la agrupación por módulo con `git-workflow-and-versioning`.
**Criterios:**

- [x] Documento [propuesta-commits-2026-10-28.md](propuesta-commits-2026-10-28.md) con dos opciones (por módulo, 14 commits; por capa, 4) y rutas explícitas, sin `git add .`.
- [x] Excluidos del staging: `.env`, `build/`, `.almacen-local/`, `node_modules/`, PDFs personales y HTML de referencia del usuario.
- [x] Ninguna acción de git ejecutada. **Pendiente de tu decisión** (A o B) para ejecutarla.

**Verificación:** no se ha hecho ningún `git add`/`commit`/`checkout`. **Dependencias:** M00. **Archivos:** 1 documento.

**Extra M01b (higiene de Git, hecho):** había `tools/animaciones-propias/__pycache__/*.pyc` y `PDF/referencias-entrenador/` (resultados personales reales; `para-claude.md` dice que van fuera de Git) **sin ignorar**, a un `git add .` de subirse. Añadidas a `.gitignore` y comprobadas con `git check-ignore`; ninguno estaba versionado.

### Checkpoint 0

- [ ] Línea base registrada · [ ] árbol intacto · [ ] decisión tuya sobre M01

## Fase 2 — Robustez operativa y puerta de calidad

### M02 · Plazos de conexión y consulta en PostgreSQL (M)

**Descripción:** hoy una base que no responde retiene peticiones indefinidamente. Añadir plazo de conexión, de inactividad, de consulta y tamaño de pool, configurables y con valores por defecto holgados.
**Criterios:**

- [x] Las opciones se leen de `PG_CONNECT_TIMEOUT_MS`, `PG_QUERY_TIMEOUT_MS`, `PG_IDLE_TIMEOUT_MS` y `PG_POOL_MAX`. Nombres de opción verificados en el código instalado (`@prisma/adapter-pg` 7.10.1 acepta `pg.PoolConfig`; `pg` 8.23.1 define `connectionTimeoutMillis`, `statement_timeout`, `query_timeout`, `idleTimeoutMillis`, `max`).
- [x] Valores no numéricos, cero, negativos, decimales o fuera de rango seguro fallan al arrancar (`leerEnteroPositivo`, 7 casos en `entorno.spec.ts`).
- [x] `urlDeConexion` y `prisma.config.ts` no cambian; el TLS `verify-full` se conserva junto a los plazos (prueba propia).
- [x] Pruebas escritas antes del cambio. `statement_timeout` = `PG_QUERY_TIMEOUT_MS` (lo cancela el servidor) y `query_timeout` = +5 s (respaldo del cliente).

**Verificación:** `npm test --workspace apps/api -- config/entorno config/postgres` (incluye una conexión real a un socket TCP mudo que se corta en ~200 ms) y E2E `plazos-postgres.e2e-spec.ts` contra `alpha_omega_e2e_codex`: `pg_sleep(5)` cancelado a los 500 ms, el pool sigue sirviendo y una consulta que cabe en el plazo pasa. **Dependencias:** M00. **Archivos:** `config/postgres.ts`, `config/entorno.ts`, sus dos specs, `prisma/prisma.service.ts`, `test/plazos-postgres.e2e-spec.ts`, `.env.example`, `docs/DESPLIEGUE.md`.

**Límites:** el parámetro `statement_timeout` viaja como opción de arranque; un PgBouncer en modo transacción puede rechazarlo (documentado en DESPLIEGUE, a ensayar con el proveedor). Los valores por defecto no están medidos en el alojamiento real. Los scripts de carga (seed, catálogo) conservan la URL sin plazos a propósito.

### M03 · Sonda `/salud` con plazo propio (S)

**Descripción:** la sonda debe responder 503 en un plazo acotado aunque la base cuelgue, para que un balanceador actúe.
**Criterios:**

- [x] Con una consulta que nunca resuelve (doble en la prueba), el servicio informa `degradado` (→ 503 en el controlador) dentro del plazo `SALUD_PLAZO_MS` (por defecto 3 s).
- [x] Con la base sana sigue devolviendo 200 con el mismo cuerpo (E2E `salud` en verde).
- [x] El temporizador se limpia siempre (`jest.getTimerCount() === 0`; `--detectOpenHandles` sin avisos).
- [x] Un `SALUD_PLAZO_MS` inválido impide arrancar (constructor), no produce 500 en cada sondeo.

**Verificación:** `npm test --workspace apps/api -- salud --detectOpenHandles` y E2E `salud` + `plazos-postgres`. **Prove-It:** al quitar a propósito el `Promise.race` la prueba de la base colgada falla por timeout; revertido. **Dependencias:** M02. **Archivos:** `salud/salud.service.ts`, `salud.service.spec.ts`.

### M04 · Plazo en el envío de correo y cobertura de `correo.service` (S)

**Descripción:** un proveedor lento no puede dejar colgada una activación o recuperación; y el servicio con menos cobertura debe quedar probado.
**Criterios:**

- [x] El envío falla con el mismo error genérico ("No se ha podido enviar el correo") si el proveedor supera `CORREO_PLAZO_MS` (15 s por defecto); el motivo del proveedor solo va al registro.
- [x] Pruebas con la SDK real de Resend contra un servidor HTTP local (`RESEND_BASE_URL`): envío correcto (cuerpo y cabecera), remitente de pruebas por defecto, rechazo 422 sin filtrar el motivo, proveedor mudo, plazo inválido, enmascarado del destinatario (largo y corto). Se conservan las 2 pruebas de producción existentes.
- [x] Cobertura de `correo.service.ts`: **45,45 % → 100 % de líneas, sentencias, funciones y ramas**, sin excluir el archivo.

**Verificación:** `npm test --workspace apps/api -- correo --coverage --collectCoverageFrom='correo/correo.service.ts' --detectOpenHandles` → 11 pruebas, sin handles abiertos; `tsc` correcto. **Dependencias:** M00. **Archivos:** `correo/correo.service.ts`, `correo.service.spec.ts` (nuevo), `.env.example`, `docs/DESPLIEGUE.md`.

**Hallazgo de SDK:** Resend 6.35 admite `signal` y, al abortarse, devuelve su error normal en vez de lanzar; no hizo falta `Promise.race`. Una de mis suposiciones (que `to` viajara como lista) era falsa y la prueba la corrigió.

### M05 · Umbral de cobertura ejecutable (M) — usa D1

**Descripción:** convertir "80 % en servicios y guardas" en un control que falla, con la interpretación escrita en SPEC.
**Criterios:**

- [x] `npm run test:cobertura` (raíz) → `apps/api/test/cobertura.mjs`: ejecuta unitarias y E2E con cobertura, **suma los contadores Istanbul a mano (sin dependencia nueva)** y falla por debajo del 80 % agregado de `*.service.ts` y `*.guard.ts` en las cuatro métricas. Los archivos sin tests cuentan a cero.
- [x] Imprime los archivos individuales por debajo del 80 % de líneas (informativo; D1 por defecto = agregado).
- [x] `SPEC.md` documenta métrica, alcance y por qué las unitarias solas no bastan (~50 %). README documenta el comando.
- [x] No se reutilizó el script de `build/` (está en una carpeta ignorada y ligado a esa revisión): se escribió uno versionado y probado.

**Verificación:** 5 pruebas de la propia puerta (`config/cobertura.spec.ts`): suma entre ejecuciones, falla a 3/5 = 60 %, pasa a 4/5 = 80 % exacto, ignora controladores, falla sin archivos en alcance. **Resultado real (base `alpha_omega_e2e_codex`):** 390 unitarias (43 suites) + 512 E2E (47 suites) en verde; fusionada sobre 36 servicios y guardas: **96,06 % líneas · 94,31 % sentencias · 98,39 % funciones · 86,56 % ramas** (referencia de Codex el 27-10: 95,36 / 93,69 / 97,69 / 86,28). Ningún archivo por debajo del 80 % de líneas. **Dependencias:** M00, M04.

**Fallo propio corregido:** la primera ejecución escribió la cobertura unitaria dentro de `src/` (la config tiene `rootDir: "src"`) y el comando devolvió exit 1 por "falta un informe"; ahora pasa rutas absolutas y se borró esa carpeta.

### M05b · Guarda: los E2E solo corren contra una base de pruebas (S) — tarea añadida durante la ejecución

**Por qué:** `npm run test:e2e` sin `POSTGRES_DB` usaba la base habitual (`alpha_omega`, desde `.env`) y los E2E crean y borran filas; el README lo advertía pero nada lo impedía.

- [x] `test/exigir-base-de-pruebas.ts` + `test/setup-e2e.ts` (en `setupFiles` de `jest-e2e.json`): se niega a arrancar si `POSTGRES_DB` no contiene `e2e`, con un mensaje que dice cómo corregirlo.
- [x] Probada en real: sin `POSTGRES_DB`, `test:e2e` falla antes de tocar la base («se niegan a correr contra la base "alpha_omega"»); con `alpha_omega_e2e_codex` los E2E pasan (512). Prueba unitaria `config/base-de-pruebas.spec.ts` (7 casos).

**Archivos:** 4 (+ README). **Nota:** otros worktrees ya usaban nombres con `e2e` (`alpha_omega_e2e_claude_d`, `_fotos`, `_panel`, `_unif`).

### M06 · CI en GitHub Actions (M)

**Descripción:** hoy nada ejecuta las 1 500+ pruebas salvo una persona. Un flujo que repita lo que se hace en local.
**Criterios:**

- [x] `.github/workflows/ci.yml` con tres trabajos: `calidad` (Node 24, npm 10.9.4, `npm ci`, `typecheck`, `lint`, `npm test`), `e2e-cobertura` (servicio `postgres:17-alpine`, base `alpha_omega_e2e_ci`, `prisma migrate deploy`, `npm run test:cobertura`) y `auditoria` (`npm audit --omit=dev --audit-level=high`, informativa).
- [x] Sin secretos reales: solo valores sintéticos de CI; los E2E ya sustituyen el correo por un doble.
- [x] Concurrencia cancelable, caché de npm, permisos mínimos (`contents: read`) y plazos por trabajo.
- [x] README enlaza la puerta de calidad. (DESPLIEGUE no hacía falta tocarlo para esto.)

**Verificación local:** Prettier valida el YAML; `prisma migrate deploy` sobre una base vacía aplica las 26 migraciones y crea 37 tablas; `npm run test:cobertura` pasa con las variables equivalentes. **No ejecutado en GitHub:** hasta el primer push no se sabe si el runner reproduce esto. **Dependencias:** M05. **Archivos:** `.github/workflows/ci.yml`, `README.md`.

**Supuestos sin comprobar:** que `main`/`master` sea la rama por defecto del remoto `origin`; que Node 24 dé el mismo resultado que el Node 22.22 local (Codex usó 24.19 en la instalación limpia); que el repo de GitHub tenga Actions habilitadas. No se creó `.gitlab-ci.yml` (D6).

### Checkpoint 1

- [ ] Todas las suites en verde · [ ] `test:cobertura` en verde · [ ] sin plazos que rompan E2E · [ ] diff de la fase revisado (`code-review-and-quality`) · [ ] OK de David

## Fase 3 — Privacidad y política de acceso (spec primero)

### M07 · Borrado a petición: especificación y ADR (S) — usa D2

**Descripción:** SPEC-identity #18 dice "anonimiza los datos personales y elimina los de salud" pero #14 dice que el histórico de entrenos sobrevive. Resolver el choque por escrito antes de programar.
**Criterios:**

- [x] [docs/adr/0006-borrado-a-peticion.md](../docs/adr/0006-borrado-a-peticion.md) en estado **PROPUESTO**: tabla campo a campo (anonimizar / eliminar / conservar) por modelo del esquema, objetos del almacén fuera de la transacción (ADR 0005), tokens y sesiones, flujo con contraseña y plazo de gracia, y dos opciones para el histórico de entrenos (A desvincular y conservar · B eliminar todo).
- [ ] `SPEC-identity.md` **no se toca**: actualizarlo con una decisión que aún no es de David sería inventar alcance. Se hará cuando elijas A o B.
- [x] Seis dudas jurídicas explícitas; ninguna presentada como resuelta.

**Verificación:** cada modelo de `schema.prisma` con relación a `Usuario` aparece en la tabla o está justificado como del entrenador/catálogo. **Dependencias:** M00. **Archivos:** 1 documento. **Estado: esperando decisión D2** (A/B, plazo de gracia, respuestas jurídicas) para desbloquear M08a–c.

### M08a · Borrado: anonimización de datos personales (M) — `[~]` bloqueada por D2

**Criterios:** endpoint de solicitud del propio titular; usuario y perfil anonimizados de forma irreversible; sesiones revocadas; histórico de entrenos conservado según ADR; E2E con datos sintéticos incluyendo reintento idempotente.
**Verificación:** E2E nuevo + `matriz-roles` sigue verde. **Archivos:** contrato `packages/shared`, servicio y controlador en `identity/`, migración aditiva + rollback, E2E.

### M08b · Borrado: eliminación de datos de salud y medios (M) — `[~]`

**Criterios:** medidas, pruebas, valoraciones, consentimiento y fotos eliminados según ADR; objetos del almacén borrados con limpieza idempotente; ninguna I/O de almacén dentro de transacción (ADR 0005).
**Verificación:** E2E con almacén local sintético. **Dependencias:** M08a.

### M08c · Borrado: pantalla en Perfil (S) — `[~]`

**Criterios:** confirmación en dos pasos, explicación de lo que se pierde, error y reintento conservan el estado, accesible por lector de pantalla; prueba de componente.
**Verificación:** `npm test --workspace apps/mobile -- perfil`. **Dependencias:** M08b.

### M09 · Pruebas de caracterización del acceso (S) — usa D3, D4

**Descripción:** fijar con pruebas lo que hoy ocurre en las dos políticas ambiguas, para que cambiarlas sea una decisión consciente.
**Criterios:**

- [x] `apps/api/test/seguimiento-acceso.e2e-spec.ts` (7 pruebas, todas en verde contra `alpha_omega_e2e_codex`). **D3 (cliente dado de baja):** el entrenador SÍ puede apuntarle medidas (201) y registrarle pruebas ya prescritas (201), pero NO cambiar su configuración (409 `operacion_incompatible`). **D4 (nutricionista asignado):** lee TODAS las pruebas físicas, sea cual sea su autor (`GET pruebas` y `pruebas/pagina` 200); puede apuntar medidas (201) pero no registrar pruebas (403); sin asignación, o con el cliente dado de baja, no ve nada (403).
- [ ] Describir en `SPEC-seguimiento-corporal.md` la diferencia entre endpoints antiguos y resúmenes nuevos: **no hecho**, hay que decidir antes qué política es la correcta.
- [x] Sin cambiar permisos.

**Verificación:** `POSTGRES_DB=alpha_omega_e2e_codex npm run test:e2e --workspace apps/api -- seguimiento-acceso` → 7/7. **Archivos:** 1 E2E nuevo.

**Para decidir (D3/D4):** hoy un cliente dado de baja sigue recibiendo medidas y pruebas del entrenador, y el nutricionista asignado ve todas las pruebas físicas aunque solo puede escribir medidas. Si cualquiera de las dos no es lo deseado, estas pruebas son las que deben cambiar a propósito.

### M10 · Login con Google: alcance de la v1 (XS) — usa D5

**Criterios:** si se difiere (por defecto), `SPEC-identity.md`, `CAPABILITY-MAP.md` y `PENDIENTE-PARA-PRODUCCION.md` dicen lo mismo (correo y contraseña en v1; Apple solo exigible si entra un tercero). Si se mantiene, se abre spec aparte.
**Verificación:** `rg -n "Google"` coherente en los tres documentos. **Archivos:** 3 documentos.

### Checkpoint 2

- [ ] ADR de borrado aprobado por David · [ ] caracterización verde · [ ] SPEC coherente · [ ] decisión sobre revisión jurídica

## Fase 4 — Calidad de la app móvil

### M11 · Avisos de desarrollo de `Image` (S)

**Descripción:** la prueba manual registró avisos por propiedades de `Image`; no se silencian, se corrigen.
**Criterios:**

- [x] Texto exacto, tomado de la evidencia del recorrido web de Codex (`build/manual-20261027/*/events.json`): «Image: style.resizeMode is deprecated. Please use props.resizeMode.» (66 apariciones) y «Image: style.tintColor is deprecated. Please use props.tintColor.» (27). **No lo reproduje yo en un navegador**; Jest no carga `react-native-web`, así que las pruebas nunca lo muestran.
- [x] Corregidos los 5 `<Image>` que lo causaban, moviendo `resizeMode`/`tintColor` de `style` a props: `componentes/armazon.tsx` (×2), `componentes/formulario.tsx`, `entrenamiento/hoy-toca.tsx`, `entrenamiento/registro-cliente.tsx`. `comparador-fotos.tsx`, `catalogo.tsx` y `cartera.tsx` ya los pasaban como props. En RN 0.86 `props.resizeMode` y `props.tintColor` tienen prioridad sobre el estilo (`Image.ios.js:142-143`), así que no cambia el aspecto.
- [x] Guarda permanente `src/imagen-props.spec.ts` (2 pruebas): resuelve los `StyleSheet.create` de cada archivo y falla si un `<Image>` recibe esas claves por estilo, por hoja o en línea.
- [ ] **Sin comprobar:** que el aviso haya desaparecido de la consola de un navegador real. Requiere arrancar Expo web + API; queda para quien lo ejecute (`npm run dev --workspace apps/mobile`, abrir la consola).

**Verificación:** `npm test --workspace apps/mobile` completo (ver evidencia global). **Archivos:** 5 + 1 spec.
**Verificación:** `npm test --workspace apps/mobile -- --runInBand` + recorrido web sin avisos en consola. **Archivos:** ≤ 5 (los que el aviso señale).

### M12a · Auditoría de accesibilidad de los flujos críticos (S, solo lectura)

**Descripción:** barrido estático de todo el código de `apps/mobile/src` y `apps/mobile/app` con el AST de TypeScript: roles, nombres accesibles y etiquetas.

- [x] **118 `Pressable`, 30 `TextInput` y 6 `Image`: 0 hallazgos** (sin rol, sin nombre ni texto, campo sin etiqueta ni placeholder, imagen sin etiqueta ni marca decorativa).
- [x] El detector se validó contra 4 defectos conocidos y los encontró todos. Un primer intento con expresiones regulares dio 15 «hallazgos» que eran **falsos positivos** (el `=>` de los `onPress` cortaba la etiqueta) y se descartó; un segundo intento del AST tenía un bug propio (contaba `onPress={…}` como texto) y también se corrigió antes de fiarme del 0.
- [ ] **No cubierto** por un barrido estático (requiere dispositivo o revisión humana): contraste real, objetivos táctiles ≥ 44 px en cada pantalla, orden de foco, TalkBack/VoiceOver, texto dinámico del sistema. Siguen en PENDIENTE-PARA-PRODUCCION.

**Salida:** la propia prueba permanente (M12b). No se redactó un informe aparte porque no hay hallazgos que listar. **Dependencias:** M00.

### M12b · Que el 0 se mantenga: guarda permanente de accesibilidad (S)

**Descripción:** como no hay hallazgos P1 que corregir, la mejora útil es impedir regresiones.

- [x] `apps/mobile/src/accesibilidad-estatica.spec.ts`: 3 pruebas — el detector marca los 4 defectos en un fuente de ejemplo, acepta los casos correctos, y **la app real no tiene ninguno** (exige además > 100 elementos revisados para detectar que el barrido siga alcanzándolos).

**Verificación:** `npm test --workspace apps/mobile -- accesibilidad-estatica` → 3/3. **Dependencias:** M12a. **Archivos:** 1.

### Checkpoint 3

- [ ] Móvil: tests, tipos y lint verdes · [ ] consola web sin avisos · [ ] hallazgos P1 de accesibilidad cerrados o justificados

## Fase 5 — Cierre

### M13 · Documentación al día (S)

**Criterios:** README con cifras reales de la última ejecución; `PENDIENTE-PARA-PRODUCCION.md` marca como resueltos plazos, CI y cobertura, y deja los bloqueos externos; ADR breve de plazos/CI si hubo decisiones; `tasks/revision-produccion-2026-10-27.md` no se reescribe (se enlaza).
**Verificación:** `npm run lint` (Prettier incluido). **Archivos:** ≤ 4 documentos.

### M14 · Revisión final y go/no-go (S)

**Criterios:** `code-review-and-quality` en cinco ejes sobre el diff completo de este plan; `security-and-hardening` sobre cambios de config/correo/borrado; `shipping-and-launch` produce un go/no-go que **no declara lista** una app con bloqueos externos abiertos.
**Verificación:** typecheck + lint + test + E2E + cobertura verdes; informe en `tasks/cierre-mejoras-2026-10-28.md`.

### Checkpoint final

- [ ] Criterios de cada tarea cumplidos con evidencia · [ ] ningún umbral, prueba o regla rebajados · [ ] bloqueos externos listados · [ ] David revisa antes de cualquier commit

## Evidencia global de la tanda (28-10-2026)

Estado del árbol: sin commit. Ejecutado tras el último cambio de código:

- `npm run typecheck`: correcto (raíz y 3 workspaces).
- `npm run lint` (ESLint + Prettier sobre todo el repositorio): correcto.
- `npm test`: **API 390/390 (43 suites)** y **móvil 733/733 (85 suites)**; línea base de partida: 352 y 728.
- `npm run test:cobertura` con `POSTGRES_DB=alpha_omega_e2e_codex`: 390 unitarias + **512 E2E (47 suites)** en verde; cobertura fusionada de 36 servicios y guardas: 96,06 % líneas · 94,31 % sentencias · 98,39 % funciones · 86,56 % ramas. El código de la API no cambió después de esa ejecución.

Estado por tarea: M00, M00b, M01 (propuesta), M02, M03, M04, M05, M05b, M06 (sin ejecutar en GitHub), M07 (propuesta, esperando D2), M11 (sin ver en navegador), M12a y M12b hechas. Pendientes: M08a–c (bloqueadas por D2), M09 (D3/D4), M10 (D5), M13 (documentación final), M14 (revisión final).

Hallazgo menor sin acción: `AlcanceClienteService.clientesDe` no filtra clientes desactivados, pero no tiene ningún llamador (código muerto); si se usa algún día, debe filtrar como `tieneAsignado`.
