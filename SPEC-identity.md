# Spec: `identity`

> Módulo 1 de 8. Sin dependencias. Fundamentos técnicos en [SPEC.md](SPEC.md).
> Mapa: [CAPABILITY-MAP.md](CAPABILITY-MAP.md)

## Objetivo

Quién entra en la app, cómo se demuestra que es quien dice, y qué puede tocar
según su papel.

Este módulo no tiene pantallas llamativas y es el que más daño hace si sale mal.
Hay un profesional externo, el nutricionista, dentro de la misma app que los
datos de salud de personas que no son sus clientes. El permiso aquí no es una
comodidad, es la frontera entre un producto y un incidente de protección de datos.

## Alcance

**Dentro**

- Login, cierre de sesión y renovación de sesión
- Entrar con Google, vinculado siempre a una cuenta que ya existe
- Alta directa de cuentas por el entrenador, y su activación posterior
- Recuperación de contraseña
- Perfil propio
- Listado, alta, edición y desactivación de clientes
- Asignación de clientes al nutricionista
- La matriz de permisos que los otros siete módulos consumen
- Consentimiento explícito de datos de salud y borrado a petición

**Fuera**

- Entrar con Apple. Fuera por ahora, pero ver el riesgo de publicación al final
  de este documento: no es un extra, es un bloqueante de iOS
- Registro público. No existe y no va a existir
- Varios entrenadores o varios negocios
- Verificación en dos pasos

## Los cuatro roles

| Capacidad                           |   Cliente   | Entrenador | Nutricionista  | Empleado |
| ----------------------------------- | :---------: | :--------: | :------------: | :------: |
| Iniciar sesión                      |     sí      |     sí     |       sí       |    sí    |
| Ver y editar su perfil              |     sí      |     sí     |       sí       |    sí    |
| Ver sus propios datos               |     sí      |     —      |       —        |    —     |
| Ver datos de otro cliente           |     no      | sí, todos  | solo asignados |    no    |
| Ver peso y composición corporal     | los propios | sí, todos  | solo asignados |    no    |
| Crear, editar y desactivar clientes |     no      |     sí     |       no       |    no    |
| Asignar clientes al nutricionista   |     no      |     sí     |       no       |    no    |
| Editar dietas                       |     no      |     sí     | solo asignados |    no    |
| Registrar su fichaje                |     no      |     no     |       no       |    sí    |
| Ver fichajes ajenos                 |     no      |     sí     |       no       |    no    |
| Ver leads                           |     no      |     sí     |       no       |    no    |

Las filas que mandan son la cuarta y la quinta. Todo lo demás se deriva de ellas.

## Requisitos

1. **No existe alta pública.** Nadie se da de alta solo. Toda cuenta nace de una
   acción del entrenador, por una de las dos vías siguientes. Es la decisión que
   más superficie de ataque elimina.
2. **Existir y poder entrar son dos cosas distintas.** Un perfil en estado
   _pendiente_ existe, tiene nombre y rol, y ya puede recibir entrenos y dietas
   asignados. No tiene contraseña y no puede iniciar sesión. Pasa a _activo_
   cuando su titular entra por primera vez. Esta separación es lo que permite al
   entrenador dar de alta a alguien que tiene delante sin esperar a que abra su
   correo, y lo que permitirá migrar más adelante la cartera de clientes que ya
   existe fuera de la app.
3. **Alta directa.** El entrenador crea el perfil con nombre, correo y rol. Nace
   pendiente. Puede empezar a planificarle entrenos ese mismo día.
4. **Activación.** Un perfil pendiente se activa por enlace enviado al correo, con
   token de un solo uso que caduca a los siete días. Al activarse, el titular fija
   contraseña o vincula su cuenta de Google.
5. **Login con correo y contraseña.** La contraseña se almacena con Argon2id y
   nunca sale del servidor en ninguna respuesta.
6. **Limitación de intentos.** Tras varios fallos seguidos desde la misma
   dirección, el login responde con espera creciente.
7. **Entrar con Google**, junto a la contraseña. Nunca crea cuentas. Solo vincula
   una identidad externa a una cuenta que ya existe. Quien entra con Google sin
   perfil activado recibe la misma denegación genérica que un correo inexistente.
8. **La vinculación ocurre al activar, no en el primer login.** Al abrir el enlace
   de activación el usuario elige contraseña o Google. En ese instante el servidor
   sabe a qué perfil corresponde y guarda el identificador del proveedor. Vincular
   por correo en el primer login sería más simple y falla en el caso corriente: el
   entrenador apunta un correo y el cliente entra con otra cuenta de Google. Además
   deja el diseño preparado para Apple, que devuelve un correo de reenvío aleatorio
   cuando el usuario oculta el suyo.
9. **Una cuenta admite varios métodos.** El mismo usuario puede tener contraseña y
   Google. Se identifica por su cuenta, no por cómo entró.
10. **Recuperación de contraseña** por correo, con token de un solo uso que caduca
    en una hora.
11. **Sesión.** Token de acceso de vida corta y token de refresco de vida larga. El
    de refresco vive en el almacén seguro del dispositivo, nunca en almacenamiento
    normal.
12. **Cierre de sesión** revoca el token de refresco en el servidor. No basta con
    borrarlo del móvil.
13. **Perfil propio** editable: nombre, apellidos, teléfono, fecha de nacimiento y
    foto.
14. **Gestión de clientes.** El entrenador da de alta, edita y desactiva. Nunca
    borra, porque el histórico de entrenos tiene que sobrevivir a la baja.
