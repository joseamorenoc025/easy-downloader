# Sprint 2 — Tech debt stabilization

**Fecha:** 2026-06-18
**Autor:** Mavis (root session `mvs_6ef5afbe115d47ad943d124fd4c21965`)
**Alcance:** tema, re-renders, auto-updater, código muerto. Sin cambios de seguridad.

## Cambios (9 archivos, +166 / -86)

### 1. Auto-updater hardening (`src/main/index.ts`)

- `autoDownload` y `autoInstallOnAppQuit` solo se activan en builds empaquetados. En dev (`app.isPackaged === false`) electron-updater no tiene `app-update.yml` y emite errores constantes.
- Handler `update-not-available` añadido (silencioso — el chequeo de los 3s post-arranque no debe hacer spam; el botón manual "Check for updates" puede mostrar feedback en otro momento).
- Handler `update-cancelled` añadido para resetear el flag `isUpdateDownloaded`.
- Flag `isUpdateDownloaded` (let) rastrea si hay un update realmente descargado. El handler `quit-and-install` IPC y el `notif.on('click')` lo consultan antes de llamar `autoUpdater.quitAndInstall()` — antes podía invocarse en cualquier momento y crashear la app si no había update.
- El error handler ahora suprime el log en dev (`!isPackaged`).
- `setTimeout` del check inicial está envuelto en `if (isPackaged)`.

### 2. Tema centralizado (`src/renderer/src/hooks/use-settings.ts` + `src/types/index.ts` + `src/renderer/src/App.tsx`)

- `applyTheme` movido a un único lugar en `use-settings.ts`. Se exporta como función interna del módulo.
- Borrado el `useEffect` duplicado de `App.tsx:32-42` que sincronizaba `documentElement.classList` con `settings.themeMode` (race con `useSettings.bootstrap` que producía flash de tema al arrancar).
- `ThemeMode` reducido de 6 valores a 3: `light` | `dark` | `system`. Los valores `dracula` / `nord` / `cyberpunk` estaban en el tipo pero `applyTheme` solo añadía la clase `theme-${mode}` sin tokens CSS definidos en `globals.css` — publicidad falsa. Se quitan del tipo, y la lógica correspondiente (`CUSTOM_THEMES`, branch de `applyTheme`, `root.classList.remove('theme-dracula'...)`) se borra.
- Type guard `isThemeMode` para narrowing defensivo de valores persistidos en `electron-store` que puedan ser literales viejos.
- `updateTheme` y `selectDirectory` ahora usan `useCallback` (antes se re-creaban en cada render, re-pendulaban hooks consumidores).
- Cleanup con `cancelled` flag en el bootstrap para evitar `setState` post-unmount.

### 3. Re-renders en cola (`src/renderer/src/components/queue-item.tsx` + `use-downloads.ts`)

- `QueueItem` envuelto en `React.memo` con comparador custom. Ahora cuando un item recibe `download-progress`, **solo ese item re-renderiza**; los otros N-1 de la lista no.
- El comparador incluye los campos que la card realmente muestra: `id, status, title, format, quality, progress, speed, eta, error, outputPath`. Cualquier cambio en `progress/speed/eta` re-renderiza (correcto, la barra se actualiza). Cambios en `downloadedBytes/totalBytes` ya no re-renderizan (esos bytes se computan en `useDownloads` pero la card no los muestra).
- El `delay: index * 0.04` está capeado a `Math.min(index, 8) * 0.04` para que la animación de stagger no se sienta lenta con colas de 10+ items.
- `statusDot` y `statusKeys` ahora tienen tipo `Record<DownloadItem['status'], string>` (antes `Record<string, ...>` con fallbacks innecesarios). Se elimina el `|| 'bg-muted-foreground/30'` defensivo.
- `parseBytes` movido de `use-downloads.ts` a `src/renderer/src/lib/utils.ts` (DRY — ya existía `formatBytes` allí).

### 4. Cleanup (`src/renderer/src/components/download-form.tsx` + `package.json`)

- `onMetadata?: (meta: MetadataResult) => void` prop de `DownloadForm` removido. Era código muerto: el único call site era `App.tsx:181` que no lo pasaba, y dentro de `download-form.tsx:65-72` solo se ejecutaba `fetchMetadata` + `onMetadata(meta)` con un `try/catch` que silenciaba errores. La metadata ya se muestra vía `MetadataPreview` (que llama `fetchMetadata` por su cuenta), así que la prop nunca se usaba.
- `lucide-react` quitado de `package.json` devDependencies. Cero imports en el código (verificado por grep). Liberaba ~150KB no tree-shakeable.
- `useDownloads.bootstrap` ahora trackea `isMounted` ref para evitar `setQueue` post-unmount (HMR / tests rápidos).
- `checkDependencies` y `handleRetryYtdlp` en `App.tsx` ahora tienen `.catch(...)` para evitar unhandled promise rejection (BLOQUEANTE para tests, ALTA para producción, según el review).
- `useDownloads` y `useSettings` importan `parseBytes` desde `lib/utils`; ya no hay duplicación.

## No incluido en este sprint (queda para Sprint 3+)

- a11y (ARIA, focus, lang sync, aria-live) — bloqueante a11y, separado por scope.
- i18n — claves faltantes, pluralización, `replaceAll` en interpolación.
- SHA256 verification del binario yt-dlp (supply chain).
- Code signing NSIS, soporte macOS / arm64.
- Code splitting / `React.lazy` en rutas grandes.

## Verificación

| Verificación | Resultado |
|---|---|
| `npx tsc --noEmit` | ✅ EXITCODE 0 |
| `lucide-react` removido, sin imports residuales | ✅ |
| `onMetadata` removido, sin call sites residuales | ✅ |
| `ThemeMode` ahora 3 valores, sin literales huérfanos | ✅ |
| `parseBytes` un solo lugar (`lib/utils.ts`) | ✅ |
| `React.memo` aplicado con comparador custom | ✅ |
| Auto-updater no se inicializa en dev | ✅ |
| `quit-and-install` valida download antes de actuar | ✅ |
