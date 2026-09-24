# Encargo para Claude — corregir e integrar Alpha & Omega

> Actualizado el 24-09-2026 con Agent Skills, por petición de David: «apunta los cambios en un plan para que lo solucione el claude». Este archivo es la entrada al encargo. Hay un solo [plan activo](plan.md), con su [lista de tareas y evidencias](todo.md).

## Petición

Continúa desde **RI00**, preserva las correcciones verificadas y resuelve las siete RI de la revisión integral. Completa después los recorridos pendientes de fotos, avisos y las mejoras de los PDF que siguen aprobadas. Mantén el diseño y la filosofía de la app: el entrenador configura y publica; el cliente consulta, registra lo solicitado y devuelve feedback.

La valoración integral ya tiene contratos, API, panel y parte de la experiencia cliente: **no vuelvas a construirla desde cero**. El alcance posterior registrado en [coordinación](coordinacion-claude-codex.md) y `a79cfc5` limita las mejoras de los PDF a **D01, D04 y D07**. D02/D03/D05/D06 quedan fuera; los párrafos históricos del plan no las reactivan.

## Leer antes de editar

1. [Plan único](plan.md): decisiones, datos, permisos, compatibilidad, comportamiento y alcance.
2. [Tareas activas](todo.md): ejecuta el desglose RI del principio y conserva los estados/evidencias anteriores. Integra D01 antes de RI03; no recorras mecánicamente las tareas históricas ya terminadas.
3. [Revisión integral](revision-integral-2026-09-24.md): siete hallazgos contrastados en el código, integración y comprobaciones pendientes. [Revisión de PDF](revision-pdfs.md): fuente histórica, subordinada a la decisión posterior registrada en coordinación.
4. [Especificación de seguimiento](../SPEC-seguimiento-corporal.md), [entrenamiento](../SPEC-entrenamiento.md), [mapa de capacidades](../CAPABILITY-MAP.md) y [ADR de fotos](../docs/adr/0005-almacenamiento-de-fotos.md). Actualiza las especificaciones afectadas dentro de las primeras tareas, conforme al plan ampliado.

Flujo solicitado: **Agent Skills → especificación → tareas pequeñas → implementación incremental con pruebas → revisión → integración.** Skills instaladas en esta máquina bajo `C:/Users/david/.claude/skills/`, empezando por `using-agent-skills`, `spec-driven-development`, `planning-and-task-breakdown`, `incremental-implementation`, `test-driven-development` y `code-review-and-quality`. Respeta las decisiones ya confirmadas; no vuelvas a pedir todo el alcance.

## Base real

- Carpeta: `C:/Users/david/Desktop/APP-ALPHA_OMEGA`.
- Rama: `codex/cliente-intuitivo`, base revisada `f931b5c` más cambios locales **todavía sin commit**. Revisa `git status` y el último commit antes de empezar; no asumas que nadie ha trabajado después.
- La base Fable ya se integró. **No repitas T00 ni integres de nuevo una copia vieja.** RI00 exige revisar y consolidar el trabajo local antes de integrar la rama de mejoras; la antigua espera de un commit de Codex no obliga a descartar estos cambios.
- Consentimiento y confirmación de fotos están corregidos y revisados. Conserva UUID final por intento, fila duradera anterior al PUT y descarte recuperable. No vuelvas a una clave final compartida ni a bloquear una transacción durante I/O de almacenamiento. Regresiones en `consentimiento-pendientes.e2e-spec.ts` y `medios.e2e-spec.ts`; arquitectura en el ADR.
- Última verificación: **188 pruebas API + 452 móviles + 448 HTTP = 1.088 pruebas correctas**. Tipos, lint, build API y `git diff --check` correctos. Esta evidencia corresponde a la base revisada; repite los controles después de tus cambios.
- `alpha_omega` y `alpha_omega_e2e_codex` tienen 26 migraciones aplicadas, incluida `20260924210000_intentos_foto`. Las cuatro pendientes de la base principal se aplicaron de forma aditiva; no hubo reset, seed ni modificación de cuentas.
- Web local actual: `http://localhost:8181`; API: `http://localhost:3000`.
- La API se reinició con el build verificado de la carpeta principal; `/salud` y la página de acceso responden. **No se ha realizado el recorrido autenticado ni el ensayo físico en esta pasada.** La cuenta facilitada anteriormente correspondía a otro entorno según C00; verifica cuenta/API/base antes de probar ambos roles. No resetees contraseñas ni recrees cuentas para ocultar una discrepancia de entorno.

### Coordinación con tu otro worktree

`C:/Users/david/Desktop/APP-ALPHA_OMEGA-mejoras`, rama `claude/mejoras-pdf`, contiene D01. Último HEAD observado: `2ff2594`, después de `e47e763` y `c5d22f4`. Puede seguir cambiando: registra su estado real antes de integrar.

Conserva tanto metros como el nuevo control de consentimiento en `registros.service.ts`. Reconcilia documentación por secciones; **no copies el `todo.md` antiguo de ese worktree sobre el de la carpeta principal**. Usa commits y archivos explícitos: no `git add .`, `reset --hard` ni `clean`. Coordina también las bases: esa rama usaba `alpha_omega_e2e_claude_d`; no ejecutes dos suites que limpien fixtures sobre la misma base simultáneamente.

## Orden de ejecución