15. **Asignación al nutricionista.** Sin asignación explícita, el nutricionista no
    ve absolutamente nada de ese cliente.
16. **El empleado solo llega a fichar.** Cualquier otra ruta le responde denegado.
17. **Consentimiento de datos de salud.** En el primer acceso del cliente se pide
    consentimiento explícito. Se guarda la fecha, la hora y la versión del texto
    aceptado. Sin consentimiento registrado, el servidor rechaza guardar peso,
    medidas, pliegues o fotos.
18. **Borrado a petición.** Anonimiza los datos personales y elimina los de salud.
19. **Denegar por defecto.** Un endpoint sin regla de permiso declarada deniega. No
    se permite que olvidar un decorador abra una puerta.

## Modelo de datos

Esquema de partida. Los nombres definitivos se fijan en la fase de plan.

| Entidad                   | Campos clave                                                     |
| ------------------------- | ---------------------------------------------------------------- |
| `Usuario`                 | id, email, passwordHash (opcional), rol, estado, creadoEn        |
| `PerfilCliente`           | usuarioId, nombre, apellidos, telefono, fechaNacimiento, fotoUrl |
| `AsignacionNutricionista` | nutricionistaId, clienteId, desde                                |
| `Consentimiento`          | usuarioId, version, aceptadoEn                                   |
| `TokenRefresco`           | id, usuarioId, hash, expiraEn, revocadoEn                        |
| `Invitacion`              | id, email, rol, tokenHash, expiraEn, usadoEn                     |
| `IdentidadExterna`        | usuarioId, proveedor, subjectId, creadoEn                        |

`rol` es un enumerado de cuatro valores. No es texto libre y no admite un quinto
valor sin migración, que es justo lo que queremos.

`estado` es un enumerado de tres: _pendiente_, _activo_ y _desactivado_. Un
pendiente existe pero no entra. Un desactivado no entra y conserva su histórico.
`passwordHash` es opcional precisamente porque un pendiente todavía no tiene.

## Success Criteria

Cada punto es un test que existe o el módulo no está terminado.

1. No hay ningún endpoint que cree una cuenta sin invitación válida.
2. Un cliente que pide los datos de otro cliente recibe denegación.
3. Un nutricionista sin asignación que pide un cliente recibe denegación.
4. Un nutricionista con asignación sí lo recibe.
5. El empleado recibe denegación en toda ruta que no sea la de fichaje.
6. Un token de acceso caducado se renueva con el de refresco sin que el usuario
   escriba nada.
7. Un token de refresco revocado no renueva, y devuelve al login.
8. El hash de contraseña no aparece en ninguna respuesta de la API.
9. Con el consentimiento no registrado, guardar un peso devuelve denegación.
10. Un endpoint declarado sin regla de permiso deniega a los cuatro roles.
11. Entrar con Google usando un correo sin invitación aceptada deniega y no crea
    ninguna cuenta.
12. Un usuario invitado a un correo que acepta con una cuenta de Google distinta
    queda vinculado a su invitación y entra correctamente.
13. Un usuario con contraseña y Google vinculados llega a la misma cuenta por los
    dos caminos, no a dos cuentas distintas.

El punto diez es el que protege a los otros doce. Sin él, el día que añadas un
endpoint con prisa habrás abierto un agujero sin enterarte.

## Boundaries del módulo

**Siempre**

- Un test de denegación por cada celda "no" de la matriz de roles
- El rol se lee del token verificado en el servidor, jamás de algo que mande la app

**Nunca**

- Confiar en que la app oculte un botón. Ocultar no es proteger
- Devolver un mensaje de error que distinga "ese correo no existe" de "esa
  contraseña es incorrecta". Los dos dicen lo mismo

## Decisiones tomadas

| Fecha      | Decisión                                                                                                                     |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-12 | El nutricionista ve peso y composición corporal de sus clientes asignados                                                    |
| 2026-09-12 | Entrar con Google entra en el alcance                                                                                        |
| 2026-09-12 | Entrar con Apple queda fuera por ahora. Ver el riesgo de abajo                                                               |
| 2026-09-12 | El entrenador crea perfiles directamente. Nacen en estado pendiente, sin contraseña                                          |
| 2026-09-12 | La cartera de clientes existente no se carga ahora. Se migrará más adelante, y el estado pendiente es lo que lo hará posible |

## Riesgo de publicación: la directriz 4.8 de Apple

Apple exige que una app que ofrece login de terceros ofrezca también una
alternativa equivalente que respete la privacidad, y Entrar con Apple es la forma
estándar de cumplirlo. Publicar en App Store con Google y sin Apple es un motivo
de rechazo documentado.

Hay un argumento defendible a nuestro favor: aquí Google no crea cuentas, solo
autentica cuentas creadas por invitación, así que no es el método de alta de la
cuenta principal. Es un argumento, no una garantía, y quien decide es el revisor.

Consecuencia práctica: en Android no hay problema. Antes de enviar a App Store hay
que añadir Entrar con Apple, o estar dispuesto a discutirlo durante la revisión y
asumir el retraso. No es un extra de una fase dos, es un bloqueante de iOS. El
modelo de datos ya queda preparado para admitirlo sin migración.

## Open Questions

1. **¿Cuántos clientes se esperan el primer año?** Define si el listado necesita
   paginación y búsqueda desde el principio o no.
2. **¿El empleado que ficha tiene que ver algo más?** Hoy la matriz dice que no.
   Una app que solo sirve para fichar es una app que se desinstala.
