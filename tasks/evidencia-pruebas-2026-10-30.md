# Evidencia de pruebas y correcciones · 30-10-2026

Tanda solicitada por David a las 05:40 de Madrid, con una hora de margen. Este documento registra comprobaciones de Codex y sus límites. No sustituye la revisión, los commits ni el go/no-go de Claude.

**Destino aclarado posteriormente por David: prueba privada con Expo Go.** La falta de DNS público descrita abajo no bloquea ese objetivo. Se mantienen Metro en `192.168.68.51:8081` y la API local en `192.168.68.51:3000`; el teléfono debe estar en la misma red y el equipo debe seguir encendido. La comprobación del 30-10 a las 07:46 UTC confirmó salud de API/base y Metro HTTP 200, con el manifiesto Android anunciando esa misma dirección LAN. La verificación de uso en el teléfono sigue pendiente.

## Alcance y entornos

- Navegador Chromium aislado, vistas de cliente y entrenador a 390 px y comprobaciones adicionales a 360 px. Sin usar la sesión del navegador personal.
- Lecturas autenticadas de la demo `alpha_omega_manual_20261027`; un interceptor impide mutaciones salvo acceso y renovación. Las credenciales no se guardan en este informe.
- Pruebas HTTP y escrituras de entrenamiento exclusivamente en `alpha_omega_e2e_codex`. Sin reinicializar ni migrar la base habitual o la demo durante esta tanda.
- Node 24.19.0 y npm 10.9.4 para aplicación, builds y pruebas. El arnés externo de medición usa Node 22.22.0, sin ejecutar la aplicación con ese runtime. No se modifica la instalación global.
- Evidencias fuera del repositorio: `C:/Users/david/.codex/visualizations/2026/10/30/01a18aa4-2d12-7212-9824-cf3f7cd70bfe/`.

## Defectos reproducidos y corregidos

1. **Rutas públicas con sesión abierta (A-06).** Activación, recuperación y restablecimiento conservan su destino y parámetros aunque haya una sesión online, local o con renovación fallida. No quedan atrapadas en la pantalla privada ni en la puerta de consentimiento. `login` conserva la redirección existente. Pruebas observadas rojas antes de corregir; 9 suites y 62 pruebas enfocadas verdes. Recorrido real de las tres rutas con ambos roles: 6/6.
2. **Inicio pendiente de redirección.** Sustituida la vista vacía por un indicador de carga accesible; se conserva la redirección al enfocar. No se declara resuelto cualquier posible parpadeo fuera de este caso.
3. **Intro web.** Reproducido `AbortError` al interrumpir el vídeo con su descarga retrasada. El reproductor web usa el autoplay del elemento de vídeo; el reproductor nativo se conserva extraído en su propio módulo. Sin parche de proveedor ni supresión global de errores. Tres suites y 30 pruebas enfocadas verdes. Navegador: salto inmediato, a 50 y 150 ms, y reproducción natural de 8,42 s; ningún error JavaScript en los cuatro casos.
4. **Suplementación a 360 px.** La dosis comprimía «Creatina monohidrato» hasta partir el nombre en fragmentos mínimos. Nombre y dosis ocupan ahora dos líneas dentro del mismo contenido, con tamaños fijos y una zona táctil de al menos 44 px. Dos suites y 27 pruebas enfocadas verdes tras observar la regresión fallar.
5. **Progreso según el diseño de Claude.** Se recuperan medidas publicadas en centímetros que la API devolvía pero la pantalla omitía. Se respeta la configuración existente, sin incorporar pesos privados ni mezclar fuentes o protocolos. Para cintura se utiliza la fuente con el último registro más reciente, con publicación como desempate. También se corrige el borde de una tarjeta comparativa seguida de pasos o sueño. Nuevas regresiones observadas rojas antes y verdes después; se conservan pruebas de permisos y modo entrenador.
6. **Confirmación de entrenamiento con varios bloques.** La sesión se guardaba completa, pero ENVIADO/GUARDADO contaba solo Principal: mostraba 0 de 2 en una sesión de 8 series con una hecha en calentamiento. Ambas confirmaciones cuentan ahora todas las series prescritas. Pruebas online y offline observadas rojas antes y verdes después; archivo completo: 55/55. Sin cambios en persistencia, reloj, descanso ni reglas de carga.
7. **Dependencia Zod vulnerable en el lockfile.** La versión anidada 3.25.76 de la CLI ignoraba el override existente. Se corrigió únicamente `package-lock.json`, manteniendo SDK, React Native y `package.json`. La CLI resuelve Zod 4.6.7; la exportación comprueba que no contiene Zod 3 anidado. La normalización se hizo con npm 11 temporal y la instalación final con npm 10.9.4; `npm ci --dry-run` conserva el lockfile. npm 10 sigue emitiendo un falso `invalid` en `npm ls zod` por su interpretación del override; no representa la versión realmente resuelta.

## Recorridos comprobados

