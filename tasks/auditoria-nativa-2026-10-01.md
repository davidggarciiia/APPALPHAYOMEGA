# Auditoría nativa y HTTP de Alpha y Omega

> Informe histórico de hallazgos. Su implementación y verificación posterior se registran en [Correcciones de auditoría del 4 de octubre](correcciones-auditoria-2026-10-04.md).

Esta continuación de la auditoría confirma un **P1 que interrumpe el entrenamiento y la navegación en Android**, además de fallos de renovación de sesión y precisión de datos contra PostgreSQL real. La app tiene una identidad visual clara y un alcance funcional amplio, pero no la considero lista para uso real mientras existan los bloqueos nativos y las pérdidas silenciosas de pautas y borradores.

Complementa el [informe de código del 30 de septiembre](auditoria-2026-09-30.md), que contiene 41 hallazgos con sus reproducciones controladas. Ese informe recibió cambios concurrentes y se conserva íntegro. Este anexo añade pruebas nativas, recorridos visuales y resultados HTTP posteriores; actualiza aquí las limitaciones de comprobación que constan en el informe anterior.

No se corrigió código de la aplicación ni se utilizaron datos personales reales. Las cuentas, contraseña, planes, dieta, medidas y solicitudes de fotos fueron ficticios, en una base aislada. El correo se interceptó y no se envió. Los cambios concurrentes del catálogo, documentación y herramientas quedan fuera de esta revisión de errores.

## Valoración del producto

Estas notas expresan mi juicio sobre las pantallas observadas; no son métricas objetivas de satisfacción ni de rendimiento.

| Área                   | Nota   | Valoración                                                                                                                                                                                                                                                                                                                                             |
| ---------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Diseño                 | 7,5/10 | Fondo oscuro, dorado y tipografía deportiva coherentes. No me transmite el aspecto genérico de una app hecha con IA. La marca tiene identidad. En móvil pequeño hay títulos excesivos y solapamientos; en herramientas profesionales la densidad y alineación son mejorables.                                                                          |
| Animaciones            | 5/10   | La técnica se reproduce en Android y web y permite pausarla. La integración falla al liberar el reproductor y bloquea tareas centrales. No se midieron FPS ni rendimiento de una compilación de distribución.                                                                                                                                          |
| Experiencia de usuario | 5/10   | Los flujos de check-in, descanso, cierre, comidas y progreso son comprensibles. Los errores nativos, pérdidas silenciosas y reintentos bloqueados impiden una experiencia muy buena. La ficha profesional reúne muchos controles y algunas acciones prometen algo distinto de lo que hacen.                                                            |
| Funcionalidades        | 8/10   | El alcance principal es amplio: cuatro roles, cartera, planes, rutinas, catálogo, agenda, registro de entrenamiento, nutrición, seguimiento, valoraciones, fotos y consentimiento. Tener estas funciones no garantiza su fiabilidad. D04 y D07 conservan pendientes documentados; leads, fichajes y agenda de boxeo están fuera del alcance declarado. |

La corrección más urgente es estabilizar el ciclo de vida del vídeo. Después deben resolverse las carreras de autenticación y las pérdidas de datos descritas en la auditoría de código. Añadir funciones antes de asegurar estos recorridos aumentaría el trabajo sobre una base poco fiable.

## P1 El reproductor interrumpe la navegación y el avance del entrenamiento

