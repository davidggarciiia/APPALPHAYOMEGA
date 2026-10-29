# E6 · Datos del cliente

Fuente: `SPEC-entrenador.md`, criterios 11–12; `tasks/diseno-movil/ESPEC-ficha.md`, sección 7. Diseño aprobado. Solo E6; sin commits ni cambios de rama.

- [x] Extraer el formulario de `app/cliente/[id].tsx` a `src/clientes/datos-del-cliente.tsx`, con la hoja, validación y confirmaciones existentes reutilizadas. Cubrir edición, fecha española, sexo, renovación de sesión, acceso y fallos con pruebas focalizadas.
- [x] Abrir la hoja desde la ficha y conservar los enlaces antiguos mediante `datos=1`; mantener la gestión de nutricionistas. Sustituir las pruebas de navegación y conservar la cobertura de edición.
- [x] Añadir sexo opcional en contrato, Prisma e identidad. Generar migración aditiva con Prisma; probar persistencia, borrado a null, ausencia de campo y rechazo de valores inválidos.
- [x] Aplicar la migración exclusivamente a `alpha_omega_e2e_codex` y `alpha_omega_manual_20261027`.
- [x] Revisar el diff y ejecutar con plazos explícitos las suites móvil/API/e2e, typecheck y lint. Informar límites del entorno y la excepción contractual del correo.

## Ficheros

- `apps/mobile/src/clientes/datos-del-cliente.tsx`: formulario único en la hoja existente, confirmaciones, acciones y guardado sin perder edición.
- `apps/mobile/src/clientes/consentimiento.ts`: texto compartido, extraído de la ficha.
- `apps/mobile/app/cliente/[id].tsx`: compatibilidad de enlaces y gestión de nutricionistas con el mismo formulario.
- `apps/mobile/app/entrenador/cliente/[id]/index.tsx`: apertura mediante `datos=1` y conservación de `correoFallido`.
- `apps/mobile/src/entrenamiento-entrenador/ficha/ficha-cliente.tsx`: acceso directo, actualización inmediata y protección frente a sondeos anteriores al guardado.
- `apps/mobile/src/clientes/datos-del-cliente.spec.tsx`, `apps/mobile/src/componentes/cliente-contacto.spec.tsx`, `apps/mobile/src/entrenamiento-entrenador/ficha-ruta.spec.tsx`, `apps/mobile/src/entrenamiento-entrenador/ficha/ficha-cliente.spec.tsx`: comportamiento y navegación.
- `packages/shared/src/index.ts`, `packages/shared/test/datos-cliente.spec.cjs`: sexo opcional y compatibilidad con fichas anteriores.
- `apps/api/src/identity/usuarios.service.ts`, `apps/api/src/identity/usuarios.service.spec.ts`, `apps/api/test/gestion-clientes.e2e-spec.ts`: persistencia, omisión, nulos y validación.
- `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/20261029220000_sexo_opcional_cliente/migration.sql`: enum y columna nullable.
- Este plan y registro de verificación.

## Cobertura de los cambios

La antigua prueba «renovar el token conserva la edición de contacto de un cliente» de `cliente-contacto.spec.tsx` pasa a «confirma descartar cambios y conserva la edición al cancelar o renovar token» de `datos-del-cliente.spec.tsx`. Su archivo original ahora prueba la redirección y la gestión de nutricionistas, además de enlaces inválidos, permisos, 404 y sesión caducada.

«Salud permite abrir la administración de datos y acceso del cliente» pasa a «abre los datos desde la ficha sin salir a otra pantalla». Se añaden apertura por parámetro, actualización inmediata y la carrera entre sondeo y guardado. Ninguna prueba se salta ni se debilitan guardas o cobertura.

Las 13 pruebas del formulario cubren guardado válido, fecha española e inválida, sexo opcional/nulo, cierre con cambios, renovación de token, baja y ambos destinos de reactivación, confirmación de correo, fallo parcial, reenvío real/fallido, bloqueo concurrente, consentimiento de solo lectura y reintento/cambio de cliente.

## Verificación final

Todos los procesos de prueba se ejecutaron con un timeout explícito mediante `spawnSync`.

| Comando                                                                   | Límite | Resultado                            |
| ------------------------------------------------------------------------- | ------ | ------------------------------------ |
| `npm test --workspace apps/mobile -- --runInBand`                         | 240 s  | 148 suites, 1.515 pruebas; 128,388 s |
| `npm test --workspace apps/api -- --runInBand`                            | 180 s  | 48 suites, 500 pruebas; 27,873 s     |
| `npm test --workspace packages/shared`                                    | 90 s   | 40 pruebas                           |
| `POSTGRES_DB=alpha_omega_e2e_codex npm run test:e2e --workspace apps/api` | 420 s  | 50 suites, 535 pruebas; 175,175 s    |
| `npm run typecheck`                                                       | 180 s  | Correcto                             |
| `npm run lint`                                                            | 180 s  | Correcto                             |

Pruebas focalizadas del móvil también ejecutadas con rutas específicas y límite de 120 s durante la implementación. `git diff --check` correcto. Revisión independiente del diff sin bloqueos pendientes.

## Base de datos y límites

Migración generada con `prisma migrate diff --script`, cliente generado con `prisma generate`, y aplicada con `prisma migrate deploy` únicamente con `POSTGRES_DB=alpha_omega_e2e_codex` y `POSTGRES_DB=alpha_omega_manual_20261027`. No se ha ejecutado ninguna migración contra `alpha_omega`.

El correo solo se edita en cuentas pendientes, como permite el endpoint existente; las activas y de baja lo muestran en solo lectura. El menú y el rediseño general de F quedan fuera del alcance E6. No hay dependencias nuevas ni commits. No se ha modificado `tasks/informe-noche-2026-10-28.md`.

Sin verificación visual a 390 px: no hay servidor local activo y el host de acceso al navegador está indisponible. El listado de dispositivos devuelve vacío; quedan pendientes dispositivo real, teclado nativo, hápticos y rendimiento real.
