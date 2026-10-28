# Prueba exploratoria de la app — 27 de octubre de 2026

Se recorrió la aplicación web en un navegador Chromium real, mediante controles
de la interfaz, capturas, inspección del DOM y comprobación de las respuestas de
la API. Se corrigieron nueve incidencias y se repitieron sus recorridos. Los
resultados corresponden a web; no equivalen a una validación nativa de Android o
iOS.

Después de estos recorridos se hicieron más correcciones en la
[revisión de producción](revision-produccion-2026-10-27.md). Este informe
conserva la evidencia de la fase manual anterior; las comprobaciones del estado
posterior están en esa revisión.

## Entorno

- Interfaz Expo: `http://localhost:8181`; API real: `http://127.0.0.1:3101`.
- PostgreSQL dedicado: `alpha_omega_manual_20261027`, con las 26 migraciones.
  El contenedor `alpha-omega-db` está arrancado y sano.
- Cuentas y datos sintéticos separados por recorrido: entrenador, cliente,
  nutricionista y empleado. La base habitual no recibió estos datos.
- El correo saliente se capturó localmente: se comprobaron activación,
  recuperación y enlaces usados, sin enviar mensajes reales.
- Anchos comprobados entre 320 y 430 px y en escritorio de 1280 y 1440 px.
  Los navegadores utilizaron contextos aislados, sin perfiles personales.
- Los fallos de red se provocaron de forma controlada para comprobar reintentos,
  pérdida de respuesta y conservación de la edición. Los vídeos y fotos usados
  son patrones sintéticos.

## Recorridos comprobados

| Área               | Comprobaciones                                                                                                                                                                                                                                                                                |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cuentas y permisos | Acceso y validación, invitación, corrección de correo pendiente, reenvío, activación, recuperación, enlaces usados, cierre de sesión, revocación, perfiles, baja/reactivación, duplicados y acceso según rol/asignación.                                                                      |
| Consentimiento     | Aceptación explícita, bloqueo sin marcar, retirada con confirmación, nueva aceptación, conservación de datos, contraste y estado accesible de las opciones.                                                                                                                                   |
| Catálogo y medios  | Crear, buscar, editar, retirar y restaurar ejercicios; asignar, cambiar y quitar figura; reproducción, pausa y reanudación de vídeo real en web; técnica sin figura y ficha guardada sin conexión.                                                                                            |
| Planes y rutinas   | Crear y editar rutina, cargar una copia independiente, plantilla, días, fases, deportes, pasos, vista del cliente, publicación y PDF. Sesión con calentamiento, parte principal, circuito y vuelta a la calma.                                                                                |
| Calendario         | Semana anterior/siguiente, cambio de día, historial del cambio, reflejo en entrenador y cliente, ajuste de una sesión futura y conservación del resultado ya enviado.                                                                                                                         |
| Entrenamiento      | Check-in, repeticiones/segundos/metros, carga externa/sin carga, peso inválido, RIR, descansos, omitir/recuperar serie, nota, recarga del borrador, registro sin red, cierre, envío pendiente inmutable, reintento y resultado de solo lectura.                                               |
| Comunicación       | Novedades, respuesta a molestias, validación del texto, comentario con reintento de la misma operación, lectura por el cliente y revisión de la sesión.                                                                                                                                       |
| Diario y progreso  | Peso, pasos, sueño, medidas iniciales, cintura, grasa y masa libre de grasa; vistas de evolución y fuerza; orden/frecuencia de indicadores, objetivo y rango inválido; prueba pautada con resultado cero conservado.                                                                          |
| Valoraciones       | Plantilla de medidas/pliegues/bioimpedancia y pruebas, borrador, guardar/reabrir, pendientes/no realizado, lecturas originales y adopción, publicación, notas internas privadas, corrección/versiones, revisiones y conflicto entre dos ediciones.                                            |
| Fotografías        | Solicitud, selección de imagen, preparación y subida, error/reintento, incorporación y revisión, evolución y fechas/vistas, comparación, retirada, enlace fallido y recuperación.                                                                                                             |
| Nutrición          | Vacío inicial, tipos de día y semana, platos/alternativas/intercambios, objetivos y cálculo de macros, indicaciones/suplemento, borrador, publicar, histórico, descartar, asignación y solo lectura, registro/quitar comida, conflicto, pérdida de respuesta, copia offline y comida ausente. |

Las evidencias detallan qué variantes se ejecutaron. Una captura inmediata puede
preceder a una respuesta asíncrona; se utilizaron también esperas y capturas
posteriores para confirmar el resultado. Los errores de selector del conductor
no se contabilizaron como fallos de la aplicación.

La ampliación final de valoraciones añadió 33 comprobaciones: renombrar,
reordenar, desactivar/reactivar y versionar definiciones; seis pruebas estándar
y una personalizada; bioimpedancia en kg, porcentaje e índice; intervalos,
fecha y desprogramación de la revisión; publicación y conservación de las
versiones anteriores. Complementa las variantes pendientes del primer informe
de valoraciones.

## Incidencias corregidas y repetidas