- Cliente: acceso, Hoy, Plan, Rutina, Nutrición, Progreso, detalle de peso y regreso. Entrenador: acceso, Inicio, Clientes, Rutinas, Ejercicios y ficha de la demo. Sin desbordamiento horizontal en las capturas.
- Plan y Nutrición siguen accesibles sin conexión sin expulsar la sesión; al recuperar la red Progreso vuelve a cargar. Los únicos errores de consola del recorrido de producción corresponden a la desconexión provocada, `ERR_INTERNET_DISCONNECTED`.
- Entrenamiento con fixture aislado: cuatro bloques, editar 15 kg, marcar una serie, avanzar y retroceder conserva cambios, salir y reabrir conserva el borrador, continuar tras pausa, confirmar las siete pendientes de la sesión completa y enviar una sola vez. El entrenador lee la serie hecha con 15 kg; agenda cerrada, borrador eliminado y una sola operación de envío. Repetido tras la corrección, con captura inspeccionada: «1 de 8 series». Fixture eliminado, cero usuarios pendientes y puerto 3109 cerrado.
- M11: no aparecen avisos de `Image` sobre `style.resizeMode` o `tintColor` en los recorridos autenticados. En desarrollo sí permanece el aviso informativo de Reanimated por la preferencia de movimiento reducido usada en la prueba.

Los scripts de navegador viven fuera del repositorio. `release-live/smoke-log.json`, `release-live/intro-log.json`, `release-live/e2e-bloques-log.json` y `rutas-publicas-real-log.json` contienen la evidencia; las capturas están junto a sus logs. Los fixtures se eliminan y los navegadores temporales se cierran.

La pasada final del navegador sobre `release-final-export` terminó con código 0: ambos roles, 18 capturas, sin error JavaScript, desbordamiento ni mutación bloqueada. Solo constan dos errores de recurso al provocar la desconexión. Evidencia: `release-production/smoke-log.json`. Se inspeccionaron visualmente la suplementación a 360 px, Progreso y el contador final de la sesión.

## Reconciliación de pendientes anteriores

La revisión de código e historial confirma N-04 en `cc59191`, N-05/N-06 en `a353ffd`, E-04 en `c5dc8f1` y E-05 en `4ca266c`. No se han rehecho estas correcciones: la batería general conserva sus pruebas de copia, recarga y deduplicación. El sondeo de registro sigue en 5 s, pero no vuelve a cifrar/persistir si el documento no cambia; el de la semana es de 15 s.

T-04 dispone de Deshacer de 5 s para ejercicio, fase y deporte, con pruebas de restauración, como pedía la auditoría original; quitar un día con ejercicios exige confirmación. La frase posterior «confirmar al quitar» no está implementada literalmente como un diálogo para los tres primeros casos. Las pestañas siguen usando `replace`; `animation: "none"` elimina el deslizamiento descrito en X-01. A-12 era el parpadeo sospechado de Inicio y su estado de espera ahora es visible. Se corrige la parte de A-06 de rutas públicas con sesión; conservar un destino privado al pasar por login sigue pendiente. La migración general de botones `Pressable` no se ha ejecutado en esta tanda.

## Exportación y dependencias

Se exportan web, Android e iOS con `EXPO_PUBLIC_API_URL=https://api.alphayomegatraining.com`; comando terminado con código 0 tras corregir el contador. Los mapas confirman seis fuentes web actuales y, en ambos bundles nativos, el registro de sesión y el reproductor nativo. Android/iOS son bundles Hermes: esto no equivale a compilar ni instalar un APK, AAB o IPA.

| Artefacto                           |     Bytes | Gzip calculado |
| ----------------------------------- | --------: | -------------: |
| Web, suma de 38 archivos JavaScript | 4.105.444 |        984.815 |
| Android, bundle Hermes              | 5.616.572 |      2.285.327 |
| iOS, bundle Hermes                  | 5.629.612 |      2.288.946 |

Gzip se calcula sobre los archivos; no implica que un proveedor esté sirviendo compresión. La suma web incluye rutas cargadas bajo demanda, no es el peso inicial de una sola visita. Los hashes y tamaños por archivo constan en `release-final-export-verification.json`.

El recorrido de la exportación web se sirvió en `127.0.0.1:8189`. Las peticiones al dominio configurado se redirigieron exclusivamente dentro del navegador de prueba a la API local. Esto valida la lógica del cliente exportado, sin acreditar conectividad pública, DNS, TLS ni CORS del servidor desplegado. El log declara `productionHostVerified: false`. El servidor auxiliar se cerró después de las comprobaciones.

