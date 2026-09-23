# Spec: `nutricion` — dietas por cliente

> Estado: **borrador pendiente de revisión por David**. Redactada por Fable el
> 2026-09-24, tarea F06 de la [iteración 3](tasks/iteracion-3/plan-fable.md).
> Módulo del [mapa aprobado](CAPABILITY-MAP.md). Solo depende de `identity`.
> Stack, estilo y reglas comunes: [SPEC.md](SPEC.md). Permisos de partida:
> [SPEC-identity.md](SPEC-identity.md).

## Objetivo

El profesional (el entrenador o el nutricionista asignado) prepara la dieta de
un cliente y la publica. El cliente la consulta en el móvil, también sin
cobertura, y sabe qué le toca comer hoy y qué alternativas tiene.

Hoy las dietas se entregan en PDF. La app las sustituye con la misma estructura
que ya usa el profesional, sin obligarle a cambiar su forma de trabajar:

- comidas con alternativas agrupadas;
- tablas de intercambio;
- indicaciones escritas.

Referencias: el prototipo `Alpha Omega App v2.dc.html` y una dieta real en PDF
aportada por David. Ninguno de los dos se incorpora al repositorio, y los
ejemplos de este documento son inventados.

## Decisiones aprobadas por David (2026-09-24)

1. **La semana se organiza por tipos de día.** El profesional define tipos
   («Entreno», «Descanso», «Comida libre») y asigna uno a cada día de lunes a
   domingo. Cada tipo tiene sus comidas y, si el profesional quiere, un objetivo
   de kcal y macros.
2. **Una comida se expresa de una de dos formas:**
   - **Alternativas:** opciones agrupadas («Opciones dulces», «Opciones saladas»)
     entre las que el cliente elige una.
   - **Tabla de intercambio:** columnas por grupo («Hidratos de carbono»,
     «Proteína», «Grasas») con alimentos y cantidades equivalentes; el cliente
     combina uno de cada columna.
3. **Las kcal y los macros los escribe el profesional.** La app no los calcula ni
   usa una base de alimentos.
4. **Las cantidades son texto libre**: «80 g», «1 ud», «250 ml», «al gusto».
5. **Borrador y publicar.** El cliente solo ve la dieta publicada, nunca un
   borrador a medio preparar.
6. **Histórico solo para el profesional.** Al publicar una dieta nueva, la
   anterior se archiva. El cliente solo ve la vigente.
7. **Cada dieta se prepara desde cero.** No hay plantillas ni copia desde otro
   cliente.
8. **El cliente lee su dieta sin conexión.** Queda cifrada en su móvil por cuenta
   y se actualiza al volver la red.

Ya estaban aprobadas antes: el cliente solo lee y no registra lo que come; el
entrenador edita todas las dietas y el nutricionista solo las de sus clientes
asignados y activos; el empleado no accede; y un perfil pendiente ya puede
recibir dietas ([SPEC-identity.md](SPEC-identity.md), requisito 2).

### Supuestos a confirmar en la revisión

- **Números opcionales.** Las kcal y los macros no son obligatorios en ningún
  nivel. La dieta real de referencia no lleva ninguno.
- **Un solo tipo de día es válido** y significa que todos los días son iguales.
- **Hora opcional.** Cada comida puede llevar una hora orientativa, sin avisos.
- **El borrador es del cliente, no de quien lo empezó.** Cualquier profesional
  autorizado puede continuarlo. Si dos lo editan a la vez, el segundo recibe un
  conflicto y no pisa al primero.
- **Alternativas de una comida.** Pueden llevar una nota y, si el profesional
  quiere, sus kcal y macros.

## Alcance

**Incluido**

1. Crear, editar y descartar el borrador de la dieta de un cliente.
2. Publicar el borrador. Si se repite la publicación, no se duplica.
3. Consultar la dieta vigente: el cliente la suya y el profesional la de sus clientes.
4. Consultar las dietas archivadas, solo el profesional.
5. Vista del cliente con «Hoy» (el tipo de día de hoy en `Europe/Madrid`) y
   «Semana» (los siete días con su tipo).
