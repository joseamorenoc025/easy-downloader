# Contributing to EasyDownloader / Guía para Contribuir

¡Gracias por tu interés en mejorar **EasyDownloader**! Todas las contribuciones — reportes de bugs, sugerencias, código, traducciones, documentación — son bienvenidas.

Thanks for your interest in improving **EasyDownloader**! All contributions — bug reports, suggestions, code, translations, docs — are welcome.

---

## Code of Conduct / Código de Conducta

- Sé respetuoso y constructivo.
- Be respectful and constructive.
- Asume buena fe. Ask before assuming.
- Reporta comportamiento inapropiado a [joseamorenoc025@gmail.com](mailto:joseamorenoc025@gmail.com).

---

## ¿Cómo contribuir? / How to contribute?

### 1. Reportar un bug / Reporting a bug

Antes de abrir un issue, busca en los [issues existentes](../../issues) por si ya está reportado. Si es nuevo:

1. Ve a [Issues](../../issues/new) → **Bug Report**.
2. Incluye:
   - Sistema operativo y versión (ej. Windows 11 23H2, Debian 12).
   - Versión de EasyDownloader (la app muestra en la cabecera del repo / changelog).
   - Pasos para reproducir (mínimo 3-4 pasos claros).
   - Comportamiento esperado vs. observado.
   - Si es un crash: el stack trace completo (ventana "Open logs folder" desde la app, o `%APPDATA%\EasyDownloader\logs` en Windows, `~/.config/EasyDownloader/logs` en Linux).
3. Etiqueta con `bug`.

**English**: same flow. Use the Bug Report template. Include OS, app version, repro steps, expected vs actual, logs if it's a crash.

### 2. Sugerir una mejora / Suggesting an enhancement

Issues → **Feature Request**. Describe:
- El problema que resuelve / the problem it solves.
- La propuesta concreta / the concrete proposal.
- Alternativas consideradas / alternatives considered.
- Si es invasivo (cambia UI, build, IPC), un mockup o sketch ayuda.

### 3. Contribuir con código / Contributing code

#### Setup local

Requisitos:
- **Node.js 20 LTS** (recomendado) o Node 22. Node 18 también funciona.
- **npm** (incluido con Node).
- **Git**.
- **ffmpeg** instalado en tu sistema (en Linux: `sudo apt install ffmpeg`; en Windows: descargar de ffmpeg.org y agregar al PATH; en macOS: `brew install ffmpeg`).
- Para probar Spotify: `pip install spotdl`.

Pasos:

```bash
# 1. Fork el repo en GitHub (botón "Fork" arriba a la derecha)

# 2. Clonar tu fork
git clone https://github.com/TU-USUARIO/easy-downloader.git
cd easy-downloader

# 3. Instalar dependencias
npm install

# 4. Crear una rama para tu cambio
git checkout -b feature/mi-cambio   # o fix/mi-bug, docs/mi-doc

# 5. Arrancar la app en modo desarrollo
npm run dev

# 6. Hacer cambios, luego verificar tipos
npx tsc --noEmit
```

#### Estructura de ramas / Branching

- Rama principal: `main` (siempre deployable).
- Para cambios: rama nueva con prefijo:
  - `feature/descripcion-corta` — funcionalidad nueva.
  - `fix/descripcion-corta` — corrección de bug.
  - `refactor/descripcion-corta` — limpieza sin cambio funcional.
  - `docs/descripcion-corta` — solo documentación.
  - `security/descripcion-corta` — fix de seguridad (etiqueta con prioridad alta).

Ejemplos:
- `feature/resolution-4k-selector`
- `fix/playlist-folder-creation-race`
- `refactor/split-history-component`

#### Hacer commit / Commit messages

- Commits chicos y enfocados (un cambio lógico por commit si es posible).
- Mensajes en inglés o español, pero consistentes. El proyecto está en español en los commits iniciales pero acepta ambos.
- Formato sugerido:
  ```
  tipo(alcance): resumen corto en imperativo

  Cuerpo opcional con motivación y trade-offs.
  ```
  Donde `tipo` ∈ {`feat`, `fix`, `refactor`, `docs`, `chore`, `security`, `test`} y `alcance` es el módulo afectado (ej. `main`, `renderer`, `i18n`, `build`).

  Ejemplos:
  ```
  feat(renderer): add 4K and 2K to quality selector
  fix(main): prevent quitAndInstall without downloaded update
  docs(readme): add Debian/Ubuntu install instructions
  ```

#### Estilo de código / Code style

- **TypeScript strict** — no `any`, no `@ts-ignore` sin razón documentada.
- **No `console.log`** para debug — usa `console.error` con contexto `{ itemId, url, attempt, stage }` si vas a loguear.
- **React**: hooks al tope, no condicionales. Componentes pequeños, extraer cuando pasen ~150 líneas.
- **Tailwind**: usa tokens semánticos (`bg-primary`, `text-muted-foreground`, `border-border/60`). No hardcodear colores (`bg-blue-500` está bien solo para colores de marca como el verde Spotify).
- **i18n**: NUNCA hardcodear strings en JSX. Toda UI va por `t('clave.i18n')`. Las claves viven en `src/renderer/src/i18n/es.json` y `en.json` — si añades una, mantenlas en paridad.
- **No re-renders innecesarios**: si un componente se re-renderiza con cada tick de progreso, considera `React.memo` con comparador custom.
- **Validación**: cualquier string del renderer que llegue al main y de ahí a un `spawn`, `shell.openPath`, o URL externa, **debe** pasar por `isValidHttpUrl` (en `src/main/utils/url.ts`) o validación de path. Ver [Sprint 1 changelog](.mavis/plans/sprint-1-changelog.md) por la historia detrás.

