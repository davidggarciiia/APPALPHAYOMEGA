# Encargo para Claude — valoración integral y registro del cliente

> Preparado el 24-09-2026 con Agent Skills. Este archivo es la entrada al encargo, no un plan alternativo. El alcance está en `tasks/plan.md`; el orden verificable, en `tasks/todo.md`. En esta sesión se ha escrito documentación y revisado fuentes: **la ampliación aún no se ha implementado**.

## Petición

Implementa el plan completo de valoración inicial y revisiones periódicas: medidas corporales, perímetros, pliegues, bioimpedancia, las cinco pruebas físicas indicadas por David, fotos y evolución. Integra todo en el panel profesional y en Progreso del cliente, manteniendo el diseño y la filosofía de la app: el entrenador configura y publica; el cliente consulta, registra lo solicitado y devuelve feedback.

Incluye las mejoras aprobadas después de revisar los PDF: distancia en metros, cardio con sus datos reales, chequeo previo breve configurable, resumen de recuperación para el entrenador, prioridades cuando falta tiempo y aplicación profesional de fases/descarga. **David respondió «todo menos k1»: no implementes D03 ni un nuevo registro real de K-1 ni preguntas de K-1 dentro del chequeo.** Conserva el historial y la descripción de otros deportes que ya existe en los planes.

## Leer antes de editar

1. [Plan único](plan.md): decisiones, datos, permisos, compatibilidad, comportamiento y alcance.
2. [Tareas activas](todo.md): conserva los T/R hechos y pendientes; ejecuta los nuevos C/V/M/P/F/E/D/Q respetando dependencias y subdivisiones.
3. [Revisión de PDF y decisión de David](revision-pdfs.md): capacidades existentes, diferencias y alcance aprobado.
4. [Especificación de seguimiento](../SPEC-seguimiento-corporal.md), [entrenamiento](../SPEC-entrenamiento.md), [mapa de capacidades](../CAPABILITY-MAP.md) y [ADR de fotos](../docs/adr/0005-almacenamiento-de-fotos.md). Actualiza las especificaciones afectadas dentro de las primeras tareas, conforme al plan ampliado.

Flujo solicitado: **Agent Skills → especificación → tareas pequeñas → implementación incremental con pruebas → revisión → integración.** Skills instaladas en esta máquina bajo `C:/Users/david/.claude/skills/`, empezando por `using-agent-skills`, `spec-driven-development`, `planning-and-task-breakdown`, `incremental-implementation` y `test-driven-development`. Respeta las decisiones ya confirmadas; no vuelvas a pedir todo el alcance.

## Base real

- Carpeta: `C:/Users/david/Desktop/APP-ALPHA_OMEGA`.
- Rama al preparar el encargo: `codex/cliente-intuitivo`. Revisa `git status` y el último commit antes de empezar; no asumas que nadie ha trabajado después.
- La base Fable ya se integró y las correcciones iniciales están guardadas. **No repitas T00 ni integres de nuevo una copia vieja.**
- Última verificación de código: 51 suites / 282 pruebas móvil; tipos y lint correctos. Evidencia previa completa en `todo.md`; no la presentes como una prueba nueva de tu implementación.
- Web local actual: `http://localhost:8181`; API: `http://localhost:3000`.
- El acceso de prueba ha devuelto error de credenciales en el navegador. C00 exige diagnosticar cuenta/entorno antes de validar UI autenticada; no resetear contraseñas, recrear cuentas ni cambiar la base para ocultar el fallo. Si falta un dato imprescindible, explicar el bloqueo de ese recorrido y continuar las tareas independientes.

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
$valoracionDbAnterior = $env:POSTGRES_DB
try {
  $env:POSTGRES_DB = 'alpha_omega_e2e_codex'
  npm run test:e2e
  if ($LASTEXITCODE -ne 0) { throw 'Fallaron las pruebas HTTP' }
} finally {
  if ($null -eq $valoracionDbAnterior) {
    Remove-Item Env:POSTGRES_DB -ErrorAction SilentlyContinue
  } else {
    $env:POSTGRES_DB = $valoracionDbAnterior
  }
}
npm run build --workspace apps/api
git diff --check
```

Ejecuta las pruebas HTTP en ese proceso de pruebas dedicado, nunca contra la base de demostración. Comprueba también el nombre de base antes de ejecutar migraciones de pruebas o limpieza de fixtures; restablece el entorno anterior antes de arrancar la API de demostración. Comprueba el código de salida de cada comando y resuelve los fallos antes de declarar la verificación completa.

Registra recorridos a 360 y 390 px y panel profesional en escritorio. Se necesitan comprobaciones reales de teclado, pausa/bloqueo, pérdida de conexión, fotos y recuperación en un móvil físico. La prueba observada con tres personas sigue pendiente hasta realizarla; no la sustituyas por tests ni por una captura de navegador.

## Entrega esperada

Actualiza `todo.md` con tarea, cambio, pruebas ejecutadas y resultado. Deja la app integrada y arrancada desde la carpeta principal, con los enlaces correctos. Informa por separado qué está implementado, qué se verificó automáticamente, qué se vio en navegador y qué comprobación física o decisión externa sigue pendiente. No declares completada la iteración mientras existan condiciones de entrega sin evidencia.
