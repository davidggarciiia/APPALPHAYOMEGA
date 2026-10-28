# Revisión integral de producción — 27 de octubre de 2026

Se completó la lectura de **520 archivos propios** del checkout actual: API,
cliente, contratos, pruebas, configuración, SQL, scripts y herramientas. El
inventario registra lectura completa, procedencia y SHA-256; se contrastó con el
estado final. Se conservaron los cambios de trabajo previos.

**Resultado: la revisión local está terminada; la publicación sigue pendiente.**
Las pruebas y compilaciones siguientes acreditan el ámbito indicado. La app aún
necesita validación física, servicios reales, decisiones de alcance y privacidad.

## Qué se corrigió

| Área                        | Comportamiento corregido                                                                                                                                                                                                                                   |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Salud y nutrición           | Guardar y publicar cálculos dietéticos exige consentimiento vigente dentro de la transacción, también tras una retirada concurrente.                                                                                                                       |
| Identidad                   | Backoff de fallos antiguos, secreto JWT de producción y bases HTTPS explícitas para activación y recuperación.                                                                                                                                             |
| Fotos                       | Decodificación real de JPEG/PNG/WebP y fotogramas animados; rechazo de archivos vacíos, truncados y dimensiones excesivas. Se conservan los bytes limpios. PUT con cancelación/tiempo límite y reintento de la misma intención.                            |
| Transporte y configuración  | TLS PostgreSQL verificado para API y Prisma CLI, cabeceras HTTP también en errores y rechazo de almacén local/correo de pruebas en producción. S3 exige HTTPS y evita el bypass por endpoints configurados en el SDK.                                      |
| Edición y navegación        | Conservación de datos al cambiar pestañas, salir, volver y fallar el disco. Guardas de ruta y recarga, publicación pendiente recuperable, modales ocupados y fechas incompletas legibles.                                                                  |
| Entrenamiento               | Ajustar una sesión conserva duración, notas, partes y circuito. Molestias congela payload, UUID y contexto visible durante envío/reintento; el cierre conserva respuestas y notas.                                                                         |
| Consultas y compatibilidad  | Históricos de más de veinte entradas accesibles, búsquedas limitadas al contrato, evolución sin puntos segura y errores de seguimiento mostrados como datos desconocidos. Las dietas antiguas siguen legibles y pueden corregirse antes de publicar.       |
| Herramientas y dependencias | Validación del seed, protección/limpieza de recorridos sintéticos, launcher relativo al proyecto, SDK Expo alineado, Jest de cada workspace y lockfile revisado. Parche de compatibilidad reproducible del router y configuración Android oscura completa. |

El detalle por hallazgo y archivo está en el [informe JSON](revision-produccion-2026-10-27.json).
El parche de dependencias se explica en [patches/README.md](../patches/README.md).

## Comprobación final

| Control                           | Resultado                                                                                                                                                                                                                                                                                            |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unitarias API                     | 352 pruebas / 40 suites, sin fallos ni pendientes.                                                                                                                                                                                                                                                   |
| Unitarias y componentes móvil     | 728 pruebas / 83 suites, sin fallos ni pendientes.                                                                                                                                                                                                                                                   |
| E2E                               | 510 pruebas / 46 suites; base dedicada con 26 migraciones, datos sintéticos y correo/objetos locales.                                                                                                                                                                                                |
| Tipos, ESLint, Prettier y diff    | Correctos. Build de API correcto.                                                                                                                                                                                                                                                                    |
| Dependencias                      | npm audit: 0 avisos conocidos. Expo install --check: alineado. Se mantienen avisos de obsolescencia de herramientas.                                                                                                                                                                                 |
| Instalación limpia                | npm ci con scripts activados, Node 24.19.0 y npm 10.9.4; aplica el parche, compila shared y genera Prisma sin credenciales ni conexión a una base.                                                                                                                                                   |
| Exportación                       | Web de producción y bytecode Hermes Android/iOS generados. Los tres artefactos tienen huella en el JSON.                                                                                                                                                                                             |
| Prebuild nativo                   | Android correcto: HTTPS autoVerify, rutas, identificador y tema oscuro. Expo omite iOS en Windows; no se generó ni firmó un APK/IPA.                                                                                                                                                                 |
| Navegador del artefacto exportado | 17 comprobaciones con cuatro roles, escritorio y móvil; 57 peticiones al API sintético, cero excepciones de página y cero respuestas 500. Incluye fecha parcial, confirmación beforeunload y pauta conservada entre pestañas. El nutricionista muestra correctamente su lista vacía en este fixture. |
| TLS real PostgreSQL               | 9/9: pg, PrismaPg y Prisma CLI aceptan la CA/nombre correctos y rechazan CA falsa y nombre incorrecto. Fixture eliminado.                                                                                                                                                                            |
| Restauración                      | Instantánea exclusivamente sintética: 37 tablas y 275 filas restauradas en otra base, con recuentos y huellas idénticos. Esta prueba cubre la base, no el backup del bucket.                                                                                                                         |
| Disponibilidad local              | 200 solicitudes a salud con diez concurrentes y cero fallos. Es una sonda local con datos sintéticos; falta medir capacidad en el alojamiento elegido.                                                                                                                                               |

