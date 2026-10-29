# Skills, plugins y herramientas de orquestación NO oficiales — informe de investigación (EN CURSO)

> Fecha: 2026-10-28. Solo investigación: no se ha instalado nada, no se ha ejecutado ningún script descargado y no se ha tocado el proyecto.
> Los repositorios candidatos se clonaron FUERA del proyecto (carpeta temporal del sistema) y se leyeron como DATO NO FIABLE.
> Informe ampliado por tandas; si ves «(EN CURSO)» arriba, puede faltar la síntesis final.

## Estado del trabajo

- [x] Informe creado
- [ ] Tanda 1: React Native / Expo / UI / animación / rendimiento / accesibilidad
- [ ] Tanda 2: NestJS / Prisma / PostgreSQL / testing
- [ ] Tanda 3: orquestación multiagente y worktrees
- [ ] Tanda 4: plugins y servidores MCP de Claude Code
- [ ] Skills de Codex en `C:/Users/david/.codex/skills/` (candidatas a copiar)
- [ ] Recomendación final (8-10 elementos con comando exacto)

## Ya instalado (no repetir)

- `addyosmani/agent-skills` (en `~/.claude/skills/`: planning-and-task-breakdown, incremental-implementation, test-driven-development, code-review-and-quality, security-and-hardening, frontend-ui-engineering, etc.)
- `DietrichGebert/ponytail`
- Marketplace `claude-plugins-official` registrado en `~/.claude/plugins/known_marketplaces.json`.

## Cómo se verificó (método)