6. Lectura sin conexión de la última dieta publicada que se descargó.
7. Secciones de texto libre para toda la dieta, como «Cómo seguir el plan» o
   «Recomendaciones».

**Fuera de esta entrega**

- Registro de comidas por el cliente.
- Base de alimentos, cálculo de macros, generador de dietas y cálculos clínicos.
- Plantillas, copiar dietas entre clientes, importar o exportar PDF y adjuntos.
- Notificaciones push al publicar.
- Revisiones periódicas, formularios y fotos: son de `seguimiento-corporal`.
- Consentimiento y borrado a petición: siguen aplazados (tareas 19 y 21 de identidad).

## Permisos por operación

| Operación                              | Cliente      | Entrenador | Nutricionista              | Empleado / sin sesión |
| -------------------------------------- | ------------ | ---------- | -------------------------- | --------------------- |
| Ver la dieta vigente                   | Solo la suya | Todas      | Asignados no dados de baja | No                    |
| Ver, crear o editar el borrador        | No           | Sí         | Asignados no dados de baja | No                    |
| Descartar el borrador                  | No           | Sí         | Asignados no dados de baja | No                    |
| Publicar                               | No           | Sí         | Asignados no dados de baja | No                    |
| Ver dietas archivadas                  | No           | Sí         | Asignados no dados de baja | No                    |
| Editar una dieta publicada o archivada | No           | No         | No                         | No                    |

- El acceso por cliente lo decide `AlcanceClienteService`, igual que en el resto
  de la app. Quitar la asignación o dar de baja al cliente corta al
  nutricionista en la petición siguiente.
- El servidor comprueba que la persona indicada es un cliente. El entrenador no
  ve «la dieta» de un nutricionista ni de un empleado.
- **Cliente dado de baja:** no se puede guardar ni publicar
  (`operacion_incompatible`). El entrenador sigue viendo su histórico.
- **Cliente pendiente:** su dieta se puede preparar y publicar.
- Para corregir una dieta publicada, se abre un borrador nuevo a partir de ella
  y se vuelve a publicar. Nunca se reescribe lo que el cliente ya vio.

## Modelo conceptual

Los nombres definitivos de tablas y rutas se fijan en el plan (F07). Contratos,
Prisma y migraciones son de Codex.

| Concepto    | Responsabilidad                                                                            |
| ----------- | ------------------------------------------------------------------------------------------ |
| Dieta       | Cliente, estado (`borrador`, `publicada`, `archivada`), revisión, autor e instantes        |
| Documento   | Contenido completo validado con Zod: tipos de día, semana, comidas e indicaciones          |
| Publicación | Operación idempotente que archiva la vigente y publica el borrador en la misma transacción |

**Qué dietas puede tener un cliente:**

- como mucho un borrador y una dieta publicada vigente, y cualquier número de
  archivadas;
- al publicar se registran quién publicó y cuándo;
- una dieta publicada o archivada no cambia nunca.

**Estructura del documento.** Ejemplo inventado:

```text
Plan de octubre
├── Tipos de día
│   ├── Entreno    (opcional: 2.300 kcal · P 160 g · H 250 g · G 70 g)
│   │   ├── Desayuno 08:00 — alternativas
│   │   │   ├── Opciones dulces: «Tostadas con fruta» [Pan integral · 60 g] [Fruta · 1 ud]
│   │   │   └── Opciones rápidas: «Batido de avena» [Avena · 40 g] [Leche · 250 ml]
│   │   └── Comida 14:00 — tabla de intercambio
│   │       ├── Hidratos de carbono: Arroz 60 g · Patata 250 g · Pasta 60 g
│   │       ├── Proteína: Pollo 150 g · Merluza 200 g
│   │       └── Grasas: Aceite de oliva 10 g
│   └── Descanso   (sus propias comidas)
├── Semana: L Entreno · M Descanso · X Entreno · J Descanso · V Entreno · S Descanso · D Descanso
└── Indicaciones: «Cómo seguir el plan», «Recomendaciones»
```