[La limpieza del efecto de foco](../apps/mobile/src/catalogo-ejercicios/figura-ejercicio.tsx#L269) llama a `jugador.pause()` cuando el objeto nativo ya fue liberado.

**Reproducción nativa:** entrar como cliente, esperar a que se reproduzca el vídeo de Inicio y pulsar Plan. Android muestra `Render Error` y `Cannot use shared object that was already released`. Reiniciar Expo Go y repetir produce el mismo resultado. También ocurre al marcar el calentamiento y pasar al siguiente ejercicio. La traza señala la línea 269.

Se reprodujo **tres veces** en Android 15 con Expo Go 57.0.9 y la aplicación SDK 57. Debe coordinarse la limpieza con el ciclo de vida real del reproductor. No se ha probado una compilación de distribución y no se afirma que Android cierre el proceso: el comportamiento observado es un error de renderizado que interrumpe la tarea.

![Error del reproductor en Android](../build/auditoria/capturas/android-error-video.png)

## Confirmaciones con HTTP y PostgreSQL

### Renovaciones simultáneas dejan cero sesiones válidas

La [prueba existente de cuatro canjes](../apps/api/test/carrera-refresco.e2e-spec.ts#L103), ejecutada con PostgreSQL real en dos bases aisladas, esperaba un token vivo y recibió cero en ambas ejecuciones. Confirma el hallazgo 21 del informe de código. [La rotación](../apps/api/src/identity/tokens-refresco.service.ts#L154) decide sobre una lectura anterior al bloqueo de la cuenta; las peticiones siguientes pueden revocar la familia recién renovada.

### La precisión de una prueba física rompe su reintento

El contrato acepta `1.234`; una petición HTTP de prueba devuelve 201 y la base guarda `1.23` por la escala `Decimal(8,2)`. Repetir exactamente la petición, con el mismo UUID, devuelve **409 `operacion_incompatible`**. Confirma el hallazgo 16 del informe anterior, que inicialmente se había reproducido simulando la escala de la base.

La reproducción está en [http-dominio.mjs](../build/auditoria/http-dominio.mjs) y su salida en [http-dominio.log](../build/auditoria/http-dominio.log). Solo admite la base sintética de esta auditoría.

### Repetición concurrente de una medida

Diez peticiones HTTP con el mismo UUID devolvieron 201 y dejaron una sola fila. **En esa ejecución no se reprodujo el P2002** del hallazgo 11. Su evidencia sigue siendo la intercalación controlada con lecturas simultáneas; no debe presentarse como fallo observado por HTTP natural en esta pasada.

## Fallos adicionales de los recorridos móviles

### P2 La gestión de cuentas evita la renovación de sesión

[La API de identidad](../apps/mobile/src/lib/api.ts#L87) usa `pedir` con el token directamente, sin el transporte autenticado que renueva el acceso. Afecta a cartera, alta, ficha y asignaciones de nutricionista.

**Reproducción controlada:** una respuesta 401 a `/usuarios` causa `ErrorDeSesion`, con cero llamadas a `/auth/refresh`, aunque exista refresco válido. Cartera indica que hay que volver a entrar. El acceso dura 900 segundos por defecto. Estos recorridos deben utilizar la misma renovación que el resto de la app.

### P2 La respuesta de un comentario borra el borrador de otra sesión

[La respuesta al enviar](../apps/mobile/src/entrenamiento-entrenador/ficha/sesiones.tsx#L90) no comprueba que siga visible la sesión que originó el envío. Las flechas y el campo siguen activos mientras se envía.

**Reproducción controlada con el componente real:** enviar en A, navegar a B y escribir otro borrador; resolver la respuesta de A. B muestra el comentario de A y su texto nuevo queda vacío. Hay que asociar el resultado y el borrador a la sesión correspondiente.

### P2 Editar plan abre un plan nuevo vacío

La ficha profesional mostraba «Fuerza y hábitos · Septiembre», cuatro semanas, tres días y fase Adaptación. «Editar plan» abrió un constructor sin nombre ni ejercicios, seis semanas y comienzo en la siguiente semana. No cargó el plan que se estaba consultando. Publicar utiliza una asignación nueva y conserva las sesiones existentes.

La acción debe aclarar que crea un plan nuevo o implementar la edición prometida. Se comprobó visualmente en web; no se publicó el nuevo plan durante este recorrido.

## Detalles observados de experiencia de usuario

- Durante el entrenamiento se mostraba **1 de 9 series**; su cierre y confirmación mostraron **4 de 12** al sumar tres del calentamiento. La ficha del entrenador volvió a mostrar 1 de 9. Hay que explicar o unificar esos recuentos.
- «Entrenamiento enviado» no ofrece una acción visible para volver. En web se salió con Atrás del navegador. Conviene añadir una salida explícita al inicio o al plan.
- En Android a 320 px, el nombre largo del ejercicio y «Ver técnica» se solapan sobre el vídeo. Se conserva en [android-sesion.png](../build/auditoria/capturas/android-sesion.png).
- Salir del constructor después de añadir un ejercicio vuelve a la ficha sin advertir sobre los cambios de ese borrador. Conviene conservarlo o confirmar su descarte.
- Al registrar una cena en web, el primer intento mostró «No se pudo guardar la comida» y el segundo tuvo éxito. El transporte renueva accesos, pero no repite escrituras sin UUID de operación. La causa exacta de aquel fallo no se registró; no se cuenta como error nuevo confirmado. La pantalla necesita explicar mejor estos reintentos.
- El teclado Android oculta el botón de entrada en la pantalla pequeña, pero **Enter sí inicia sesión**. No se clasifica como bloqueo. La captura es [android-teclado.png](../build/auditoria/capturas/android-teclado.png).
- La caché de figuras se bloquea antes de instanciar el reproductor si la sesión vuelve en fase `local` sin token. Es un riesgo concreto del código para la reapertura sin red; sigue pendiente verificarlo en modo avión con una compilación de distribución.

## Cobertura y resultados

| Comprobación                         | Resultado y alcance                                                                                                                                                                                                                                                             |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unitarios API                        | 192 pruebas, 23 suites correctas en la base revisada.                                                                                                                                                                                                                           |
| Unitarios móviles                    | 613 pruebas, 70 suites correctas ejecutadas en serie.                                                                                                                                                                                                                           |
| HTTP con PostgreSQL 17 UTF8          | 470 pruebas correctas y 4 fallidas, de 474 en 45 suites. Un fallo corresponde al refresco de sesiones; tres a `prepararAmpliacion`, que figuraba como pendiente en la ampliación concurrente del catálogo.                                                                      |
| Entorno HTTP                         | Puerto 15432, base dedicada, 26 migraciones aplicadas. No se utilizó el PostgreSQL habitual ni datos reales.                                                                                                                                                                    |
| Tipos, compilación y exportación web | Correctos en la base revisada; el informe previo recoge los comandos y las limitaciones de formato de archivos concurrentes.                                                                                                                                                    |
| Web                                  | Acceso, validación, inicio, check-in, técnica, serie válida e inválida, descanso, cierre parcial, envío, confirmación, registro de cena, progreso, perfil, cierre de sesión, cartera, ficha, constructor, seguimiento y solicitud de fotos. Resoluciones de 360×800 y 1440×900. |
| Android                              | Emulador Android 15, 320×640. Acceso con teclado y Enter, restauración, reproducción y pausa, cambio de pestaña, plan, check-in y avance del calentamiento. El cambio de pestaña y avance del calentamiento reproducen el error nativo.                                         |
| Cámara                               | Solicitud ficticia creada desde el entrenador; visible en Android. Permiso de cámara concedido solo esa vez y cámara virtual abierta. La lectura del MCP falló después del disparo; no se da por comprobada la subida completa.                                                 |
| Cuatro roles                         | Cuentas sintéticas preparadas y permisos cubiertos por las pruebas HTTP. Recorridos visuales de cliente y entrenador; no se afirma haber recorrido cada pantalla de los otros dos roles.                                                                                        |
| Sin conexión                         | Revisión del almacenamiento local y reproducciones controladas en el informe anterior. Modo avión, reapertura y sincronización completos en dispositivo quedan pendientes.                                                                                                      |
| Fuera de la comprobación             | iOS, teléfono físico, compilación de distribución, proveedor S3 real, despliegue HTTPS y medición de FPS.                                                                                                                                                                       |

La primera ejecución de PostgreSQL tenía codificación WIN1252 y produjo un error Unicode de entorno. Se repitió en UTF8 y ese caso pasó. No se presenta como defecto de la app.

Durante la continuación, el acceso del navegador a `localhost:8182` fue denegado. Se detuvieron esas interacciones sin recurrir a otra dirección o navegador. Por eso no se completaron los recorridos visuales adicionales que quedaban; este documento distingue lo probado de lo pendiente.

## Entorno preparado y evidencias

Mobile MCP 1.0.6 quedó registrado en Codex, con telemetría desactivada y el SDK Android local configurado. Su descubrimiento principal no encontraba el emulador en Windows; el backend alternativo incluido en el MCP lo detectó como `emulator-5554`, Android 15, online. Se instalaron las herramientas Android y Expo Go oficiales, con las licencias previamente aceptadas por el usuario. No se contrataron dispositivos cloud ni servicios de pago.

Los recursos de SDK, emulador y PostgreSQL viven en carpetas temporales `alpha-omega-android-20260930` y `alpha-omega-mobile-mcp-20260930`. Los arneses de esta continuación están en `build/auditoria/`, ignorado por Git. Las capturas acompañan el informe y los logs HTTP permiten revisar los resultados.

![Inicio nativo](../build/auditoria/capturas/android-inicio.png)

Las pruebas y la revisión no equivalen a «absolutamente todas» las combinaciones de dispositivos, red y concurrencia. La evidencia es suficiente para identificar bloqueos de salida y priorizar correcciones concretas; no para certificar una aplicación sin errores.
