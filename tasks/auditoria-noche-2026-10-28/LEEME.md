# Trabajo de la noche del 28-10-2026

Carpeta de informes de los agentes. Cada archivo lo escribe un agente de solo lectura
sobre el código (no modifica la app). Los agentes que sí modifican código trabajan en
worktrees con sus propias ramas y las integra la sesión principal tras verificarlas.

Reglas comunes: sin push ni despliegue; la base habitual `alpha_omega` no se toca (los
E2E exigen `POSTGRES_DB` con «e2e»); código limpio según la skill `ponytail`; nada se da
por hecho sin ejecutarlo.
