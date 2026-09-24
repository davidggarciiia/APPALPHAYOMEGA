# Evidencia · valoración inicial, revisiones y mejoras D01–D07

> Registro de comprobaciones de la ampliación descrita en [plan.md](plan.md) y desglosada en [todo.md](todo.md). Separa lo automático, lo visto en navegador y lo que exige un móvil físico o personas. No contiene contraseñas, tokens ni datos personales reales.

## C00 · Acceso de revisión · 24-09-2026

**Resultado: bloqueo identificado; la revisión autenticada queda pendiente de que David inicie sesión.** No se han restablecido contraseñas, cambiado roles, creado cuentas ni escrito datos en `alpha_omega`.

### Entornos en marcha

| Entorno                   | Web                     | API                     | Base                   | `/salud` |
| ------------------------- | ----------------------- | ----------------------- | ---------------------- | -------- |
| Carpeta principal         | `http://localhost:8181` | `http://localhost:3000` | `alpha_omega`          | 200      |
| Worktree Fable (temporal) | `http://localhost:8182` | `http://localhost:3101` | `alpha_omega_fable_i3` | 200      |

La API 3000 acepta el origen 8181 (y 8182/8081) mediante `CORS_ORIGENES` del proceso; el `.env` solo declara 8081.

### Causa del error de credenciales

La cuenta de prueba que se usó en el navegador (`cliente.prueba@…`) existe únicamente en `alpha_omega_fable_i3`, la base del worktree de Fable. En la carpeta principal la web 8181 habla con la API 3000 y la base `alpha_omega`, donde esa cuenta no existe: el servidor responde «Correo o contraseña incorrectos» con razón.

Cuentas de `alpha_omega` con contraseña establecida (sin mostrar claves):

- Cliente: `ana.garcia@prueba.local`, `cliente.demo@prueba.local`.
- Entrenador: `entrenador.prueba@prueba.local` (hay además una cuenta real del centro, que no se usa para pruebas).
- Nutricionista: `nut.prueba@prueba.local`.

Otras fichas de cliente no tienen clave, están pendientes de invitación o desactivadas; no sirven para entrar y no se han tocado.

### Sesión en el navegador

- 24-09-2026, `http://localhost:8181/`: la pantalla de acceso muestra «Tu sesión ha caducado. Entra otra vez.» No hay sesión de cliente ni de entrenador activa. Una redirección a login no cuenta como acceso.
- Claude no escribe contraseñas en formularios ni lee tokens del navegador. Para C01 y las comprobaciones visuales autenticadas, David debe entrar en 8181 con una de las cuentas anteriores (cliente y entrenador).

### Qué bloquea y qué no

- **Bloqueado hasta que haya sesión:** C01 (recorridos a 360/390 px), la parte visual de C02/C03 y las comprobaciones visuales de los puntos de control.
- **No bloqueado:** implementación y pruebas automáticas de C02, C03 y del resto de tareas, con pruebas de componentes y API sobre `alpha_omega_e2e_codex`.

## C01 · Revisión de pantallas actuales

**Pendiente de C00.** Sin sesión autorizada no se ha realizado la revisión autenticada a 360/390 px. Se registrará aquí con fecha, pasos y resultado cuando David entre.
