# ADR 0005: Las fotos van a almacenamiento de objetos, con enlaces firmados

- **Fecha:** 2026-09-16
- **Estado:** aceptado e implementado (2026-09-24); pendiente de elegir proveedor
- **Contexto:** tarea 15, aplazado hasta el módulo `seguimiento-corporal`

## Contexto

La tarea 15 incluía la foto de perfil. Al plantearla apareció que el problema real
no es esa foto, sino la pantalla de evolución del boceto: **el cliente sube fotos
de su cuerpo cada mes**.

Son dos cosas de escala y naturaleza distintas.

|         | Foto de perfil  | Fotos de evolución               | Vídeos de ejercicios  |
| ------- | --------------- | -------------------------------- | --------------------- |
| Cuántas | Una por usuario | Muchas por cliente, durante años | ~100                  |
| Tamaño  | Cientos de KB   | Varios MB cada una               | Decenas de MB         |
| Qué son | Dato personal   | **Dato de salud**                | Contenido del negocio |

Una estimación conservadora de las de evolución: treinta clientes, una al mes,
tres años. Más de mil fotos y varios gigas.

Pero lo que decide el diseño no es el tamaño. **Una foto del cuerpo de una
persona es categoría especial bajo el RGPD**, el mismo escalón que su peso y sus
pliegues cutáneos.

## Decisión

**1. Almacenamiento de objetos, no el disco del servidor.**

Con este volumen el disco deja de ser viable, y en la mayoría de formas de
desplegar cada actualización arranca una máquina limpia y se lleva los ficheros.
Un volumen persistente lo evitaría, pero ata el despliegue a una forma concreta
de hacerlo por una razón que no lo merece.

**2. Ninguna dirección pública. Enlaces firmados que caducan.**

Esta es la parte que se hace mal a menudo. La vía fácil es dejar el fichero en una
dirección que funcione sin autenticación y meter esa dirección en la app.

El problema es que las direcciones se escapan. Acaban en el historial del
navegador, en los registros del servidor, en la caché del dispositivo, en una
captura de pantalla que alguien comparte. Cualquiera con ese enlace vería el
cuerpo de una clienta sin haber iniciado sesión nunca.

El servidor genera una dirección firmada con caducidad corta, y **solo después de
comprobar el permiso**. Ese permiso ya está escrito: es el mismo
`AlcanceClienteService` de la tarea 10, el que impide que el nutricionista vea
clientes que no lleva asignados.

**3. Proveedor con los datos en la Unión Europea, y protocolo compatible con S3.**

El negocio está en Barcelona y esto son datos de salud. Con los servidores en la
UE, el capítulo de protección de datos se resuelve en un párrafo. Fuera, se
convierte en transferencias internacionales que hay que justificar por escrito.

Hablar el protocolo de S3, que es el estándar de hecho, permite cambiar de
proveedor tocando configuración en lugar de reescribiendo código.

**Proveedor concreto: sin decidir.** Es una decisión de coste y de con quién
quiere trabajar David, no técnica.

## Dos detalles que ahorran dinero

**El móvil sube directamente al almacenamiento**, con un permiso temporal que le
da la API, en lugar de mandar los megas a través del servidor. Es el patrón
habitual y evita pagar el ancho de banda de cada foto dos veces.

**La app encoge la imagen antes de subirla.** Un móvil moderno saca fotos de
cuatro o cinco megas y para ver una evolución corporal no hace falta ni la cuarta
parte. Es la diferencia entre unos euros al año y unos cuantos al mes.

## Consecuencia inmediata

**La foto de perfil sale de la tarea 15** y entra con el módulo
`seguimiento-corporal`, junto a las de evolución. Montar el almacenamiento dos
veces, primero provisional y luego bien, es trabajo tirado.

La tarea 15 queda cerrada con los datos de texto, que no dependen de nada de esto.

## Coste

Para unos pocos gigas, entre céntimos y un par de euros al mes. Poco, pero es otro
gasto recurrente que se suma al servidor, y eso sigue sin decidirse quién lo paga.
Ver [PENDIENTE-PARA-PRODUCCION.md](../PENDIENTE-PARA-PRODUCCION.md), punto 5.

## Implementación (2026-09-24)

El flujo del servidor está implementado. Quedan la elección y el ensayo del
proveedor, y las comprobaciones físicas y de interfaz indicadas en `tasks/todo.md`:

