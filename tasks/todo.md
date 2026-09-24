# Tareas activas — experiencia del cliente

> [Plan y decisiones](plan.md). Marcar una tarea hecha solo con criterios y verificación demostrados. El archivo de planes anteriores conserva sus pendientes históricos sin declararlos terminados.

## Base

- [x] **T00 · Integración y archivo.** Base Fable integrada por avance directo; rama `codex/cliente-intuitivo` creada; 21 documentos históricos archivados con índice y referencias actualizadas. Los HTML, PDF, scripts y archivos del usuario permanecen. Evidencia: avance directo desde `d7d8ef0`, `git diff --check` sin errores.

## Entrenamiento guiado

- [x] **T01 · Contratos compatibles.** RIR configurable, tipo de carga y serie omitida; documentos antiguos se leen. Evidencia: contratos compartidos y pruebas de compatibilidad API.
- [x] **T02 · Controles profesionales.** Ajustes editables en sesión y constructor, incluso al duplicar y publicar. Evidencia: pruebas de editor/constructor y tipos completos.
- [x] **T03 · Navegación.** Ejercicio actual, lista plegable y orden pautado; RIR final mantiene el ejercicio visible hasta avanzar. Evidencia: pruebas del modelo y la tabla de series.
- [x] **T04 · Registro.** Campos por unidad/carga, «Hecha», omisión, RIR opcional, técnica y molestia accesibles. Calentamiento con carga externa solicita kg. Evidencia: pruebas de componentes y validación de registro.
- [ ] **T05 · Tiempo y recuperación.** Código y pruebas de reloj, pausa, recarga y sincronización pasan; falta comprobar bloqueo, salida y recuperación en un móvil físico.
- [ ] **T06 · Inicio y fecha.** Estados y cambio semanal implementados, incluido inicio sin red desde copia local. Pruebas de semana y API pasan; falta revisión visual del cliente autenticado.

**Punto de control 1:** configurar, iniciar, registrar, salir, continuar y mover fecha conservando prescripción y datos.

## Entrega y comunicación

- [x] **T07 · Envío.** Intención persistida antes de la red, reintentos con UUID estable y conflicto recuperable. Evidencia: pruebas de pérdida de respuesta, desconexión y envío HTTP.
- [x] **T08 · Cierre visible.** Resumen hechas/omitidas/pendientes y estados de guardado/entrega; progresión solo en panel profesional. Evidencia: pruebas de cierre, control y resultado.
- [x] **T09 · Revisión y novedades API.** Revisión explícita y lectura por actor con permisos; las respuestas concurrentes a molestias no duplican avisos. Evidencia: migración aplicada y pruebas HTTP.
- [x] **T10 · Seguimiento visible.** Revisión en panel, novedades en inicio y cambios de día para entrenador; lista paginada sin avisos inaccesibles. Evidencia: pruebas de componentes, persistencia y permisos HTTP.

**Punto de control 2:** envío confirmado sin pérdida; revisión y respuesta distinguibles por cliente.

## Nutrición

- [x] **T11 · Formato por comida.** Selector, valores iniciales, vista previa y confirmación al cambiar de formato con contenido. Evidencia: pruebas de editor, borrador y publicación.
- [x] **T12 · Comidas cliente.** Plato único, varios platos e intercambio explícito; solo el detalle permite registrar, con selección conservada tras fallo. Evidencia: pruebas de las tres situaciones y corrección.
- [x] **T13 · Suplementos.** Inicio muestra solo los publicados y comparte registro diario con Nutrición. Evidencia: pruebas con dietas con/sin suplementos.

## Seguimiento

- [x] **T14 · Configuración y API.** Indicadores, frecuencia, peso y pruebas prescritas con revisión y permisos. Evidencia: migración aditiva y pruebas HTTP en `alpha_omega_e2e_codex`.
- [x] **T15 · Panel profesional.** Editor y vista previa del seguimiento del cliente. Evidencia: pruebas de guardado y relectura.
- [x] **T16 · Progreso.** Indicadores, próximo registro, resultados prescritos e historial. Evidencia: pruebas con datos existentes, vacíos y parciales.

**Punto de control 3:** dieta mixta y seguimiento publicados por profesional coinciden con lo registrado por cliente.

## Final

- [ ] **T17 · Integración y calidad.** Código, especificaciones y servicios integrados en la carpeta principal. Comandos completos pasan; faltan revisión visual a 360/390 px en pantallas autenticadas y dispositivo físico.
- [ ] **Prueba física y observada.** Comprobar en móvil bloqueo, pausa, recuperación y pérdida de conexión. Observar a tres personas continuar, registrar serie, mover día, registrar comida y encontrar respuesta sin instrucciones; guardar resultados.

## Evidencia de integración · 24-09-2026

- `npm run typecheck`: correcto.
- `npm run lint`: correcto; incluye ESLint y Prettier.
- `npm test`: 17 suites / 100 pruebas API; 50 suites / 265 pruebas móvil.
- `$env:POSTGRES_DB='alpha_omega_e2e_codex'; npm run test:e2e` (PowerShell): 31 suites / 318 pruebas HTTP en la base dedicada, sin usar la base de demostración.
- `npm run build --workspace apps/api`: correcto.
- `npx prisma migrate status`: 22 migraciones; base `alpha_omega` al día.
- `git diff --check`: sin errores.
- API integrada en `http://localhost:3000/salud` y web en `http://localhost:8181/login`: ambas responden 200. La sesión del navegador caducó; falta entrar de nuevo para revisar las pantallas autenticadas.
