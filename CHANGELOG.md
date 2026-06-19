# Changelog

Todos los cambios notables en este proyecto se documentan en este archivo.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/)
y el proyecto adhiere a [Versionado Semántico](https://semver.org/lang/es/).

> All notable changes are also documented in English at the bottom of this file.

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