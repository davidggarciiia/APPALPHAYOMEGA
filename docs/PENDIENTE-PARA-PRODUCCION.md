# Pendiente antes de publicar

> Cosas que no se resuelven programando. Se han ido acumulando durante el
> desarrollo y ninguna bloquea seguir construyendo, pero **todas bloquean
> publicar**. Se actualiza cada vez que aparece una nueva.

## Bloqueantes duros

Sin esto la app no se puede publicar o no funciona para clientes reales.

### 1. Verificar el dominio en Resend

**Estado: pendiente.** Hoy el proyecto funciona en modo de pruebas, que solo
permite enviar desde el dominio de Resend y **solo a la dirección con la que
David se registró**. Sirve para desarrollar y para los tests.

En cuanto haya que invitar a un cliente de verdad, esto deja de valer: su correo
de activación no le llegará.

Qué hay que hacer: en el panel de Resend, añadir el dominio
`alphayomegatraining.com` y copiar los registros DNS que te dé en el proveedor
donde esté el dominio. Son registros de tipo TXT y CNAME que demuestran que
Resend tiene permiso para enviar en tu nombre. La propagación tarda, así que no
lo dejes para el día que lo necesites.

Cuando esté, cambiar en el `.env` del servidor:

```
CORREO_REMITENTE=Alpha & Omega Training <no-responder@alphayomegatraining.com>
```

No hay que tocar código.

### 2. Cuentas de desarrollador de Apple y Google Play

**Estado: sin abrir.** Apple cobra una cuota anual, Google un pago único. Ninguna
se tramita en cinco minutos y Apple puede tardar días en verificar la identidad.

**A nombre del entrenador, no tuyo.** Si las abres a tu nombre, el día que os
separéis la app se va contigo y él se queda sin poder actualizarla ni responder a
una incidencia. Es la clase de detalle que arruina una relación profesional.

### 3. Entrar con Apple

**Estado: fuera del alcance por decisión de David.** Pero la directriz 4.8 de
revisión de Apple exige que una app que ofrece login de terceros ofrezca también
una alternativa equivalente que respete la privacidad, y Entrar con Apple es la
forma estándar de cumplirla.

Publicar en App Store con Google y sin Apple es un motivo de rechazo documentado.
Hay un argumento defendible a favor, porque aquí Google no crea cuentas, solo
autentica las que ya existen. Es un argumento, no una garantía, y decide el
revisor.

En Android no hay problema. Ver [SPEC-identity.md](../SPEC-identity.md).

### 4. Texto de consentimiento de datos de salud

**Estado: sin redactar.** Peso, medidas, pliegues cutáneos y fotos corporales son
categoría especial bajo el RGPD, el escalón más alto. Sin consentimiento
explícito registrado no se puede guardar el primer dato de una persona real.

Claude puede escribir un borrador sólido. **Antes de publicar lo tiene que
revisar alguien con título**, porque es un documento legal y no un texto de
interfaz.

### 5. Dónde vive el servidor y quién lo paga

**Estado: sin decidir.** Un VPS o un Postgres gestionado cuestan algunos euros al
mes, todos los meses, durante años. En un proyecto de precio cerrado conviene
decidir quién los asume **antes** de facturar, no después.

## Bloqueantes blandos

No impiden publicar, pero conviene resolverlos antes o poco después.

### 6. Licencia de las figuras animadas

Si salen de la librería de Symmetry, no son vuestras. Hay librerías de
animaciones anatómicas que se licencian por poco dinero. Conviene saber de cuál
tiráis antes de que estén incrustadas en ocho pantallas.

### 7. Vídeos de los ejercicios

Los grabará el entrenador. Nadie los ha contado todavía. Una librería realista
ronda el centenar, y son semanas de trabajo de alguien que no cobra por ello. No
bloquean el lanzamiento porque las figuras animadas los sustituyen, pero sí
bloquean la promesa.

### 8. El limitador de intentos vive en memoria

Funciona perfectamente con un servidor. Si algún día se replica, deja de valer y
hay que moverlo a la base de datos o a Redis. Ver
[ADR 0004](adr/0004-el-token-de-acceso-se-contrasta-con-la-base.md).

### 9. Revocar sesiones al desactivar, borrar o cambiar contraseña

Tareas 17 y 20. Hoy el acceso ya se corta al comprobar el estado en cada
petición, pero las filas de tokens de refresco sobreviven hasta treinta días.
Efecto desagradable: reactivar a un usuario más tarde le resucita todas sus
sesiones viejas.

### 10. Avisos de `npm audit`

Cinco aceptados con razonamiento, ninguno silenciado. Hay que revisarlos al subir
el SDK de Expo y antes de publicar. Ver
[ADR 0003](adr/0003-avisos-de-seguridad-aceptados.md).

## Avisos que Claude debe dar

Para que ninguno de estos se quede en una conversación y se pierda:

- Al empezar la tarea 12 (alta y activación): recordar el punto 1.
- Al empezar la tarea 13 (entrar con Google): recordar los puntos 2 y 3.
- Al empezar la tarea 19 (consentimiento): recordar el punto 4.
- Al empezar la fase 5 o al hablar de desplegar: recordar el punto 5.
