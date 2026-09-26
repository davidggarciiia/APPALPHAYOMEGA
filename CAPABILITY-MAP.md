# Mapa de capacidades — App Alpha & Omega

> Aprobado por David el 2026-09-11. Producido por `spec-driven-development`, fase 0.
> Este documento es el índice del proyecto. Las especificaciones se nombran por
> el id de módulo (`SPEC-identity.md`, `SPEC-agenda.md`...). Los ids no se renombran.
>
> Intención confirmada: [docs/intent/app-alpha-omega.md](docs/intent/app-alpha-omega.md)
>
> **Cambio del 2026-09-25**, en el plan aprobado por David: se añade el módulo
> `planes` y horarios pasa por delante de entrenamiento. Intención:
> [horarios y reservas](docs/intent/horarios-y-reservas.md).
>
> **Cambio del 2026-09-26**, en el plan del panel del entrenador aprobado por
> David: la API de entrenos ya existe, así que sus pantallas del entrenador van
> antes que horarios. Se añade la pauta del entrenador a `nutricion`. Intención:
> [decisiones del 26-09](docs/intent/app-alpha-omega.md); plan:
> [tasks/panel-entrenador](tasks/panel-entrenador/plan.md).

## Módulos

| Id                     | Responsabilidad                                                                 | Depende de                                  |
| ---------------------- | ------------------------------------------------------------------------------- | ------------------------------------------- |
| `identity`             | Cuentas, sesión, los cuatro roles y qué ve cada uno                             | —                                           |
| `catalogo-ejercicios`  | Ejercicios, grupos musculares, mapa Symmetry, figuras animadas, hueco de vídeo  | `identity`                                  |
| `planes`               | Planes, bonos y sesiones sueltas, saldo de cada cliente, solicitudes y cobros   | `identity`                                  |
| `agenda`               | Horario del entrenador, reservas con hora, clases de boxeo y fechas de rutina   | `identity`, `planes`                        |
| `entrenamiento`        | Rutina prescrita, registro real de series/peso/reps/notas, panel del entrenador | `identity`, `catalogo-ejercicios`, `agenda` |
| `seguimiento-corporal` | Peso, bioimpedancia, plicómetro, medidas, fotos de evolución                    | `identity`                                  |
| `nutricion`            | Dietas por cliente, alimentos, macros, notas. Cliente en solo lectura           | `identity`                                  |
| `leads`                | Envíos del formulario de la landing y su seguimiento                            | `identity`                                  |
| `fichajes`             | Registro de jornada del empleado                                                | `identity`                                  |

## Orden de construcción

```
identity
   ├──→ planes ──→ agenda ────┐
   ├──→ catalogo-ejercicios ──┼──→ entrenamiento
   ├──→ nutricion             │
   ├──→ seguimiento-corporal  │
   ├──→ leads                 │
   └──→ fichajes              │
```

Secuencia desde el 2026-09-26: `identity` → `catalogo-ejercicios` + `entrenamiento`
(panel del entrenador; las fechas de `agenda` ya están) → `planes` + `agenda`
(horarios y reservas) → `nutricion` + `seguimiento-corporal` → `leads` → `fichajes`

## Decisiones de frontera

- **Los horarios viven en `agenda`, no en un módulo de gestión.** La pantalla de
  inicio del cliente ya muestra "Viernes 16, boxeo, 10:00", así que `agenda` es
  necesaria desde el primer día. El panel de horarios del entrenador es su cara
  de admin y sale casi gratis.
- **El panel del entrenador vive en `entrenamiento`.** Lee los mismos registros
  que escribe el cliente. Separarlo crearía dos modelos del mismo dato.
- **`fichajes` no depende de nada salvo el login.** Se puede cortar entero sin
  tocar el resto. Por eso es el último.
- **El saldo y el dinero viven en `planes`, no en `agenda`.** Tienen reglas propias
  (libro de movimientos, caducidades, cobros), hay packs que no tocan la agenda y
  `nutricion` podrá leer el plan sin depender de ella. `planes` nunca importa
  `agenda`.

## Pantallas por módulo

