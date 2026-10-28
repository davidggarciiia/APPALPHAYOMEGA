# Auditoría con un perfil completo · 3–4 de octubre de 2026

Se ha creado y probado un cliente ficticio con historial acumulado. La base es `alpha_omega_audit_utf8`, PostgreSQL local en el puerto 15432; la API de pruebas usa el 3300. Los datos no pertenecen a clientes reales y el correo está interceptado. Este informe amplía las auditorías anteriores y distingue sus observaciones históricas de las comprobaciones actuales.

## Acceso y contenido del perfil

**Elena Álvarez · Perfil demo** — `completo@auditoria.test` / `Audit-local-2026!`.

La fecha fija del escenario es el **2 de octubre**. La comprobación visual continúa el día 3; por eso el sábado figura como descanso y los registros diarios de ese día empiezan vacíos. La fecha fija evita que repetir el arnés cambie el contenido asociado a los mismos UUID de operación.

| Datos al preparar el escenario                                                 |    Cantidad |
| ------------------------------------------------------------------------------ | ----------: |
| Plan de ocho semanas, con calentamiento, trabajo, circuito y vuelta a la calma | 24 sesiones |
| Entrenamientos enviados / pendientes                                           |      20 / 4 |
| Días de seguimiento, con ausencias y días parciales                            |          52 |
| Medidas corporales / pruebas físicas                                           |      8 / 16 |
| Dietas: vigente, archivadas, borrador profesional                              |   1 / 2 / 1 |
| Comidas históricas de distintas versiones                                      |         175 |
| Visitas publicadas / visita en borrador                                        |       3 / 1 |
| Publicaciones, incluida una corrección de la última visita                     |           4 |
| Fotografías de prueba                                                          |           7 |

Incluye comentarios, revisiones del entrenador, alternativas de comidas, intercambio por grupos, indicaciones, suplementos, métricas por protocolo y solicitudes de fotos pendientes y parcialmente recibidas. La próxima revisión es el 19 de octubre. Las notas internas tienen un marcador para comprobar que no se filtran al cliente.

Las fotografías son copias de un PNG de prueba: sirven para comprobar permisos, descarga y elección de fechas; no sirven para valorar cambios físicos. Algunos ejercicios se eligieron mediante coincidencia de nombres en el catálogo inicial; el perfil prueba formatos y estados, no prescribe una rutina real. No debe reutilizarse como asesoramiento de entrenamiento o nutrición.

El arnés está en [perfil-completo.mjs](../build/auditoria/perfil-completo.mjs), sus conteos en [perfil-completo.json](../build/auditoria/perfil-completo.json), y el lanzador local en [entorno.ps1](../build/auditoria/entorno.ps1). Los tres comprueban o fijan el entorno de auditoría. `build/auditoria/` está ignorado por Git: estos recursos permanecen en esta máquina, no se incorporan automáticamente a un clon nuevo.

## Comprobaciones con el historial

**145 de 145 casos correctos**, con **602 peticiones HTTP**: 588 registradas y 14 comprobaciones adicionales de firma ausente. Se probaron cliente, entrenador, nutricionista, empleado y otro cliente ajeno. Las lecturas directas de PostgreSQL se ejecutaron en transacciones `READ ONLY`; el verificador no alteró los datos de dominio.

Se contrastaron perfil y contacto, agenda, 24 sesiones, 20 resultados, referencias «Anterior» y fuerza estimada, seguimiento, medidas y pruebas, historial de dietas y sus 175 comidas, valoraciones, corrección, próxima revisión, solicitudes y fotografías. La paginación conservó los identificadores sin duplicados ni pérdidas. El cliente y el nutricionista asignado no recibieron las notas internas; los roles ajenos fueron rechazados. Las siete imágenes se descargaron con firma válida y coincidieron en bytes; sin firma se rechazaron.

Evidencia: [verificador](../build/auditoria/verificar-perfil-completo.mjs), [resultados](../build/auditoria/verificar-perfil-completo.json), [log](../build/auditoria/verificar-perfil-completo.log). Es una verificación del escenario y del servidor en ejecución; no certifica todas las carreras ni todas las rutas de escritura.

