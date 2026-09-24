# Revisión de preparación para producción · Codex · 24-09-2026

**Conclusión actualizada:** los dos defectos iniciales de fotografías y retirada del consentimiento están corregidos en código y comprobados con las pruebas descritas al final. La preparación completa para producción sigue pendiente. Este documento conserva los hallazgos iniciales y la evidencia posterior; no sustituye al plan activo.

**Versión y alcance:** rama `codex/cliente-intuitivo`; revisión iniciada sobre `8cedd5f`, con `f931b5c` como último commit observado. Claude estaba modificando la interfaz durante las comprobaciones. Los resultados corresponden a ese intervalo, no certifican sus cambios posteriores. Se revisaron código, contratos y pruebas focales; no se verificaron navegador autenticado, móvil físico ni proveedor de producción.

## 1. P1 · Una subida repetida puede reemplazar la fotografía ya validada

**Localización:** `apps/api/src/medios/medios.service.ts:241–273`, especialmente la escritura sobre `fila.clave` en la línea 262. Relacionado con `apps/api/src/medios/medios.controller.ts:143–158` y `apps/api/src/medios/almacen-s3.ts:48–55`.

La subida original y la fotografía final comparten la misma clave de almacenamiento. Confirmar elimina los metadatos y reemplaza ese objeto, pero el enlace de subida sigue permitiendo escribir sobre él hasta que caduca. Además, confirmar de nuevo un medio disponible devuelve el registro sin volver a validar su contenido.

**Reproducción HTTP realizada con una imagen sintética y almacén local aislado:**

1. Aceptar el consentimiento y solicitar una subida para una valoración de prueba.
2. Subir un JPEG sintético con metadatos GPS mediante el enlace firmado recibido.
3. Confirmar el medio y leerlo mediante un acceso autorizado: los metadatos GPS ya no aparecen.
4. Repetir la subida del JPEG original usando el mismo enlace de subida.
5. Volver a leer el medio: los metadatos GPS reaparecen. La expectativa de que siguieran eliminados falla.

**Impacto:** se puede cambiar el contenido de una fotografía disponible y restaurar información que la aplicación afirma haber eliminado. La reproducción no demuestra acceso a imágenes ajenas; demuestra que se elude la validación del contenido final.