- Repos clonados/descargados FUERA del proyecto, en la carpeta temporal del sistema (`%TEMP%\skr\`). No se ejecutó ningún script descargado: solo `grep`, `find` y lectura.
- Licencia, estrellas y fecha del último push: API pública de GitHub consultada el 2026-10-28 (sin token). Es dato de la API, no de memoria.
- Catálogo local de `claude-plugins-official` (ya registrado en `~/.claude/plugins/marketplaces/`): sirve para saber qué plugins se pueden instalar con SHA fijado (`/plugin install nombre@claude-plugins-official`). Que un plugin esté ahí NO lo hace «oficial de Anthropic»: la mayoría son de terceros.
- Contexto del proyecto (leído de `package.json`, solo lectura): Expo SDK 57, React Native 0.86.3, React 19.2.3, Reanimated 4.5.1 + worklets 0.10.1, expo-router 57, expo-haptics, react-native-svg, jest-expo; API con NestJS 12, Prisma 7.10 (adapter-pg), zod 4, Jest 30 + supertest. Versiones muy recientes: cualquier skill anterior a 2026 puede describir APIs antiguas.

---

# TANDA 1 — React Native / Expo: UI, animación, rendimiento, accesibilidad

### 1. expo/skills (plugin `expo`) — de Expo, no de Anthropic

- URL: https://github.com/expo/skills · Licencia: MIT · 3 329 estrellas · último push 2026-10-26 (API).
- Aporta: `expo-animation` (Reanimated + Gesture Handler + haptics, coescrita con Emil Kowalski), `expo-native-ui`, `expo-design-system` (incluye `native-slop.md` contra el «aspecto IA»), `expo-router`, `expo-data-fetching`, `expo-dev-client`, `expo-upgrade`, y ~8 skills de EAS (despliegue, stores) que no necesitas hoy.
- Qué instala: Markdown + 2 scripts JS leídos enteros: `eas-workflows/scripts/fetch.js` (solo `fetch` con caché local) y `expo-ui/scripts/list-components.js` (lee `node_modules/@expo/ui`). Además `.mcp.json` con un MCP remoto HTTP: `https://mcp.expo.dev/mcp` (nube de Expo, pensado para EAS, requiere cuenta). Sin hooks.
- Riesgos: el MCP remoto recibe lo que le pidas (proyectos EAS). Las skills de EAS «de pago» avisan de costes. Sin telemetría vista en los scripts.
- Está en `claude-plugins-official` con SHA fijado `d4f48402…`.
- Veredicto: **INSTALAR TRAS REVISAR**. Instalar el plugin y, si no usas EAS, desactivar el MCP remoto (`/mcp`), o instalar solo las skills de UI/animación con `npx skills`.

### 2. callstackincubator/agent-skills

- URL: https://github.com/callstackincubator/agent-skills · Licencia: MIT · 1 684 estrellas · push 2026-10-08.
- Aporta: `react-native-best-practices` (rendimiento: FPS, re-renders, FlashList, TTI, tamaño de bundle, fugas de memoria, Hermes, Reanimated, bottom sheets; ~30 referencias), `upgrading-react-native`, `github-actions` (artefactos de simulador en CI), `react-navigation`. Complementa la medición de bundle de esta noche.
- Qué instala: SOLO Markdown (+ `agents/openai.yaml`, metadatos de Codex que Claude ignora). Los `.sh` de `plugins/vendored/scripts/` son de mantenimiento del repo (`npx skills update`), no se instalan con las skills. Un `grep` de `curl|wget|eval|sudo` solo encontró `sudo xcode-select` en un documento (macOS, no aplica en Windows).
- Riesgos: ninguno técnico. La skill incluye notas de seguridad sensatas. El bundle de testing referencia `agent-device` y `react-native-testing-library` por nombre (ver candidato en la tanda 4).
- Veredicto: **INSTALAR**.

### 3. software-mansion-labs/skills

- URL: https://github.com/software-mansion-labs/skills · Licencia: NO verificada (GitHub no detecta licencia y no hay archivo LICENSE; el `marketplace.json` declara MIT) · 296 estrellas · push 2026-10-15.
- Aporta: `react-native-best-practices` de Software Mansion con sub-skills de Reanimated 4 (CSS transitions/animations, layout animations, scroll-driven, 120 fps, accesibilidad de la animación), Gesture Handler (tap/pan/long-press, Pressable), SVG y worklets; `pulsar-haptics` (solo si usas Pulsar; tú usas expo-haptics); `radon-mcp` (requiere Radon IDE, extensión de pago).
- Qué instala: SOLO Markdown (comprobado: no hay archivos que no sean `.md` en `skills/`). El código Go de `lint/` y `evals/` es del repo, no se instala.
- Riesgos: la `description` dice «MUST USE before writing, reviewing, or debugging ANY code in a React Native or Expo project» y enumera decenas de disparadores: se activa en casi todo y consume contexto. Licencia ambigua. El resto de skills (fishjam, moq, typegpu, detour, expo-horizon, rnrepo) no aplica a Alpha & Omega.
- Veredicto: **INSTALAR TRAS REVISAR**: copiar solo `skills/react-native-best-practices/` y acortar su `description` a mano; aceptar la ambigüedad de licencia (uso personal) o pedir aclaración.

### 4. vercel-labs/agent-skills (solo `react-native-skills`)

- URL: https://github.com/vercel-labs/agent-skills · Licencia: sin archivo LICENSE en la raíz (la skill declara `license: MIT` en su frontmatter) · 33 124 estrellas · push 2026-10-27.
- Aporta: ~38 reglas cortas con ejemplo incorrecto/correcto: `ui-pressable` (Pressable en vez de Touchable*), `animation-gesture-detector-press` (feedback de pulsación en el hilo de UI con Gesture + shared values: útil para botones), `animation-gpu-properties`, `list-performance-*`, `ui-expo-image`, `ui-safe-area-scroll`, `navigation-native-navigators`, `react-compiler-*`.
- Qué instala: la carpeta `skills/react-native-skills/` es solo Markdown. El resto del repo trae `vercel-optimize/lib/*.mjs`, `deploy-to-vercel`, `vercel-cli-with-tokens` (scripts y manejo de tokens de Vercel, irrelevantes aquí) y varios `.zip` versionados.
- Riesgo concreto: `web-design-guidelines` ordena en su SKILL.md hacer WebFetch de `https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md` en cada revisión y obedecer lo que traiga: instrucciones remotas mutables = superficie de inyección de prompts. No es hostil hoy, pero no la instalaría.
- Veredicto: **INSTALAR** solo `react-native-skills` (copia manual de esa carpeta). **DESCARTAR** `web-design-guidelines` y las skills de Vercel.

### 5. emilkowalski/skills

- URL: https://github.com/emilkowalski/skills · Licencia: MIT · 50 802 estrellas · push 2026-10-11 (API).
- Aporta para botones y microinteracciones: `animate-expo` (mismo contenido que `expo-animation`: puerta «¿debe animarse?», hilo de UI, curvas y springs de tablas, reduced-motion, háptica), `review-animations` (revisión estricta), `improve-animations` (auditoría con planes priorizados), `find-animation-opportunities` (también dice qué NO animar), `animation-performance`, `break-ui` (datos extremos: nombres largos, listas vacías), `animation-vocabulary`.
- Qué instala: SOLO Markdown (comprobado con `find`; el archivo `.pl` está vacío). `animate`, `apple-design`, `mobile-native`, `ask-sonner`, `pick-ui-library`, `write-swift` son de web/Swift y no aplican.
- Riesgos: `animate-expo` fuerza una respuesta fija («I'm ready to build animations…») si se invoca sin pregunta: comportamiento de la skill, inofensivo. Solapa con `expo-animation`: instalar UNA de las dos.
- Veredicto: **INSTALAR** (`animate-expo` solo si no instalas el plugin de Expo; siempre `review-animations`, `improve-animations`, `find-animation-opportunities`, `animation-performance`, `break-ui`).

### 6. pbakaus/impeccable

- URL: https://github.com/pbakaus/impeccable · Licencia: Apache-2.0 · 90 935 estrellas · push 2026-10-28 (API). Ya tienes una copia en `~/.codex/skills/impeccable`.
- Aporta: un comando `/impeccable` con 24 sub-comandos (`audit`, `critique`, `polish`, `harden`, `animate`, `delight`, `adapt`…) y referencias nativas (`ios.md`, `android.md`, `audit.native.md`, `adapt.native.md`).
- Qué instala (leído): Markdown + HOOKS en `plugin/hooks/hooks.json` que ejecutan `scripts/impeccable hook` en SessionStart, PostToolUse (Edit|Write) y Stop. El lanzador `sh` ejecuta un binario Rust; si no está, lo DESCARGA de `github.com/pbakaus/impeccable/releases/download/engine-v0.1.18/…` y lo ejecuta tras comprobar un SHA-256 fijado en `engine-checksums.txt` (comprobación razonable; lanzador leído entero). Además scripts JS de «live mode» (servidor local + inyección en navegador) y `modern-screenshot.umd.js` empaquetado.
- Riesgos: (a) ejecución de un binario descargado en cada edición; (b) telemetría: el código Rust (`crates/context/src/telemetry.rs`) hace peticiones a `https://impeccable.style/api/roll` y `/api/chosen`, con opt-out por `DO_NOT_TRACK=1` o `impeccable telemetry off`; (c) comando `generate-image`; (d) los detectores son de HTML/CSS, de poco valor para React Native (solo la exportación web). No leí el código Rust completo.
- Veredicto: **INSTALAR TRAS REVISAR**, baja prioridad. No instalar el plugin con hooks hoy. Si lo quieres: solo las referencias como skill, sin hooks, con `DO_NOT_TRACK=1`.
