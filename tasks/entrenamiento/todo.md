# Tareas de Codex — entrenamiento

> Estado: ejecución de Codex autorizada por David el 2026-09-18 («comienza tu parte»).
> C00 en curso. Ninguna tarea terminada todavía.
> [Plan general](plan.md) · [Plan independiente de Fable](plan-fable.md).
> Los identificadores C pertenecen a Codex; los F están en [todo-fable.md](todo-fable.md).
> Esta lista no sustituye `tasks/todo.md` de identidad.

## Regla de ejecución

Una tarea cada vez. Si una tarea supera los cinco archivos previstos o necesita
cambiar el contrato, se divide o se actualiza el plan antes de implementarla.
Cada entrega distingue implementación, tests y comprobación en dispositivo.

Antes de ejecutar, David valida primero los planes y después las tareas. Cada
checkpoint presenta evidencia para revisión humana antes del siguiente incremento;
la revisión cruzada entre Codex y Fable no sustituye esa revisión.

Antes de cada commit: `npm run test`, `npm run typecheck`, `npm run lint`.
Antes de un test enfocado: `npm run build:shared`. Las pruebas HTTP que usan la
misma base se ejecutan en turnos. Los patrones de tests indicados son nombres
de archivos a crear, no pruebas existentes.

La documentación aprobada se versiona primero, sin incluir cambios ajenos. El
commit base y los commits entregados se anotan al final de este documento.

## Incremento 0 — base compartida

### C00 — Fijar contratos por módulo

- [ ] Definir esquemas Zod de catálogo, agenda y entrenamiento; separar DTOs de
      cliente, entrenador, borrador y resultado.
- [ ] Validar fechas reales, discriminación repeticiones/tiempo, objetivos
      opcionales, límites de longitud, revisiones e ids de operación.
- [ ] Exportar sin modificar los contratos de identidad; incluir ejemplos de
      respuestas válidas y tests que rechacen mezcla de series y campos incompatibles.

**Dependencias:** PLAN y TASKS aprobados. **Alcance:** M, cinco archivos.
**Archivos:** `packages/shared/src/catalogo-ejercicios.ts`, `agenda.ts`,
`entrenamiento.ts`, `index.ts`; `apps/api/src/entrenamiento/contratos.spec.ts`.
**Verificar:** `npm run build:shared`;
`npm run test --workspace apps/api -- --runInBand contratos`; `npm run typecheck`.

### C01 — Habilitar pruebas de interacción móvil

- [ ] Instalar únicamente las dependencias aprobadas en el plan, fijando el lockfile.
- [ ] Añadir un script `test` sin modo watch y preset Expo, sin incluir tests en `app/`.
- [ ] Ejecutar una prueba significativa del formulario existente y verificar
      que Jest de API y de móvil conviven con React 19.2.3.

**Dependencias:** PLAN y TASKS aprobados. **Alcance:** M, cinco archivos.
**Archivos:** `apps/mobile/package.json`, `package-lock.json`,
`apps/mobile/jest.config.cjs`, `apps/mobile/tsconfig.json`,
`apps/mobile/src/componentes/formulario.spec.tsx`.
**Verificar:** `npm run test --workspace apps/mobile -- --runInBand formulario`;
`npm run test --workspace apps/api -- --runInBand`; `npm run typecheck`.

### C02 — Preparar la persistencia del catálogo

- [ ] Añadir `Ejercicio`, grupos y restricciones de nombre; ninguna relación a clientes.
- [ ] Crear y revisar una migración aditiva; no borrar ni reiniciar la base de desarrollo.
- [ ] Registrar un módulo de catálogo vacío para que Fable añada sus servicios
      sin modificar el módulo raíz.

**Dependencias:** C00 y vocabulario aprobado con el plan. **Alcance:** M, cuatro archivos.
**Archivos:** `apps/api/prisma/schema.prisma`, una migración de catálogo,
`apps/api/src/catalogo-ejercicios/catalogo-ejercicios.module.ts`, `apps/api/src/app.module.ts`.
**Verificar:** `npx prisma validate`; `npx prisma migrate dev --name catalogo_minimo`;
`npm run db:generate`; `npm run build --workspace apps/api`.
Ante una propuesta de reset, detener la migración y analizar el drift; no aceptarla.

### Checkpoint 0A — base compilable