**Alcance S3:** no se probó un bucket real. El adaptador utiliza la misma clave para subida y sustitución, por lo que el problema también es aplicable a S3 según su funcionamiento documentado: [las URLs prefirmadas se pueden reutilizar hasta su caducidad](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html) y [una subida con la misma clave reemplaza el objeto existente](https://docs.aws.amazon.com/AmazonS3/latest/userguide/PresignedUrlUploadObject.html). Esta extensión del hallazgo es una inferencia del código y la documentación del proveedor.

**Corrección propuesta:** separar el objeto temporal de subida del objeto final privado y validado. La URL de subida nunca debe poder escribir la clave final referenciada por la aplicación. Tratar confirmación, publicación, reintentos y limpieza de temporales de forma coherente. Un bloqueo exclusivo en el controlador local no resuelve la escritura directa mediante S3.

**Aceptación:** repetir el PUT original después de confirmar o publicar no cambia la fotografía final ni restaura metadatos. Verificar con almacén local y con el proveedor elegido; mantener confirmación idempotente y limpieza de temporales.

## 2. P1 · Retirar el consentimiento aún permite ciertas escrituras nuevas

**Localización:** `apps/api/src/medios/medios.controller.ts:81–87` y `medios.service.ts:241–245`; `apps/api/src/entrenamiento/entrenamiento.controller.ts:122–139` y su servicio de registros.

Los controles añadidos por Claude protegen varias escrituras y la creación de una intención de subida. Sin embargo, no se vuelve a exigir consentimiento vigente al confirmar una fotografía pendiente ni al guardar el borrador de entrenamiento. Esto contradice el comportamiento previsto de detener nuevas aportaciones de datos de salud al retirarlo.

**Reproducción A, fotografía pendiente:**

1. El cliente acepta el consentimiento.
2. Su entrenador solicita y sube una fotografía sintética para una valoración.
3. El cliente retira el consentimiento: `DELETE /consentimiento` responde 200.
4. El entrenador ejecuta `POST /medios/:id/confirmacion`.
5. Respuesta observada: **200**, y la fotografía pasa a disponible. La prueba esperaba el rechazo por falta de consentimiento, **409**.

**Reproducción B, nuevo chequeo de entrenamiento:**

1. El cliente acepta el consentimiento y el entrenador le asigna un plan sintético.
2. El cliente retira el consentimiento.
3. El cliente hace `PUT /entrenamiento/sesiones/:id/borrador` con un nuevo registro cuyo `checkin` contiene `{ "sensacion": 2, "molestia": "dolor" }`.
4. Respuesta observada: **200**. La prueba esperaba **409**.

La ruta `POST /entrenamiento/sesiones/:id/enviar` tampoco presenta ese control en el código revisado; no se reprodujo separadamente el envío en esta pasada.

**Corrección propuesta:** resolver el cliente propietario a partir del recurso y comprobar el consentimiento vigente antes de aceptar la mutación, incluido el servicio de confirmación. Cubrir acciones del cliente y del profesional, subidas pendientes y borradores/envíos conservados sin conexión. Definir y probar el orden frente a una retirada concurrente. Conservar el acceso autorizado al histórico según el contrato existente.

**Aceptación:** ambas reproducciones dejan de aceptar datos nuevos; el envío de entrenamiento y las operaciones pendientes siguen la misma regla. Mantener pruebas de aceptación, retirada, reaceptación, roles y lectura del histórico. Este hallazgo evalúa el contrato de la aplicación; no sustituye una revisión jurídica.

## Verificación ejecutada

Se usaron datos sintéticos, la base dedicada `alpha_omega_e2e_codex` y un directorio temporal propio para fotografías. No se cambiaron cuentas ni registros de la base habitual.

| Comprobación                                                                             | Resultado observado                                                                                                                                                                                                                       |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`                                                                      | Correcto en la instantánea comprobada.                                                                                                                                                                                                    |
| API: `consentimiento.guard.spec.ts`, `almacen-s3.spec.ts`, `almacen-configurado.spec.ts` | 14 pruebas correctas, 3 suites.                                                                                                                                                                                                           |
| Móvil: consentimiento, resumen de valoración, solicitudes y comparador de fotos          | 39 correctas y 9 fallidas. Los fallos pertenecían al comparador que Claude estaba modificando; requieren repetición al finalizar su trabajo.                                                                                              |
| HTTP: consentimiento, evolución y novedades                                              | Las pruebas focales pasan tras repetir novedades aisladamente: esa suite tuvo inicialmente un timeout de 5 segundos y después pasó sus 6 pruebas con límite de 30 segundos. No se atribuye ese timeout a un defecto funcional demostrado. |
| Tres regresiones temporales de esta revisión                                             | Las tres fallan y reproducen los dos bloqueos anteriores: sustitución de imagen, confirmación tras retirada y nuevo chequeo tras retirada.                                                                                                |

Comandos focales utilizados, además de `npm run typecheck`:

```text
npm test --workspace apps/api -- --runInBand consentimiento.guard.spec.ts almacen-s3.spec.ts almacen-configurado.spec.ts
npm test --workspace apps/mobile -- --runInBand consentimiento.spec.tsx resumen-valoracion.spec.tsx solicitudes-fotos.spec.tsx comparador-fotos.spec.tsx
npm run test:e2e --workspace apps/api -- --runTestsByPath test/codex-revision-produccion-temporal.e2e-spec.ts test/consentimiento.e2e-spec.ts test/evolucion-valoraciones.e2e-spec.ts test/valoraciones-novedades.e2e-spec.ts
npm run test:e2e --workspace apps/api -- --runTestsByPath test/valoraciones-novedades.e2e-spec.ts --testTimeout=30000
```

El archivo de regresión temporal se retiró después de documentar los escenarios, para no mezclarlo con la implementación activa de Claude. Las comprobaciones HTTP se ejecutaron con `POSTGRES_DB=alpha_omega_e2e_codex`, `ALMACEN=local`, almacenamiento temporal propio y limpieza periódica desactivada en ese proceso. No ejecutar esas pruebas contra la base habitual.

No se ejecutaron la suite completa, lint ni build final en esta pasada. Los tests focales y el typecheck no equivalen a una validación completa de producción.

## Trabajo pendiente, separado de los defectos

- **Cerrar los recorridos de fotografías y evolución.** La continuación descrita abajo ya conecta evolución, comparador y aportación del cliente desde Progreso. Falta completar la subida profesional al borrador de valoración y la comprobación autenticada y móvil.
- **Verificar los avisos recién conectados.** `AvisosSeguimiento` ya se está montando en Inicio. La API tiene pruebas; queda comprobar el recorrido completo y las nuevas pruebas de interfaz cuando Claude termine.
- **Integrar las ampliaciones con el alcance vigente.** La revisión inicial enumeraba metros, cardio, chequeo, recuperación, prioridades y fases. La nota posterior de [coordinación](coordinacion-claude-codex.md) registra un recorte a D01, D04 y D07; los demás figuran excluidos allí. La revisión integral distingue trabajo en otra rama, trabajo aún sin implementar y esa divergencia documental; no incorpora de nuevo funciones aplazadas.
- **Pruebas móviles y de uso.** Siguen pendientes las comprobaciones autenticadas a 360/390 px, dispositivo físico, bloqueo/recuperación, pérdida de red, subida interrumpida y observación con usuarios. No hay evidencia nueva de esas pruebas en esta revisión.
- **Preparar y ensayar el despliegue real.** El adaptador S3 existe y sus pruebas focales pasan. La elección/configuración del proveedor y la prueba con bucket real siguen pendientes en la documentación, junto con los restantes pasos de [preparación para producción](../docs/PENDIENTE-PARA-PRODUCCION.md). No se han verificado cuentas externas, infraestructura, correo ni restauración de copias en esta revisión.

## Orden recomendado para Claude

1. Corregir los dos P1 y añadir las regresiones permanentes en las suites correspondientes.
2. Completar la subida profesional al borrador de valoración y revisar los recorridos móviles integrados.
3. Ejecutar los controles completos sobre una versión estable, sin cambios concurrentes.
4. Completar la comprobación visual, móvil y de pérdida de conexión con evidencia.
5. Ensayar el despliegue y la recuperación antes de abrir un piloto con usuarios reales.

La estimación anterior de semanas sigue siendo orientativa. Esta revisión aporta condiciones de salida comprobables; no permite prometer una fecha de producción mientras la implementación continúa y faltan pruebas reales.

## Continuación del trabajo móvil · 24-09-2026

Tras esta revisión, se conectó «Ver mi evolución» desde Progreso. La pantalla consulta los datos solo al abrirla y muestra el comparador privado de fotos; al ocultarla se desmontan esos componentes. El cliente puede hacer o elegir las fotos que pidió su entrenador, subir cada vista por la URL temporal, confirmar el medio y continuar con las vistas restantes. Si la subida falla, conserva temporalmente la imagen y reintenta con la misma operación; no guarda fotos ni URL firmadas como datos sin conexión. Inicio ya monta `AvisosSeguimiento` y sus destinos de cliente llevan a Progreso.

En esta continuación pasan **94 pruebas de 8 suites focales móviles** (solicitudes de fotos, evolución, avisos, comparador, preparación de fotos y pantallas de Progreso); `npm run typecheck --workspace apps/mobile` también pasa. Se ajustó una expectativa inválida sobre el indicador de carga, ya que el test anterior resolvía la petición durante el propio render. Se corrigieron errores de tipos en los tests nuevos de imágenes.

El navegador disponible en Codex se encuentra en el acceso y presenta «Correo o contraseña incorrectos», así que no se comprobó visualmente una sesión autenticada. Tampoco se probó cámara/galería reales ni un dispositivo físico. La subida profesional de fotos al borrador sigue pendiente. En ese punto seguían pendientes los dos P1; su corrección posterior se registra a continuación.

## Corrección de los dos P1 y revisión de la continuación · 24-09-2026

La última tanda anterior había añadido dos pruebas sin cambiar la lógica de la API. La prueba de consentimiento dependía del estado que dejaba otra prueba y podía fallar durante la preparación, antes de llegar al defecto. Se recuperó la suite original y se separaron seis casos en `consentimiento-pendientes.e2e-spec.ts`, con aceptación explícita antes de cada caso. Ahora se comprueban por separado la confirmación de una foto, el borrador y el envío, tanto si la retirada precede a la petición como si gana durante su ejecución.

La API exige el consentimiento del cliente propietario dentro de la transacción de esas escrituras. La lectura con bloqueo compartido impide que una retirada se cuele entre la comprobación y el commit. Confirmar una foto también comprueba el consentimiento antes de procesar el objeto. Los reintentos de una operación que ya terminó pueden devolver su resultado histórico sin escribir de nuevo.

La fotografía validada se escribe en una clave distinta de la subida. Cada intento usa una clave UUID registrada antes del PUT en la tabla aditiva `intentos_foto`. Publicar y descartar compiten mediante esa fila: el ganador la elimina junto al cambio de referencia, y el descarte confirma su estado antes del DELETE externo. Una fila ausente nunca permite borrar. Los registros descartados sobreviven a la intención original y se repasan diariamente para recuperar escrituras tardías; un fallo de borrado se reintenta en el siguiente pase. Un enlace PUT reutilizado no cambia los bytes finales ni restaura metadatos. El temporal se borra al confirmar y tras caducar su enlace. Las fotos anteriores se conservan; transición y límites en ADR 0005.

La revisión independiente también examinó las correcciones de Codex: detectó que una copia sin vincular podía quedar huérfana tras un fallo de limpieza y que una clave final compartida podía perderse si el almacén tardaba más que una transacción. Ambas alternativas se retiraron antes de la entrega. Las regresiones permanentes reproducen esos casos; el diseño final usa claves por intento, descarte duradero y ninguna operación de almacenamiento dentro de una transacción.

**Evidencia actualizada:** las regresiones iniciales fallaron por los defectos esperados, una vez aislado el montaje. También se reprodujo la sobrescritura tras caducar la transacción antes de corregirla. Suite completa: **448 pruebas HTTP / 42 suites**, **188 unitarias API / 23 suites** y **452 móviles / 65 suites**. Pasan `npm run typecheck` y el build de API. Las pruebas HTTP usan exclusivamente `alpha_omega_e2e_codex`, imágenes sintéticas y almacenamiento temporal. La revisión final independiente no encontró nuevos defectos en el parche.

No se declara la aplicación lista para producción: faltan recorridos del plan, integración de otra rama, pruebas físicas y de usabilidad, y ensayo del proveedor/despliegue real. Estado global y próximos pasos en [revisión integral](revision-integral-2026-09-24.md).
