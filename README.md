# EasyDownloader

> App de escritorio para descargar videos y audio. Funciona con **yt-dlp** (no solo YouTube — soporta ~1700 sitios) y **spotdl** (Spotify).
>
> Cross-platform desktop app to download videos and audio. Works with **yt-dlp** (not just YouTube — supports ~1700 sites) and **spotdl** (Spotify).

[🇪🇸 Español](#español) · [🇬🇧 English](#english)

---

## Español

### ¿Qué es EasyDownloader?

Una app de escritorio multiplataforma (Windows / Linux / macOS) construida con Electron + React + Tailwind. Pegas una URL, eliges formato (MP4 video o MP3 audio), y se descarga. Internamente usa [yt-dlp](https://github.com/yt-dlp/yt-dlp) — el mismo motor que youtube-dl pero mantenido y mucho más compatible — y [spotdl](https://github.com/spotDL/spotify-downloader) para Spotify.

### Características

- **~1700 sitios soportados** vía yt-dlp: YouTube, Vimeo, Twitter/X, TikTok, Reddit, SoundCloud, Twitch, Bandcamp, archive.org, bilibili, dailymotion, y muchos más.
- **Spotify**: tracks individuales, álbumes y playlists (requiere `spotdl` instalado).
- **Cola de descargas** con hasta 3 simultáneas.
- **Metadata preview** antes de descargar (thumbnail, título, duración).
- **Historial** con búsqueda y re-descarga.
- **i18n**: Español e Inglés.
- **Tema claro / oscuro** (sigue al sistema).
- **System tray**: minimiza a la bandeja, doble-click restaura.
- **Auto-updater**: notifica cuando hay versión nueva en GitHub Releases.
- **Drag & drop** y **Ctrl+V global** para pegar URLs.
- **Cola persistente**: sobrevive reinicios.

### Instalación

#### Windows

1. Descarga `EasyDownloader-Setup-2.x.x.exe` desde [Releases](https://github.com/joseamorenoc025/easy-downloader/releases/latest).
2. Ejecuta el instalador NSIS (es seguro pese al SmartScreen — el binario está **sin firma** porque no tengo certificado; si Windows te avisa, click "More info" → "Run anyway").
3. Listo. La app crea un acceso directo en escritorio y menú inicio.

#### Debian / Ubuntu (`.deb`)

1. Descarga `easy-downloader_2.x.x_amd64.deb` desde [Releases](https://github.com/joseamorenoc025/easy-downloader/releases/latest).
2. Instálalo:
   ```bash
   sudo dpkg -i easy-downloader_2.x.x_amd64.deb
   sudo apt-get install -f   # resuelve dependencias si faltan
   ```
   O simplemente doble-click en el archivo `.deb` y usa el instalador gráfico.

3. Las dependencias se instalan automáticamente via `apt` (gracias a `linux.deb.depends` en `package.json`): `libgtk-3-0`, `libnss3`, `libnotify4`, `libxss1`, etc.

4. Lanza desde el menú de aplicaciones o por terminal:
   ```bash
   easy-downloader
   ```

#### Fedora / otras distros (`.rpm` o AppImage)

- **AppImage**: descarga `EasyDownloader-2.x.x.AppImage`, `chmod +x`, doble-click. Es universal, no requiere instalación.
  ```bash
  chmod +x EasyDownloader-2.x.x.AppImage
  ./EasyDownloader-2.x.x.AppImage
  ```

#### macOS

> ⚠️ **No hay builds de macOS todavía.** El código tiene branching a `darwin`, pero no he generado instaladores firmados para macOS (requiere cuenta de developer de Apple y certificado de notarización, que no tengo). Si lo necesitas, mira [Sprint plan en el repo](https://github.com/joseamorenoc025/easy-downloader/issues) o ábrelo desde código (`npm run dev`).

### Dependencias externas

| Dependencia | Para qué se usa | Cómo se instala |
|---|---|---|
| **yt-dlp** | Descargar de YouTube y otros ~1700 sitios | Se descarga **automáticamente** la primera vez que arrancas la app |
| **ffmpeg** | Convertir audio a MP3, mezclar video+audio | Incluido en el instalador. En Debian/Ubuntu también: `sudo apt install ffmpeg` |
| **spotdl** (opcional) | Descargar de Spotify | `pip install spotdl` |

### Uso básico

1. Arranca la app.
2. Pega una URL en el campo de texto (o Ctrl+V en cualquier lado de la app, o arrastra el enlace).
3. Elige formato: **Video (MP4)** o **Audio (MP3)**.
4. Elige calidad.
5. Click **Descargar**. El item aparece en la cola; cuando termina se mueve al historial.
6. Para abrir la carpeta donde se descargó, click en el item completado → "Abrir carpeta".

### FAQ

**P: ¿Solo funciona con YouTube?**
R: No. yt-dlp soporta ~1700 sitios: YouTube, Vimeo, Twitter/X, TikTok, SoundCloud, Twitch, Reddit, Bandcamp, bilibili, archive.org, y mucho más. La UI dice "YouTube" en los toggles pero internamente cualquier URL soportada por yt-dlp funciona. Ver [lista completa](https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md).

**P: ¿Por qué no veo 2K / 4K en el selector de calidad?**
R: Porque la UI actual solo expone hasta 1080p. Para añadir 2K/4K hay que tocar `download-form.tsx` y `options.ts` — está planeado para una versión futura. Mientras tanto puedes usar el preset `best` que descarga la mejor calidad disponible (incluye 4K si el video la tiene).

**P: ¿Por qué el `.exe` me sale warning de SmartScreen?**
R: Porque no tengo certificado de code signing (cuesta ~$200-400/año). Es un binario legítimo pero Windows no lo sabe sin firma. Click "More info" → "Run anyway". Cuando el proyecto lo justifique, compraré un cert.

**P: ¿Spotify me pide instalar `spotdl`, eso es seguro?**
R: Sí. `spotdl` es open source (GitHub: spotDL/spotify-downloader) y se instala vía pip oficial.

**P: ¿Puedo contribuir?**
R: Sí. Lee [CONTRIBUTING.md](CONTRIBUTING.md).

### Troubleshooting

**La app no descarga nada / se queda en "queued":**
- Revisa el banner de dependencias al inicio. Si yt-dlp está rojo, click "Retry" — la app intenta bajarlo de nuevo.
- Verifica conexión a internet.

**Spotify no descarga nada:**
- Necesitas `spotdl` instalado. `pip install spotdl` en una terminal.

**Audio sale sin video o viceversa:**
- ffmpeg no está en PATH. En Windows descarga de [ffmpeg.org](https://ffmpeg.org/download.html) y agrégalo al PATH. En Linux: `sudo apt install ffmpeg`.

**Error "spawn EINVAL" en Windows:**
- Bug conocido de Node 22 + spawn en Windows. La solución es usar Node 20 LTS o esperar a que Electron 43+ traiga Node actualizado.

**Linux: la app no abre / crashea al inicio:**
- Probablemente faltan librerías. Ejecuta desde terminal para ver el error:
  ```bash
  easy-downloader
  ```
- Instala las deps listadas en `package.json:linux.deb.depends`.

### Licencia

MIT — ver [LICENSE](LICENSE).

---

## English

### What is EasyDownloader?

A cross-platform desktop app (Windows / Linux / macOS) built with Electron + React + Tailwind. Paste a URL, choose format (MP4 video or MP3 audio), and download. Under the hood it uses [yt-dlp](https://github.com/yt-dlp/yt-dlp) — the same engine as youtube-dl but actively maintained and much more compatible — and [spotdl](https://github.com/spotDL/spotify-downloader) for Spotify.

### Features

- **~1700 supported sites** via yt-dlp: YouTube, Vimeo, Twitter/X, TikTok, Reddit, SoundCloud, Twitch, Bandcamp, archive.org, bilibili, dailymotion, and more.
- **Spotify**: individual tracks, albums and playlists (requires `spotdl`).
- **Download queue** with up to 3 concurrent.
- **Metadata preview** before downloading (thumbnail, title, duration).
- **Searchable history** with re-download.
- **i18n**: Spanish and English.
- **Light / dark theme** (follows system).
- **System tray**: minimize to tray, double-click to restore.
- **Auto-updater**: notifies on new GitHub Releases.
- **Drag & drop** and **global Ctrl+V** to paste URLs.
- **Persistent queue**: survives restarts.

### Installation

#### Windows

1. Download `EasyDownloader-Setup-2.x.x.exe` from [Releases](https://github.com/joseamorenoc025/easy-downloader/releases/latest).
2. Run the NSIS installer (SmartScreen will warn because the binary is **unsigned** — I don't have a certificate; click "More info" → "Run anyway").
3. Done. App creates a desktop shortcut and start menu entry.

#### Debian / Ubuntu (`.deb`)

1. Download `easy-downloader_2.x.x_amd64.deb` from [Releases](https://github.com/joseamorenoc025/easy-downloader/releases/latest).
2. Install:
   ```bash
   sudo dpkg -i easy-downloader_2.x.x_amd64.deb
   sudo apt-get install -f   # resolves missing dependencies
   ```
   Or just double-click the `.deb` and use the graphical installer.

3. Dependencies install automatically via `apt` (declared in `package.json:linux.deb.depends`): `libgtk-3-0`, `libnss3`, `libnotify4`, `libxss1`, etc.

4. Launch from the applications menu or terminal:
   ```bash
   easy-downloader
   ```

#### Fedora / other distros (AppImage)

- **AppImage**: download `EasyDownloader-2.x.x.AppImage`, `chmod +x`, double-click. Universal, no install required.
  ```bash
  chmod +x EasyDownloader-2.x.x.AppImage
  ./EasyDownloader-2.x.x.AppImage
  ```

#### macOS

> ⚠️ **No macOS builds yet.** The code has `darwin` branching but I haven't generated signed macOS installers (requires Apple Developer account + notarization cert, which I don't have). If you need it, follow the [issue tracker](https://github.com/joseamorenoc025/easy-downloader/issues) or build from source (`npm run dev`).

### External dependencies

| Dependency | Used for | How to install |
|---|---|---|
| **yt-dlp** | YouTube + ~1700 other sites | **Auto-downloaded** on first launch |
| **ffmpeg** | Audio conversion to MP3, muxing | Bundled in installer. Debian/Ubuntu: `sudo apt install ffmpeg` |
| **spotdl** (optional) | Spotify downloads | `pip install spotdl` |

### Basic usage

1. Launch the app.
2. Paste a URL (Ctrl+V anywhere in the app, or drag & drop).
3. Choose format: **Video (MP4)** or **Audio (MP3)**.
4. Choose quality.
5. Click **Download**. Item appears in the queue; when done it moves to history.
6. To open the download folder, click the completed item → "Open folder".

### FAQ

**Q: Does this only work with YouTube?**
A: No. yt-dlp supports ~1700 sites: YouTube, Vimeo, Twitter/X, TikTok, SoundCloud, Twitch, Reddit, Bandcamp, bilibili, archive.org, and much more. The UI says "YouTube" in toggles but internally any yt-dlp-supported URL works. See [full list](https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md).

**Q: Why don't I see 2K / 4K in the quality selector?**
A: Because the current UI only exposes up to 1080p. Adding 2K/4K requires touching `download-form.tsx` and `options.ts` — planned for a future version. Meanwhile you can use the `best` preset which downloads the best available quality (including 4K if the video has it).

**Q: Why does the `.exe` trigger a SmartScreen warning?**
A: Because I don't have a code signing certificate (costs ~$200-400/year). It's a legitimate binary but Windows can't verify that without a signature. Click "More info" → "Run anyway". When the project justifies it, I'll buy a cert.

**Q: Is `spotdl` safe to install?**
A: Yes. `spotdl` is open source (GitHub: spotDL/spotify-downloader) and installs via official pip.

**Q: Can I contribute?**
A: Yes. See [CONTRIBUTING.md](CONTRIBUTING.md).

### Troubleshooting

**App doesn't download / stuck on "queued":**
- Check the dependencies banner at startup. If yt-dlp is red, click "Retry" — the app tries to download it again.
- Verify your internet connection.

**Spotify doesn't download:**
- You need `spotdl` installed. `pip install spotdl` in a terminal.

**Audio comes out without video (or vice versa):**
- ffmpeg is not in PATH. On Windows download from [ffmpeg.org](https://ffmpeg.org/download.html) and add to PATH. On Linux: `sudo apt install ffmpeg`.

**Windows: "spawn EINVAL" error:**
- Known issue with Node 22 + spawn on Windows. Workaround: use Node 20 LTS or wait for Electron 43+ to ship newer Node.

**Linux: app won't open / crashes at launch:**
- Probably missing libraries. Run from terminal to see the error:
  ```bash
  easy-downloader
  ```
- Install the deps listed in `package.json:linux.deb.depends`.

### License

MIT — see [LICENSE](LICENSE).

---

## Tech stack

- **Frontend**: React 18 + TypeScript + Tailwind CSS
- **Backend**: Electron 42 + electron-vite
- **Downloads**: yt-dlp-wrap (yt-dlp), spotdl (Spotify)
- **Packaging**: electron-builder + electron-updater
- **Storage**: electron-store

## Development

```bash
git clone https://github.com/joseamorenoc025/easy-downloader.git
cd easy-downloader
npm install
npm run dev
```

### Build for distribution

```bash
npm run dist:win      # Windows (NSIS .exe)
npm run dist:linux    # Linux (.AppImage + .deb)
```

## Project structure

```
easy-downloader/
├── src/
│   ├── main/              # Electron main process
│   │   ├── downloader/    # yt-dlp / spotdl / ffmpeg management
│   │   ├── index.ts       # Window, tray, IPC setup
│   │   └── utils/         # Shared main-process helpers
│   ├── preload/           # Context bridge (IPC)
│   ├── renderer/          # React UI
│   │   ├── components/    # UI components
│   │   ├── i18n/          # es.json, en.json
│   │   ├── hooks/         # Custom React hooks
│   │   └── ...
│   └── types/             # TypeScript type definitions
├── resources/             # App icons
├── .mavis/plans/          # Sprint plans & changelogs
├── .github/workflows/     # CI: build & release
├── package.json
└── README.md
```

## Releases & versioning

We follow [Semantic Versioning](https://semver.org/). Releases are tagged `vX.Y.Z` and built automatically by `.github/workflows/build.yml`. The same workflow uploads artifacts to the GitHub Release and updates the auto-updater manifest (`latest.yml`).

For full release notes see [CHANGELOG.md](CHANGELOG.md).