En Android 15, con Expo Go y pantalla de 320×640, se comprobó:

- Entrada con el perfil completo y su plan semanal: dos entrenamientos enviados y uno pendiente en la semana del 28 de septiembre.
- Última valoración corregida, detalle de medidas y pruebas, historial y próxima revisión. La evolución contiene **tres visitas**, con primer peso 74 kg y último 71,8 kg; la corrección no crea una cuarta visita.
- Dieta vigente, elección de cena vegetal y confirmación «Comida registrada». Una consulta HTTP posterior confirmó que la cena del día 3 persistía. Ese recorrido añade un registro a los 175 del escenario inicial.
- Validación de intercambio incompleto: «Elige un alimento de cada grupo antes de guardar». Elección de tofu, arroz y verdura. El envío de este plato no se da por confirmado: no apareció en la consulta posterior y el entorno interrumpió el recorrido antes de obtener una conclusión fiable.
- Apertura de la comparación de fotos, vistas frente y espalda y fechas de las tres visitas. La visualización completa de ambas imágenes sigue pendiente: el emulador pasó a `offline` antes de obtener la captura.

![Evolución con tres visitas](../build/auditoria/capturas/mock-evolucion.png)

## Errores actuales comprobados

### P1 · Android no recupera la sesión guardada en el dispositivo

Al iniciar el entrenamiento pendiente del 2 de octubre, el cliente mostró «Error de guardado · En curso». El reintento no resolvió el fallo. Tras reiniciar Metro con caché vacía, compilar **1950 módulos** y terminar y abrir Expo Go, intentar la misma sesión mostró «No se pudo abrir la sesión»; reintentar mantuvo el error. La API seguía disponible y el plan se había cargado.

El stack recuperado en Metro apunta a `almacen-dispositivo.ts:46`, `AESSealedData.fromCombined(texto)`. La app guarda el contenido cifrado como Base64 y lo entrega como `string`. El wrapper JavaScript de `expo-crypto` conserva ese string; la implementación Android instalada de `fromCombined` declara el parámetro `ByteArray`. El convertidor de `expo-modules-core` exige un array tipado de bytes. Aunque la documentación TypeScript admite Base64, esa ruta Android no lo convierte a bytes.

La reproducción controlada, completada el día 4, ejecuta el wrapper real de Expo y el almacén de la app transpilados en memoria, con un puente nativo que aplica el contrato Android de bytes. La primera escritura guarda Base64; leer esa copia, editarla mediante comparación de versiones y reintentar fallan antes de descifrar. El control con el mismo contenido decodificado a `Uint8Array` completa cifrado y descifrado AES-GCM con AAD; `ArrayBuffer` también funciona. El contenido permanece recuperable: la integración bloquea su uso, no demuestra que se haya borrado. Los diez hashes de fuentes permanecieron iguales. No se utilizaron SQLite real ni secretos del dispositivo para este arnés.

Hay que convertir explícitamente a bytes o usar una versión cuya implementación soporte el formato, comprobar la recuperación de las copias existentes y mostrar un error local que no se confunda con falta de conexión. El alcance observado es **Android 15 con Expo Go 57.0.9**: no se ejecutó un binario de distribución. La implementación iOS sí decodifica Base64; no se extiende este hallazgo a iOS.

Fuente de integración: [almacen-dispositivo.ts](../apps/mobile/src/entrenamiento/almacen-dispositivo.ts). Evidencia: [arnés](../build/auditoria/aes-nativo-controlado.cjs), [resultado](../build/auditoria/aes-nativo-controlado.json), [log](../build/auditoria/aes-nativo-controlado.log), [error de guardado](../build/auditoria/capturas/mock-error-local.png) y [reapertura con bundle limpio](../build/auditoria/capturas/mock-reapertura-local.png). La sesión no pudo recuperarse y la corrección reciente del reproductor no pudo revalidarse dentro de este recorrido.

### P1 · Una valoración puede guardarse o publicarse después de retirar el consentimiento

