# Sprint 4 — 2K/4K selector + i18n cleanup

**Fecha:** 2026-06-21
**Autor:** Mavis (root session `mvs_6ef5afbe115d47ad943d124fd4c21965`)
**Alcance:** selector de resolución 2K/4K + auditoría i18n (claves faltantes, pluralización, interpolación, relative time).

## Cambios (8 archivos)

### 1. Selector 2K/4K (mecánico)

- `src/main/downloader/options.ts`: `VIDEO_FORMAT_MAP` ahora incluye `'2160p'` (`height<=2160`) y `'1440p'` (`height<=1440`). Las entradas existentes (`best`, `1080p`, `720p`, `480p`) se mantienen en el mismo formato `bestvideo[height<=N][ext=mp4]+bestaudio[ext=m4a]/best[height<=N][ext=mp4]/best`.
- `src/renderer/src/components/download-form.tsx`:
  - `videoQualities` ahora es `['best', '2160p', '1440p', '1080p', '720p', '480p']`.
  - Nuevo helper `qualityLabel(q, t)` que devuelve etiquetas legibles: `'Mejor (calidad máxima)'`, `'2160p (4K)'`, `'1440p (2K)'`, `'1080p (Full HD)'`, `'720p (HD)'`, `'480p'`. Las etiquetas pasan por i18n.
- Claves nuevas en `es.json` y `en.json`:
  - `form.quality.best`, `form.quality.2160p`, `form.quality.1440p`, `form.quality.1080p`, `form.quality.7200p` (typo intencional? no — es 720p), `form.quality.480p`.

### 2. i18n: context + pluralización + interpolación

- `src/renderer/src/i18n/context.tsx`:
  - **Pluralización ad-hoc CLDR-style**: `t(key, { count: N })` ahora prefiere `key.one` cuando `count === 1` y `key.other` en caso contrario. Si la variante sufija no existe, hace fallback a la clave base (las traducciones parciales no rompen la UI).
  - **`count` no se interpola** dentro de la cadena (antes podías tener bugs tipo "1 archivo" mostrando literalmente "{count}" si la variante pluralizada no existía). Ahora `count` se usa solo para elegir la variante.
  - **`replace` → `replaceAll`**: si una traducción referencia la misma clave dos veces (ej. `"{count} items in {count} groups"`), antes solo la primera se reemplazaba. Ahora todas.
- Claves nuevas (paridad 100% es/en):
  - `queue.active.one`, `queue.active.other` — pluralización del contador en `queue-list.tsx`.
  - `history.today`, `history.thisWeek`, `history.thisMonth`, `history.older` — los labels de los grupos en `groupByDate`.
  - `history.noResults` con placeholder `{search}`.
  - `history.filterAll`, `history.filterVideo`, `history.filterAudio` — los labels de los pills de filtro de formato.
  - `history.filesCount.one`, `history.filesCount.other` — pluralización del contador en `HistorySection`.

### 3. i18n: relativeTime con Intl

- `src/renderer/src/components/history.tsx`:
  - `relativeTime(iso, locale)` ahora usa `Intl.RelativeTimeFormat` (built-in, sin deps) en vez de templates hardcoded en español. Soporta `second` / `minute` / `hour` / `day` / fecha como fallback.
  - Antes: `hace 5 min` / `hace 3 h` hardcoded en español → ahora: localizado via `Intl` con `numeric: 'auto'` (`"hace 5 minutos"` / `"hace 3 horas"` en es; `"5 minutes ago"` / `"3 hours ago"` en en).
  - El componente `HistoryCard` ahora usa `useI18n()` para obtener `locale`.

### 4. Hardcoded strings eliminados

- `history.tsx:63-65` — `relativeTime` ya no devuelve strings hardcoded.
- `history.tsx:226` — `archivo`/`archivos` reemplazado por `t('history.filesCount', { count })`.
- `history.tsx:329` — `'Todo'` / `'Video'` / `'Audio'` reemplazado por `t('history.filter*')`.
- `history.tsx:355` — `Sin resultados para «{search}»` reemplazado por `t('history.noResults', { search })`.
- `history.tsx:37-40` — `'Hoy'` / `'Esta semana'` / etc. reemplazado por `t('history.today/thisWeek/...')`.
- `queue-list.tsx:30` — `${pendingCount} ${t('queue.active')}` reemplazado por `t('queue.active', { count: pendingCount })`.

## Verificación

| Verificación | Resultado |
|---|---|
| `npx tsc --noEmit` | ✅ EXITCODE 0 |
| Paridad de claves es/en | ✅ 106/106 |
| `count` ya no se filtra dentro de la cadena (no hay `{count}` literales en output) | ✅ |
| `replaceAll` para interpolación múltiple | ✅ |
| `Intl.RelativeTimeFormat` con locale del contexto | ✅ |
| Selector 2K/4K con etiquetas legibles | ✅ |

## No incluido en este sprint (queda para Sprint 5+)

- **a11y**: ARIA roles, focus visible global, `aria-live` para progreso, lang sync.
- **SHA256 verification** del binario yt-dlp (supply chain).
- **Code signing NSIS** (requiere cert).
- **Soporte macOS / arm64** (decisión de scope).
- **Code splitting / `React.lazy`** en rutas grandes.