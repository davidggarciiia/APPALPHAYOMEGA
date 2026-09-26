# Datos de demostración

Un comando llena una base de **demostración** con cuentas y datos inventados,
realistas y coherentes entre sí, para enseñar la app entera nada más abrirla:
doce semanas de entrenamientos, seguimiento, fotos, valoraciones, dieta, saldo,
reservas y cobros. Las fechas se calculan desde hoy (Europe/Madrid), así que la
demo siempre parece reciente.

Nada es real: nombres, correos (`@demo.alphaomega.test`, dominio reservado),
pesos y medidas son inventados, y las fotos de progreso son siluetas generadas
por código (`apps/api/src/demo/imagen-demo.ts`).

## Antes de sembrar

1. **Una base propia con «demo» en el nombre.** El script se niega a escribir
   en cualquier otra (sale con código 1 y lo explica). Con el Postgres de
   `docker-compose.yml`:

   ```bash
   docker compose exec postgres createdb -U <POSTGRES_USER> alpha_omega_demo
   ```

2. **Migrada**, apuntando a ella (PowerShell):

   ```powershell
   $env:POSTGRES_DB='alpha_omega_demo'; npx prisma migrate deploy
   ```

3. **`.env`**:
   - `ALMACEN=local` y `ALMACEN_LOCAL_DIR`: carpeta donde se guardan las fotos
     de la demo. La API que sirva la demo tiene que usar **la misma** carpeta.
   - `MEDIOS_DIR` (opcional): las figuras animadas del catálogo. Sin ella los
     ejercicios se crean igual, sin figura.
   - `SEED_ENTRENADOR_EMAIL` y `SEED_ENTRENADOR_PASSWORD`: si esa cuenta no
     existe en la base, se crea como hace `npm run db:seed`.

## Sembrar

```powershell
$env:POSTGRES_DB='alpha_omega_demo'; npm run demo:seed --workspace apps/api
```

Si el `.env` ya apunta a la base de demo, basta con
`npm run demo:seed --workspace apps/api`. Lo que venga del entorno manda sobre
el `.env`.

El script compila la API, imprime la base destino, arranca la API dentro del
propio proceso y escribe por HTTP todo lo que la API permite (con sus
validaciones y permisos). Tarda menos de un minuto y acaba con un resumen de
filas (cuentas, sesiones enviadas, medidas, fotos, reservas, cobros…).

**Volver a sembrar** es el mismo comando. Borra solo las cuentas
`@demo.alphaomega.test` y todo lo que cuelga de ellas (también sus fotos del
almacén) y lo recrea desde cero: dos ejecuciones el mismo día dejan el mismo
estado. Conviene volver a sembrar antes de enseñar la demo para que «hoy» sea
hoy. No toca ningún otro usuario; el horario semanal, los ajustes de la agenda
y el catálogo son globales y se dejan como los necesita la demo.

## Cuentas

Contraseña de todas las cuentas de demo: **`Demo-AlphaOmega-2026`**

| Rol           | Nombre       | Correo                              | Notas                           |
| ------------- | ------------ | ----------------------------------- | ------------------------------- |
| Entrenador    | Álex Romero  | `entrenador@demo.alphaomega.test`   | Autor de todo lo del entrenador |
| Nutricionista | Irene Soler  | `irene.soler@demo.alphaomega.test`  | Asignada a Lucía y Sara         |
| Cliente       | Lucía Martín | `lucia.martin@demo.alphaomega.test` | La clienta principal            |
| Cliente       | Marcos Gil   | `marcos.gil@demo.alphaomega.test`   |                                 |
| Cliente       | Sara Ortega  | `sara.ortega@demo.alphaomega.test`  |                                 |
| Cliente       | Javier Ruiz  | `javier.ruiz@demo.alphaomega.test`  | Pendiente de activar: no entra  |
| Cliente       | Nerea Campos | `nerea.campos@demo.alphaomega.test` |                                 |
| Cliente       | Pablo Vidal  | `pablo.vidal@demo.alphaomega.test`  |                                 |
| Entrenador    | La del seed  | `SEED_ENTRENADOR_EMAIL` del `.env`  | Su contraseña es la del `.env`  |

Los clientes activos han dado el consentimiento de datos de salud.

## Qué enseña cada cuenta

