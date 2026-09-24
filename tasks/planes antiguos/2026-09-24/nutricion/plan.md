# Plan de implementación: `nutricion`

> Tarea F07 de la [iteración 3](../iteracion-3/plan-fable.md). Parte de
> [SPEC-nutricion.md](../../SPEC-nutricion.md), aprobada por David el 2026-09-24.
> Preparado con `planning-and-task-breakdown` de Agent Skills.
> Tareas y casillas: [todo.md](todo.md). **Aprobado por David el 2026-09-24.** El código
> empieza cuando Codex publique N00 (C09).

## Resumen

El profesional (entrenador o nutricionista asignado) prepara en borrador la
dieta de un cliente y la publica. El cliente la lee en el móvil, también sin
conexión. Una dieta puede ser:

- **completa:** tipos de día, comidas con alternativas o tabla de intercambio, e
  indicaciones;
- **solo de objetivos:** kcal y macros por tipo de día, para quien no tiene dieta
  contratada.

El trabajo se construye en tramos verticales. Primero la API completa sobre el
contrato de Codex. Después, cada tramo del móvil termina con el recorrido real
funcionando: primero la dieta solo de objetivos, luego las comidas, luego el
histórico y por último el uso sin conexión.

## Decisiones de arquitectura

- **La dieta es un documento JSON validado con Zod**, como la prescripción del
  entrenamiento. Tiene una versión del formato para poder migrarla después sin
  reescribir filas. Un documento se guarda y se publica entero; no hay tablas por
  comida ni por alimento.
- **Los estados son `borrador`, `publicada` y `archivada`, en una sola tabla.**
  - Un cliente tiene como mucho un borrador y una publicada. Lo garantizan dos
    índices únicos parciales en PostgreSQL, no solo el código.
  - Publicar archiva la vigente y publica el borrador en una transacción, tras
    bloquear la fila del cliente (el mismo patrón que usa identidad).
- **La revisión va en cada escritura del borrador.** `0` significa «crear». Si la
  revisión no coincide, se responde `409 revision_obsoleta` y no se pisa nada.
- **Publicar es idempotente.** El `operacionId` se guarda en la dieta publicada
  (`@@unique([clienteId, operacionPublicacion])`):
  - repetir la operación con el mismo contenido devuelve el mismo resultado;
  - repetirla con otro contenido devuelve `409 operacion_incompatible`.
- **Los permisos se reutilizan tal cual.** `@Roles` y `AlcanceClienteGuard` sobre
  `:clienteId` en todas las rutas. El servicio comprueba además que la persona
  indicada es un cliente, y rechaza escribir si está dada de baja.
- **No hay endpoint para «editar desde la vigente».** El móvil guarda un borrador
  nuevo (revisión `0`) con una copia del documento vigente. Menos superficie y
  el mismo resultado.
- **Sin conexión se reutiliza `almacenDispositivo`** (cifrado por cuenta, de
  Codex) sin modificarlo. La copia de la dieta es de solo lectura, así que no
  cuenta como cambio pendiente al cerrar sesión.
- **«Hoy» usa `hoyAgenda()`** de `src/entrenamiento/fechas.ts`, que ya calcula el
  día en `Europe/Madrid`. Se importa, no se copia.

## Contrato y modelo propuestos a Codex (C09)

Codex decide los nombres definitivos y publica el SHA antes de N01. Esta es la
propuesta concreta.

### Rutas

| Método y ruta                                            | Roles                              | Respuesta                                              |
| -------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------ |
| `GET /nutricion/clientes/:clienteId/dieta`               | cliente, entrenador, nutricionista | `{ dieta: DietaPublicada \| null }`                    |
| `GET /nutricion/clientes/:clienteId/borrador`            | entrenador, nutricionista          | `{ borrador: BorradorDieta \| null }`                  |
| `PUT /nutricion/clientes/:clienteId/borrador`            | entrenador, nutricionista          | `BorradorDieta` (cuerpo: `{ revision, documento }`)    |
| `POST /nutricion/clientes/:clienteId/borrador/descartar` | entrenador, nutricionista          | `204` (cuerpo: `{ revision }`)                         |
| `POST /nutricion/clientes/:clienteId/borrador/publicar`  | entrenador, nutricionista          | `DietaPublicada` (cuerpo: `{ operacionId, revision }`) |
| `GET /nutricion/clientes/:clienteId/historico`           | entrenador, nutricionista          | `{ dietas: ResumenDieta[], total }`                    |
| `GET /nutricion/clientes/:clienteId/dietas/:dietaId`     | entrenador, nutricionista          | `DietaArchivada`                                       |

### Zod (`packages/shared/src/nutricion.ts`)