- [ ] C00–C02 pasan sus comprobaciones y el proyecto sigue arrancando.
- [ ] El contrato puede ser leído y usado por Fable sin decidir otros campos.
- [ ] Registrar el commit de contrato y presentar la evidencia del checkpoint a David.

### C03 — Ofrecer un transporte HTTP común a los módulos nuevos

- [ ] Extraer la petición de red de `src/lib/api.ts` conservando el comportamiento
      de las funciones de identidad existentes.
- [ ] Tipar errores 400/409 y cuerpos de respuesta; no tratar 403 como cierre de sesión.
- [ ] Añadir un punto de acceso autenticado que C06 conectará a la renovación,
      manteniendo ids de operación en reintentos.

**Dependencias:** C01. **Alcance:** M, cuatro archivos.
**Archivos:** `apps/mobile/src/lib/api.ts`, `http.ts`, `http.spec.ts`,
`peticion-autenticada.ts`.
**Verificar:** `npm run test --workspace apps/mobile -- --runInBand http`;
`npm run typecheck`. Repetir login y lectura de perfil en desarrollo.

## Incremento 1 — catálogo y recuperación local en paralelo

### C04 — Probar el almacén privado de borradores

- [ ] Persistir por cuenta/sesión con SQLite nativo y cifrado Crypto; clave pequeña
      en SecureStore. Proveer adaptador web para desarrollo con límites documentados.
- [ ] Serializar escrituras y devolver confirmación solo tras persistencia;
      errores de cifrado, disco o lectura no borran silenciosamente la copia anterior.
- [ ] Comprobar en Expo Go guardar, cerrar y recuperar un documento mayor que
      el límite histórico de una entrada pequeña del llavero.

**Dependencias:** C01. **Alcance:** M, cinco archivos.
**Archivos:** `apps/mobile/src/entrenamiento-cliente/almacen-borradores.ts`,
`almacen-borradores.web.ts`, `cifrado-borradores.ts`, `almacen-borradores.spec.ts`,
`cifrado-borradores.spec.ts`.
**Verificar:** `npm run test --workspace apps/mobile -- --runInBand borradores`;
`npm run typecheck`; prueba nativa de recuperación y aislamiento entre cuentas.

### C05 — Recuperar sesiones descargadas sin conexión

- [ ] Persistir identidad local mínima tras autenticación y distinguir sesión
      online de acceso local limitado a sesiones descargadas del cliente.
- [ ] Un fallo de red permite el borrador local; 401 o cambio de cuenta no
      conceden acceso al servidor ni al historial de otra persona.
- [ ] Conservar el comportamiento existente para entrenador y otros roles.

**Dependencias:** C04. **Alcance:** M, cuatro archivos.
**Archivos:** `apps/mobile/src/sesion.tsx`, `src/lib/sesion-local.ts`,
`app/_layout.tsx`, `src/sesion.spec.tsx`.
**Verificar:** `npm run test --workspace apps/mobile -- --runInBand sesion`;
`npm run typecheck`; abrir una sesión descargada tras reiniciar en modo avión.

### Checkpoint 1A — contrato y persistencia

- [ ] Entregar a Fable el commit común C00–C03 antes de sus cambios de código.
- [ ] C04–C05 preservan un borrador y separan usuarios en pruebas nativas.
- [ ] Revisar el catálogo F01–F02 sin editar simultáneamente sus archivos.

### C06 — Renovar la sesión durante una petición

- [ ] Unificar renovaciones concurrentes en una promesa en vuelo, persistiendo
      el refresh nuevo antes de darlo por válido.
- [ ] Reintentar una vez una petición rechazada por token vencido; no repetir
      automáticamente una mutación sin id de operación estable.
- [ ] Logout o cambio de cuenta invalidan renovaciones en vuelo; red no equivale a 401.

**Dependencias:** C03, C05. **Alcance:** M, tres archivos.
**Archivos:** `apps/mobile/src/lib/peticion-autenticada.ts`, `src/sesion.tsx`,
`src/lib/peticion-autenticada.spec.ts`.
**Verificar:** `npm run test --workspace apps/mobile -- --runInBand peticion-autenticada`;
`npm run typecheck`; sesión de prueba con acceso caducado y dos peticiones simultáneas.

### C07 — Cerrar sesión sin filtrar ni perder datos inadvertidamente

- [ ] Detectar cambios no sincronizados y permitir cancelar el cierre o aceptar
      su descarte; no prometer sincronización cuando no hay red.
