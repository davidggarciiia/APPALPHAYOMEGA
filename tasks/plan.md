# Plan de implementación: `identity`

> Módulo 1 de 8. Spec: [SPEC-identity.md](../SPEC-identity.md) ·
> Fundamentos: [SPEC.md](../SPEC.md) · Mapa: [CAPABILITY-MAP.md](../CAPABILITY-MAP.md)
>
> Tareas con criterios y verificación: [tasks/todo.md](todo.md)

## Overview

Levantar el monorepo, la base de datos y los dos esqueletos, y sobre eso construir
sesión, permisos, invitaciones y cumplimiento. Al terminar, cuatro roles entran en
la app con permisos demostrados por tests y el entrenador puede dar de alta a su
primer cliente real.

Nada de esto se ve bonito en pantalla. Es el módulo que sostiene los otros siete.

## Architecture Decisions

- **Rebanadas verticales, no capas.** Cada tarea atraviesa base de datos, API y
  app. Al terminar cualquiera de ellas hay algo que funciona de punta a punta.
  Construir "toda la base de datos" primero deja semanas sin nada demostrable.
- **Denegar por defecto desde la tarea 6, no al final.** El guard global se instala
  antes de que exista el segundo endpoint. Retrofitear permisos sobre rutas que ya
  funcionan es como se abren los agujeros.
- **La prueba de humo de Google va antes de que haga falta.** La configuración
  nativa de OAuth es la pieza con más superficie de fallo y ninguna relación con
  el resto. Se prueba aislada en la tarea 13 para que reviente pronto y barato.
- **El correo se envía con Resend** (decidido el 2026-09-12). Invitación,
  aceptación y recuperación dependen de él. Requiere verificar el dominio
  `alphayomegatraining.com` añadiendo registros DNS, cosa que puedes hacer porque
  la web pasa a ser tuya.
- **Prisma manda sobre el esquema.** Ninguna tabla se toca a mano. Toda forma del
  dato pasa por una migración versionada, para que la base de datos de tu máquina
  y la del servidor no diverjan.

## Fases y checkpoints

| Fase            | Tareas  | Qué queda funcionando al final                                         |
| --------------- | ------- | ---------------------------------------------------------------------- |
| 0. Andamiaje    | 1 a 4   | El proyecto arranca, compila y pasa un test                            |
| 1. Sesión       | 5 a 8   | El entrenador entra y su sesión sobrevive a cerrar la app              |
| 2. Permisos     | 9 a 10  | Los cuatro roles están separados y hay tests que lo demuestran         |
| 3. Invitaciones | 11 y 12 | El entrenador da de alta y el invitado activa su cuenta con contraseña |
| 4. Gestión      | 15 a 18 | El entrenador administra clientes y los asigna al nutricionista        |
| 3b. Google      | 13 y 14 | Entrar con Google. Aplazada: necesita un proyecto en Google Cloud      |
| 5. Cumplimiento | 19 a 21 | Consentimiento, recuperación de contraseña y borrado                   |

Hay un checkpoint al final de cada fase. En cada uno: los tests pasan, el proyecto
compila, el flujo de la fase funciona a mano en un móvil, y se revisa antes de
seguir. Además de los criterios de cada tarea, todo cambio cumple la
[definición de terminado](../../../.claude/references/definition-of-done.md)
del repositorio de skills.

## Risks and Mitigations

| Riesgo                                                         | Impacto          | Mitigación                                                                                                         |
| -------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------ |
| Aprender TypeScript mientras construyes el módulo más delicado | Alto             | Las tareas 1 a 4 son andamiaje muy documentado y sin lógica propia. El lenguaje se aprende ahí, no en los permisos |
| Configuración nativa de Google en Expo                         | Medio            | Tarea 13 aislada, solo demostrar que vuelve un token. Si falla, falla sola                                         |
| Verificación del dominio en Resend                             | Bajo             | Son registros DNS y propagación. Hacerlo el día que empiece la fase 3, no el mismo día que la tarea 11             |
| La directriz 4.8 de Apple                                      | Alto solo en iOS | No bloquea Android ni el desarrollo. Decidir antes de enviar a App Store                                           |
| Un guard mal puesto abre datos de salud ajenos                 | Muy alto         | Denegar por defecto en la tarea 6, y un test de denegación por cada celda "no" de la matriz en la tarea 9          |
| Alcance abierto con precio cerrado                             | Alto             | Cualquier cosa fuera del mapa de capacidades se responde con el mapa, no con código                                |

## Paralelizable

Casi nada, y es correcto que sea así. Trabajas solo y la cadena de dependencias es
real: sin esquema no hay API, sin API no hay pantalla.

Lo único que se puede adelantar en cualquier momento: la tarea 13, la prueba de
humo de Google, y las decisiones de las preguntas abiertas, que no son código.

## Open Questions

1. **Dónde se despliega y quién paga el servidor.** No bloquea nada hasta que
   quieras enseñárselo al entrenador desde fuera de tu casa.
2. **Cuántos clientes el primer año.** Decide si la tarea 16 necesita paginación
   o le basta con una lista.
3. **Quién redacta el texto de consentimiento** de la tarea 19. No es trabajo de
   programación y hace falta antes de guardar el primer peso real.

## Decisiones tomadas

| Fecha      | Decisión                                                            |
| ---------- | ------------------------------------------------------------------- |
| 2026-09-12 | Correo con Resend, verificando el dominio `alphayomegatraining.com` |