**Álex (entrenador).** Panel «Hoy» con datos: cuatro sesiones hoy (la de Lucía
a medias), entrenos enviados por revisar, la molestia de rodilla de Marcos, las
fotos recibidas de Lucía, una pregunta de Lucía sin leer, la cita de hoy o de
mañana, dos cobros pendientes y un «Lo quiero» de Sara. Cartera de seis
clientes, cinco rutinas guardadas, agenda con horario (L–V 8:00–14:00 y
17:00–21:00, sábado 9:00–13:00), un cierre puntual el miércoles que viene por
la tarde, reservas pasadas y próximas y los cobros del mes.

**Lucía Martín**, la clienta con todo:

- Plan «Recomposición · 16 semanas» con bloque (objetivos, cuatro fases, pádel
  los domingos, 8.000 pasos), tres sesiones por semana y doce semanas de
  historia: la mayoría enviadas con series, cargas que progresan, RIR,
  esfuerzo y energía; casi todas revisadas y algunas con comentario del
  entrenador. Hoy tiene una sesión a medias. Una molestia antigua de hombro,
  ya atendida.
- Peso de ~72 a ~66,5 kg con ruido de un día a otro, cintura y grasa bajando,
  pasos y sueño diarios, creatina, medidas semanales y pruebas (flexiones,
  plancha, sentadillas) cada cuatro semanas.
- Valoración inicial y una revisión publicadas (medidas, pliegues,
  bioimpedancia, cuatro pruebas estándar y fotos) y la próxima revisión
  pautada.
- Tres tomas de fotos de frente y de perfil (silueta cada vez más definida):
  una pedida por el entrenador, otra subida por ella desde Progreso y la última
  pedida y aún sin revisar; y dos fotos sueltas de frente entre medias.
- Dieta de su nutricionista (fase 2 vigente, fase 1 en el histórico) con
  alternativas, intercambios, dos tipos de día y comidas marcadas esta semana.
- Plan Presencial Plus este mes (pedido con «Lo quiero»), renovación del mes
  que viene pendiente de cobro, un Bono EP 10 casi gastado, reservas pasadas
  cada martes y las de los próximos martes.

**Marcos Gil.** Bloque de fuerza con su último entrenamiento enviado sin
revisar y una molestia de rodilla abierta (ámbar). Valoración inicial
publicada, dieta de objetivos diarios del entrenador, Presencial Esencial este
mes y la primera cita libre (hoy o mañana).

**Sara Ortega.** Empezó hace tres semanas: Bono EP 10 a medias, reservas los
jueves, un «Lo quiero» pendiente de un Bono EP 6 y un borrador de dieta que
prepara su nutricionista.

**Javier Ruiz.** Dado de alta hace dos días y pendiente de activar, sin
contraseña. Ya tiene plan desde el lunes que viene.

**Nerea Campos.** Baja adherencia: pocos entrenos y ninguno en casi dos
semanas, registros abandonados, una sesión en pareja reservada con cobro
pendiente y una reserva que canceló a tiempo (la sesión le volvió).

**Pablo Vidal.** Plan online (sin reservas), fuerza para corredor con algunos
entrenos hechos, muchos pasos y una prueba de 5 km en cinta cada mes.

**Irene Soler (nutricionista).** Ve solo a Lucía y a Sara: la dieta publicada
de Lucía y el borrador de la de Sara.

## Qué no pasa por la API y por qué

Todo se escribe por la API salvo esto, que se hace con Prisma imitando al
servicio correspondiente:

- **Cuenta del entrenador de demo**: la API no crea entrenadores; nace como la
  del seed (`src/seed.ts`). Los demás se dan de alta por la API y activan su
  cuenta con el enlace real; ese correo se queda en memoria y no sale del
  proceso.
- **Reservas pasadas**: la API no reserva en el pasado. Se crean como lo haría
  `ReservasService.reservar`, con el consumo de saldo del propio
  `SaldoService` en la misma transacción.
- **Marcas de tiempo**: altas, consentimientos, envíos y revisiones de
  sesiones, comentarios, molestias, avisos leídos, medidas, fotos,
  valoraciones, dietas, activaciones y cobros se mueven al día en que habrían
  ocurrido. No se cambia ningún otro dato.

## Límites

- La cita «de hoy o de mañana» es el primer hueco libre desde que se siembra;
  si se siembra un sábado por la tarde, cae el lunes.
- Las sesiones «de hoy» de cada cliente dependen del día de la semana: el
  patrón de entrenos se ajusta para que haya sesiones hoy.
- Las fotos solo se ven si la API usa el mismo `ALMACEN_LOCAL_DIR` con el que
  se sembró.
