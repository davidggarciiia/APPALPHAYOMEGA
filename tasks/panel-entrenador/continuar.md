# Cómo continuar el panel del entrenador

> Traspaso del 2026-09-26, al pasar de la sesión en la nube a Claude Code en
> local. Plan: [plan.md](plan.md) · Tareas: [todo.md](todo.md).

## Dónde está todo

- **Rama `dev`** (`713033b`): reúne las ramas paralelas y las fases 0 y 1 del
  plan. Es la base de todo lo nuevo; cada fase se entrega con un PR contra `dev`.
- **Fase 0 hecha:** `dev` integrada y verde (lint, typecheck, unitarios de API y
  app, e2e contra Postgres).
- **Fase 1 hecha y fusionada** ([PR #1](https://github.com/davidggarciiia/APPALPHAYOMEGA/pull/1)):
  [diseño](../../docs/diseno/panel-entrenador.md),
  [prototipo](../../docs/diseno/prototipo-entrenador.html), ampliaciones de
  `SPEC-entrenamiento.md` y `SPEC-catalogo-ejercicios.md`, borrador de
  `SPEC-nutricion.md`, decisiones del 26-09 en la intención y este plan.
- **Otra sesión** subió a `dev` el rediseño del lado cliente con Claude Design
  (tema, fuentes, degradados y `src/componentes/diseno.tsx`). No tocar esas
  pantallas sin coordinarlo.

## Retomar en local

```bash
git fetch origin
git checkout dev && git pull
npm ci
cp .env.example .env        # si no existe; rellenar contraseñas y JWT_SECRET
npm run db:up
npx prisma migrate deploy
npm run db:seed
npm run lint && npm run typecheck && npm test && npm run test:e2e
```

Si `npm ci` deja algún paquete a medias (en la nube faltaban ficheros dentro de
`zod` y `react-hook-form` y fallaba el typecheck), borrar `node_modules` y
repetirlo.

## Pendiente de David (checkpoint A)

1. Aprobar el prototipo como base de las fases 2 y 3.
2. Preguntas abiertas de `SPEC-entrenamiento.md`: umbrales de «cuándo modificar
   la sesión», incremento por defecto (2,5/5 kg o 1/2,5 kg) y si la carga
   sugerida llega sola al cliente.
3. Preguntas de `SPEC-nutricion.md`: quién manda si hay nutricionista y dónde se
   registran los hábitos diarios.
4. Si se sustituyen por datos inventados los datos reales del cliente que trae
   el export de Claude Design (`docs/diseno/pantallas/`: nombre, peso, altura y
   grasa corporal). Seguirían en el historial de git.

## Lo primero que hay que hacer

**Tres huecos de los specs** que la revisión automática encontró justo antes de
fusionar el PR #1. Son de documentación:

1. **Prioridad del check-in** (`docs/diseno/panel-entrenador.md` y
   `SPEC-entrenamiento.md`, apartado Check-in): si coinciden una fila ámbar y
   una roja, manda la roja; orden rojo, ámbar, verde; si coinciden dos del
   mismo nivel, se muestran las dos decisiones.
2. **Compuesto o accesorio por plan** (`SPEC-entrenamiento.md`, «Bloque, fases y
   deporte» y tabla de la prescripción): añadir un campo `carga` en el ejercicio
   del plan que manda sobre el del catálogo; incluirlo en P25.
3. **Agujetas de más de 72 horas** (`SPEC-entrenamiento.md`, «Señales de
   ajuste»): definir la señal con check-ins seguidos con agujetas de 7 o más en
   la misma zona que abarquen más de 72 horas, sin un check-in intermedio por
   debajo; incluirlo en P31.

Después, la **fase 2** desde P03 (lo que falta del sistema visual), siguiendo
[todo.md](todo.md): tareas de cinco archivos como máximo, `lint`, `typecheck` y
`test` antes de cada commit, y un PR por fase contra `dev`.

## Datos que no están en el repositorio

Los tres documentos que el entrenador entrega hoy (rutina con pauta nutricional,
guía semanal y guía de ejercicios) tienen datos de salud reales y no deben
subirse: el repositorio es público. Su estructura está descrita en el
[diseño](../../docs/diseno/panel-entrenador.md), apartado 1.