**Límites de validación:**

| Elemento                | Límite                                                                             |
| ----------------------- | ---------------------------------------------------------------------------------- |
| Nombre de la dieta      | 1–120 caracteres                                                                   |
| Tipos de día            | 1–7; nombre de 1–40                                                                |
| Semana                  | Exactamente 7 entradas, cada una apuntando a un tipo existente                     |
| Comidas por tipo        | 1–10; nombre de 1–40; hora `HH:MM` opcional; indicación de hasta 500               |
| Grupos de alternativas  | 1–6 por comida, nombre opcional de hasta 40; como mucho 20 alternativas por comida |
| Alternativa             | Título de 1–80; 1–20 alimentos; nota de hasta 300; macros opcionales               |
| Columnas de intercambio | 1–6 por comida; nombre de 1–40; 1–40 alimentos por columna                         |
| Alimento                | Nombre de 1–80; cantidad opcional de hasta 40 («Pieza de fruta» no la lleva)       |
| Objetivo o macros       | Enteros no negativos: kcal ≤ 10.000; gramos ≤ 2.000; todos opcionales              |
| Indicaciones generales  | 0–10 secciones; título de 1–60; texto de hasta 3.000                               |
| Documento               | Estricto: se rechazan los campos desconocidos                                      |

## Flujo del profesional

1. Desde la ficha del cliente (entrenador) o desde «Mis clientes» (nutricionista)
   abre «Dieta» y ve la vigente, el borrador si existe y el histórico.
2. «Nueva dieta» empieza un borrador vacío. «Editar» parte de una copia de la
   vigente de ese mismo cliente.
3. Crea tipos de día, asigna la semana y añade comidas en forma de alternativas
   o de tabla de intercambio. También escribe las indicaciones generales.
4. Guarda el borrador tantas veces como quiera. Cada guardado lleva la revisión
   que leyó; si otro profesional guardó antes, recibe un conflicto y puede
   recargar sin perder lo escrito en pantalla.
5. «Publicar» muestra un resumen y pide confirmación. Solo cuando el servidor
   responde se ve «Dieta publicada». Si el reintento llega con el mismo
   identificador de operación, devuelve la misma publicación.
6. En el histórico ve las dietas archivadas con fecha, autor y contenido, en
   modo consulta.

## Flujo del cliente

1. En «Dieta» ve la vigente con dos pestañas:
   - **«Hoy»:** el tipo de día que toca según `Europe/Madrid` y sus comidas.
   - **«Semana»:** los siete días con su tipo; al tocar uno se ven sus comidas.
2. Si el tipo tiene objetivo, se muestran las kcal y los macros tal como los
   escribió el profesional. Si no lo tiene, no aparece ningún número.
3. Cada comida con alternativas muestra sus grupos y opciones, con alimentos,
   cantidades y nota. Cada comida con tabla de intercambio muestra sus columnas
   y la indicación de combinar una de cada una.
4. Sin dieta publicada, la pantalla lo dice («Tu dieta aún no está publicada»)
   en vez de enseñar un ejemplo.
5. **Sin conexión:** muestra la última dieta descargada, con la fecha de la
   última actualización. Si nunca se descargó, dice que hace falta conexión la
   primera vez.
6. Al cerrar sesión se borra la copia local, igual que el entrenamiento. Otra
   cuenta en el mismo dispositivo no la ve.

## Estructura del código

| Ubicación                              | Contenido                                                                | Dueño                               |
| -------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------- |
| `packages/shared/src/nutricion.ts`     | Contratos Zod del documento, las respuestas y las peticiones             | Codex publica, a propuesta de Fable |
| `apps/api/prisma/`                     | Modelo y migración aditiva                                               | Codex                               |
| `apps/api/src/nutricion/`              | Controlador sin lógica, servicio con reglas y tests unitarios            | Fable                               |
| `apps/api/test/nutricion*.e2e-spec.ts` | HTTP contra PostgreSQL: permisos, estados, conflictos, idempotencia      | Fable                               |
| `apps/mobile/src/nutricion/`           | Cliente API, vista del cliente, editor, histórico y tests de componentes | Fable                               |
| `apps/mobile/app/nutricion/`           | Rutas: `/nutricion` (cliente) y `/nutricion/cliente/[id]` (profesional)  | Fable                               |
| Accesos existentes                     | Pestaña del cliente, botón en la ficha y fila en «Mis clientes»          | Codex                               |