La exploración anterior, con 183 registros de comprobación, se conserva en
[prueba-manual-2026-10-27.md](prueba-manual-2026-10-27.md). La última pasada usa el
bundle web de producción y redirige únicamente el origen API a localhost mediante
el navegador de prueba. No acredita el dominio ni los servicios públicos.

## Cobertura y permisos

La fusión de contadores Istanbul de unitarias y E2E incluye los **32 servicios y
4 guardas**, también los archivos a cero de cada ejecución. Resultado combinado:
**95.36% líneas, 93.69% sentencias, 97.69% funciones y 86.28% ramas**.
La medición solo unitaria tiene 49,77% de líneas; gran parte de la lógica de
servicios y autorización se ejecuta con la base real en los E2E.

Los agregados de servicios y guardas superan el 80%. Algunos archivos individuales
quedan por debajo, especialmente correo (45,45% de líneas). SPEC no precisa la
métrica ni si exige el mínimo por archivo; esa interpretación debe quedar escrita
y conectada al control de calidad. La matriz de 44 permisos usa un controlador de
prueba; las denegaciones en rutas reales se documentan aparte. Los números no
acreditan por sí solos una auditoría exhaustiva de todas las combinaciones.

## Pendientes que impiden afirmar preparación completa

- **Funcionalidad especificada:** el login de Google y el flujo completo de borrado
  a petición/anonimización siguen sin implementar. Hay que cerrar ese alcance con
  lo que se vaya a entregar. El acceso actual usa correo y contraseña. La revisión
  de login social de Apple queda condicionada a incorporar terceros; véase
  [PENDIENTE-PARA-PRODUCCION](../docs/PENDIENTE-PARA-PRODUCCION.md).
- **Dos políticas de acceso:** decidir si el entrenador puede completar medidas y
  pruebas de un cliente dado de baja, y qué pruebas físicas puede consultar el
  nutricionista. Los endpoints antiguos y los resúmenes nuevos difieren. Se
  conservaron los permisos vigentes ante un contrato ambiguo.
- **Android/iOS físicos y firmados:** cámara/galería, permisos denegados, temporales,
  SecureStore, SQLite, cierre brusco, mala red, reinstalación, vídeo y enlaces
  verificados. Los bundles Hermes y prebuild Android cubren una parte del proceso.
- **Servicios e instalación reales:** DNS, AASA/assetlinks con firmas auténticas,
  remitente y entrega Resend, S3 privado en la UE, CORS, expiración, limpieza y
  respaldo de objetos. No se invocaron proveedores reales en estas pruebas.
- **Operación:** elegir alojamiento, ensayar el despliegue con su proxy/CA,
  configurar sondas con plazos, alertas, capacidad, copias programadas cifradas y
  recuperación. El driver no fija un plazo de conexión/consulta; una base que no
  responde puede retener la sonda. Es una inferencia de configuración pendiente
  de ensayo con el proveedor. Los SQL de rollback destructivo requieren revisión
  y copia previa. Falta CI automática y la aplicación del criterio de cobertura.
- **Privacidad:** el consentimiento conserva una versión de borrador. Faltan su
  validación jurídica y la definición de información de privacidad, conservación
  y procedimiento efectivo de borrado.

## Evidencia y alcance

El [JSON adjunto](revision-produccion-2026-10-27.json) conserva el inventario de los
520 archivos, huellas, resultados y pendientes. Los logs, informes de cobertura,
capturas, exportaciones y scripts reproducibles están en
build/production-20261027/. Se excluyen fuentes de terceros, binarios,
artefactos generados, otros worktrees y el HTML de referencia visual. El lockfile
se comprobó mediante análisis del árbol, auditoría e instalación reproducible.

Las bases habituales y los cambios ajenos se conservaron. No se hizo commit,
push ni despliegue. El [manual de despliegue](../docs/DESPLIEGUE.md) recoge la
configuración y los controles que faltan en el entorno real.

## Estado local al cierre

La API sintética sigue en el puerto 3101 y PostgreSQL continúa sano. El servidor
web de la prueba de release se cerró después de las 17 comprobaciones correctas.
La revisión automática de aprobación rechazó el reinicio del servidor Expo de
desarrollo con el único motivo «blocked by policy». La web no quedó reiniciada;
este bloqueo de ejecución es independiente de los resultados de pruebas y build.
