# Intención confirmada — App Alpha & Omega

> Producido con la skill `interview-me`. Confirmado por David el 2026-09-11.
> Este documento es la entrada de `spec-driven-development`. No es una especificación.

## Resultado

Una app móvil publicada en App Store y Google Play donde el cliente registra sus
entrenos y consulta su dieta, y el equipo lo ve todo desde perfiles con permisos
separados.

## Usuarios

Cuatro perfiles con permisos distintos:

| Perfil                        | Qué puede hacer                                             |
| ----------------------------- | ----------------------------------------------------------- |
| Cliente                       | Registra entrenos. Lee su dieta, no la edita.               |
| Entrenador                    | Todo. Además leads, horarios y fichajes.                    |
| Nutricionista (subcontratado) | Solo nutrición, y solo de los clientes que le corresponden. |
| Informático (en plantilla)    | Solo ficha entrada y salida.                                |

El permiso es estructura, no una casilla añadida al final: un externo entra en la
app y no puede ver datos de clientes que no son suyos.

## Por qué ahora

El encargo está cerrado. La landing (alphayomegatraining.com) capta, pero a partir
del primer contacto el seguimiento no vive en ningún sistema.

## Éxito

El entrenador abre el panel y ve qué ha levantado cada cliente esta semana sin
preguntárselo a nadie. Ese espejo en tiempo real es el producto. Todo lo demás lo
rodea.

## Restricción

Sin fecha límite, precio cerrado y alcance comprometido como "la app completa".
Esa combinación es el riesgo real del proyecto, no la tecnología. Por eso este
documento fija qué significa completa.

Plataforma: multiplataforma publicada en tiendas. Implica dos cuentas de
desarrollador con cuota anual y revisión de tienda en cada actualización.

Identidad: ya existe y se respeta. Negro y oro. "Construye rendimiento.
Demuestra resultados."

## Fuera de alcance

- El cliente **no** registra comidas. Solo las lee.
- Los vídeos propios **no** bloquean el lanzamiento. Entran figuras animadas con
  el botón de vídeo ya colocado al lado.
- El rediseño de la landing es **otro proyecto** con su propio precio.
- La báscula de bioimpedancia **no** se conecta. Sus datos se teclean a mano.

## Inventario: qué significa "completa"

Catorce pantallas contando el login, no las ocho del boceto.

**1. Núcleo del producto**

- Login con cuatro roles
- Inicio cliente
- Entrenos — semana
- Entrenos — mes
- Detalle de ejercicio con registro de series
- Panel admin de entrenos

**2. Alrededor**

- Librería Symmetry (mapa muscular)
- Nutrición cliente (solo lectura)
- Nutrición del nutricionista
- Seguimiento corporal: peso, bioimpedancia, plicómetro, medidas

**3. Gestión del negocio**

- Leads desde el formulario de la web
- Horarios

**4. Al final (prioridad baja, decidida por David)**

- Fichajes

## Riesgos abiertos

1. **Licencia de las figuras animadas.** Si salen de la librería de Symmetry, no
   son nuestras. Confirmar origen y licencia antes de incrustarlas en ocho pantallas.
2. **Vídeos de ejercicios.** Los grabará el entrenador. Nadie los ha contado. Una
   librería realista ronda los cien. No bloquean el lanzamiento pero sí la promesa.
3. **Alcance abierto con precio cerrado.** Este documento es la defensa. Cualquier
   cosa que no esté en el inventario es fase dos.
4. **Fichajes.** Un módulo a medida para un único usuario. El registro de jornada
   es obligatorio en España, pero se cumple con medios mucho más baratos.
5. **Leads.** Dependen del formulario de la landing. Deja de ser dependencia de un
   tercero porque David asume la web, pero sigue siendo una integración.

## Decisiones ya tomadas

- Publicación en tiendas, no web instalable.
- El cliente no registra nutrición.
- Figuras animadas primero, vídeo después.
- Stack: **sin decidir**. Se decide en la fase de especificación.