Para leer sin conexión se reutiliza el almacén cifrado por cuenta que ya existe
(`almacenDispositivo`), sin modificarlo. Si hiciera falta cambiarlo, se pide a Codex.

## Estilo

Se aplican las convenciones de [SPEC.md](SPEC.md): vocabulario en español,
retornos explícitos, controladores sin lógica, `@Roles` más
`AlcanceClienteGuard` por `:clienteId`, entrada con `EntradaApiPipe` y errores
con el contrato `ErrorDeApiSchema` (`solicitud_invalida`, `revision_obsoleta`,
`operacion_incompatible`).

Contrato propuesto a Codex, con el mismo estilo que `entrenamiento.ts`:

```ts
const TextoCorto = (max: number) => z.string().trim().min(1).max(max)
const Gramos = z.number().int().min(0).max(2000).nullable()

export const AlimentoSchema = z.strictObject({
  nombre: TextoCorto(80),
  cantidad: z.string().trim().max(40).nullable(), // texto libre: "80 g", "al gusto"
})

// Opcional en todos sus campos: el profesional solo escribe lo que quiera mostrar.
export const MacrosSchema = z.strictObject({
  kcal: z.number().int().min(0).max(10000).nullable(),
  proteinaG: Gramos,
  hidratosG: Gramos,
  grasaG: Gramos,
})

const GrupoDeAlternativasSchema = z.strictObject({
  nombre: z.string().trim().max(40).nullable(), // "Opciones dulces"
  alternativas: z
    .array(
      z.strictObject({
        id: z.uuid(),
        titulo: TextoCorto(80),
        alimentos: z.array(AlimentoSchema).min(1).max(20),
        nota: z.string().trim().max(300).nullable(),
        macros: MacrosSchema.nullable(),
      }),
    )
    .min(1)
    .max(20),
})

const ColumnaDeIntercambioSchema = z.strictObject({
  nombre: TextoCorto(40), // "Proteína"
  alimentos: z.array(AlimentoSchema).min(1).max(40),
})

export const ComidaSchema = z.discriminatedUnion("forma", [
  z.strictObject({
    forma: z.literal("alternativas"),
    id: z.uuid(),
    nombre: TextoCorto(40),
    hora: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .nullable(),
    indicacion: z.string().trim().max(500).nullable(),
    grupos: z.array(GrupoDeAlternativasSchema).min(1).max(6),
  }),
  z.strictObject({
    forma: z.literal("intercambio"),
    id: z.uuid(),
    nombre: TextoCorto(40),
    hora: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .nullable(),
    indicacion: z.string().trim().max(500).nullable(),
    columnas: z.array(ColumnaDeIntercambioSchema).min(1).max(6),
  }),
])
```

## Comandos

Desde la raíz del worktree, con la base de pruebas propia de Fable:

```bash
npm run build:shared
npm run test --workspace apps/api -- --runInBand nutricion
npm run test:e2e --workspace apps/api -- --runInBand nutricion
npm run test --workspace apps/mobile -- --runInBand nutricion
npm run build --workspace apps/api
npm run typecheck
npm run lint
```

## Estrategia de pruebas

- **Unitarias:**
  - reglas del servicio: estados, revisión, publicación idempotente y cliente
    dado de baja;
  - validación del documento: semana con tipos inexistentes, límites, campos
    desconocidos, números opcionales y cantidades libres.
- **HTTP contra PostgreSQL:**
  - una denegación por cada «No» de la matriz de permisos, incluidos otro
    cliente, nutricionista sin asignación, nutricionista tras perder la
    asignación, cliente dado de baja, empleado y petición sin sesión;
  - dos guardados con la misma revisión;
  - publicar dos veces con el mismo identificador;
  - publicar mientras otro guarda.
