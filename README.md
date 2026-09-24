# Alpha & Omega Training

App móvil para un entrenador personal de Sant Martí, Barcelona. El cliente
registra sus entrenos y lee su dieta; el entrenador lleva su cartera, y un
nutricionista subcontratado ve solo a los clientes que él le asigne.

Se publicará en App Store y Google Play.

## Estado

La segunda iteración de entrenamiento está integrada y verificada en web con
API y PostgreSQL reales. Las pantallas aplican la referencia de diseño en blanco
y negro. La comprobación física Android/iOS sigue pendiente.

| Módulo                                           | Estado                                                                  |
| ------------------------------------------------ | ----------------------------------------------------------------------- |
| identity                                         | 17 de 21 tareas; sesión offline y renovación integradas                 |
| catalogo-ejercicios                              | Catálogo textual, búsqueda, alta, edición, retirada y reposición        |
| agenda                                           | Sesiones por día completo y cambios auditados dentro de su semana       |
| entrenamiento                                    | Rutinas, planes de varias semanas, registro privado, envío y resultados |
| nutricion, seguimiento-corporal, leads, fichajes | Pendientes                                                              |

El entrenador prepara desde cero o adapta una rutina guardada, asigna varias
semanas y consulta los resultados enviados. El cliente puede mover su sesión,
escribir peso y repeticiones o segundos, marcar series y enviar al terminar.
Sus borradores son privados; las sesiones descargadas admiten edición sin red.
Las figuras animadas, vídeos y mapa muscular del catálogo quedan fuera de esta
iteración. La investigación está en [docs/animaciones-ejercicios.md](docs/animaciones-ejercicios.md).

## Cómo arrancarlo

Hace falta Node 22 o superior y Docker.

```bash
npm install
cp .env.example .env        # y rellena los valores
npm run db:up               # Postgres en Docker
npm run db:migrate          # aplica las migraciones
npm run db:seed             # crea la cuenta del entrenador
```

Después, en dos terminales:

```bash
npm run dev --workspace apps/api
npm run dev --workspace apps/mobile
```

La app se abre con Expo Go en un móvil o con `w` para verla en el navegador. En
desarrollo la dirección de la API se deduce sola del servidor de Metro, así que
no hay que escribir ninguna IP a mano.

## Pruebas

```bash
npm run typecheck
npm run lint
npm test                    # unitarios
npm run test:e2e            # de extremo a extremo, necesita la base levantada
```

La verificación de la segunda iteración registra 76 pruebas unitarias de API,
85 móviles y 261 HTTP (422 en total). Los tests de extremo a extremo hablan con una base de datos
de verdad y nunca salen a la red: el envío de correo se sustituye por un doble en
memoria.

## Cómo está organizado

```
apps/api        API en NestJS, Prisma y Postgres
apps/mobile     App en Expo y React Native
packages/shared Contratos de Zod que usan los dos lados
```

Los contratos viven en un solo sitio a propósito. El mismo esquema valida lo que
la app envía y lo que el servidor recibe, y si cambia la forma de un dato el
compilador rompe en los dos lados a la vez.

## Documentación

El proyecto se escribió antes de programarse, y esos documentos siguen vivos.

- [CAPABILITY-MAP.md](CAPABILITY-MAP.md) — los ocho módulos, las dieciséis
  pantallas y el orden de construcción
- [SPEC.md](SPEC.md) — stack, estilo, estrategia de pruebas y fronteras
- [SPEC-identity.md](SPEC-identity.md) — cuentas, sesión y permisos
- [SPEC-catalogo-ejercicios.md](SPEC-catalogo-ejercicios.md) — alcance completo del catálogo
- [SPEC-entrenamiento.md](SPEC-entrenamiento.md) y [SPEC-agenda.md](SPEC-agenda.md) — segunda iteración
- [Verificación de la iteración 2](tasks/planes%20antiguos/2026-09-24/entrenamiento/verificacion.md) — pruebas, cobertura y límites históricos
- [tasks/](tasks/) — el plan y el estado de cada tarea
- [docs/adr/](docs/adr/) — decisiones técnicas con su porqué
- [docs/PENDIENTE-PARA-PRODUCCION.md](docs/PENDIENTE-PARA-PRODUCCION.md) — lo que
  no se resuelve programando y bloquea publicar

## Secretos

No hay ninguno en el repositorio y no debe haberlo nunca. Todo lo sensible vive
en `.env`, que está ignorado por git; `.env.example` es solo la plantilla con
valores de relleno.