| ID  | Incidencia observada                                                                                                 | Resultado tras corregir                                                                                                         |
| --- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| M01 | Consentimiento con texto claro sobre fondo blanco.                                                                   | Fondo oscuro, texto legible y pantalla completa.                                                                                |
| M02 | Casillas y opciones no comunicaban el estado marcado en web.                                                         | `aria-checked` sigue el estado real, conservando el estado accesible nativo.                                                    |
| M03 | Cambiar entre móvil y escritorio desmontaba la pantalla y perdía la edición.                                         | El contenido conserva su posición; nombre, semanas y otros campos sobreviven al cambio de ancho.                                |
| M04 | Publicar o descartar una dieta dejaba obsoleta la cabecera o la Pauta del profesional.                               | Se actualiza el estado del padre después de confirmar la operación.                                                             |
| M05 | Un nutricionista sin acceso recibía un mensaje que decía que la pantalla era solo para el entrenador.                | El mensaje explica la falta de permiso sin atribuir un rol incorrecto.                                                          |
| M06 | La copia offline cambiaba el autor de la dieta y presentaba registros desconocidos como cero o suplemento no tomado. | Conserva el autor y muestra expresamente el registro no disponible.                                                             |
| M07 | El PDF perdía las secciones, vueltas/descanso del circuito y tiempos de las partes.                                  | Conserva las cuatro partes, sus dosis y metadatos; el encabezado de la columna es «Pauta». PDF generado y revisado visualmente. |
| M08 | Un ejercicio pautado sin carga externa proponía «Sube la carga».                                                     | Pide «Revisar pauta» al completar el criterio; la progresión con carga y las molestias conservan su tratamiento.                |
| M09 | Una comida que ya no existía dejaba una pantalla de error sin salida en la app.                                      | «Volver a Nutrición» reemplaza esa ruta y permite continuar.                                                                    |

Se añadieron regresiones para pérdida de estado, invalidación de dieta, mensaje
de permisos, copia offline, PDF, progresión sin carga y salida de comida. Los
cambios recibieron revisión cruzada. Se conservaron copias anteriores de los
archivos para distinguir esta intervención de los cambios que ya había en la
carpeta de trabajo.

## Verificación

- **996 tests unitarios correctos:** 302 de API y 694 de la app, en 110 suites.
  Registro: `build/manual-20261027/unit-current.log`.
- **Typecheck global correcto**, incluidos raíz y los tres workspaces.
  Registro: `build/manual-20261027/typecheck-current.log`.
- **500 E2E correctos en 45 suites**, ejecutados durante esta tarea contra
  `alpha_omega_e2e_codex`. Desde esa ejecución las correcciones de producto
  afectaron solo al cliente móvil/web; el backend no cambió.
- **ESLint y Prettier globales correctos**, incluidos los cuatro avisos de
  formato anteriores. Registro: `build/manual-20261027/lint-current.log`.
  `git diff --check` también es correcto.
- No se observaron excepciones JavaScript sin capturar ni respuestas 500
  inesperadas en los recorridos registrados. Los rechazos 400/401/403/409 y
  fallos de conexión deliberados forman parte de las pruebas negativas.

## Evidencias

El índice completo está en [prueba-manual-2026-10-27.json](prueba-manual-2026-10-27.json).
Las capturas, DOM, resultados y registros permanecen localmente en
`build/manual-20261027/`, que está excluido de Git:

- [Entrenamiento, diario e integración](../build/manual-20261027/root-result.json).
- [Cuentas, catálogo, rutinas y PDF](../build/manual-20261027/identity/result.json).
- [Nutrición](../build/manual-20261027/nutrition/report.json).
- [Valoraciones, fotos y evolución](../build/manual-20261027/valuation/result.json).
- [Ampliación de plantillas y pruebas](../build/manual-20261027/identity/valuation-extra/report.json).
- [Vídeos](../build/manual-20261027/media-animations/result.json).

## Límites

- No hay un dispositivo ni un emulador Android/iOS disponible. Quedan sin
  comprobar los permisos del sistema para cámara/galería, el llavero y cifrado
  nativo, caché de archivos/vídeos nativa, suspensión y cierre del proceso,
  enlaces abiertos por el sistema, TalkBack y VoiceOver.
- Se comprobó Chromium. No se certifican otros navegadores, todos los tamaños ni
  una auditoría completa de accesibilidad.
- Correo y almacenamiento se comprobaron con captura y almacén local. No se
  probó entrega real del proveedor de correo ni S3. Los clips prueban la
  reproducción, sin validar técnica biomecánica de animaciones comerciales.
- No se ejecutaron manualmente todas las combinaciones numéricas, límites de
  volumen, paginaciones extensas o carreras de cada editor. Los informes por
  área enumeran las variantes concretas no ejecutadas; los tests automáticos
  complementan la exploración y no sustituyen una prueba nativa.
- La subida profesional de fotos y su comparador profesional no tienen un
  acceso en la interfaz actual; no se declaró como recorrido manual una
  capacidad disponible únicamente en API.
- Persisten avisos de desarrollo sobre propiedades de `Image` y una advertencia
  de PostgreSQL en el arnés E2E. No impidieron los recorridos ni se silenciaron.

No se modificó la base habitual ni se hicieron commits, publicación o despliegue.
Docker y los servidores locales de prueba quedan disponibles con datos sintéticos.
