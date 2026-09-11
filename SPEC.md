# Spec del proyecto — App Alpha & Omega

> Fundamentos comunes a todos los módulos. Cada módulo tiene su propio
> `SPEC-<id>.md` con objetivo y criterios. Este documento no se repite en ellos.
>
> Mapa: [CAPABILITY-MAP.md](CAPABILITY-MAP.md) · Intención: [docs/intent/app-alpha-omega.md](docs/intent/app-alpha-omega.md)

## Objetivo

App móvil publicada en App Store y Google Play para Alpha & Omega Training
(Sant Martí, Barcelona). El cliente registra sus entrenos y consulta su dieta.
El entrenador, el nutricionista y el empleado acceden con permisos distintos.

El éxito del producto está definido en el documento de intención: el entrenador
abre el panel y ve qué ha levantado cada cliente esta semana sin preguntárselo
a nadie.

## Tech Stack

**App móvil**

| Pieza              | Elección                    | Por qué                                                                                       |
| ------------------ | --------------------------- | --------------------------------------------------------------------------------------------- |
| Framework          | Expo (React Native)         | Una base de código, iOS y Android, y EAS sube a las dos tiendas                               |
| Lenguaje           | TypeScript en modo `strict` | Obligado por React Native. Sin `strict` el tipado no sirve de nada                            |
| Navegación         | Expo Router                 | Rutas por ficheros, menos configuración que mantener                                          |
| Estado de servidor | TanStack Query              | Caché, reintentos y refresco. Evita escribir a mano el estado de carga de dieciséis pantallas |
| Formularios        | React Hook Form + Zod       | El mismo esquema Zod valida en app y servidor                                                 |

**Servidor**

| Pieza         | Elección                                | Por qué                                                                                        |
| ------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Runtime       | Node LTS                                |                                                                                                |
| Framework     | NestJS                                  | Módulos, inyección de dependencias y decoradores. Calcado de Spring, familiar viniendo de Java |
| ORM           | Prisma                                  | Migraciones versionadas y tipos generados desde el esquema                                     |
| Base de datos | PostgreSQL                              | El dominio es relacional de arriba abajo: cliente, sesión, ejercicio, serie                    |
| Validación    | Zod                                     | Compartido con la app vía `packages/shared`                                                    |
| Contraseñas   | Argon2id                                | Resistente a ataques con hardware dedicado                                                     |
| Sesión        | JWT de acceso corto y token de refresco | Estándar en móvil. El usuario no reescribe la contraseña cada día                              |

**Versiones exactas**: se fijan y se anclan en el `package-lock.json` al instalar.
No se escriben aquí porque envejecen mal.

## Commands

```bash
npm install
npm run dev                  # app y api en paralelo
npm run test                 # todos los tests
npm run lint                 # eslint y prettier --check
npm run typecheck            # tsc --noEmit en todos los paquetes
```

```bash
npm run dev      --workspace apps/mobile
npm run test     --workspace apps/mobile
npx eas build -p android --profile preview
npx eas build -p ios     --profile preview
```

```bash
npm run dev      --workspace apps/api
npm run test     --workspace apps/api
npm run test:e2e --workspace apps/api
npx prisma migrate dev --name <nombre>
npx prisma studio
```

## Project Structure

Monorepo con workspaces de npm.

```
apps/mobile/            → App Expo
  app/                  → Rutas (Expo Router)
  src/components/       → Componentes reutilizables
  src/features/<mod>/   → Pantallas y lógica por módulo del mapa
  src/lib/              → Cliente HTTP, almacenamiento seguro, utilidades
apps/api/               → Servidor NestJS
  src/<mod>/            → Un directorio por módulo del mapa
    *.controller.ts     → Entrada HTTP. Sin lógica de negocio
    *.service.ts        → Lógica de negocio
    *.guard.ts          → Permisos
  prisma/schema.prisma  → Esquema de datos
  test/                 → Tests end-to-end de la API
packages/shared/        → Esquemas Zod y tipos usados por app y servidor
docs/                   → Intención, ADRs, decisiones
tasks/                  → Planes y listas de tareas
```

Los directorios de módulo usan los ids del mapa de capacidades, sin inventar otros.

## Code Style

Un esquema compartido, definido una vez y usado en los dos lados:

```ts
// packages/shared/src/schemas/serie.ts
import { z } from "zod"

export const SerieSchema = z.object({
  numero: z.number().int().positive(),
  pesoKg: z.number().nonnegative(),
  reps: z.number().int().positive(),
  hecha: z.boolean(),
})

export type Serie = z.infer<typeof SerieSchema>
```