- [ ] Desactivar el acceso local y limpiar claves/caché de esa cuenta cuando se
      confirma la salida, incluso si el servidor no contesta.
- [ ] Otra cuenta no hereda el borrador ni recibe una respuesta tardía de la anterior.

**Dependencias:** C04–C06. **Alcance:** M, cinco archivos.
**Archivos:** `apps/mobile/src/sesion.tsx`, `src/lib/sesion-local.ts`,
`src/entrenamiento-cliente/almacen-borradores.ts`, `app/index.tsx`,
`src/salida-con-borrador.spec.tsx`.
**Verificar:** `npm run test --workspace apps/mobile -- --runInBand salida-con-borrador`;
`npm run typecheck`; comprobar salida y login con dos cuentas.

### Checkpoint 1B — catálogo integrado

- [ ] Integrar F01–F03; alta, búsqueda y retirada funcionan desde el móvil.
- [ ] C06–C07 pasan, incluida la compatibilidad con identidad de `055c401`.
- [ ] Compartir el commit integrado y anotar comprobaciones de dispositivo.

## Incremento 2 — primera asignación visible

### C08 — Añadir persistencia de agenda y entrenamiento

- [ ] Crear entidades, índices, relaciones y unicidad descritos en el plan;
      fechas calendario y documentos con versión explícita.
- [ ] Revisar una migración aditiva y preservar todos los datos de identidad y catálogo.
- [ ] Registrar los dos módulos nuevos vacíos, sin rutas accesibles por omisión.

**Dependencias:** C02 y catálogo integrado. **Alcance:** M, cinco archivos.
**Archivos:** `apps/api/prisma/schema.prisma`, una migración de entrenamiento,
`src/agenda/agenda.module.ts`, `src/entrenamiento/entrenamiento.module.ts`,
`src/app.module.ts`, todos los `src/` bajo `apps/api/`.
**Verificar:** `npx prisma validate`; `npx prisma migrate dev --name entrenamiento`;
`npm run db:generate`; `npm run build --workspace apps/api`.

### C09 — Asignar y consultar una sesión

- [ ] Crear para un cliente pendiente o activo una sesión con prescripción
      validada, referencia a ejercicios publicados y fecha concreta.
- [ ] Hacer idempotente la asignación y devolver semana/detalle con DTOs distintos
      para propietario y entrenador. No publicar borradores.
- [ ] Probar cuentas ajenas, roles prohibidos y cliente desactivado mediante HTTP.

**Dependencias:** C00, C08. **Alcance:** M, cinco archivos.
**Archivos:** `apps/api/src/agenda/agenda.service.ts`,
`src/entrenamiento/planes.service.ts`, `src/entrenamiento/entrenamiento.controller.ts`,
`src/entrenamiento/entrenamiento.module.ts`, `test/entrenamiento-asignacion.e2e-spec.ts`.
El módulo de entrenamiento registra temporalmente el proveedor de agenda; su
exportación definitiva se completa en C13a sin crear una dependencia inversa.
**Verificar:** `npm run test:e2e --workspace apps/api -- --runInBand entrenamiento-asignacion`;
`npm run build --workspace apps/api`; `npm run typecheck`.

### C10 — Mostrar la semana del cliente

- [ ] Consultar semanas y abrir prescripción con etiquetas de fecha, nombre y estado.
- [ ] Descargar la prescripción al almacén local de la cuenta sin inventar registros.
- [ ] Mostrar carga, vacío y error, conectando desde el inicio existente.

**Dependencias:** C03–C06, C09. **Alcance:** M, cinco archivos.
**Archivos:** `apps/mobile/app/entrenos/index.tsx`,
`src/entrenamiento-cliente/semana.tsx`, `src/entrenamiento-cliente/api.ts`,
`app/index.tsx`, `src/entrenamiento-cliente/semana.spec.tsx`.
**Verificar:** `npm run test --workspace apps/mobile -- --runInBand semana`;
`npm run typecheck`; usar una sesión asignada por F04 desde la cuenta del cliente.

### Checkpoint 2 — entrenador asigna, cliente abre

- [ ] Integrar F04 y comprobar el recorrido completo con un ejercicio y una serie.
- [ ] Reintentar la asignación no crea otra sesión; otro cliente no puede leerla.
- [ ] Revisión del incremento antes de ampliar el editor.

