# Ampliación del catálogo de ejercicios

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Incorporar las fichas que se pueden definir de la rutina y sus guías, los básicos adicionales investigados y las figuras gratuitas disponibles, conservando las fichas del entrenador.

**Architecture:** Mantener intacto el paquete inicial de 52 figuras. Añadir un catálogo textual independiente y un cargador conservador con simulación por defecto, validación previa y escritura transaccional. Ejecutar la instalación en la base local configurada únicamente después de comprobar el destino y las pruebas.

**Tech Stack:** TypeScript, Prisma, PostgreSQL, Zod, Jest y ffmpeg ya instalados.

Autorización: David aprobó la propuesta de ampliación con «pues instálate todos los que puedas». Incluye cargar las fichas y medios gratuitos; no incluye compras, creación de cuentas ni cambiar su rutina. Se trabaja en la carpeta compartida, rama `codex/cliente-intuitivo`, manteniendo sus archivos no registrados.

## Tarea 1: Contenido y cargador

Archivos nuevos:

- `apps/api/src/catalogo-ejercicios/catalogo-ampliado.ts`: contenido de fuerza, core, básicos, activación, movilidad y estiramientos que admite el vocabulario muscular actual.
- `apps/api/src/catalogo-ejercicios/preparar-ampliacion.ts`: importación de las fichas textuales, independiente de las figuras.
- `apps/api/test/catalogo-ampliado.e2e-spec.ts`: comprobaciones contra la base de pruebas, sin usar la principal.

- [x] Escribir primero pruebas de simulación, repetición, conservación de una ficha editada/retirada, equivalencias y ambigüedad. La prueba debe mostrar el fallo del nuevo cargador antes de implementarlo.
- [x] Validar el contenido con `CrearEjercicioSchema`, rechazando nombres o equivalencias repetidos entre entradas y conflictos con el catálogo inicial. Cada ficha lleva instrucciones propias, pasos, error a evitar y grupos musculares correctos; las cargas y repeticiones pertenecen a la rutina.
- [x] Implementar `prepararAmpliacion(prisma, { confirmar, entradas?, informar? })`. Resolver los nombres normalizados y las equivalencias sin inventar equivalencias de material. Si una entrada coincide con dos fichas existentes, abortar antes de escribir. Con `confirmar: false` no ejecutar ninguna escritura. Con `confirmar: true`, usar una transacción y crear solo lo ausente; nunca editar, borrar ni reponer fichas existentes.
- [x] El CLI imprime únicamente el nombre de la base, el modo y los nombres/resumen; no imprime credenciales. Sin `--confirmar` simula. Su ejecución como módulo no inicia el CLI.
- [x] Conservar las variantes explícitas de equipo y movimiento. Añadir RKC como ficha diferenciada, sin sustituir la plancha frontal. Para tríceps sobre la cabeza, publicar variantes con equipo concreto sin vincular automáticamente la indicación ambigua de la rutina. No crear un ejercicio que requiera inventar un grupo muscular inexistente.
- [x] Ejecutar pruebas y compilación:

```powershell
$env:POSTGRES_DB='alpha_omega_e2e_codex'
npm run test:e2e --workspace apps/api -- --testPathPatterns=catalogo-ampliado
npm run build --workspace apps/api
```

Resultado esperado: pruebas correctas; cero cambios en fichas preexistentes y cero figuras inventadas.

## Tarea 2: Figuras disponibles y activación

- [x] Arrancar Docker Desktop oculto si está apagado y levantar únicamente el servicio PostgreSQL existente, conservando su volumen.
- [x] Importar los originales ya descargados de Vital y MoveKit con el importador actual. Usar `MEDIOS_DIR` configurado y comprobar 52 MP4 y sus pósteres, incluidos sus formatos reales con ffprobe.

```powershell
node apps/api/dist/catalogo-ejercicios/importar-medios.js --vital C:/Users/david/AppData/Local/Temp/ao-vital --movekit C:/Users/david/AppData/Local/Temp/ao-muestra
```

- [x] Comprobar si la pieza gratuita de flexiones encontrada permite obtener e instalar un formato compatible sin crear cuentas ni pagar. Si no es posible, conservar la ficha textual y registrar la limitación; no convertir una vista previa en un medio instalado.
- [x] Compilar, verificar destino `alpha_omega`, simular ambos cargadores e inspeccionar los resultados antes de aplicar:

```powershell
node apps/api/dist/catalogo-ejercicios/preparar-catalogo.js
node apps/api/dist/catalogo-ejercicios/preparar-ampliacion.js
node apps/api/dist/catalogo-ejercicios/preparar-catalogo.js --confirmar
node apps/api/dist/catalogo-ejercicios/preparar-ampliacion.js --confirmar
```

- [x] Repetir la simulación: cero fichas por crear. Consultar recuentos reales y cobertura de la rutina. No dar por instaladas las fichas si solo se han guardado en código.

## Tarea 3: Revisión y entrega

- [x] Revisar cumplimiento de la propuesta y después calidad/idempotencia del cargador mediante un revisor independiente.
- [x] Añadir el comando de instalación a `package.json` y documentar recuentos reales, material pendiente y ausencia de animaciones donde corresponda.
- [x] Ejecutar la comprobación de tipos, las pruebas del catálogo y formato de los archivos modificados. Informar con claridad de los totales instalados, figuras disponibles y cualquier bloqueo real.

## Resultado verificado

- Base principal `alpha_omega`: 130 fichas publicadas, 74 altas nuevas y las 56 anteriores conservadas con todos sus campos, relaciones y fechas.
- Ampliación final: 36 rutina/variantes, 2 alternativas, 8 básicos, 20 movilidad/activación y 8 estiramientos.
- El catálogo inicial ya tenía sus 52 figuras asociadas; su simulación dio cero cambios, por lo que no fue necesario confirmarlo otra vez.
- 52 MP4 H.264 sin audio y 52 pósteres importados. LottieFiles pide crear cuenta para exportar el MP4 de flexiones; no se instaló esa pieza.
- Nueve pruebas nuevas correctas tras comprobar primero el fallo del cargador pendiente y después el fallo de validación cruzada. Se ejecutaron además 140 pruebas del catálogo y medios, compilación, tipos y lint de los archivos nuevos.
- Astra revisó independientemente: eliminada la prensa inclinada duplicada, corregido el apoyo de pies del press inclinado y añadida validación cruzada de alias iniciales. La segunda revisión no encontró bloqueos.
- Docker Desktop volvió a arrancar tras conservar y renombrar sus dos carpetas transitorias de sockets obsoletos. El volumen PostgreSQL se conservó.
- La simulación posterior dio cero altas. No se modificó la rutina ni se crearon cuentas, compras, commits o PR.