Un servicio del lado del servidor:

```ts
// apps/api/src/identity/clientes.service.ts
@Injectable()
export class ClientesService {
  constructor(private readonly prisma: PrismaService) {}

  async listarAsignadosA(nutricionistaId: string): Promise<Cliente[]> {
    return this.prisma.cliente.findMany({
      where: { asignaciones: { some: { nutricionistaId } } },
    })
  }
}
```

Convenciones:

- **Tipo de retorno explícito** en toda función exportada. El compilador puede
  inferirlo, pero escribirlo documenta el contrato y evita que un cambio interno
  altere la firma pública sin que nadie se entere.
- **`any` está prohibido.** Si no conoces el tipo es `unknown` y lo estrechas.
- **`const` por defecto.** Solo usas `let` cuando reasignas de verdad.
- **Vocabulario del dominio en español** (`cliente`, `serie`, `entreno`,
  `plicometro`), sufijos técnicos en inglés (`Service`, `Controller`, `Guard`).
  El cliente habla español y el boceto está en español. Traducir el dominio solo
  añade una capa de confusión.
- `camelCase` para variables y funciones, `PascalCase` para tipos y clases,
  `kebab-case` para nombres de fichero.
- **Los controladores no llevan lógica.** Validan la entrada, llaman al servicio
  y devuelven. Toda regla de negocio vive en un servicio y se testea sin HTTP.

## Testing Strategy

Jest en los dos lados. Es lo que traen NestJS y Expo de fábrica, y una sola
herramienta se aprende una vez.

| Nivel      | Dónde                        | Qué cubre                                                    |
| ---------- | ---------------------------- | ------------------------------------------------------------ |
| Unitario   | `*.spec.ts` junto al fichero | Servicios y reglas de permisos                               |
| E2E de API | `apps/api/test/`             | Endpoints reales contra base de datos de test, con Supertest |
| Componente | `apps/mobile/**/*.spec.tsx`  | Pantallas con React Native Testing Library                   |

Cobertura mínima del 80% en servicios y guardas de permisos. Sin objetivo global,
porque perseguir un número en código repetitivo enseña a escribir tests malos.

**Regla innegociable: toda regla de permiso tiene un test que demuestra que
deniega.** No basta con probar que un rol puede hacer algo. Hay que probar que
los otros tres no pueden.

## Boundaries

**Siempre**

- Correr `npm run test` y `npm run typecheck` antes de cada commit
- Validar toda entrada del exterior con Zod en el borde, antes de tocar nada
- Tipos de retorno explícitos en lo exportado
- Un test que demuestre la denegación por cada regla de permiso

**Preguntar antes**

- Cambiar el esquema de la base de datos
- Añadir una dependencia nueva
- Tocar el modelo de permisos o los roles
- Cambiar la configuración de CI o de EAS
- Cualquier cosa que no esté en el mapa de capacidades

**Nunca**

- Subir secretos al repositorio. Van en `.env`, que está ignorado
- Guardar contraseñas en claro ni con hash reversible
- Escribir datos de salud en logs. Peso, medidas, pliegues y fotos no aparecen
  en ninguna traza, ni en desarrollo
- Borrar o marcar como omitido un test que falla sin aprobación explícita
- Publicar en tiendas sin política de privacidad enlazada

## Success Criteria del proyecto

1. Un cliente registra una serie en su móvil y el entrenador la ve en su panel
   sin recargar nada.
2. Un nutricionista autenticado que pide datos de un cliente que no tiene
   asignado recibe una denegación, y existe un test que lo demuestra.
3. La app está publicada y descargable en App Store y Google Play.
4. Los datos de salud tienen consentimiento explícito registrado y se pueden
   borrar a petición del titular.

## Open Questions

Ninguna bloquea empezar `identity`, pero todas cuestan dinero o tiempo y ninguna
se resuelve sola.

1. **Dónde vive el servidor y quién paga.** Un VPS con Docker o un Postgres
   gestionado. Es un gasto recurrente en un proyecto de precio cerrado. Conviene
   decidir quién lo asume antes de facturar.
2. **Cuentas de desarrollador.** Apple cobra cuota anual y Google un pago único.
   ¿A nombre del entrenador o tuyo? Recomendación: a nombre de él, o el día que
   os separéis la app se va contigo y él se queda sin nada.
3. **Licencia de las figuras animadas.** Si salen de Symmetry, no son vuestras.
4. **Política de privacidad y textos de consentimiento.** Alguien los redacta y
   no es el compilador.
5. **Quién diseña la UI final.** Hay boceto de ocho pantallas. Faltan ocho.
