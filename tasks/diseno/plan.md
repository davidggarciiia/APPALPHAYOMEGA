# Plan: la app según Design.html

David (24-09): «básate 100 % en el diseño de Design.html». El diseño manda sobre
decisiones anteriores que lo contradigan (por ejemplo, el cliente sí marca sus
comidas). El archivo no entra en el repo; su contenido está resumido abajo.
Todo lo que el diseño muestra se construye con datos reales: nada de cifras de
ejemplo dentro de componentes.

## Las 17 pantallas y su tramo

| Pantalla                              | Tramo  |
| ------------------------------------- | ------ |
| Cliente · Inicio                      | D1, D5 |
| Cliente · Check-in                    | D3     |
| Cliente · Sesión en curso             | D2     |
| Cliente · Técnica del ejercicio       | D1     |
| Cliente · Registrar molestia          | D3     |
| Cliente · Cierre de sesión            | D3     |
| Cliente · Plan · Rutina               | D4     |
| Cliente · Plan · Bloque               | D4     |
| Cliente · Guía                        | D4     |
| Cliente · Nutrición con nutricionista | D6     |
| Cliente · Nutrición sin nutricionista | D6     |
| Cliente · Nutrición · Comida          | D6     |
| Cliente · Nutrición · Media mañana    | D6     |
| Cliente · Progreso                    | D5     |
| Entrenador · Ficha del cliente        | D7     |
| Entrenador · Constructor de planes    | D8     |
| Nutricionista · Ficha del cliente     | D6     |

## Tramos

**D1 · Prescripción ampliada y técnica.** La sesión se ordena en partes
(calentamiento, parte principal, circuito, final) con sus minutos; cada
ejercicio lleva RIR objetivo, descanso, rango de repeticiones, carga inicial,
subida, nota del entrenador y alternativas; la ficha del ejercicio lleva pasos,
«evita» y consejos. Campos opcionales: los documentos anteriores siguen valiendo.
«Hoy toca» enseña la animación del primer ejercicio y la duración estimada.

**D2 · Sesión en curso.** Cronómetro, descanso tras cada serie con «Saltar
descanso», RIR por serie («¿Cuántas te quedaban?»), sugerencia del entrenador,
«Anterior» (última vez que hizo ese ejercicio) y diferencia de carga, serie en
curso resaltada, calentamiento como lista marcable, notas y diálogos de terminar
y salir.

**D3 · Check-in, molestias y cierre.** Check-in antes de empezar (cómo te
sientes 1–5, nada/agujetas/dolor). Molestia durante la sesión (zona,
intensidad, qué notas, avisar al entrenador). Cierre: esfuerzo 0–10, cómo
terminas 1–5, todo bien / algo incómodo, nota y «La próxima vez» calculada con
la doble progresión.

**D4 · Plan.** Pestañas Rutina, Bloque y Guía. El plan guarda bloque, fases,
objetivos, otros deportes y notas del entrenador. La guía (RIR, semáforo de
molestias y temas) es contenido fijo de la app.

**D5 · Seguimiento diario y progreso.** Registro del día (peso en ayunas, pasos,
sueño, creatina), medidas (cintura, grasa, masa libre, altura, edad) y pruebas
físicas; Progreso con Peso, Cintura, Fuerza y Pruebas, media semanal y gráfica.

**D6 · Nutrición completa.** Comidas marcadas como hechas con la opción elegida,
«Tu plato» en las comidas de intercambio, suplementos del día, objetivo con
rango y porcentajes. Ficha del nutricionista: Pauta, Seguimiento e Historial,
cálculo del gasto (Mifflin-St Jeor y factor de actividad) y publicación.

**D7 · Ficha del cliente para el entrenador.** Pestañas Resumen, Sesiones,
Progreso, Check-ins y molestias, Nutrición y Salud; «Requiere tu atención»;
tabla prescrito / sugerido / hecho / RIR / próxima vez; comentarios y mensajes.

**D8 · Constructor de planes.** Bloque y fases, días, deportes, partes con tabla
(series, reps, RIR, descanso, carga inicial, subida), panel del ejercicio,
publicar, ver como cliente, exportar PDF y guardar como plantilla.

## Reglas

- Cada tramo: contrato Zod → Prisma y migración aditiva → API con permisos y
  pruebas HTTP → pantallas con pruebas de componente → verificación en web.
- Commit por tramo, con typecheck, lint y pruebas en verde.
- Cálculos (doble progresión, medias, gasto energético) en funciones puras
  probadas; los números que escribe el profesional se muestran tal cual.