El guard comprueba el consentimiento antes de entrar al controlador. Las transacciones de `ValoracionesService.cambiar` y `publicar` no lo vuelven a comprobar ni adquieren el bloqueo del consentimiento. Una retirada completada entre ambos pasos deja que se persistan datos nuevos.

Se ejecutaron el guard, `ConsentimientoService` y `ValoracionesService` reales transpilados en memoria, con repositorios instrumentados. Retirar antes del guard rechazó correctamente con 409. Retirar después del guard permitió cambiar peso de 80 a 91 kg, subir a revisión 2 y, en otro caso, publicar y cerrar el borrador. Los hashes de las fuentes permanecieron iguales.

La reproducción confirma el orden de llamadas del servicio. **No es una carrera observada con PostgreSQL real**; falta ejecutar allí la misma intercalación. Las cinco escrituras del hallazgo 3 antiguo tienen protección nueva, pero las valoraciones conservan este mecanismo.

Fuentes: [guard](../apps/api/src/identity/consentimiento.guard.ts), [servicio de valoraciones](../apps/api/src/seguimiento/valoraciones.service.ts). Evidencia: [arnés](../build/auditoria/valoraciones-consentimiento-controlado.mjs), [resultado](../build/auditoria/valoraciones-consentimiento-controlado.json), [log](../build/auditoria/valoraciones-consentimiento-controlado.log).

### P2 · Se acepta como PNG un archivo con píxeles comprimidos inválidos

El saneamiento comprueba estructura, cabecera, CRC y existencia de IDAT, pero no valida el contenido zlib. Un PNG de 58 bytes con cabecera 1×1 y CRC correctos, cuyo IDAT es `01`, se acepta y devuelve intacto. Descomprimir ese contenido falla con `Z_BUF_ERROR`: no es una imagen decodificable.

El PNG de 32 bytes del informe anterior sí se rechaza ahora. Este es un caso residual distinto: puede dejar fotografías confirmadas que el usuario no podrá visualizar. Reproducción en memoria, sin subir el archivo ni modificar datos; hashes estables.

Fuente: [imagenes.ts](../apps/api/src/medios/imagenes.ts). Evidencia: [arnés](../build/auditoria/png-residual-controlado.mjs), [resultado](../build/auditoria/png-residual-controlado.json), [log](../build/auditoria/png-residual-controlado.log).

## Pruebas automáticas y cambios concurrentes

| Comprobación de esta continuación                              | Resultado                                                 |
| -------------------------------------------------------------- | --------------------------------------------------------- |
| Unitarios API                                                  | 262/262, 32 suites correctas.                             |
| Última suite móvil completa, en serie y sin caché              | 669/670; 75/76 suites; 284,09 segundos.                   |
| Fallo móvil aislado                                            | Comparador de fotos: 25/26; el mismo caso supera 5000 ms. |
| Focales de registro, comentarios y almacenamiento tras cambios | 14/14.                                                    |
| Focal de control de registro tras cambios                      | 25/25.                                                    |
| Tipos API y móvil                                              | Ambos comandos terminan con código 0.                     |

El único fallo de la última suite es el primer caso de `comparador-fotos.spec.tsx`. Se reprodujo por separado con hashes estables. Una instrumentación adicional, manteniendo el límite de 5000 ms, localizó **7,572 segundos en el render inicial**; la primera búsqueda de la imagen resolvió en unos 6 ms. La plataforma del caso era iOS simulada y no usaba temporizadores falsos. No se atribuye a la descarga Android de imágenes ni se presenta como prueba de un bloqueo nativo: la suite permanece fallida bajo su límite actual.

Durante la suite completa cambiaron tres de los 235 archivos inventariados. Los resultados corresponden a una pasada con edición concurrente, no a un snapshot estable de todas las fuentes. Los fallos de pasadas anteriores en recuentos de series, salida del resultado, comentarios y comparación de documentos ya no se reproducen en sus focales. El último fallo de control de registro también pasó tras actualizarse externamente código y fixture.

