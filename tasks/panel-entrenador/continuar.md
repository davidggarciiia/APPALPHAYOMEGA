# Cómo continuar tras la unificación

> Traspaso del 2026-09-26 (noche), sustituye al de la rama `claude/pensive-thompson-j9a7d2`
> (`84bb150`). El plan y las tareas de este directorio describen la línea `dev`
> antes de unificarla; lo que sigue vale más que ellos donde no coincidan.

## Qué pasó

`dev` (GitHub) y la rama local `codex/cliente-intuitivo` se separaron el 18-09 en
`0f07539` y cada una construyó por su cuenta entrenamiento, catálogo y agenda. La
rama **`integracion/unificada`** (worktree `APP-ALPHA_OMEGA-unificada`) las junta:

- **Manda la línea local** en el dominio: contratos, esquema, API y pantallas
  (constructor, ficha del entrenador, check-in, molestias, valoraciones, fotos,
  consentimiento, metros). Tenía mucho más hecho y probado.
- **De `dev` se conserva** lo que la local no tenía: Reanimated y la skill
  `animate-expo`, `Pulsable`, la pantalla de carga con el logo vectorizado y la
  pantalla nativa de arranque, el arreglo de la carrera de refresco, la CI, los
  documentos de diseño (`docs/diseno/`), el prototipo y la intención y el plan de
  horarios y reservas.
- **Se retira** la implementación paralela de `dev` (entreno del cliente,
  borradores/envíos/prescripciones y sus migraciones). Las enmiendas de
  `SPEC-entrenamiento.md` de la fase 1 de `dev` no se trajeron: la especificación
  vigente es la local. Los «tres huecos de los specs» del traspaso anterior eran de
  esas enmiendas y quedan con ellas.

## Qué se añadió esa noche

| Pieza                                                           | Dónde                                                                                                            | Estado                                                                                             |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Reservas, horario, saldo, productos, «Lo quiero» y cobros (API) | `apps/api/src/agenda/`, `apps/api/src/planes/`, migración `20260926120000_reservas_y_saldo`                      | Hecho, con criterios de SPEC-agenda y SPEC-planes en `test/reservas.e2e-spec.ts`. Boxeo sin hacer. |
| Pestaña Reservar (cliente) y Agenda (entrenador)                | `apps/mobile/src/reservas/`, `app/reservar.tsx`, `app/agenda/`                                                   | Hecho.                                                                                             |
| Panel «Hoy» del entrenador                                      | `GET /panel/hoy`, `apps/mobile/src/panel/`                                                                       | Hecho, con citas de hoy y negocio.                                                                 |
| Fotos de progreso y comparador «deslizar»                       | destino `progreso` en medios, `src/seguimiento/fotos-progreso.tsx`, migración `20260926130000_fotos_de_progreso` | Hecho.                                                                                             |
| Progreso del cliente reordenado                                 | `src/seguimiento/progreso.tsx`, `resumen-progreso.ts`                                                            | Hecho.                                                                                             |
| Respuesta al pulsar en toda la app                              | `Pulsable` sustituye a `Pressable`                                                                               | Hecho.                                                                                             |
| Datos de demostración                                           | `apps/api/src/demo/`, `docs/DEMO.md`                                                                             | Ver ese documento.                                                                                 |

## Verificación al cerrar la noche

- `npm run typecheck`, `npm run lint`, `npm run build --workspace apps/api`: correctos.
- `npm test`: 207 pruebas de API (26 suites) y 719 móviles (82 suites).
- HTTP contra Postgres (`alpha_omega_e2e_unif`, 28 migraciones): 508 pruebas en 47
  suites, entre ellas `reservas.e2e-spec.ts` (28), `panel-hoy.e2e-spec.ts` y
  `fotos-progreso.e2e-spec.ts`.
- Revisión independiente de reservas y saldo: siete fallos confirmados, todos
  corregidos con su prueba (`032d053`).
- Recorrido en el navegador (web, 375 px y 1440 px) con los datos de demo: login de
  cliente y entrenador; inicio con «Tu próxima cita»; Progreso con resumen, fotos y
  comparador lado a lado y deslizando; Reservar de principio a fin (hueco, hoja de
  confirmación, «¡Reservado!»); panel «Hoy»; Agenda con semana y cobros; ficha con
  saldo y reservas; Nutrición y Plan; la pantalla de carga con el logo.
- No verificado: móvil físico (iOS/Android) ni la app compilada.

## Pendiente

- **Probar en un móvil real** (Expo Go o compilación): arrastre del comparador de
  fotos dentro del scroll, pantalla de carga nativa, movimiento reducido, cámara.
- **Boxeo** (horario fijo, pasar lista, cuota semanal): contrato preparado en el
  esquema de saldo (`clase: boxeo`), sin rutas ni pantallas.
- **Decisiones de David** que siguen abiertas en `SPEC-planes.md` (subir de plan a
  mitad de mes, VERI\*FACTU) y en `docs/PENDIENTE-PARA-PRODUCCION.md`.
- **Subir a GitHub**: nada de esta rama se ha subido. El repositorio es público;
  antes de subir, revisar que no viaje nada personal (los PDF de `PDF/` están fuera
  de git) y decidir si `integracion/unificada` sustituye a `dev`.

## Arrancar en local

API y web de la unificación, con la base de demostración `alpha_omega_demo`:

```powershell
cd C:\Users\david\Desktop\APP-ALPHA_OMEGA-unificada
npx prisma migrate deploy
npm run build --workspace apps/api
cd apps/api; node dist/main.js          # API en http://localhost:3000
cd ..\mobile; npx expo start --web --port 8181   # web en http://localhost:8181
```

El `.env` de ese worktree apunta a `alpha_omega_demo` y a un almacén local de fotos
propio. La base `alpha_omega` y la carpeta principal no se han tocado. Desde la
app de escritorio de Claude, `.claude/launch.json` de la carpeta principal arranca
lo mismo como `api-demo` y `web-demo`.

Para volver a dejar la demo como recién sembrada (cuentas y qué enseña cada una en
[docs/DEMO.md](../../docs/DEMO.md)):

```powershell
cd C:\Users\david\Desktop\APP-ALPHA_OMEGA-unificada
npm run demo:seed --workspace apps/api
```
