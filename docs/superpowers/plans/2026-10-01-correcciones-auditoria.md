# Correcciones de auditoría Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Corregir los 41 hallazgos reproducidos del informe y los cuatro errores adicionales del anexo nativo, con regresiones y evidencia de verificación por caso; resolver sus cuatro observaciones concretas de interfaz.

**Architecture:** Conservar datos y operaciones completas en móvil; serializar comprobación y escritura en los servicios existentes. Cada agente tiene archivos asignados y comunica cualquier cambio de interfaz antes de editar archivos compartidos.

**Tech Stack:** TypeScript, NestJS, Prisma/PostgreSQL, Zod, Expo/React Native, Jest.

## Método de cada caso

- [x] Escribir una regresión en la suite existente del servicio o componente que exprese el resultado esperado del caso numerado.
- [x] Ejecutarla con `npm test --workspace apps/api -- --runInBand <spec>` o `npm test --workspace apps/mobile -- --runInBand <spec>` y registrar el fallo funcional esperado.
- [x] Aplicar la corrección mínima al recorrido real y conservar compatibilidad con documentos publicados.
- [x] Repetir la regresión y las suites vecinas hasta que pasen; registrar archivos, comando y resultado por número.
- [x] Revisar requisitos y calidad con un agente distinto antes de cerrar el caso.

## A. Identidad y medios — agente seguridad

**Files:** `apps/api/src/identity/{auth.service,tokens-refresco.service,usuarios.service,limitador-intentos.service}.ts`, sus specs; `apps/api/src/config/`, `apps/api/src/main.ts`; `apps/api/src/medios/{medios.service,limpieza-medios,imagenes}.ts`, sus specs; `apps/api/src/seguimiento/solicitudes-fotos.service.ts`, su spec; límites de autores en `packages/shared/src/{medios,valoraciones}.ts`.

- [x] 1 Revalidar credenciales y estado durante emisión coordinada con restablecimiento; contraseña antigua no crea sesión después del cambio.
- [x] 2 Serializar cierre y canje de familia; ningún sucesor vivo tras logout completado.
- [x] 18 Reservar intentos en curso para limitar ráfagas sin excluir logins legítimos indebidamente.
- [x] 21 Releer el token dentro del bloqueo para reconocer la rotación ganadora, sin revocación falsa.
- [x] 25 Reactivación no puede sobrescribir una activación posterior; comprobar estado vigente durante transición.
- [x] 37 Enmascarar identificador personal del limitador en logs.
- [x] 39 Configurar confianza explícita y restringida en proxy; clientes distintos mantienen contadores distintos.
- [x] 12 Coordinar limpieza y renovación del objeto temporal para no borrar la subida renovada.
- [x] 17 Nueva foto tras revisión devuelve solicitud a pendiente de revisión o rechaza claramente la intención anterior.
- [x] 26 Compatibilizar límites válidos de nombre y apellidos con salida de autor en fotos y valoraciones.
- [x] 36 Rechazar PNG con IHDR inválido o sin datos de imagen antes de publicarlo como disponible.

## B. Servicios de dominio — agente dominio

**Files:** `apps/api/src/entrenamiento/{planes,sesiones,molestias,comentarios,registros}.service.ts`, `apps/api/src/seguimiento/{seguimiento,valoraciones}.service.ts`, `apps/api/src/nutricion/{comidas,dietas}.service.ts`, `apps/api/src/agenda/agenda.service.ts`, sus specs y pruebas HTTP dedicadas.

- [x] 3 Cinco escrituras comprueban y bloquean consentimiento vigente dentro de la transacción; retirada completada impide nuevos datos.
- [x] 9 Separar revisión del plan de versión del formato del replay; editar bloque conserva replay de asignación.
- [x] 10 Comparar toda la petición de molestia al reutilizar UUID, incluyendo síntomas y nota.
- [x] 11 Recuperar colisión única de medidas, pruebas, molestias y comentarios con replay idéntico o conflicto contractual.
- [x] 13 Respetar registroComidas:false en la API.
- [x] 14 Exigir todas las columnas de un plato de intercambio.
- [x] 15 Coordinar registro y publicación de dieta para no escribir contra una dieta archivada.
- [x] 16 Normalizar precisión decimal de pruebas antes de almacenar y comparar replay.
- [x] 27 Rechazar definiciones desconocidas antes de filtrar, conservando el borrador previo.
- [x] 28 Incluir grasaPorPliegues como resultado publicable.
- [x] 29 Publicación idéntica concurrente devuelve la misma publicación.
- [x] 30 Coordinar asociación de foto y cierre del borrador; foto incluida o error claro, nunca éxito invisible.
- [x] 34 Mejor serie por ejercicio del catálogo y sesión considerando todas sus apariciones.
- [x] 35 Buscar ejecuciones anteriores fuera de una ventana global de 60 sesiones ajenas.
- [x] Riesgo SQL adicional: ordenar bloqueos de mover y enviar para eliminar el ciclo y añadir regresión apropiada; mantener límites de evidencia.

