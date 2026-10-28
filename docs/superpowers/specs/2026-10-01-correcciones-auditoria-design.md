# Corrección de la auditoría del 30 de septiembre

El usuario solicita corregir con agentes los 41 hallazgos de `tasks/auditoria-2026-09-30.md`. Los recorridos, causas y resultados esperados de ese informe constituyen el alcance autorizado.

Se conservarán los contratos públicos y los documentos existentes siempre que sea posible. Los editores conservarán todos los campos ajenos a una edición y las solicitudes pendientes completas. Las operaciones concurrentes usarán el mismo bloqueo de cuenta, consentimiento, borrador o publicación antes de comprobar y escribir; una operación idéntica devolverá su resultado ya confirmado. Los errores de validación no eliminarán datos guardados.

La persistencia web coordinará clave y documento entre pestañas. Si una edición concurrente no puede combinarse de forma segura, conservará una copia y mostrará conflicto. Una rotación de credenciales posterior no debe cerrar una cuenta válida ni borrar borradores.

Se añadirán regresiones que fallen antes de cada corrección y pasen después. Los cambios se revisarán por requisitos y por calidad, seguidos de tipos, unitarios, compilación y lint de los archivos afectados. Las carreras SQL se comprobarán con una base dedicada si el entorno permite levantarla sin usar datos reales. Los resultados no comprobados en PostgreSQL o dispositivos se indicarán expresamente.

La ampliación concurrente del catálogo y los archivos ajenos quedan fuera de estas correcciones. Se trabaja en la rama `codex/cliente-intuitivo`, distribuyendo archivos para evitar escrituras simultáneas sobre los mismos componentes. No se publica, despliega ni modifica datos reales.

La continuación incluye el anexo `tasks/auditoria-nativa-2026-10-01.md`: ciclo de vida del vídeo (N1), renovación de las rutas de identidad móviles (N2), respuesta de comentarios al cambiar de sesión (N3) y acción que promete editar pero crea un plan nuevo (N4). Se corrigen también sus cuatro observaciones concretas de interfaz: recuento de series, salida tras envío, solapamiento a 320 px y aviso al salir del constructor. Los riesgos sin reproducción del anexo se mantienen como límites de verificación.
