# Mapa de capacidades — App Alpha & Omega

> Aprobado por David el 2026-09-11. Producido por `spec-driven-development`, fase 0.
> Este documento es el índice del proyecto. Las especificaciones se nombran por
> el id de módulo (`SPEC-identity.md`, `SPEC-agenda.md`...). Los ids no se renombran.
>
> Intención confirmada: [docs/intent/app-alpha-omega.md](docs/intent/app-alpha-omega.md)

## Módulos

| Id                     | Responsabilidad                                                                 | Depende de                                  |
| ---------------------- | ------------------------------------------------------------------------------- | ------------------------------------------- |
| `identity`             | Cuentas, sesión, los cuatro roles y qué ve cada uno                             | —                                           |
| `catalogo-ejercicios`  | Ejercicios, grupos musculares, mapa Symmetry, figuras animadas, hueco de vídeo  | `identity`                                  |
| `agenda`               | Sesión programada: cliente, fecha, hora, tipo. Clases de boxeo                  | `identity`                                  |
| `entrenamiento`        | Rutina prescrita, registro real de series/peso/reps/notas, panel del entrenador | `identity`, `catalogo-ejercicios`, `agenda` |
| `seguimiento-corporal` | Peso, bioimpedancia, plicómetro, medidas, fotos de evolución                    | `identity`                                  |
| `nutricion`            | Dietas por cliente, alimentos, macros, notas. Cliente en solo lectura           | `identity`                                  |
| `leads`                | Envíos del formulario de la landing y su seguimiento                            | `identity`                                  |
| `fichajes`             | Registro de jornada del empleado                                                | `identity`                                  |

## Orden de construcción

```
identity
   ├──→ catalogo-ejercicios ──┐
   ├──→ agenda ───────────────┼──→ entrenamiento
   ├──→ nutricion             │
   ├──→ seguimiento-corporal  │
   ├──→ leads                 │
   └──→ fichajes              │
```

Secuencia: `identity` → `catalogo-ejercicios` + `agenda` → `entrenamiento` →
`nutricion` + `seguimiento-corporal` → `leads` → `fichajes`

## Decisiones de frontera

- **Los horarios viven en `agenda`, no en un módulo de gestión.** La pantalla de
  inicio del cliente ya muestra "Viernes 16, boxeo, 10:00", así que `agenda` es
  necesaria desde el primer día. El panel de horarios del entrenador es su cara
  de admin y sale casi gratis.
- **El panel del entrenador vive en `entrenamiento`.** Lee los mismos registros
  que escribe el cliente. Separarlo crearía dos modelos del mismo dato.
- **`fichajes` no depende de nada salvo el login.** Se puede cortar entero sin
  tocar el resto. Por eso es el último.

## Pantallas por módulo

| Pantalla                           | Módulo                                        |
| ---------------------------------- | --------------------------------------------- |
| Login / recuperación de contraseña | `identity`                                    |
| Perfil propio                      | `identity`                                    |
| Listado de clientes (entrenador)   | `identity`                                    |
| Alta y edición de cliente          | `identity`                                    |
| Inicio cliente                     | `agenda` + `seguimiento-corporal` (compuesta) |
| Entrenos — semana                  | `entrenamiento`                               |
| Entrenos — mes                     | `agenda` + `entrenamiento`                    |
| Detalle de ejercicio               | `catalogo-ejercicios` + `entrenamiento`       |
| Librería Symmetry                  | `catalogo-ejercicios`                         |
| Panel admin de entrenos            | `entrenamiento`                               |
| Nutrición cliente (solo lectura)   | `nutricion`                                   |
| Nutrición del nutricionista        | `nutricion`                                   |
| Seguimiento corporal               | `seguimiento-corporal`                        |
| Horarios (admin)                   | `agenda`                                      |
| Leads                              | `leads`                                       |
| Fichajes                           | `fichajes`                                    |

Dieciséis pantallas, no las ocho del boceto. Las cuatro primeras no estaban
dibujadas por nadie y no son opcionales.

## Estado

| Módulo     | Spec     | Plan     | Implementación                 |
| ---------- | -------- | -------- | ------------------------------ |
| `identity` | aprobada | aprobado | 9 de 21 tareas. Fases 0, 1 y 2 |
| resto      | —        | —        | —                              |

### Detalle de `identity`

| Fase            | Tareas  | Estado                                                       |
| --------------- | ------- | ------------------------------------------------------------ |
| 0. Andamiaje    | 1 a 4   | Hecha. Falta abrir la app en un móvil real                   |
| 1. Sesión       | 5 a 8   | Hechas la 5, 6 y 7. La 8 es la pantalla de login             |
| 2. Permisos     | 9 y 10  | Hecha                                                        |
| 3. Invitaciones | 11 a 14 | Pendiente. Necesita cuenta de Resend y proyecto Google Cloud |
| 4. Gestión      | 15 a 18 | Pendiente                                                    |
| 5. Cumplimiento | 19 a 21 | Pendiente                                                    |