## C. Sesión, persistencia y seguimiento móvil — agente móvil

**Files:** `apps/mobile/src/{sesion.tsx,lib/peticion-autenticada.ts}`, `apps/mobile/src/entrenamiento/{almacen-dispositivo,almacen-local,clave-local,persistencia.web,documento-local,registro-control}.ts`, `apps/mobile/src/seguimiento/{borrador-valoracion,solicitudes-fotos,hoy-diario}.tsx`, `apps/mobile/src/seguimiento/modelo.ts`, suites vecinas.

- [x] 19 Caché de consulta del plan no cuenta como edición pendiente.
- [x] 22 Rotación posterior en otra pestaña no revoca la cuenta ni limpia borradores.
- [x] 23 Crear clave de cifrado una sola vez entre pestañas.
- [x] 24 Detectar edición compartida antes de sustituir un documento y conservar ambas copias.
- [x] 31 Resolver conflicto con borrador cerrado muestra estado publicado sin crash.
- [x] 32 Conservar solicitud de fotos completa al perder respuesta; cambiar contenido usa operación nueva únicamente tras confirmar la anterior.
- [x] 33 Respuesta pendiente no cierra una edición posterior ni elimina su texto.
- [x] 38 Validar minutos de sueño entre 0 y 59.

## D. Editores profesionales y nutrición — root

**Files:** `apps/mobile/src/nutricion/{editor-modelo,editor-dieta,ficha-nutricion,pauta,calculo}.ts[x]`, `apps/mobile/src/entrenamiento-entrenador/{editor-modelo,editor-plan,editor-rutina}.ts[x]`, `apps/mobile/src/entrenamiento-entrenador/constructor/{modelo,constructor}.ts[x]`, specs vecinas.

- [x] 4 Conservar suplementos, notas, cálculos, registro y margen en editor avanzado y Pauta; modificar solo la nota no cambia dosis.
- [x] 5 Conservar partes, circuito y prescripción completa al editar rutina/plan.
- [x] 6 Conservar series distintas o impedir adaptar sin advertir y revisar su diferencia.
- [x] 7 Respuesta de guardado solo marca guardada la versión enviada; cambios posteriores quedan pendientes.
- [x] 8 Guardar revisión alcanzada y solicitud de publicación para repetir la fase correcta.
- [x] 20 Reenviar exactamente el plan pendiente con los mismos UUID; no eliminarlo ni duplicar sesiones tras respuesta perdida.
- [x] 40 Reconstruir porcentajes con suma válida tras redondeo de gramos.
- [x] 41 Límite de indicaciones produce aviso explícito y conserva datos; nunca descartar silenciosamente peso diario.

## E. Anexo nativo y recorridos adicionales

- [x] N1 Seguridad: no acceder al reproductor liberado durante la limpieza de foco; conservar pausa al salir y reanudación al volver.
- [x] N2 Móvil: transporte autenticado en cartera, alta, ficha y asignaciones.
- [x] N3 Móvil: asociar comentario pendiente y borrador a su sesión; impedir cambios durante envío.
- [x] N4 Root: nombrar «Crear plan nuevo» la acción que abre una asignación nueva.
- [x] U1 Móvil: misma definición de series de trabajo en progreso, cierre y resumen.
- [x] U2 Móvil: salida explícita al plan tras enviar entrenamiento.
- [x] U3 Móvil: separar nombre y técnica con layout flexible; documentar la falta de medición visual nueva a 320 px.
- [x] U4 Root: confirmar descarte de cambios al salir del constructor.

## F. Casos residuales del perfil completo

- [x] R1 Móvil: reabrir AES Base64 existente como bytes compatibles con la frontera Android; conservar formato y clave. Diagnosticar fallos de lectura y guardado local también al reintentar, sin pedir conexión.
- [x] R2 Dominio: comprobar consentimiento en las cinco escrituras de valoraciones dentro de transacción; probar retirada después del guard con HTTP y estado sin cambios.
- [x] R3 Seguridad: validar zlib, filas filtradas y Adam7 del PNG con límite previo de 64 MiB; rechazar IDAT01 y confirmar PNG válido con HTTP.

## G. Integración y entrega

- [x] Matriz de cobertura de los números 1–41, sin huecos ni afirmaciones basadas solo en el informe del implementador.
- [x] Revisión de especificación por otro agente y posterior revisión de calidad; reparar observaciones.
- [x] `npm run typecheck`, unitarios API y móvil en serie, compilación API y exportación web pertinente.
- [x] ESLint y Prettier de archivos propios, `git diff --check`; preservar archivos concurrentes sin formatearlos.
- [x] Ejecutar carreras HTTP en PostgreSQL dedicado si puede iniciarse de forma aislada; documentar cualquier limitación real.
- [x] Guardar resumen de correcciones y verificaciones en `tasks/correcciones-auditoria-2026-10-04.md` y entregar el resultado local revisable.
