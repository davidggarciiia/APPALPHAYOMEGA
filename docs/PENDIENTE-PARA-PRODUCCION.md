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

### 1b. El enlace de activación es secuestrable hasta que el dominio esté verificado

**Estado: pendiente, y depende del punto 1.** Lo encontró la revisión adversarial
del andamiaje y es el hallazgo de seguridad más serio que queda abierto.

Hoy el correo de activación apunta a `alphaomega://activar?token=...`. Un esquema
propio no está reservado a nadie: **cualquier otra app instalada en el teléfono
puede declarar que también responde a `alphaomega://`**. Si lo hace, al pulsar el
enlace es esa app la que recibe el token, y con él fija la contraseña y entra
como esa persona. Sin necesitar ninguna otra credencial.

Importa mucho aquí porque quien recibe esos enlaces son clientes con su historial
de peso, medidas, pliegues y fotos corporales, y también el nutricionista externo.

Qué hay que hacer, y todo depende de tener el dominio:

1. Alojar el enlace en `https://alphayomegatraining.com/activar?token=...`.
2. Publicar `assetlinks.json` en el dominio para Android y
   `apple-app-site-association` para iOS.
3. Declarar `android.intentFilters` con `autoVerify` y `ios.associatedDomains` en
   `app.json`.
4. Apuntar `ACTIVACION_URL_BASE` a ese dominio.

Con eso el sistema operativo comprueba contra el dominio que la app tiene derecho
a abrir esos enlaces, y ninguna otra puede reclamarlos.

Mientras tanto, el enlace funciona para probar y **no debe usarse con clientes
reales**. Que hoy no se pueda enviar correo fuera de tu dirección lo hace
inofensivo por accidente, no por diseño.

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

**Estado (2026-09-24): implementado con un borrador; falta la revisión legal.**
Peso, medidas, pliegues cutáneos y fotos corporales son categoría especial bajo
el RGPD, el escalón más alto. Sin consentimiento explícito registrado no se
puede guardar el primer dato de una persona real.

Lo que ya hace la app:

- El cliente ve el texto al entrar y tiene que marcar la casilla; no viene nada
  marcado. Puede no aceptar y cerrar sesión.
- Se guarda quién aceptó, qué versión y cuándo (`consentimientos_salud`).
- Lo puede retirar desde Perfil, con confirmación (RGPD, art. 7.3). La app
  vuelve a pedírselo. Lo guardado antes no se borra.
- La API rechaza con 409 `consentimiento_pendiente` las escrituras de datos de
  salud de un cliente sin consentimiento vigente, las haga él o su equipo.
- El entrenador ve en la ficha si falta, con la fecha en que se dio o se retiró.

Lo que falta: **que alguien con título revise el texto**. Está en
`packages/shared/src/consentimiento.ts`, marcado como versión
`2026-09-24-borrador`. Si la revisión cambia el texto, hay que subir
`VERSION_CONSENTIMIENTO` y cada cliente lo vuelve a aceptar. También tiene que
confirmar si hace falta un aviso de privacidad aparte (responsable, base
jurídica, plazos y derecho a reclamar ante la AEPD). Ese aviso no está
redactado.

### 5. Dónde vive el servidor y quién lo paga

**Decidido el 2026-09-17: lo asume el entrenador.** El servidor, la base de datos
y el almacenamiento de las fotos corren de su cuenta como gasto del negocio, no
van dentro del precio cerrado del desarrollo.

Queda una consecuencia práctica que conviene no olvidar: **las cuentas se abren a
su nombre desde el primer día**. Mover un servidor y una base de datos con datos
de salud dentro de un año, porque la cuenta estaba a nombre de otro, es trabajo
tirado y un riesgo innecesario.

Sigue sin decidir el proveedor. Cuando toque, la restricción que manda es que los
datos estén en la Unión Europea, por el [ADR 0005](adr/0005-almacenamiento-de-fotos.md).

Lo que ya está listo (2026-09-24): el código de las fotos privadas funciona con
cualquier almacenamiento compatible con S3 y región en la UE. Basta con
configurar las variables `ALMACEN=s3` y `S3_*` de
[DESPLIEGUE.md](DESPLIEGUE.md), sin tocar código. Mientras no haya proveedor, el
almacén local sirve para desarrollar, pero no para producción: guarda las
fotos en el disco del servidor.

## Bloqueantes blandos

No impiden publicar, pero conviene resolverlos antes o poco después.

### 6. Licencia de las figuras animadas

**Resuelto el 2026-09-24 con material gratuito.** Vital (paquete Free50) permite
alojar y transcodificar sus animaciones en una app. La muestra de MoveKit solo
se sirve por streaming. Detalle y citas en
[animaciones-ejercicios.md](animaciones-ejercicios.md). Los originales **no**
entran en el repositorio. En cada servidor se importan con
`importar-medios.js`, y el catálogo inicial de 52 ejercicios se crea con
`preparar-catalogo.js` (ver [DESPLIEGUE.md](DESPLIEGUE.md)).

Queda una tarea práctica: guardar una copia de los paquetes descargados y de
sus licencias en un sitio del entrenador. Si el proveedor los retira, no se
pueden volver a bajar.

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

**Hecho para la baja el 2026-09-16 (tarea 17).** Dar de baja revoca ahora todas
las sesiones vivas y quema los enlaces de activación pendientes, las tres cosas
en la misma transacción. Reactivar ya no resucita nada.

La otra mitad también está hecha. Hoy la contraseña solo se cambia con la
recuperación por correo, y restablecerla revoca todas las sesiones en la misma
transacción (`recuperacion.service.ts`). Si algún día se añade «cambiar
contraseña» dentro de la app, tiene que hacer lo mismo.

### 9c. El token de acceso no se renovaba solo mientras la app estaba abierta

**Hecho.** `apps/mobile/src/lib/peticion-autenticada.ts` renueva el token al
recibir un 401. Varias peticiones a la vez comparten una sola renovación.
Repite sola la petición si es una lectura o una escritura con `operacionId`
(no puede duplicarse). Cualquier otra escritura pide al usuario que la
confirme de nuevo. Solo se vuelve a entrar si también ha caducado
el token de refresco.

### 9d. El nutricionista seguía viendo a un cliente dado de baja

**Hecho.** `AlcanceClienteService.tieneAsignado` exige ahora que el cliente no
esté desactivado. La fila de asignación se conserva como rastro de quién tuvo
acceso, pero ya no da acceso.

### 9e. No hay registro de auditoría de las acciones del entrenador

Las bajas y reactivaciones dejan una línea en el log del servidor con quién,
a quién y cuándo, y nada más. Cuando llegue el borrado a petición (tarea 21)
habrá que poder demostrar qué se hizo y cuándo, y eso pide una tabla.

### 9b. La app móvil no tenía tests

**Hecho.** La app tiene su suite con React Native Testing Library
(`npm test --workspace apps/mobile`). Lo que sigue sin cubrir es lo físico:
cámara, galería, permisos y rendimiento en un teléfono real. Eso se comprueba a
mano antes de publicar (`tasks/todo.md`, Q03).

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
