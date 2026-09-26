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

**Estado: sin redactar.** Peso, medidas, pliegues cutáneos y fotos corporales son
categoría especial bajo el RGPD, el escalón más alto. Sin consentimiento
explícito registrado no se puede guardar el primer dato de una persona real.

Claude puede escribir un borrador sólido. **Antes de publicar lo tiene que
revisar alguien con título**, porque es un documento legal y no un texto de
interfaz.

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

### 5b. Cobros en efectivo y tiendas de aplicaciones

**Estado: previsto en el diseño, por confirmar antes de publicar.** Llega con
horarios y reservas ([SPEC-planes.md](../SPEC-planes.md)). La app no cobra nada:
muestra precios, el cliente pide un producto con «Lo quiero» y el entrenador lo
activa cuando cobra en efectivo.

- Las normas de App Store no exigen la compra integrada de Apple para servicios
  físicos que se consumen fuera de la app, como una sesión presencial (3.1.3(e)), ni
  para servicios en tiempo real entre dos personas (3.1.3(d)). Google Play tiene
  una excepción equivalente. Hay que releer las normas vigentes el día de enviar
  la app a revisión.
- Los packs online no se ofrecen al cliente dentro de la app. Son seguimiento a
  distancia y un revisor podría leerlos como contenido digital, que sí exige compra
  integrada. El entrenador los activa igual desde su lado.
- La app registra importes y fechas de cobro, pero no emite facturas. Conviene que
  el gestor confirme que eso no la convierte en un sistema de facturación sujeto a
  VERI\*FACTU.

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

**Hecho para la baja el 2026-09-16 (tarea 17).** Dar de baja revoca ahora todas
las sesiones vivas y quema los enlaces de activación pendientes, las tres cosas
en la misma transacción. Reactivar ya no resucita nada.

Queda la mitad de la tarea 20: cambiar la contraseña también tiene que revocar
las sesiones abiertas, o quien te la robó sigue dentro después de que la cambies.

### 9c. El token de acceso no se renueva solo mientras la app está abierta

El token de acceso dura quince minutos y solo se renueva al arrancar la
aplicación. Una pantalla abierta más rato deja de funcionar y hoy la única salida
es volver a entrar.

Las pantallas lo dicen con honestidad desde la tarea 17 en vez de ofrecer un
"reintentar" que no arreglaría nada, pero el arreglo de verdad vive en
`sesion.tsx` y afecta a todas las pantallas. Tarea propia antes de tener clientes
de verdad usando la app a diario.

### 9d. El nutricionista sigue viendo a un cliente dado de baja

`AlcanceClienteService.tieneAsignado` mira si existe la fila de asignación, no el
estado del cliente. La fila no se borra a propósito, porque perderla borraría el
rastro de quién tuvo acceso a qué. Filtrar por estado es trabajo de la tarea 18.

Es la fuga de datos de salud más plausible del módulo: un nutricionista
subcontratado conservando acceso a alguien que ya no es cliente.

### 9e. No hay registro de auditoría de las acciones del entrenador

Las bajas y reactivaciones dejan una línea en el log del servidor con quién,
a quién y cuándo, y nada más. Cuando llegue el borrado a petición (tarea 21)
habrá que poder demostrar qué se hizo y cuándo, y eso pide una tabla.

### 9b. La app móvil no tiene ni un solo test

`SPEC.md` fija en su estrategia de pruebas que las pantallas se comprueban con
React Native Testing Library. No existe ninguna, y `apps/mobile` ni siquiera
define un comando de test.

Se nota. La revisión adversarial encontró once fallos confirmados en la app, y
tres eran críticos: dejaban la aplicación colgada para siempre o cerraban la
sesión de un cliente sin motivo. Ninguno habría sobrevivido a un test decente.

Los arreglos están hechos y razonados, pero **verificados leyendo el código, no
ejecutándolo**. Montar el entorno de pruebas de la app es trabajo pendiente y
debería ir antes de la fase 4, no después.

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