```ts
const Texto = (min: number, max: number) => z.string().trim().min(min).max(max)
const TextoOpcional = (max: number) => z.string().trim().max(max).nullable()
const Hora = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
  .nullable()

export const MacrosSchema = z.strictObject({
  kcal: z.number().int().min(0).max(10000).nullable(),
  proteinaG: z.number().int().min(0).max(2000).nullable(),
  hidratosG: z.number().int().min(0).max(2000).nullable(),
  grasaG: z.number().int().min(0).max(2000).nullable(),
})
const tieneAlgunNumero = (m: z.infer<typeof MacrosSchema>): boolean =>
  Object.values(m).some((valor) => valor !== null)

export const AlimentoSchema = z.strictObject({
  nombre: Texto(1, 80),
  cantidad: TextoOpcional(40),
})
export const AlternativaSchema = z.strictObject({
  id: z.uuid(),
  titulo: Texto(1, 80),
  alimentos: z.array(AlimentoSchema).min(1).max(20),
  nota: TextoOpcional(300),
  macros: MacrosSchema.nullable(),
})
const CamposComida = {
  id: z.uuid(),
  nombre: Texto(1, 40),
  hora: Hora,
  indicacion: TextoOpcional(500),
}
export const ComidaSchema = z.discriminatedUnion("forma", [
  z.strictObject({
    ...CamposComida,
    forma: z.literal("alternativas"),
    grupos: z
      .array(
        z.strictObject({
          nombre: TextoOpcional(40),
          alternativas: z.array(AlternativaSchema).min(1).max(20),
        }),
      )
      .min(1)
      .max(6)
      .refine(
        (g) => g.flatMap((x) => x.alternativas).length <= 20,
        "Como máximo 20 alternativas por comida",
      ),
  }),
  z.strictObject({
    ...CamposComida,
    forma: z.literal("intercambio"),
    columnas: z
      .array(
        z.strictObject({ nombre: Texto(1, 40), alimentos: z.array(AlimentoSchema).min(1).max(40) }),
      )
      .min(1)
      .max(6),
  }),
])
export const TipoDeDiaSchema = z
  .strictObject({
    id: z.uuid(),
    nombre: Texto(1, 40),
    objetivo: MacrosSchema.nullable(),
    comidas: z.array(ComidaSchema).max(10),
  })
  .refine(
    (t) => t.comidas.length > 0 || (t.objetivo !== null && tieneAlgunNumero(t.objetivo)),
    "Un tipo de día sin comidas necesita un objetivo con algún número",
  )
export const DocumentoDietaSchema = z
  .strictObject({
    formato: z.literal(1),
    nombre: Texto(1, 120),
    tiposDeDia: z.array(TipoDeDiaSchema).min(1).max(7),
    semana: z.array(z.uuid()).length(7), // lunes..domingo -> id de tipo de día
    indicaciones: z.array(z.strictObject({ titulo: Texto(1, 60), texto: Texto(1, 3000) })).max(10),
  })
  .refine(
    (d) => d.semana.every((id) => d.tiposDeDia.some((t) => t.id === id)),
    "La semana apunta a un tipo inexistente",
  )
  .refine(idsUnicos, "Hay identificadores repetidos") // tipos, comidas y alternativas

export const GuardarBorradorDietaSchema = z.strictObject({
  revision: RevisionSchema,
  documento: DocumentoDietaSchema,
})
export const PublicarDietaSchema = z.strictObject({
  operacionId: z.uuid(),
  revision: RevisionSchema,
})
export const DescartarBorradorDietaSchema = z.strictObject({ revision: RevisionSchema })
export const BorradorDietaSchema = z.strictObject({
  id: z.uuid(),
  clienteId: z.uuid(),
  revision: RevisionSchema,
  documento: DocumentoDietaSchema,
  actualizadoEn: z.iso.datetime(),
})
export const DietaPublicadaSchema = z.strictObject({
  id: z.uuid(),
  clienteId: z.uuid(),
  documento: DocumentoDietaSchema,
  publicadaEn: z.iso.datetime(),
})
export const ResumenDietaSchema = z.strictObject({
  id: z.uuid(),
  nombre: Texto(1, 120),
  estado: z.enum(["publicada", "archivada"]),
  publicadaEn: z.iso.datetime(),
  archivadaEn: z.iso.datetime().nullable(),
  publicadaPor: z.strictObject({ id: z.uuid(), nombre: z.string() }),
})
```

El cliente no recibe quién publicó la dieta ni el histórico. Los errores usan
`ErrorDeApiSchema` sin cambios.

### Prisma (migración aditiva)

```prisma
enum EstadoDieta {
  borrador
  publicada
  archivada
}

model Dieta {
  id                   String      @id @default(uuid())
  clienteId            String
  cliente              Usuario     @relation("DietasCliente", fields: [clienteId], references: [id], onDelete: Restrict)
  estado               EstadoDieta
  version              Int         @default(1)
  documento            Json
  revision             Int         @default(0)
  operacionPublicacion String?
  hashPublicacion      String?
  creadaPorId          String
  publicadaPorId       String?
  creadaEn             DateTime    @default(now())
  actualizadaEn        DateTime    @updatedAt
  publicadaEn          DateTime?
  archivadaEn          DateTime?
  @@unique([clienteId, operacionPublicacion])
  @@index([clienteId, estado])
  @@map("dietas")
}
```

