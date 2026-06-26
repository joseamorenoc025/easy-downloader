# Changelog

Todos los cambios notables en este proyecto se documentan en este archivo.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/)
y el proyecto adhiere a [Versionado Semántico](https://semver.org/lang/es/).

> All notable changes are also documented in English at the bottom of this file.

---

## [2.3.0] - 2026-06-25

### Added
- **Cookies para YouTube**: importación de cookies en formato Netscape desde el header. El manager pasa `--cookies` a yt-dlp para acceder a contenido autenticado (age-restricted, privado). Persiste la ruta en electron-store.
- **Editor de metadatos ID3**: al descargar audio, se extraen metadatos vía `yt-dlp --dump-json` y se muestra un modal editable (título, artista, álbum, año, género, pista). Se aplica `--replace-in-metadata` + `--embed-thumbnail --add-metadata`.
- **Notificaciones de descarga**: toggle on/off en el header. Notificación nativa del SO al completar cada descarga.
- **Modo portable**: detección automática por `--portable` en argv, variable de entorno o nombre del directorio. `app.setPath('userData', ...)` redirige datos a `portable-data/` junto al ejecutable.
- **6 presets de conversión**: Music (256 kbps), Podcast (192 kbps mono), Archival (320 kbps), Social Media (128 kbps), Video HD (1080p), Video SD (480p). Cada preset aplica flags automáticos de yt-dlp.
- **Selector de carpeta de descargas**: dropdown en el header con opciones "Abrir carpeta" y "Cambiar carpeta". Selector nativo de directorio con toast de confirmación al cambiar.
- **USB / ruta dinámica**: `setDownloadPath()` actualiza managers en tiempo real al cambiar la carpeta desde el selector.
- **show-in-folder**: resalta el archivo descargado en el explorador del SO (reemplaza open-folder).
- **Historial session-only**: almacena en memoria durante la sesión, sin persistencia a disco.
- **Layout contextual dual-pane**: StatsCard con controles de sesión como pills row, eliminando espacio desperdiciado.
- **Paleta Electric Indigo & Slate**: rediseño completo de colores con tokens CSS semánticos.

### Changed
- **107 tests** (de 93 a 107): tests de presets, IPC channels, get-settings shape (8 campos), setDownloadPath, session history cap (200), show-in-folder, check-file-exists, set-cookies-path, set-notifications, set-max-concurrent.
- **Historial simplificado**: lista simple sin grid cards, sin botón re-download, sin cleanup por días. Solo "Clear session".
- **Botón Historial eliminado del header**: historial solo accesible como lista inline en la cola.
- **electron-builder 26.8.1**: versión fija para evitar regressions de schema validation en 26.15.x.
- **BaseDownloadManager**: clase abstracta que elimina ~40% de duplicación entre DownloadManager y SpotifyDownloadManager.
- **ErrorCategory + classifyYtDlpError**: 9 categorías de error con clasificación case-insensitive y preservación de stderr raw.
- **Progress throttle 3 capas**: 200ms main, 150ms renderer buffer, 500ms NetworkStats.

### Fixed
- **USB / external drive downloads**: `select-directory` ahora llama `setDownloadPath()` en managers corriendo, no solo en la store.
- **yt-dlp-wrap progress regex**: el regex del wrapper estaba roto para yt-dlp actual. Se parsea del raw `ytDlpEvent` tipo `download`.

### Removed
- Botón "Historial" del header (UI más limpia).
- Drawer de historial (backdrop + spring animation).
- Persistencia de historial a electron-store (session-only).
- `prune-history` IPC (ya no necesario).
- `historyMaxAge` de Settings y store defaults.
- `fuse.js` de dependencias (ya no necesario desde v2.2.0).

---

# English summary

## [2.3.0] - 2026-06-25
- **YouTube cookies**: Netscape cookie import from header. Manager passes `--cookies` to yt-dlp for authenticated content. Path persisted in electron-store.
- **ID3 metadata editor**: audio downloads extract metadata via `yt-dlp --dump-json`, show editable modal (title, artist, album, year, genre, track), apply `--replace-in-metadata` + `--embed-thumbnail --add-metadata`.
- **Download notifications**: on/off toggle in header. Native OS notification on each download completion.
- **Portable mode**: auto-detection via `--portable` argv, env var, or directory name. `app.setPath('userData', ...)` redirects data to `portable-data/` next to the executable.
- **6 conversion presets**: Music (256 kbps), Podcast (192 kbps mono), Archival (320 kbps), Social Media (128 kbps), Video HD (1080p), Video SD (480p). Each preset applies automatic yt-dlp flags.
- **Download folder selector**: dropdown in header with "Open folder" and "Change folder" options. Native directory picker with toast confirmation.
- **USB / dynamic path**: `setDownloadPath()` updates running managers in real-time when folder is changed.
- **show-in-folder**: highlights downloaded file in the OS file explorer (replaces open-folder).
- **Session-only history**: in-memory during session, no disk persistence.
- **Contextual dual-pane layout**: StatsCard with session controls as pills row, eliminating wasted vertical space.
- **Electric Indigo & Slate palette**: complete color redesign with semantic CSS tokens.
- **107 tests** (from 93 to 107): presets, IPC channels, get-settings shape (8 fields), setDownloadPath, session history cap (200), show-in-folder, check-file-exists, set-cookies-path, set-notifications, set-max-concurrent.
- **Simplified history**: simple list without grid cards, no re-download button, no day-based cleanup. Only "Clear session".
- **History button removed from header**: history only accessible as inline list in queue.
- **Fixed USB/external drive downloads**: `select-directory` now calls `setDownloadPath()` on running managers, not just in store.
- **Fixed yt-dlp-wrap progress regex**: wrapper regex was broken for current yt-dlp. Parses from raw `ytDlpEvent` type `download`.

---

## [2.2.0] - 2026-06-19

### Added
- **Spotify nativo**: reemplazo completo de `spotdl` con un wrapper propio usando `spotify-url-info` + `yt-dlp`. Sin dependencia de Python ni pip. Descarga tracks, álbumes y playlists directamente desde la UI.
- **Selector de calidad de audio**: 320, 256, 192 o 128 kbps para descargas de Spotify. Pipeline completo: form → hook → IPC → yt-dlp args.
- **YouTube search vía scraping**: búsqueda de videos usando `node:https` para parsear `ytInitialData` del HTML de resultados. Elimina la dependencia de `ytsearch` de yt-dlp (bloqueado por YouTube con 403).
- **Toast notifications**: notificaciones visuales con `framer-motion` para errores individuales en playlists.
- **Selector de calidad de video**: 480p hasta mejor calidad disponible.
- **Botón "Volver a la cola"** en el estado vacío del historial.

### Changed
- Footer actualizado: "Construido por José Moreno" + enlace para dejar estrella en GitHub.
- README reescrito con documentación del motor nativo de Spotify y diagrama de componentes.
- CONTRIBUTING.md actualizado con estructura de archivos actualizada (spotify-native.ts, ytdlp-search.provider.ts).
- Descripción de package.json actualizada.
- `node:https` reemplaza `globalThis.fetch` en el scraper de YouTube para compatibilidad con Electron.

### Removed
- Eliminado `spotdl.ts` (reemplazado por `spotify-native.ts`).
- Eliminado fuzzy matcher y search cache (ya no son necesarios).
- Eliminado `fuse.js` de dependencias.

---

# English summary

## [2.2.0] - 2026-06-19
- **Native Spotify**: complete `spotdl` replacement using `spotify-url-info` + `yt-dlp`. No Python or pip needed. Downloads tracks, albums, and playlists directly from the UI.
- **Audio quality selector**: 320, 256, 192, or 128 kbps for Spotify downloads. Full pipeline: form → hook → IPC → yt-dlp args.
- **YouTube search via scraping**: searches videos using `node:https` to parse `ytInitialData` from result HTML. Removes dependency on yt-dlp's `ytsearch` (blocked by YouTube with 403).
- **Toast notifications**: visual notifications with `framer-motion` for individual track errors in playlists.
- **Video quality selector**: 480p to best available quality.
- **"Back to queue" button** in history empty state.
- Footer updated: "Built by José Moreno" + GitHub star prompt.
- README rewritten with native Spotify engine documentation and component diagram.

---

## [2.1.0] - 2026-06-18

### Added
- **Sprint 3 — Instalador `.deb` para Debian/Ubuntu**: `electron-builder` ya configurado para producir `EasyDownloader-*.deb`. CI workflow incluye `dpkg` y `fakeroot` en el runner Ubuntu. Dependencias declaradas en `package.json:linux.deb.depends` (`libgtk-3-0`, `libnss3`, `libnotify4`, etc.) para que `apt` las resuelva automáticamente en la instalación.
- README bilingüe (Español + English) con instrucciones de instalación para Windows / Debian / Ubuntu / Fedora / macOS, troubleshooting, FAQ y lista completa de sitios soportados por yt-dlp.
- CONTRIBUTING.md actualizado con setup de desarrollo, branching, estilo de código y flujo de PRs.

### Changed
- `package.json:linux` ahora incluye `synopsis`, `description` y bloque `deb.depends`. El instalador `.deb` resultante se registra correctamente en el menú de aplicaciones con icono y `.desktop` file auto-generado por electron-builder.
- `CHANGELOG.md` reescrito con todos los sprints (1, 2 y 3) en orden cronológico.

### Verification
- `npx tsc --noEmit` → ✅ EXITCODE 0
- `.deb` config válida según spec de electron-builder v26

---

## [2.0.0] - 2026-06-16

### Security (Sprint 1)
- `webPreferences`: `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false` explícitos.
- CSP estricta añadida en `src/renderer/index.html` (permite Google Fonts, bloquea inline scripts y connect-src externo).
- `spotdl` spawn ahora usa `shell: false` + validación de URL. Resuelve dos issues en un cambio:
  - **Command injection CRÍTICO**: con `shell: true`, un URL malicioso del renderer podía ejecutar código arbitrario.
  - **Bug funcional "Spotify guarda en raíz del proyecto"**: con `shell: true` y paths con espacios (ej. `Mi Música/`), el shell rompía el argumento `--output` y spotdl caía al cwd.
- `setWindowOpenHandler` valida protocolo antes de `shell.openExternal` (bloquea `ms-settings:`, `file://`, `javascript:`, etc.).
- `open-folder` IPC valida que el path esté dentro de `downloadPath` configurado.
- Validación de URL en `fetch-metadata`, `add-download`, `add-spotify-download` (IPC handlers) + defense-in-depth en `DownloadManager.startDownload`. Helper compartido en `src/main/utils/url.ts`.
- `process.on('unhandledRejection')` y `uncaughtException` añadidos al main process.
- `app.on('before-quit')` mata hijos (`cancelAll()`) con 500ms de gracia + handlers `SIGTERM`/`SIGINT`.

### Refactor (Sprint 2)
- **Tema centralizado**: `applyTheme` movido a un único lugar en `useSettings`. Borrado el `useEffect` duplicado en `App.tsx` que producía flash de tema al arrancar. `ThemeMode` reducido de 6 valores a 3 (light/dark/system) — los valores `dracula/nord/cyberpunk` no tenían tokens CSS definidos.
- **Re-renders**: `React.memo(QueueItem)` con comparador custom. Un tick de progreso re-renderiza solo el item afectado, no los N items de la cola. Stagger de animación capeado a 8 items.
- **DRY**: `parseBytes` movido de `use-downloads.ts` a `src/renderer/src/lib/utils.ts`.
- **Auto-updater hardened**: `autoDownload` solo en builds packaged (en dev no escupe errores). Flag `isUpdateDownloaded` valida antes de `quitAndInstall`. Listeners `update-not-available` y `update-cancelled` añadidos.
- **Cleanup**: prop muerta `onMetadata` removida de `DownloadForm`. `lucide-react` quitado de devDependencies (cero imports, ~150KB liberados). `isMounted` guard en `useDownloads` bootstrap. `.catch()` en `checkDependencies` calls (era unhandled promise rejection).

### UI
- Transiciones con `framer-motion`.
- Upgrade a Electron 42.3.3.
- `App.tsx` refactor (Header, Main, Footer); `download-form`, `history`, `queue-item`, `queue-list` rediseñados.
- Hook `use-settings` mejorado; `globals.css` refinado con tokens semánticos.

---

## [1.0.0] - 2026-05-23

### Added
- Interfaz gráfica principal con `Electron + React + Tailwind`.
- Integración con `yt-dlp` para descargas de video y extracción de audio.
- Integración con `spotdl` para descargas de Spotify.
- Sistema de cola de descargas con concurrencia configurable.
- Soporte para formatos MP4 y MP3, con selector de resolución.
- i18n Español / English.
- Historial de descargas con búsqueda y re-descarga.
- Metadata preview antes de descargar.
- Auto-updater via GitHub Releases.
- Minimizar a system tray.
- Queue persistente entre reinicios.

---

# English summary

## [2.1.0] - 2026-06-18
- **Sprint 3**: `.deb` installer for Debian/Ubuntu. CI now installs `dpkg`/`fakeroot` on the Ubuntu runner. `linux.deb.depends` lists runtime libs (`libgtk-3-0`, `libnss3`, etc.) so `apt` resolves them automatically.
- Bilingual README (Spanish + English) with install instructions, troubleshooting, FAQ, and yt-dlp supported sites list.
- CONTRIBUTING.md updated with dev setup, branching model, code style, PR flow.

## [2.0.0] - 2026-06-16
- **Sprint 1 (Security)**: `sandbox: true`, strict CSP, `shell: false` + URL validation in spotdl (fixes CRITICAL command injection AND the Spotify path bug), protocol/path validation in window-open and open-folder IPCs, URL validation in all download handlers, `unhandledRejection`/`uncaughtException` handlers, `before-quit` cleanup + SIGTERM/SIGINT.
- **Sprint 2 (Tech debt)**: Centralized theme (kill flash of wrong theme), reduced `ThemeMode` to 3 values, `React.memo(QueueItem)` with custom comparator, `parseBytes` moved to `lib/utils`, auto-updater hardened (no-op in dev, `isUpdateDownloaded` flag), removed dead `onMetadata` prop and unused `lucide-react` dep, `.catch()` on `checkDependencies`.
- UI work: `framer-motion` transitions, Electron 42.3.3 upgrade, App.tsx refactor, component redesigns.

## [1.0.0] - 2026-05-23
- Initial Electron + React + Tailwind rewrite.
- yt-dlp and spotdl integration, download queue, i18n, history, metadata preview, auto-updater, system tray, persistent queue.