| Pantalla                           | Módulo                                              |
| ---------------------------------- | --------------------------------------------------- |
| Login / recuperación de contraseña | `identity`                                          |
| Perfil propio                      | `identity`                                          |
| Listado de clientes (entrenador)   | `identity`                                          |
| Alta y edición de cliente          | `identity`                                          |
| Inicio cliente (reservar)          | `agenda` + `planes`; después `seguimiento-corporal` |
| Entrenos — semana                  | `entrenamiento`                                     |
| Entrenos — mes                     | `agenda` + `entrenamiento`                          |
| Detalle de ejercicio               | `catalogo-ejercicios` + `entrenamiento`             |
| Librería Symmetry                  | `catalogo-ejercicios`                               |
| Panel admin de entrenos (Hoy)      | `entrenamiento`                                     |
| Ficha de entrenos del cliente      | `entrenamiento` + `nutricion`                       |
| Constructor de planes y asignar    | `entrenamiento` + `catalogo-ejercicios`             |
| Rutinas guardadas                  | `entrenamiento`                                     |
| Guía y reglas                      | `entrenamiento`                                     |
| Check-in, molestia y cierre        | `entrenamiento`                                     |
| Nutrición cliente (solo lectura)   | `nutricion`                                         |
| Nutrición del nutricionista        | `nutricion`                                         |
| Seguimiento corporal               | `seguimiento-corporal`                              |
| Horarios (admin)                   | `agenda`                                            |
| Agenda del entrenador              | `agenda`                                            |
| Pasar lista de boxeo               | `agenda` + `planes`                                 |
| Planes y bonos (cliente)           | `planes`                                            |
| Solicitudes y cobros (admin)       | `planes`                                            |
| Ajustes de agenda y precios        | `agenda` + `planes`                                 |
| Leads                              | `leads`                                             |
| Fichajes                           | `fichajes`                                          |

Veintisiete pantallas, no las ocho del boceto. Las cuatro primeras no estaban
dibujadas por nadie y no son opcionales. Las cinco que siguen a «Horarios» llegan
con la ampliación del 2026-09-25, y las seis del panel del entrenador, con la del
2026-09-26 ([diseño](docs/diseno/panel-entrenador.md)).

## Estado

| Módulo                | Spec                                         | Plan                                 | Implementación                                                   |
| --------------------- | -------------------------------------------- | ------------------------------------ | ---------------------------------------------------------------- |
| `identity`            | aprobada                                     | aprobado                             | 17 de 21 tareas. Fases 0, 1, 2 y 4 completas                     |
| `planes`              | redactada, en revisión                       | aprobado el 2026-09-25               | Sin empezar; va después del panel del entrenador                 |
| `agenda`              | aprobada; ampliación de horarios en revisión | aprobado el 2026-09-25               | Fechas de sesiones hechas en `dev`; horarios, después del panel  |
| `catalogo-ejercicios` | borrador; ampliación del 26-09 en revisión   | parcial, en el plan de entrenamiento | API hecha en `dev`; falta la pantalla                            |
| `entrenamiento`       | aprobada; ampliación del 26-09 en revisión   | panel del entrenador, 26-09          | API y lado cliente en `dev`; faltan las pantallas del entrenador |
| `nutricion`           | borrador de la pauta del entrenador          | panel del entrenador, 26-09          | Sin empezar                                                      |
| resto                 | —                                            | —                                    | —                                                                |

### Detalle de `identity`

| Fase            | Tareas  | Estado                                                         |
| --------------- | ------- | -------------------------------------------------------------- |
| 0. Andamiaje    | 1 a 4   | Hecha. Falta abrir la app en un móvil real                     |
| 1. Sesión       | 5 a 8   | Hecha                                                          |
| 2. Permisos     | 9 y 10  | Hecha. Checkpoint 2 superado tras arreglar 8 hallazgos         |
| 3. Invitaciones | 11 a 14 | 11 y 12 hechas. 13 y 14 aplazadas: falta el proyecto de Google |
| 4. Gestión      | 15 a 18 | Hecha                                                          |
| 5. Cumplimiento | 19 a 21 | 20 hecha. La 19 y la 21, aplazadas por David el 17-09          |