`npm audit --audit-level=high` no detecta vulnerabilidades altas, críticas ni moderadas tras la corrección de Zod. Permanecen 17 avisos bajos transitivos de deepmerge 4.3.1, sin versión corregida en el aviso; no se ha degradado Expo ni aplicado `audit fix --force`. Referencias: [Zod](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5), [deepmerge](https://github.com/advisories/GHSA-gcqx-w48m-w2h4). Evidencia: `audit-after-zod-security.json` y `release-final-export-verification.json`.

## Rendimiento medido, sin optimizaciones

Host sin compilaciones ni suites simultáneas. API y base locales ya calientes: una petición de calentamiento excluida y diez GET secuenciales por ruta, midiendo hasta leer el cuerpo completo. Las 30 respuestas fueron HTTP 200. La ruta de ficha mide los datos básicos del cliente, no toda la pantalla y sus demás peticiones.

| Endpoint local                     |      p50 |      p95 |
| ---------------------------------- | -------: | -------: |
| Inicio entrenador: resumen semanal | 28,83 ms | 31,62 ms |
| Datos de ficha del cliente         |  9,17 ms | 11,90 ms |
| Semana del cliente                 | 16,60 ms | 20,61 ms |

Web exportada: cinco contextos Chromium nuevos a 390 px, caché HTTP deshabilitada y almacenamiento vacío; `/` redirige a `/login` en los cinco. Sin limitación de CPU o red; navegador, disco y servidor pueden estar calientes. FCP y LCP observados: p50 524 ms, p95 544 ms; formulario presente: 1100,7/1116,2 ms. Tras reproducir la intro completa sin saltarla: 9660,1/9675,7 ms. La intro sigue siendo saltable y su duración de diseño no se ha cambiado.

Percentiles por rango más cercano; con diez o cinco muestras, p95 equivale al máximo observado. Son medidas locales, no una prueba de carga ni previsión del rendimiento en internet o en un teléfono. Una tanda anterior bajo carga y con la carpeta de exportación regenerándose se descartó para la comparación; no se ha atribuido su timeout a un defecto funcional. Datos, rutas y metodología: `performance-web-api-final.json`.

## Infraestructura local recuperada

Docker Desktop no arrancaba por dos sockets AF_UNIX obsoletos que Windows no podía recorrer. Se conservaron los directorios originales como `sockets-backup-codex-20261030-*` y se recrearon sus directorios vacíos. Sin restauración de fábrica, cambios de ACL ni borrado de volúmenes, WSL o bases. Motor 29.7.2 operativo; PostgreSQL saludable; API local `/salud` responde 200. Se mantiene la vista previa solicitada por David: API 3000 y Expo 8081, con el QR LAN existente.

## Límites para una salida pública

- **Bloqueo verificado:** `api.alphayomegatraining.com`, fijado en los perfiles preview y production, no resuelve por DNS (`ENOTFOUND`/NXDOMAIN). Las consultas HTTPS independientes a Google DNS y Cloudflare devuelven estado DNS 3, sin respuestas A. No se ha sustituido por una URL inventada ni publicado el backend en un proveedor sin configurar.
- La infraestructura, correo, almacenamiento privado y enlaces HTTPS asociados al dominio siguen necesitando comprobación en el proveedor real; las pruebas locales no cierran esos puntos de `docs/PENDIENTE-PARA-PRODUCCION.md`.
- No se ha probado una instalación nativa en dispositivo físico, cámara/galería reales ni lector de pantalla Android. No se declara publicación en tiendas ni despliegue completado.
- Reservas R2/R3 son API; R4–R6 siguen pendientes del checkpoint del contrato y no se presentan como funcionalidad móvil entregada. Tampoco se resuelven por inferencia las decisiones D2/D3/D4/D5.
- Sin staging ni commits. Claude conserva la revisión, la preparación de commits y el cierre final.

## Verificación final

- `npm run typecheck`: código 0 con las fuentes finales.
- `npm run lint`: código 0, ESLint y Prettier correctos.
- `npm run build --workspace apps/api`: código 0 con las fuentes actuales.
- `npm test`: código 0; API 539/539 en 50 suites, móvil 1758/1758 en 166 suites y compartido 69/69. Ninguna prueba omitida en esta tanda.
- Navegador de la exportación final y medición de rendimiento: terminados, como consta arriba.
- `POSTGRES_DB=alpha_omega_e2e_codex npm run test:cobertura`: código 0 en la repetición aislada; 539 unitarias API y 589/589 HTTP en 54 suites. Cobertura fusionada de 40 servicios y guardas: líneas 96,51 %, sentencias 94,70 %, funciones 98,60 %, ramas 87,46 %. Mínimo del 80 % cumplido en las cuatro métricas. Log: `release-final-coverage.log`.
- La primera pasada de cobertura, solapada con compilaciones y batería general, terminó con 588/589 HTTP correctas y agotó el límite existente de 5 s en un caso de `valoraciones-novedades.e2e-spec.ts`. La repetición completa aislada terminó en 138,8 s frente a 254,9 s de la primera, sin modificar el límite, las aserciones ni la implementación de ese caso. Se conserva el fallo inicial como incidencia de la ejecución; el resultado verde aislado no promete ausencia de flakiness bajo cualquier carga.