Logs: [API](../build/auditoria/api-unitarios-actual.log), [suite móvil](../build/auditoria/mobile-unitarios-cierre.log), [comparador aislado](../build/auditoria/mobile-comparador-focal.log), [instrumentación](../build/auditoria/mobile-comparador-instrumentado.log), [hashes antes](../build/auditoria/mobile-sha256-antes.json), [hashes después](../build/auditoria/mobile-sha256-despues.json).

Los 41 hallazgos del [informe inicial](auditoria-2026-09-30.md) no deben sumarse como 41 fallos vigentes. Se observan correcciones de sus causas, incluidas las carreras de autenticación y refresco, pero algunos cierres aún requieren intercalaciones deterministas con PostgreSQL y comprobación del despliegue. Las evidencias anteriores permanecen fechadas en el [informe nativo](auditoria-nativa-2026-10-01.md).

## Valoración de diseño, experiencia y alcance

| Área            | Valoración provisional         | Motivo                                                                                                                                                                                                   |
| --------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Diseño          | 7,5/10                         | Identidad negra y dorada consistente, buena jerarquía y cifras legibles. Mi impresión estética: no se ve «muy IA», aunque la repetición de tarjetas y gradientes recuerda interfaces de plantilla.       |
| Animaciones     | Pendiente de cierre nativo     | Los clips de técnica se reproducen; el ciclo de vida del reproductor tiene una corrección reciente que exige probar un bundle limpio. Sin medición de FPS en distribución.                               |
| Experiencia     | 5,5/10                         | Las tareas habituales se entienden y la evolución corregida es coherente. El historial largo y el intercambio exigen demasiado desplazamiento; los errores de persistencia interrumpen el entrenamiento. |
| Funcionalidades | 8/10 para el alcance observado | Plan, prescripción, registro, dieta, historial, seguimiento, revisiones, fotos y roles cubren un ciclo amplio. Que una función exista no demuestra que todos sus estados sean fiables.                   |
| Errores         | Cierre pendiente               | Bloqueo de recuperación local en Android, consentimiento en valoraciones y PNG residual. Persiste un test de comparador por tiempo; no se certifica la corrección nativa del reproductor.                |

En la comida por intercambio, «Tu plato» ocupa casi toda la pantalla antes de mostrar los selectores. Seleccionar un alimento amplía una caja y desplaza las pestañas y opciones siguientes. El botón de registrar aparece antes de las opciones y la confirmación/error después de ellas: cuesta seguir el orden y comprobar el resultado. Conviene situar primero las elecciones, después un resumen compacto y una confirmación visible junto a la acción.

En Progreso, las valoraciones y cada serie de evolución se apilan antes de solicitudes y métricas diarias. Con datos acumulados, acceder a una tarea concreta exige varios desplazamientos. Conviene separar vistas o añadir accesos directos, manteniendo las fechas y el contexto de cada serie.

![Intercambio en pantalla pequeña](../build/auditoria/capturas/mock-intercambio.png)

## Límites de esta pasada

Mobile MCP está instalado y conecta con el emulador local; no se contrató un dispositivo cloud. El emulador recibió cierres forzados de Expo y desapareció con código 1, sin un `FATAL EXCEPTION` asociado recuperado. No se cuentan esos eventos como errores de la app. La hora del equipo avanzó durante la sesión; no se modificó por esta auditoría.

El servidor Metro anterior funcionaba en CI y mantenía el bundle cargado mientras cambiaban las fuentes. Se repitió el error `VideoPlayer.pause` antes de reiniciar Metro con caché vacía; esa captura no demuestra que la corrección actual del reproductor falle. Se conserva [cambio de ejercicio](../build/auditoria/capturas/mock-cambio-ejercicio.png) con esta limitación. El bloqueo de reapertura local sí se repitió después de la recompilación limpia, como se describe arriba. El emulador volvió a desaparecer durante la navegación posterior.

No se certifican todas las combinaciones ni una app sin errores. Quedan fuera iOS real, teléfono físico, compilación de distribución, FPS, S3 y despliegue HTTPS. Tampoco se da por completado el disparo y subida desde la cámara virtual ni el recorrido completo de modo avión, reapertura y sincronización. La negativa anterior de acceso al navegador se respetó; esta continuación utiliza Android y API del escenario sintético.