Hacen falta además:

- **Relaciones** de autor hacia `Usuario`, con `onDelete: Restrict`.
- **Dos índices únicos parciales** en el SQL de la migración:
  - uno sobre `(clienteId)` `WHERE estado = 'borrador'`;
  - otro sobre `(clienteId)` `WHERE estado = 'publicada'`.
- **Esqueleto del módulo:** `apps/api/src/nutricion/nutricion.module.ts` vacío,
  registrado en `app.module.ts`. Los tests HTTP levantan `AppModule`, así que sin
  ese registro no puedo probar nada. A partir de ahí la carpeta es de Fable.

### Otros cambios que necesita Codex

- **N11:** en `_layout.tsx`, dejar abrir `/nutricion` en `fase: "local"` (sin
  conexión) igual que `/entrenamiento`. En `armazon.tsx`, añadir la pestaña
  «Dieta» del cliente, también sin conexión.
- **N11:** botón «Dieta» en la ficha del cliente (`app/cliente/[id].tsx`) y filas
  de «Mis clientes» (`app/mis-clientes.tsx`) que abran `/nutricion/cliente/[id]`.

## Grafo de dependencias

```text
N00 contrato + Prisma + migración + esqueleto (Codex, C09)
 │
 ├── N01 API borrador ──→ N02 API publicar y leer vigente ──→ N03 API histórico
 │                             │
 │                             ├── N04 móvil: vista del cliente (objetivos)
 │                             └── N05a modelo del editor ──→ N05b editor y publicación (objetivos)
 │                                                             │
 │                     ┌───────────────────────────────────────┘
 │                     ├── N06 alternativas (editor + vista)
 │                     ├── N07 tabla de intercambio (editor + vista)
 │                     ├── N08 indicaciones generales
 │                     └── N09 histórico, descartar y editar desde la vigente (con N03)
 │
 ├── N10 copia sin conexión del cliente (con N04 y N11)
 ├── N11 accesos y ruta sin conexión (Codex)
 └── N12 recorrido completo y evidencia (todo lo anterior)
```

**Qué puede ir en paralelo:**

- N04 y N05a, en cuanto exista N02, porque sus tests usan dobles.
- N06, N07 y N08 tocan partes distintas del editor y de la vista, pero comparten
  archivos. Por eso van en serie: N06 → N07 → N08.
- N11 (Codex) puede hacerse en cualquier momento después de N04.

## Fases y checkpoints

| Fase                        | Tareas          | Checkpoint                                                                                                   |
| --------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------ |
| 0. Base común               | N00 (Codex)     | SHA publicado; contrato con ejemplos válidos e inválidos; migración aplicada en la base de pruebas           |
| 1. API                      | N01–N03         | Tests unitarios y HTTP en verde, cobertura del servicio ≥ 80 %, build. Matriz de permisos completa           |
| 2. Tramo «solo objetivos»   | N04, N05a, N05b | **Revisión de David:** en web con la API real, un profesional publica objetivos y el cliente los ve          |
| 3. Dieta completa           | N06–N08         | Una dieta inventada con la estructura del PDF (alternativas, intercambio e indicaciones) se publica y se lee |
| 4. Histórico y sin conexión | N09–N11         | Histórico solo del profesional; modo avión con la app reabierta; cierre de sesión y cambio de cuenta         |
| 5. Cierre                   | N12             | Los 15 criterios de la spec trazados a pruebas. Web y Android/iOS registrados por separado                   |

## Riesgos y mitigaciones

| Riesgo                                                                                  | Impacto | Mitigación                                                                                            |
| --------------------------------------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------- |
| El editor en el móvil resulta pesado: la dieta de referencia tiene unas 20 alternativas | Alto    | Secciones plegables. Botones para duplicar dentro de la misma dieta (aprobado)                        |
| Dos publicaciones o guardados a la vez dejan dos borradores o dos publicadas            | Alto    | Índices únicos parciales, bloqueo de la fila del cliente y tests HTTP de carrera                      |
| Sin N11, la dieta no se abre sin conexión aunque exista la copia                        | Medio   | N11 está pedida a Codex con la ruta exacta; N10 no se da por cerrada sin ella                         |
| Datos reales de salud en un entorno sin consentimiento                                  | Medio   | Decisión de David registrada; nada del documento en logs; cifrado en el dispositivo; tests sintéticos |
| Crece el tamaño del documento                                                           | Bajo    | Límites del contrato; el cuerpo HTTP ya admite hasta 8 MB                                             |

## Decisiones de la revisión del plan (David, 2026-09-24)

1. **Duplicar dentro de la misma dieta: sí.** Se podrá duplicar un tipo de día,
   una comida y una alternativa. Entra en N06 y N07. No incluye copiar entre
   clientes, que sigue descartado.
2. **El entrenador y el nutricionista asignado** pueden preparar y publicar la
   dieta del mismo cliente. Si guardan a la vez, el conflicto de revisión evita
   que uno pise al otro.
