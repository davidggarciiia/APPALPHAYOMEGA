# Pendiente antes de publicar

> Estado de preparación para publicar. Incluye configuración de proveedores,
> dispositivos, decisiones de alcance y revisión jurídica. Las comprobaciones
> de código no acreditan que la instalación real esté preparada. Los puntos
> siguientes indican qué bloquea la publicación y qué revisión es condicional.

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

En desarrollo el correo de activación apunta a `alphaomega://activar?token=...`. Un esquema
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

**Actualización del 27-10-2026:** la API exige en producción dos bases HTTPS
explícitas: `ACTIVACION_URL_BASE` para `/activar` y `RECUPERACION_URL_BASE` para
`/restablecer`. Fuera de producción conserva los esquemas propios para las pruebas.
La recuperación necesita la misma asociación de dominio que la activación; cambiar
solo el enlace de activación no la protege. Las guardas de arranque no acreditan
que AASA, assetlinks, huellas y configuración de tiendas estén verificados.

Mientras tanto, el enlace funciona para probar y **no debe usarse con clientes
reales**. Que hoy no se pueda enviar correo fuera de tu dirección lo hace
inofensivo por accidente, no por diseño.

### 2. Cuentas de desarrollador de Apple y Google Play

**Estado: sin abrir.** Apple cobra una cuota anual, Google un pago único. Ninguna
se tramita en cinco minutos y Apple puede tardar días en verificar la identidad.

**A nombre del entrenador, no tuyo.** Si las abres a tu nombre, el día que os
separéis la app se va contigo y él se queda sin poder actualizarla ni responder a
una incidencia. Es la clase de detalle que arruina una relación profesional.

### 3. Alcance del login social y revisión de App Store

**Estado comprobado el 27-10-2026:** el acceso actual usa correo y contraseña.
Entrar con Google está en [SPEC-identity.md](../SPEC-identity.md), pero aún no
está implementado en la interfaz ni en la API. Hay que cerrar ese alcance antes
de presentarlo como funcionalidad terminada.

Entrar con Apple quedó fuera del alcance por decisión de David. La
[directriz 4.8 de Apple](https://developer.apple.com/app-store/review/guidelines/#login-services)
contempla una excepción para sistemas de acceso propios. Si se añade Google,
hay que revisar de nuevo el requisito de un servicio equivalente con las
características de privacidad indicadas por Apple. Esta revisión condicional
no acredita aprobación de la tienda.

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

**Actualización del 28-10-2026:** el borrado a petición sigue **sin implementar**.
Existe una propuesta en [ADR 0006](adr/0006-borrado-a-peticion.md) (estado
«Propuesto») que necesita la decisión de David sobre el histórico de entrenos y la
respuesta a seis dudas jurídicas antes de programarse.

### 9b. La app móvil no tenía tests

**Hecho.** La app tiene su suite con React Native Testing Library
(`npm test --workspace apps/mobile`). Lo que sigue sin cubrir es lo físico:
cámara, galería, permisos y rendimiento en un teléfono real. Eso se comprueba a
mano antes de publicar (`tasks/todo.md`, Q03).

### 10. Avisos de `npm audit`

Revisados el 27-10-2026: dependencias actualizadas, Expo 57 alineado y
compatibilidad del router cubierta con pruebas. La auditoría actual no presenta
avisos conocidos; esto no sustituye la revisión del código ni las pruebas del
binario. Repetir la auditoría al actualizar dependencias y antes de publicar.
El [ADR 0003](adr/0003-avisos-de-seguridad-aceptados.md) conserva el razonamiento
histórico; el resultado actual está en la
[revisión de producción](../tasks/revision-produccion-2026-10-27.md).

### 11. Plazos, cobertura y CI (estado 28-10-2026)

**Hecho en código, sin sustituir la prueba en el alojamiento real:**

- La API abre PostgreSQL con plazos de conexión, consulta (`statement_timeout`) e
  inactividad, un tamaño de pool y un plazo propio en `/salud` y en el envío de
  correo (ver «Plazos de la base» en [DESPLIEGUE.md](DESPLIEGUE.md)). Los valores por
  defecto son holgados y **no están medidos** en el proveedor elegido; un pooler
  externo en modo transacción puede rechazar `statement_timeout` y hay que ensayarlo.
- `npm run test:cobertura` exige el 80 % agregado de servicios y guardas (SPEC.md,
  «Cómo se mide»). Hoy: 96,06 % en líneas y 86,56 % en ramas.
- Hay un flujo de CI en `.github/workflows/ci.yml` (tipos, lint, unitarias, E2E sobre
  una base desechable y cobertura). **No se ha ejecutado todavía en GitHub**: se
  sabrá en el primer push. No existe equivalente para el espejo de GitLab.
- Los E2E se niegan a correr contra una base cuyo nombre no lleve `e2e`.

**Sigue pendiente:** alertas y sondas en el proveedor, prueba de capacidad, copias
programadas cifradas con recuperación ensayada, y que la CI haya pasado al menos una
vez en el repositorio real.

## Avisos que Claude debe dar

Para que ninguno de estos se quede en una conversación y se pierda:

- Al empezar la tarea 12 (alta y activación): recordar el punto 1.
- Al empezar la tarea 13 (entrar con Google): recordar los puntos 2 y 3.
- Al empezar la tarea 19 (consentimiento): recordar el punto 4.
- Al empezar la fase 5 o al hablar de desplegar: recordar el punto 5.