## Incremento 3 — ejecución y envío

### C11 — Guardar borradores privados en la API

- [ ] Leer/escribir solo el borrador propio, admitiendo campos incompletos no
      marcados y validando todas las series contra la prescripción.
- [ ] Aplicar revisiones e ids de operación; la primera escritura impide ajustes
      posteriores de prescripción y no permite mezclar series de sesiones distintas.
- [ ] Denegar entrenador y otros roles incluso en lecturas de detalle/listado.

**Dependencias:** C09. **Alcance:** M, cuatro archivos.
**Archivos:** `apps/api/src/entrenamiento/borradores.service.ts`,
`entrenamiento.controller.ts`, `entrenamiento.module.ts`,
`apps/api/test/entrenamiento-borrador.e2e-spec.ts`.
**Verificar:** `npm run test:e2e --workspace apps/api -- --runInBand entrenamiento-borrador`;
`npm run build --workspace apps/api`; `npm run typecheck`.

### C12a — Sincronizar el borrador sin perder ediciones

- [ ] Persistir localmente antes de enviar y serializar operaciones por sesión;
      una respuesta antigua no pisa el texto más reciente.
- [ ] Mantener edición parcial y estados Guardando/Guardado/Error sin confundir
      el objetivo tenue con el valor real.
- [ ] Resolver 409 conservando ambas copias; no reemplazar datos por antigüedad
      de una respuesta ni publicar el borrador al entrenador.

**Dependencias:** C04, C06, C11. **Alcance:** M, cuatro archivos.
**Archivos:** `apps/mobile/src/entrenamiento-cliente/use-borrador.ts`,
`sincronizar-borrador.ts`, `api.ts`, `sincronizar-borrador.spec.ts`.
**Verificar:** `npm run test --workspace apps/mobile -- --runInBand sincronizar-borrador`;
`npm run typecheck`; intercalar ediciones con respuestas retrasadas.

### C12b — Registrar una serie desde el móvil

- [ ] Dos campos con unidades, objetivos tenues, valores reales y marcador;
      repeticiones/tiempo y carga opcional siguen el contrato.
- [ ] Marcar requiere valores válidos; vacío no es cero, se admite coma decimal,
      y desmarcar conserva el contenido sin contarlo como realizado.
- [ ] Conectar notas y recuperación del borrador, sin permitir cambiar la rutina.

**Dependencias:** C10, C12a. **Alcance:** M, cuatro archivos.
**Archivos:** `apps/mobile/app/entrenos/[id].tsx`,
`src/entrenamiento-cliente/registro.tsx`, `src/entrenamiento-cliente/fila-serie.tsx`,
`src/entrenamiento-cliente/registro.spec.tsx`.
**Verificar:** `npm run test --workspace apps/mobile -- --runInBand registro`;
`npm run typecheck`; registrar, cerrar y recuperar en el móvil.

### Checkpoint 3A — borrador recuperable

- [ ] C11–C12b pasan; entrenador y otro cliente no reciben el borrador.
- [ ] Recuperación real con red cortada y posterior reconexión.
- [ ] No ampliar hasta demostrar que ninguna respuesta atrasada pierde una edición.

### C13a — Mover fechas en la API

- [ ] Cambiar dentro de la semana original sin modificar futuras ocurrencias ni borradores.
- [ ] Registrar autor, antes/después y revisión; resolver concurrencia y denegar cerradas.
- [ ] Verificar lunes/domingo, año nuevo y DST; admitir varias sesiones el mismo día.

**Dependencias:** C08–C09. **Alcance:** M, cinco archivos.
**Archivos:** `apps/api/src/agenda/agenda.service.ts`, `agenda.controller.ts`,
`agenda.module.ts`, `apps/api/src/entrenamiento/entrenamiento.module.ts`,
`apps/api/test/agenda-fechas.e2e-spec.ts`.
**Verificar:** `npm run test:e2e --workspace apps/api -- --runInBand agenda-fechas`;
`npm run build --workspace apps/api`; `npm run typecheck`.

### C13b — Cambiar día desde la semana

- [ ] Ofrecer solo días de la misma semana y mostrar fecha original/actual.
- [ ] Conservar el último estado confirmado si falla el cambio y ofrecer reintento.
- [ ] Integrar el mismo control reutilizable en el panel del entrenador mediante
      contrato de componente, sin editar sus archivos en paralelo.