- **Contrato `AlmacenObjetos`** (`apps/api/src/medios/almacen-objetos.ts`), con dos
  implementaciones que se eligen con `ALMACEN`:
  - `AlmacenS3` sirve para AWS o cualquier compatible con S3 en la UE, con URLs
    prefirmadas v4. Sin sumas de comprobación automáticas, que firmarían un
    cuerpo vacío.
  - `AlmacenLocal` usa el disco del servidor, con enlaces HMAC a la propia API.
    Es solo para desarrollo.
  - Con `NODE_ENV=production` la API no arranca sin elegir uno. Ver
    [DESPLIEGUE.md](../DESPLIEGUE.md).
- **Flujo:** la app pide una intención (`POST /medios/subidas`) y sube directo
  con un enlace de 15 minutos que firma el tipo y el tamaño. Después confirma, y
  la API relee el objeto, comprueba el formato por su firma de bytes y quita los
  metadatos (ubicación, cámara) por lista blanca. Guarda el resultado en una
  clave privada nueva, que ninguna URL de subida autoriza a escribir, y cambia
  la referencia de la base al confirmarlo. Los intentos simultáneos conservan
  la referencia ganadora. La lectura es otro enlace, de 5 minutos, sin caché
  (`private, no-store`).
- **Intentos recuperables:** cada copia tiene UUID propio y se registra antes
  del PUT en `intentos_foto` (migración `20260924210000_intentos_foto`). La
  publicación bloquea ese registro activo y lo elimina en la misma transacción
  que guarda la referencia ganadora. Descartar confirma primero el cambio en la
  base y después borra del almacén; una fila ausente nunca permite borrar.
  Ninguna transacción mantiene un bloqueo durante operaciones del almacén.
  Así, un PUT o DELETE tardío solo afecta a su propia copia.
- **Limpieza de copias:** los intentos activos caducan tras una hora. Los fallos
  de borrado quedan para el siguiente pase; las claves descartadas se conservan
  y se repasan diariamente, incluso si se eliminó la intención original. Esto
  permite retirar un objeto que termine de escribirse después de un error o
  una caída del proceso. Son metadatos de limpieza, sin imágenes ni enlaces;
  no se debe vaciar esa tabla como parte de un rollback rutinario.
- **Nada público ni persistido:** la base guarda la clave del objeto, nunca una
  URL. El visor no guarda enlaces ni fotos para uso sin conexión. En Android
  descarga la foto a memoria y la pinta como `data:`, evitando la caché de disco
  de Fresco. La selección/preparación nativa sí genera archivos de caché: su
  borrado explícito al terminar/cancelar sigue pendiente en F03a; no equivale
  a afirmar que no queda ningún archivo en el dispositivo.
- **Quién ve qué:** el entrenador ve todas las fotos de sus clientes. El cliente
  ve las suyas y las del entrenador ya publicadas. El nutricionista no ve
  ninguna.
- **Retirada y limpieza:** una foto retirada pasa a `eliminando` sin acceso y
  después se borra el objeto; si el almacén falla, se puede repetir. Las
  intenciones que nadie confirma se descartan una hora después de caducar
  (`MEDIOS_LIMPIEZA_MINUTOS`). Una foto aún sin confirmar no se puede retirar:
  la descarta la limpieza. Al confirmar se elimina el temporal. Como el enlace
  de subida aún puede recrearlo, la limpieza vuelve a eliminarlo después de
  caducar, también si la foto ya se retiró. Si falla, repite ese intervalo; al
  reiniciar revisa el histórico una vez. Nunca borra la clave de una foto
  confirmada antigua que todavía use la ruta original.
- **Consentimiento pendiente:** confirmar identifica al cliente por el medio,
  comprueba su consentimiento antes de leer el archivo y de nuevo dentro de la
  transacción que lo hace disponible. La retirada y la confirmación se coordinan
  mediante el bloqueo de la fila de consentimiento.
- **La app reduce la imagen** antes de subirla y el servidor rechaza más de 8 MB.

**Transición de versiones:** los objetos ya confirmados se conservan donde
estaban. Los enlaces emitidos por una versión anterior mantienen su autorización
hasta caducar; antes de abrir un despliegue que tuviera enlaces antiguos de
subida se debe dejar transcurrir su validez (15 minutos). La prueba con el
proveedor real sigue pendiente.
