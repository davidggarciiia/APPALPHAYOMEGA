# ADR 0004: El token de acceso se contrasta con la base en cada petición

- **Fecha:** 2026-09-12
- **Estado:** aceptado
- **Contexto:** checkpoint 2 del plan de `identity`

## Cómo apareció

El checkpoint 2 pedía una revisión antes de seguir. Se hizo de dos formas: una
revisión de cinco ejes hecha por quien escribió el código, y una auditoría
adversarial con seis analistas independientes atacando el sistema de permisos
desde ángulos distintos, cada hallazgo sometido después a dos revisores cuyo
único encargo era refutarlo.

La primera no encontró nada de lo que sigue. La segunda propuso diecinueve
fallos y confirmó ocho. **Esa diferencia es el dato más útil de este documento**:
revisarse a uno mismo tiene un límite que no se arregla poniendo más cuidado.

## El problema principal

`AutenticacionGuard` hacía tres cosas: mirar `@Publico()`, verificar la firma del
token y validar su forma con Zod. Ni una consulta a la base de datos. `RolesGuard`
decidía con el rol que venía dentro del propio token.

Es decir, la única fuente de verdad sobre quién eres, si sigues teniendo cuenta y
qué rol tienes era un papel autofirmado con quince minutos de vida.

Consecuencias, todas comprobadas contra el código:

| Acción                | Lo que parecía      | Lo que pasaba de verdad                  |
| --------------------- | ------------------- | ---------------------------------------- |
| Cerrar sesión         | 204, sesión cerrada | El token seguía abriendo todo 15 minutos |
| Desactivar una cuenta | Acceso cortado      | Seguía dentro 15 minutos                 |
| Borrar una cuenta     | Usuario eliminado   | Su token seguía funcionando              |
| Degradar un rol       | Permisos reducidos  | Conservaba el rol antiguo 15 minutos     |

El caso que importa en este proyecto: el día que el entrenador corte el contrato
al nutricionista subcontratado, ese profesional externo sigue leyendo peso,
medidas, pliegues y fotos corporales de clientes reales durante quince minutos.
Y peor: el test que sí existía, el de que no puede renovar la sesión, pasaba en
verde y daba la falsa sensación de que el corte había funcionado.

Quince minutos no acotan el daño, solo la oportunidad. Lo que se escriba en esa
ventana es permanente.

## Decisión

**El token de acceso lleva el identificador de su sesión (`sid`), y el guard
comprueba en cada petición que esa sesión sigue viva y que el usuario sigue
existiendo, activo y con el rol que dice.**

Dos consultas por clave primaria indexada. El coste es real y se acepta a
sabiendas: para un entrenador con decenas de clientes es irrelevante, y la
alternativa es un sistema de permisos que no se puede apagar.

El rol que usa `RolesGuard` es ahora el de la base, no el del token. Un cambio de
rol surte efecto en la petición siguiente.

## Los otros tres arreglos

**Carrera en la rotación.** Entre leer la fila del token y marcarla revocada
cabían dos peticiones simultáneas, y las dos salían con sesión válida. La
rotación producía justo lo que pretendía impedir: una sesión bifurcada. Ahora la
revocación es una escritura condicional y la base arbitra: de cuatro canjes
simultáneos gana exactamente uno.

**Detección de reutilización.** Un token ya rotado que vuelve a aparecer no es un
error del usuario, es la firma de una copia. Ahora se revoca la **familia**
entera y se obliga a escribir la contraseña de nuevo. No se sabe quién tiene el
token legítimo, así que se echa a los dos.

**Vida máxima de la cadena.** Cada rotación reiniciaba los treinta días, así que
una sesión robada que se fuera refrescando duraba para siempre. La familia guarda
su fecha de nacimiento y la hereda en cada rotación; pasados noventa días se pide
la contraseña otra vez.

**Limitación de intentos.** El requisito 6 de la especificación llevaba sin
implementar desde que se escribió, y ningún test lo notó. El login era una puerta
que se podía aporrear sin coste, y encima obligaba al servidor a calcular un hash
Argon2id por intento, que es caro a propósito: servía para colarse y para tumbar
el servidor. Ahora la espera se dobla a partir del sexto fallo.

Ese limitador vive en memoria. Se pierde al reiniciar y no se comparte entre
instancias. **Si algún día el servidor se replica, deja de valer** y hay que
moverlo a la base o a Redis.

## Qué queda pendiente

Cuando lleguen las tareas 17 y 20 hay que llamar a `revocarTodosDe` al
desactivar una cuenta, al borrarla y al cambiar la contraseña. Hoy el guard ya
corta el acceso al comprobar el estado, pero las filas de tokens de refresco se
quedan vivas hasta treinta días, y eso tiene un efecto desagradable: reactivar
más tarde a un usuario le resucita todas sus sesiones viejas.

## Los once hallazgos descartados

Los revisores refutaron once de los diecinueve propuestos. Merece la pena
nombrarlos porque son el tipo de cosa que suena grave y no lo es aquí: el
algoritmo de firma sin fijar, `@Publico()` heredándose por la cadena de
prototipos, el `ZodPipe` sin cubrir `@Query` ni `@Param`. Ninguno es explotable
con el código tal y como está hoy. Varios lo serían con endpoints que aún no
existen, así que conviene releerlos antes de la fase 4.