**Dependencias:** C10, C13a. **Alcance:** M, cuatro archivos.
**Archivos:** `apps/mobile/src/entrenamiento-cliente/cambiar-dia.tsx`,
`semana.tsx`, `api.ts`, `cambiar-dia.spec.tsx`.
**Verificar:** `npm run test --workspace apps/mobile -- --runInBand cambiar-dia`;
`npm run typecheck`; mover una sesión con borrador y comprobar que lo conserva.

### C14 — Enviar una ejecución de forma atómica

- [ ] Validar versión, propiedad, al menos una serie hecha y datos completos de
      las marcadas; excluir valores de series no realizadas del resultado público.
- [ ] Publicar resultado y cerrar agenda en una transacción; dejar histórico inmutable.
- [ ] Doble envío y respuesta perdida devuelven el mismo resultado; payload
      diferente con la misma clave y guardado tardío se rechazan sin sobrescribir.

**Dependencias:** C11, C13a. **Alcance:** M, cinco archivos.
**Archivos:** `apps/api/src/entrenamiento/envios.service.ts`,
`entrenamiento.controller.ts`, `entrenamiento.module.ts`,
`apps/api/src/agenda/agenda.service.ts`, `apps/api/test/entrenamiento-envio.e2e-spec.ts`.
**Verificar:** `npm run test:e2e --workspace apps/api -- --runInBand entrenamiento-envio`;
`npm run build --workspace apps/api`; `npm run typecheck`.

### Checkpoint 3B — API de envío y fechas

- [ ] C13–C14 pasan; no hay resultado publicado con agenda abierta.
- [ ] Fable recibe el contrato integrado de resultados para F05.
- [ ] Las respuestas del entrenador siguen sin contener borradores.

### C15 — Enviar y consultar el resultado desde el cliente

- [ ] Resumen de hechas/pendientes, confirmación de envío incompleto y estado
      pendiente mientras el servidor no confirma.
- [ ] Un fallo conserva el borrador; reintentar conserva clave y contenido;
      resolver un éxito cuya respuesta se perdió no duplica nada.
- [ ] Mostrar el resultado confirmado en modo consulta y limpiar la cola local
      sin permitir que una respuesta tardía lo reabra.

**Dependencias:** C12b, C14. **Alcance:** M, cinco archivos.
**Archivos:** `apps/mobile/src/entrenamiento-cliente/enviar.tsx`, `registro.tsx`,
`api.ts`, `use-borrador.ts`, `enviar.spec.tsx`.
**Verificar:** `npm run test --workspace apps/mobile -- --runInBand enviar`;
`npm run typecheck`; envío con interrupción de red y lectura desde F05.

## Incremento 4 — plan repetido y rutinas guardadas

### C16a — Repetir el plan durante varias semanas

- [ ] Expandir el patrón en fechas concretas, conservando sesiones ya existentes.
- [ ] Copiar objetivos por ocurrencia y mostrar colisiones como aviso, sin sustitución.
- [ ] Hacer atómica/idempotente la asignación del bloque completo.

**Dependencias:** C09, C14. **Alcance:** M, cuatro archivos.
**Archivos:** `apps/api/src/entrenamiento/planes.service.ts`, `fechas-del-plan.ts`,
`fechas-del-plan.spec.ts`, `apps/api/test/entrenamiento-plan.e2e-spec.ts`.
**Verificar:** `npm run test --workspace apps/api -- --runInBand fechas-del-plan`;
`npm run test:e2e --workspace apps/api -- --runInBand entrenamiento-plan`;
`npm run typecheck`.

### C16b — Guardar y reutilizar plantillas independientes

- [ ] Guardar/listar/leer/editar rutinas para el entrenador, sin datos de clientes.
- [ ] Asignar desde una copia; editar plantilla no altera planes asignados.
- [ ] Denegar otros roles y rechazar nuevas asignaciones con ejercicios retirados,
      manteniendo la consulta de la plantilla y del histórico.

**Dependencias:** C16a. **Alcance:** M, cinco archivos.
**Archivos:** `apps/api/src/entrenamiento/rutinas.service.ts`,
`rutinas.controller.ts`, `entrenamiento.module.ts`, `planes.service.ts`,
`apps/api/test/entrenamiento-rutinas.e2e-spec.ts`.
**Verificar:** `npm run test:e2e --workspace apps/api -- --runInBand entrenamiento-rutinas`;
`npm run build --workspace apps/api`; `npm run typecheck`.

