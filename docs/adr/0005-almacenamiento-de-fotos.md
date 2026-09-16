# ADR 0005: Las fotos van a almacenamiento de objetos, con enlaces firmados

- **Fecha:** 2026-09-16
- **Estado:** aceptado, pendiente de elegir proveedor
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
