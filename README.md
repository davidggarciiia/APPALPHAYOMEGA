# Alpha & Omega Training

App móvil para un entrenador personal de Sant Martí, Barcelona. El cliente
registra sus entrenos y lee su dieta; el entrenador lleva su cartera, y un
nutricionista subcontratado ve solo a los clientes que él le asigne.

Se publicará en App Store y Google Play.

## Estado

La carpeta principal integra entrenamiento guiado, nutrición y seguimiento con
valoraciones. Las pantallas conservan el diseño vigente. La app sigue en
desarrollo: quedan correcciones de uso, partes del flujo de fotos, integración de
otra rama y comprobación física Android/iOS. El estado comprobado está en la
[revisión integral del 24-09-2026](tasks/revision-integral-2026-09-24.md).

| Módulo               | Estado                                                                        |
| -------------------- | ----------------------------------------------------------------------------- |
| identity             | 17 de 21 tareas; sesión offline y renovación integradas                       |
| catalogo-ejercicios  | Catálogo textual, búsqueda, alta, edición, retirada y reposición              |
| agenda               | Sesiones por día completo y cambios auditados dentro de su semana             |
| entrenamiento        | Rutinas, planes de varias semanas, registro privado, envío y resultados       |
| nutricion            | Dietas profesionales, platos/intercambios, comidas y suplementos              |
| seguimiento-corporal | Indicadores, valoraciones, pruebas y evolución; fotos parcialmente integradas |
| leads, fichajes      | Fuera de la entrega actual                                                    |

El entrenador prepara desde cero o adapta una rutina guardada, asigna varias
semanas y consulta los resultados enviados. El cliente puede mover su sesión,
escribir peso y repeticiones o segundos, marcar series y enviar al terminar.
Sus borradores son privados; las sesiones descargadas admiten edición sin red.
El catálogo incluye un paquete inicial de 52 ejercicios y una ampliación de
74 fichas con técnica, pasos y errores a evitar. El 30-09-2026 se comprobaron
130 ejercicios publicados en la base local `alpha_omega`, con 52 animaciones
y sus pósteres disponibles. Las 74 fichas nuevas llevan técnica textual.
Licencias y restricciones en [docs/animaciones-ejercicios.md](docs/animaciones-ejercicios.md).

## Cómo arrancarlo

Hace falta Docker, npm 10.9.4 y Node compatible con `engines` de la raíz
(22.22.3+, 24.15+ o 26+). La revisión actual está en
[revisión de producción](tasks/revision-produccion-2026-10-27.md).

```bash
npm install
cp .env.example .env        # y rellena los valores
npm run db:up               # Postgres en Docker
npm run db:migrate          # aplica las migraciones
npm run db:seed             # crea la cuenta del entrenador
```

Para cargar las fichas adicionales en la base configurada:

```bash
npm run db:catalogo:ampliar                 # simulación, sin escrituras
npm run db:catalogo:ampliar -- --confirmar   # crea únicamente las ausentes
```

La carga conserva las fichas existentes, incluidas las retiradas y las editadas,
y no añade animaciones a movimientos sin un medio correspondiente. Los recuentos
locales incluyen cuatro ejercicios previos adicionales al paquete inicial.

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
# HTTP: solo contra una base dedicada, nunca contra la base habitual.
# En PowerShell: $env:POSTGRES_DB='alpha_omega_e2e_codex'
npm run test:e2e            # necesita esa base levantada y migrada
npm run test:cobertura      # unitarias + E2E + mínimo del 80 % en servicios y guardas
```

Los E2E crean y borran filas: se niegan a arrancar si `POSTGRES_DB` no lleva `e2e`
en el nombre (por ejemplo `alpha_omega_e2e_codex`), así que un `npm run test:e2e`
sin la variable no escribe en la base habitual. La CI de GitHub
([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) repite tipos, lint, unitarias,
E2E sobre una base desechable y el mínimo de cobertura.

La última verificación completa (28-10-2026, sin commit) registra 390 pruebas
unitarias de API, 733 de la app y 512 E2E en 47 suites; la cobertura fusionada de
servicios y guardas es de 96,06 % en líneas y 86,56 % en ramas. Los tests de extremo
a extremo hablan con una base de datos de verdad y nunca salen a la red: el envío de
correo se sustituye por un doble en memoria. El seguimiento de esas mejoras está en
[tasks/todo-mejoras-2026-10-27.md](tasks/todo-mejoras-2026-10-27.md).

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