1. **RI00 → RI01/RI02/RI04:** consolidar; cierre con los datos comprometidos; guardado protegido; motivo correcto de consulta en nutrición.
2. **RI05 → RI06a/RI06b:** composición sin mezclar tomas e histórico paginado completo, con compatibilidad y permisos.
3. **D01 integrado → RI03:** metros y registro parcial de calentamiento/vuelta a la calma.
4. **RI07a/RI07b → F03b → F04b/F05b:** temporales nativos, subida profesional, solicitud del cliente y comparación.
5. **E02c, D04/D07 y catálogo:** avisos profesionales, chequeo configurable, aplicación de fases y figuras reales.
6. **E03/Q01/Q02/Q03:** integración, revisión, controles completos y pruebas reales documentadas.

Cada tarea del principio de `todo.md` incluye archivos, dependencia, criterios y comandos. Hay puntos de control cada dos o tres tareas; revisa el resultado y continúa dentro del alcance autorizado.

Las figuras **no están instaladas en la carpeta configurada**: la simulación actual informa 52 ejercicios por crear y 52 archivos sin importar. Localiza los medios gratuitos y sus licencias; no presentes una lista de nombres como animaciones listas. La carga inicial de la base principal conserva el requisito de autorización de PR3. La caché nativa y la subida profesional también siguen pendientes aunque exista el flujo web del cliente.

## Fuentes y datos

Los tres PDF de referencia están en `PDF/referencias-entrenador/`, extraídos del ZIP de WhatsApp indicado por David. Consúltalos localmente; son referencias personales y permanecen fuera de Git. No copies resultados personales, diagnósticos, contraseñas ni fotos reales a pruebas, seeds, logs o servicios externos. Usa fixtures sintéticos.

No aparece la lista exacta de pliegues/perímetros en esos PDF: la plantilla debe ser configurable. No inventes un protocolo concreto, una sexta prueba ni los resultados iniciales que faltan. Los dispositivos se registran manualmente; no hay encargo de Bluetooth, sincronización de básculas o banda pectoral. Las instrucciones deportivas del PDF no son autorización para que la app modifique la prescripción por su cuenta.

## Reglas de implementación

- Un incremento verificable a la vez; si supera aproximadamente cinco archivos, divide la tarea antes de editar. Código, pruebas y evidencias en commits acotados.
- Un solo responsable de contratos, migraciones, archivos de dependencias y pantallas compartidas. Si repartes trabajo, asigna archivos concretos y vuelve a integrar antes del siguiente tramo dependiente.
- Conserva cuentas, registros históricos, borradores y archivos del usuario. Las migraciones son aditivas; nunca uses `db:reset` en la base principal.
- Distingue valoración nueva, revisión periódica y corrección de una publicación. Copiar una visita nueva no copia resultados. No mezcles unidades, métodos, variantes o instrumentos incompatibles en la evolución.
- Cliente: lectura de valoraciones publicadas y aportaciones solicitadas. Entrenador: configuración, resultados profesionales, publicación/corrección. Aplica los permisos también en API y medios; no confíes en ocultar botones.
- Lo que se publique debe estar conectado desde UI hasta persistencia y vuelta a lectura. Retira el código sustituido cuando no queden consumidores; evita componentes muertos y estados que parezcan completos sin tener efecto.
- Sigue el ADR para fotos privadas. Prueba con almacenamiento local compatible; no contrates ni habilites un proveedor externo sin la decisión correspondiente. La selección del proveedor no impide terminar la integración local.
- Las diferencias opcionales de la maqueta de Perfil y los controles de vídeo no forman parte de D01–D07: no cambies el diseño ni amplíes el encargo por encontrarlas en el PDF antiguo.

## Comprobación

Primero corre las pruebas focales indicadas en cada tarea. Al integrar, desde la raíz:

```powershell
npm run typecheck
npm run lint
npm test
npm run build --workspace apps/api
git diff --check
```

En una terminal dedicada solo a pruebas, desde la raíz:

```powershell
$env:POSTGRES_DB = 'alpha_omega_e2e_codex'
$env:ALMACEN = 'local'
$env:ALMACEN_LOCAL_DIR = Join-Path $env:TEMP 'alpha-omega-claude-revision'
$env:MEDIOS_LIMPIEZA_MINUTOS = '0'
npm exec --workspace apps/api -- prisma migrate status
npm run test:e2e --workspace apps/api -- --testTimeout=30000
```

Comprueba el destino antes de migrar o limpiar fixtures. **Nunca ejecutes HTTP contra `alpha_omega` ni arranques la API habitual heredando estas variables de pruebas.** Comprueba el código de salida de cada comando y resuelve los fallos antes de declarar la verificación completa. No contrates almacenamiento ni publiques servicios para completar la verificación local.

Registra recorridos a 360 y 390 px y panel profesional en escritorio. Se necesitan comprobaciones reales de teclado, pausa/bloqueo, pérdida de conexión, fotos y recuperación en un móvil físico. La prueba observada con tres personas sigue pendiente hasta realizarla; no la sustituyas por tests ni por una captura de navegador.

## Entrega esperada

Actualiza `todo.md` con tarea, cambio, pruebas ejecutadas y resultado. Deja la app integrada y arrancada desde la carpeta principal, con los enlaces correctos. Informa por separado qué está implementado, qué se verificó automáticamente, qué se vio en navegador y qué comprobación física o decisión externa sigue pendiente. La preparación de producción incluye almacenamiento privado real, correo/enlaces HTTPS, copia/restauración, distribución y revisión de los textos/procedimientos con sus responsables; no está resuelta por tener tests verdes. No declares completada la iteración mientras existan condiciones de entrega sin evidencia.