### Checkpoint 4A — primer recorrido y repetición

- [ ] C15 y F05 completan el recorrido de una sesión con servidor real.
- [ ] C16a–C16b preservan otros clientes y semanas ante copias y ediciones.
- [ ] Compartir base integrada para F06 y F07a.

### C17 — Ajustar una sesión no iniciada

- [ ] Permitir al entrenador editar prescripción con revisión mientras no haya
      borrador sincronizado ni envío.
- [ ] El ajuste y el primer guardado compiten atómicamente; quien pierde recibe
      conflicto, conservando la copia local del cliente.
- [ ] Retirar ejercicios o editar nombres no modifica lo ya enviado.

**Dependencias:** C11, C16b. **Alcance:** M, cinco archivos.
**Archivos:** `apps/api/src/entrenamiento/prescripciones.service.ts`,
`entrenamiento.controller.ts`, `entrenamiento.module.ts`, `borradores.service.ts`,
`apps/api/test/entrenamiento-ajustes.e2e-spec.ts`.
**Verificar:** `npm run test:e2e --workspace apps/api -- --runInBand entrenamiento-ajustes`;
`npm run build --workspace apps/api`; `npm run typecheck`.

## Incremento 5 — integración y comprobación completa

### C18 — Probar carreras e integrar los accesos definitivos

- [ ] Verificar carreras mover/enviar, editar/guardar, dos dispositivos, logout
      durante refresh y cuenta desactivada en servidor con datos locales pendientes.
- [ ] Conectar cartera/ficha/inicio con las rutas reales de Fable y revisar
      sondeo visible, cambio de cuenta y limpieza al desmontar.
- [ ] Integrar entregas F06–F08 y ejecutar regresión de identidad.

**Dependencias:** C17, F06, F07a–F07b. **Alcance:** M, cinco archivos.
**Archivos:** `apps/api/test/entrenamiento-carreras.e2e-spec.ts`,
`apps/mobile/src/entrenamiento-cliente/integracion.spec.tsx`,
`apps/mobile/app/cliente/[id].tsx`, `apps/mobile/app/index.tsx`,
`apps/mobile/app/_layout.tsx`.
**Verificar:** `npm run test:e2e --workspace apps/api -- --runInBand`;
`npm run test --workspace apps/mobile -- --runInBand`; `npm run typecheck`;
`npm run lint`.

### Checkpoint 4B — funciones completas

- [ ] C17, C18 y F07b pasan; no quedan inconsistencias de contrato.
- [ ] Revisión cruzada: cada responsable corrige los hallazgos de sus archivos.
- [ ] F08 entrega evidencia de pantallas; no se declara prueba nativa por un mock.

### C19 — Verificar en dispositivo y cerrar la documentación

- [ ] Recorrer todos los criterios de entrenamiento y agenda en dispositivo,
      incluyendo cierre/reapertura sin red y cambio de usuario.
- [ ] Registrar comandos, resultados, plataforma y límites. Si no hay acceso
      a dispositivo, dejar explícitamente pendiente esa comprobación.
- [ ] Actualizar el mapa y las reglas comunes para reflejar que el entrenador
      ve resultados solo después del envío, sin marcar el catálogo completo terminado.

**Dependencias:** C18, F08. **Alcance:** M, cinco archivos.
**Archivos:** `tasks/entrenamiento/verificacion.md`, `tasks/entrenamiento/todo.md`,
`CAPABILITY-MAP.md`, `SPEC.md`, `README.md`.
**Verificar:** `npm run test`; `npm run test:e2e --workspace apps/api -- --runInBand`;
`npm run build --workspace apps/api`; `npm run typecheck`; `npm run lint`;
recorrido en Expo Go desde `npm run dev --workspace apps/mobile`.

### Checkpoint final

- [ ] Criterios de las dos specs trazados a pruebas y comprobaciones.
- [ ] Histórico, privacidad de borradores e idempotencia demostrados.
- [ ] Cobertura de servicios y guardas nuevos conforme al mínimo del proyecto.
- [ ] Revisión humana del resultado. Publicación y merge no se presuponen.

## Registro de entregas

No hay commits de implementación ni pruebas ejecutadas para esta iteración.
Base leída: `055c401`. El plan y los contratos propuestos esperan revisión.