- **Componentes móviles:**
  - «Hoy» y «Semana», incluido el cambio de domingo a lunes;
  - alternativas y tabla de intercambio;
  - dieta sin números y sin dieta publicada;
  - copia sin conexión;
  - en el editor: añadir y quitar, conflicto, publicar con confirmación y error
    sin falsa confirmación.
- **Recorrido real:**
  - un profesional publica y el cliente la ve;
  - se publica una segunda dieta: la primera pasa al histórico y el cliente
    solo ve la nueva;
  - modo avión con la app reabierta;
  - cierre de sesión y otra cuenta en el mismo dispositivo.

  Web y Android/iOS se registran por separado.

Mínimo del 80 % en servicios y guardas, como en el resto del proyecto. Las
denegaciones son obligatorias sea cual sea la cobertura.

## Fronteras

**Siempre**

- Validar el documento con Zod en el servidor y el alcance en cada petición.
- Mostrar en el cliente solo datos reales de la API o de su copia local.
- Usar datos sintéticos en tests, en la base demo y en la documentación.

**Preguntar antes (a Codex o a David)**

- Contratos, Prisma, migraciones, dependencias nuevas o cambios del almacén cifrado.
- Cualquier cosa de «Fuera de esta entrega».

**Nunca**

- Escribir contenido de una dieta en logs.
- Incorporar al repositorio la dieta real que sirvió de referencia.
- Calcular kcal o macros por el profesional.
- Mostrar un borrador al cliente o editar una dieta ya publicada.

## Criterios de aceptación

1. Un profesional crea el borrador de la dieta del cliente A, con dos tipos de
   día, una comida con alternativas en dos grupos y otra con tabla de
   intercambio. El cliente A no ve nada hasta que se publica.
2. Al publicar, el cliente A ve la dieta. Una segunda publicación archiva la
   primera: el profesional la sigue viendo en el histórico y el cliente, no.
3. El cliente B no obtiene ni la dieta vigente ni el borrador del cliente A,
   aunque llame directamente a sus rutas.
4. Un cliente no puede guardar, descartar ni publicar.
5. El nutricionista sin asignación recibe denegación; con asignación edita y
   publica; tras perderla, la petición siguiente se deniega. Lo mismo ocurre si
   el cliente se da de baja.
6. El empleado y una petición sin sesión reciben denegación en todas las rutas.
7. Dos guardados con la misma revisión no se pisan: el segundo recibe
   `revision_obsoleta`.
8. Repetir la publicación con el mismo identificador devuelve el mismo resultado
   y no crea dos dietas.
9. «Hoy» muestra el tipo de día correcto según `Europe/Madrid`, también en el
   paso de domingo a lunes, sin depender de la zona horaria del teléfono.
10. Una dieta sin kcal ni macros es válida y no muestra números. Con ellos, se
    muestran tal cual se escribieron. Se rechazan los negativos o los que
    superan los límites.
11. Las cantidades en texto libre («1 ud», «al gusto», «(25 g)») se guardan y se
    muestran sin cambios, y un alimento sin cantidad es válido.
12. Tras abrir la dieta una vez, en modo avión se lee la última publicada. Al
    cerrar sesión desaparece, y otra cuenta del mismo dispositivo no la ve.
13. A un cliente dado de baja no se le puede guardar ni publicar dieta, y su
    histórico se conserva. A un cliente pendiente sí se le puede publicar.
14. Ninguna traza del servidor contiene texto del documento de una dieta.

## Preguntas abiertas

1. **¿Una dieta cuenta como dato de salud a efectos del consentimiento (tarea
   19)?** Una pauta alimentaria puede revelar información de salud.
   - Mientras David y la revisión legal no lo decidan, se desarrolla con datos
     sintéticos.
   - Técnicamente se trata como sensible: cifrada en el dispositivo y fuera de
     los logs.
2. **¿Hace falta adjuntar el PDF original de una dieta?** No está incluido;
   necesitaría el almacenamiento de objetos del ADR 0005.