#### Antes de hacer PR / Before opening a PR

Checklist:
- [ ] `npx tsc --noEmit` pasa limpio.
- [ ] Probaste la app en dev (`npm run dev`) y tu feature funciona.
- [ ] Si tocaste UI: probaste en tema claro Y oscuro.
- [ ] Si tocaste i18n: agregaste la clave en **ambos** `es.json` y `en.json`.
- [ ] Si es un fix de bug: añadiste un test manual (pasos para reproducir) en la descripción del PR.
- [ ] Si es código nuevo: dejaste comentarios donde la lógica no sea obvia.
- [ ] El commit message sigue el formato sugerido arriba.

#### Pull Requests

1. Push a tu fork:
   ```bash
   git push origin feature/mi-cambio
   ```
2. Abrir PR desde tu rama hacia `main` del repo upstream.
3. Llenar la plantilla del PR (qué cambia, por qué, cómo probarlo, screenshots si hay UI).
4. Responder a review comments — si hay desacuerdo, explicá tu posición con datos, no con opiniones.

### 4. Traducciones / Translations

Por ahora: Español e Inglés. Si quieres añadir un idioma (Portugués, Francés, Alemán...):
1. Fork.
2. Crea `src/renderer/src/i18n/<lang>.json` copiando `en.json` como base.
3. Traduce todos los valores (mantén las claves idénticas).
4. Añade detección del locale en `src/renderer/src/i18n/context.tsx` (función `detectLocale`).
5. Añade el botón de idioma en `App.tsx`.
6. PR con screenshots.

### 5. Reportar issues de seguridad / Security issues

**No abras un issue público.** Envía email a [joseamorenoc025@gmail.com](mailto:joseamorenoc025@gmail.com) con:
- Descripción del vulnerability.
- Pasos para reproducir.
- Impacto (qué puede hacer un atacante).
- Si lo deseas, una propuesta de fix.

Crédito en el fix release si quieres.

---

## Estructura del proyecto / Project structure

```
easy-downloader/
├── src/
│   ├── main/                 # Electron main process
│   │   ├── downloader/       # manager.ts (yt-dlp), spotdl.ts, options.ts, ffmpeg.ts, metadata.ts
│   │   ├── utils/            # url.ts (validation helper)
│   │   └── index.ts          # Window, tray, IPC handlers, lifecycle
│   ├── preload/              # Context bridge (exposes API via window.easyDownloader)
│   ├── renderer/             # React UI
│   │   ├── components/       # UI components
│   │   ├── hooks/            # Custom React hooks (useDownloads, useSettings)
│   │   ├── i18n/             # es.json, en.json, context.tsx
│   │   └── lib/              # Shared utilities (cn, formatBytes, parseBytes, isValidUrl)
│   └── types/                # TypeScript types compartidos main + preload + renderer
├── resources/                # App icons
├── .mavis/plans/             # Sprint plans, reviews, changelogs
├── .github/workflows/        # CI: build.yml (release on tag)
├── package.json              # Dependencies, scripts, electron-builder config
└── README.md
```

### ¿Dónde tocar para...? / Where to change...?

| Quiero cambiar... | Archivo |
|---|---|
| Una resolución nueva en el selector (ej. 4K) | `src/renderer/src/components/download-form.tsx` (videoQualities) + `src/main/downloader/options.ts` (VIDEO_FORMAT_MAP) |
| Una cadena de UI (texto en pantalla) | `src/renderer/src/i18n/es.json` y `en.json` |
| Un IPC handler nuevo (renderer ↔ main) | `src/main/index.ts` (handler) + `src/preload/index.ts` (exponer) + `src/types/index.ts` (tipo) |
| Cómo se descargan videos | `src/main/downloader/manager.ts` + `src/main/downloader/options.ts` |
| Cómo se descargan de Spotify | `src/main/downloader/spotdl.ts` |
| Cómo se valida una URL | `src/main/utils/url.ts` (helper compartido) |
| Config de build / packaging | `package.json` (sección `build`) + `.github/workflows/build.yml` |
| Tema / colores | `tailwind.config.js` + `src/renderer/src/styles/globals.css` |

---

## Sprint plan / Plan de sprints

El proyecto se desarrolla en sprints documentados en `.mavis/plans/`. Cada sprint tiene:
- `sprint-N-plan.yaml` — definición de tareas (qué, por qué, criterios de aceptación).
- `sprint-N-remediation.md` — alcance detallado.
- `sprint-N-changelog.md` — diff documentado de lo que se hizo.
- `sprint-N-verification.md` — verificación adversarial por code-reviewer.

Sprints completados:
- **Sprint 1** (2026-06-16): Security hardening + bug de Spotify. 8 fixes críticos/altos.
- **Sprint 2** (2026-06-18): Tech debt stabilization (tema centralizado, `React.memo`, auto-updater hardened).
- **Sprint 3** (2026-06-18): Instalador `.deb` para Debian/Ubuntu + README bilingüe + CONTRIBUTING actualizado.

Próximos sprints planeados:
- a11y (ARIA roles, focus visible, `aria-live` para progreso, lang sync) — bloqueante a11y.
- i18n: completar claves faltantes + pluralización.
- SHA256 verification del binario yt-dlp (supply chain).
- Selector de resolución 2K/4K en la UI.
- Code signing NSIS (si hay cert disponible).

Si quieres proponer un sprint, abre un issue con la etiqueta `sprint-proposal`.

---

## Licencia / License

Al contribuir, aceptás que tu código se publique bajo [MIT](LICENSE), la misma licencia del proyecto.

By contributing, you agree your code is published under [MIT](LICENSE), the project's license.