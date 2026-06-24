# EasyDownloader

![Build & Release](https://img.shields.io/github/actions/workflow/status/joseamorenoc025/easy-downloader/build.yml?branch=main)
![License](https://img.shields.io/github/license/joseamorenoc025/easy-downloader)
![Release](https://img.shields.io/github/v/release/joseamorenoc025/easy-downloader)
![Downloads](https://img.shields.io/github/downloads/joseamorenoc025/easy-downloader/total)

> App de escritorio para descargar videos y audio desde YouTube, Spotify y ~1700 sitios web. Sin dependencias externas para Spotify — motor nativo integrado.
>
> Desktop app to download videos and audio from YouTube, Spotify, and ~1700 websites. No external dependencies for Spotify — native engine built in.

[🇪🇸 Español](#español) · [🇬🇧 English](#english)

---

## Español

### ¿Qué es EasyDownloader?

Una app de escritorio multiplataforma (Windows / Linux) construida con Electron + React + Tailwind. Pegas una URL, eliges formato y calidad, y se descarga. Soporta YouTube y ~1700 sitios adicionales via yt-dlp, más Spotify con un motor nativo que no requiere `spotdl` ni pip.

### Características

- **~1700 sitios soportados** via yt-dlp: YouTube, Vimeo, Twitter/X, TikTok, Reddit, SoundCloud, Twitch, Bandcamp, archive.org, bilibili, dailymotion, y muchos más.
- **Spotify nativo**: tracks, álbumes y playlists. Usa `spotify-url-info` para metadata y `yt-dlp` para descargar el audio — sin instalar `spotdl` ni Python.
- **Selector de calidad de audio**: 320, 256, 192 o 128 kbps para descargas de Spotify.
- **Selector de calidad de video**: desde 480p hasta mejor calidad disponible.
- **Cola de descargas** con hasta 3 simultáneas.
- **Vista previa de metadata** antes de descargar (thumbnail, título, duración).
- **Historial** con búsqueda, filtros y re-descarga.
- **i18n**: Español e Inglés.
- **Tema claro / oscuro** (sigue al sistema).
- **System tray**: minimiza a la bandeja, doble-click restaura.
- **Auto-updater**: notifica cuando hay versión nueva en GitHub Releases.
- **Drag & drop** y **Ctrl+V global** para pegar URLs.
- **Cola persistente**: sobrevive reinicios.
- **Toast notifications**: feedback visual en errores y éxitos.

### Cómo funciona

| Componente | Tecnología | Rol |
|---|---|---|
| **YouTube y otros sitios** | yt-dlp | Descarga video/audio de ~1700 fuentes |
| **Búsqueda de YouTube** | Scraping de `ytInitialData` | Encuentra el video correcto sin API key |
| **Spotify** | `spotify-url-info` + yt-dlp | Obtiene metadata del track y busca el audio en YouTube |
| **Conversión de audio** | ffmpeg | Convierte a MP3 con la calidad elegida |
| **Interfaz** | React + Tailwind + framer-motion | UI nativa con animaciones suaves |
| **Empaquetado** | electron-builder | Instaladores NSIS (Windows) y AppImage/.deb (Linux) |

### Arquitectura

```
┌─────────────────────────────────────────────────────────┐
│                    Electron Main                         │
│  ┌──────────────┐  ┌──────────────────────────────────┐  │
│  │  index.ts    │  │  BaseDownloadManager (abstract)  │  │
│  │  IPC + Tray  │  │  ├─ ensureBinary()               │  │
│  │  Window mgmt │  │  ├─ processQueue()               │  │
│  └──────────────┘  │  ├─ cancelItem / cancelAll        │  │
│                    │  ├─ setupEmitterListeners()       │  │
│                    │  └─ validateUrl()                 │  │
│                    └───────┬──────────┬────────────────┘  │
│                            │          │                   │
│              ┌─────────────┘          └─────────────┐    │
│              ▼                                      ▼    │
│  ┌───────────────────┐              ┌──────────────────┐ │
│  │ DownloadManager   │              │ SpotifyDownload  │ │
│  │ (YouTube/yt-dlp)  │              │ Manager          │ │
│  │ addToQueue()      │              │ addSpotifyUrl()  │ │
│  └───────────────────┘              └──────────────────┘ │
│         │                                    │           │
│         ▼                                    ▼           │
│  ┌───────────────┐              ┌────────────────────┐  │
│  │ yt-dlp binary │              │ spotify-url-info   │  │
│  │ (auto-update) │              │ + yt-dlp-search    │  │
│  └───────────────┘              │   (LRU cache)      │  │
│                                 └────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                            │
                     IPC (contextBridge)
                            │
┌─────────────────────────────────────────────────────────┐
│                  Electron Renderer                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │ DownloadForm │  │  QueueList   │  │   History    │   │
│  │ URL input    │  │  Active DLs  │  │  Past DLs    │   │
│  │ Format/Qlty  │  │  Progress    │  │  Search      │   │
│  └──────────────┘  └──────────────┘  └──────────────┘   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │  ThemeToggle │  │  Toast       │  │  i18n        │   │
│  │  Light/Dark  │  │  Notifications│  │  ES / EN     │   │
│  └──────────────┘  └──────────────┘  └──────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### Instalación

#### Windows

1. Descarga `EasyDownloader-Setup-2.x.x.exe` desde [Releases](https://github.com/joseamorenoc025/easy-downloader/releases/latest).
2. Ejecuta el instalador NSIS. Si Windows muestra SmartScreen, click "More info" → "Run anyway".
3. Listo. La app crea un acceso directo en escritorio y menú inicio.

#### Debian / Ubuntu (`.deb`)

1. Descarga `easy-downloader_2.x.x_amd64.deb` desde [Releases](https://github.com/joseamorenoc025/easy-downloader/releases/latest).
2. Instálalo:
   ```bash
   sudo dpkg -i easy-downloader_2.x.x_amd64.deb
   sudo apt-get install -f
   ```
   O doble-click en el archivo `.deb`.

3. Lanza desde el menú de aplicaciones o por terminal:
   ```bash
   easy-downloader
   ```

#### Fedora / otras distros (AppImage)

```bash
chmod +x EasyDownloader-2.x.x.AppImage
./EasyDownloader-2.x.x.AppImage
```

#### macOS

No hay builds de macOS. Para usar en macOS, ejecuta desde código fuente: `npm run dev`.

### Dependencias externas

| Dependencia | Para qué se usa | Cómo se instala |
|---|---|---|
| **yt-dlp** | Descargar de YouTube y otros sitios | Se descarga **automáticamente** al iniciar la app |
| **ffmpeg** | Convertir audio a MP3 | Incluido en el instalador |

No se requiere instalar `spotdl`, `pip`, `python` ni ninguna otra herramienta externa.

### Uso básico

1. Arranca la app.
2. Pega una URL en el campo de texto (o Ctrl+V en cualquier lado, o arrastra el enlace).
3. Elige formato: **Video (MP4)** o **Audio (MP3)**.
4. Elige calidad.
5. Click **Descargar**. El item aparece en la cola; cuando termina se mueve al historial.
6. Para abrir la carpeta donde se descargó, click en el item completado → "Abrir carpeta".

### FAQ

**P: ¿Solo funciona con YouTube?**
R: No. yt-dlp soporta ~1700 sitios: YouTube, Vimeo, Twitter/X, TikTok, SoundCloud, Twitch, Reddit, Bandcamp, bilibili, archive.org, y mucho más. La UI dice "YouTube" en los toggles pero internamente cualquier URL soportada por yt-dlp funciona. Ver [lista completa](https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md).

**P: ¿Necesito instalar algo para Spotify?**
R: No. La app incluye un motor nativo de Spotify que usa `spotify-url-info` para obtener metadata y `yt-dlp` para encontrar el audio. No necesitas Python ni `spotdl`.

**P: ¿Qué calidad de audio puedo elegir para Spotify?**
R: 320, 256, 192 o 128 kbps. La opción por defecto es 320 kbps.

**P: ¿Por qué no veo 2K / 4K en el selector de calidad?**
R: La UI expone hasta 1080p. Puedes usar el preset `best` que descarga la mejor calidad disponible (incluye 4K si el video la tiene).

**P: ¿Por qué el `.exe` me sale warning de SmartScreen?**
R: El binario está sin firma (no hay certificado de code signing). Es seguro — click "More info" → "Run anyway".

**P: ¿Puedo contribuir?**
R: Sí. Lee [CONTRIBUTING.md](CONTRIBUTING.md).

### Troubleshooting

**La app no descarga nada / se queda en "queued":**
- Revisa el banner de dependencias al inicio. Si yt-dlp está roto, click "Retry".
- Verifica conexión a internet.

**Audio sale sin video o viceversa:**
- ffmpeg no está en PATH. En Windows descarga de [ffmpeg.org](https://ffmpeg.org/download.html) y agrégalo al PATH. En Linux: `sudo apt install ffmpeg`.

**Linux: la app no abre / crashea al inicio:**
- Ejecuta desde terminal para ver el error: `easy-downloader`
- Instala las dependencias listadas en `package.json:linux.deb.depends`.

### Licencia

MIT — ver [LICENSE](LICENSE).

### Apoya el proyecto

EasyDownloader es gratuito y siempre lo será. Si te resulta útil, considera apoyar el desarrollo:

- **Certificado de Windows ($300/año)**: Quitemos juntos el error de SmartScreen
- **Meta**: 60 personas x $5 = certificado comprado

| Crypto | Dirección / ID |
|--------|---------------|
| USDT (TRC20) | `TFRHPxCaSs5aMkEmA7kuuwnS5Md2CMXkHL` |
| Binance Pay | `57018184` |

---

## English

### What is EasyDownloader?

A cross-platform desktop app (Windows / Linux) built with Electron + React + Tailwind. Paste a URL, choose format and quality, and download. Supports YouTube and ~1700 additional sites via yt-dlp, plus Spotify with a native engine that doesn't require `spotdl` or pip.

### Features

- **~1700 supported sites** via yt-dlp: YouTube, Vimeo, Twitter/X, TikTok, Reddit, SoundCloud, Twitch, Bandcamp, archive.org, bilibili, dailymotion, and more.
- **Native Spotify**: tracks, albums, and playlists. Uses `spotify-url-info` for metadata and `yt-dlp` to download the audio — no `spotdl` or Python needed.
- **Audio quality selector**: 320, 256, 192, or 128 kbps for Spotify downloads.
- **Video quality selector**: from 480p to best available quality.
- **Download queue** with up to 3 concurrent downloads.
- **Metadata preview** before downloading (thumbnail, title, duration).
- **Searchable history** with filters and re-download.
- **i18n**: Spanish and English.
- **Light / dark theme** (follows system).
- **System tray**: minimize to tray, double-click to restore.
- **Auto-updater**: notifies on new GitHub Releases.
- **Drag & drop** and **global Ctrl+V** to paste URLs.
- **Persistent queue**: survives restarts.
- **Toast notifications**: visual feedback for errors and successes.

### How it works

| Component | Technology | Role |
|---|---|---|
| **YouTube and other sites** | yt-dlp | Downloads video/audio from ~1700 sources |
| **YouTube search** | `ytInitialData` scraping | Finds the right video without an API key |
| **Spotify** | `spotify-url-info` + yt-dlp | Gets track metadata and finds the audio on YouTube |
| **Audio conversion** | ffmpeg | Converts to MP3 at the chosen quality |
| **Interface** | React + Tailwind + framer-motion | Native UI with smooth animations |
| **Packaging** | electron-builder | NSIS installers (Windows) and AppImage/.deb (Linux) |

### Installation

#### Windows

1. Download `EasyDownloader-Setup-2.x.x.exe` from [Releases](https://github.com/joseamorenoc025/easy-downloader/releases/latest).
2. Run the NSIS installer. If Windows shows SmartScreen, click "More info" → "Run anyway".
3. Done. App creates a desktop shortcut and start menu entry.

#### Debian / Ubuntu (`.deb`)

1. Download `easy-downloader_2.x.x_amd64.deb` from [Releases](https://github.com/joseamorenoc025/easy-downloader/releases/latest).
2. Install:
   ```bash
   sudo dpkg -i easy-downloader_2.x.x_amd64.deb
   sudo apt-get install -f
   ```
   Or double-click the `.deb` file.

3. Launch from the applications menu or terminal:
   ```bash
   easy-downloader
   ```

#### Fedora / other distros (AppImage)

```bash
chmod +x EasyDownloader-2.x.x.AppImage
./EasyDownloader-2.x.x.AppImage
```

#### macOS

No macOS builds available. To use on macOS, run from source: `npm run dev`.

### External dependencies

| Dependency | Used for | How to install |
|---|---|---|
| **yt-dlp** | Download from YouTube and other sites | **Auto-downloaded** on first launch |
| **ffmpeg** | Convert audio to MP3 | Bundled in installer |

No `spotdl`, `pip`, `python`, or other external tools required.

### Basic usage

1. Launch the app.
2. Paste a URL (Ctrl+V anywhere, or drag & drop).
3. Choose format: **Video (MP4)** or **Audio (MP3)**.
4. Choose quality.
5. Click **Download**. Item appears in the queue; when done it moves to history.
6. To open the download folder, click the completed item → "Open folder".

### FAQ

**Q: Does this only work with YouTube?**
A: No. yt-dlp supports ~1700 sites: YouTube, Vimeo, Twitter/X, TikTok, SoundCloud, Twitch, Reddit, Bandcamp, bilibili, archive.org, and much more. The UI says "YouTube" in toggles but internally any yt-dlp-supported URL works. See [full list](https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md).

**Q: Do I need to install anything for Spotify?**
A: No. The app includes a native Spotify engine that uses `spotify-url-info` for metadata and `yt-dlp` to find the audio. No Python or `spotdl` needed.

**Q: What audio quality can I choose for Spotify?**
A: 320, 256, 192, or 128 kbps. Default is 320 kbps.

**Q: Why don't I see 2K / 4K in the quality selector?**
A: The UI exposes up to 1080p. You can use the `best` preset which downloads the best available quality (including 4K if available).

**Q: Why does the `.exe` trigger a SmartScreen warning?**
A: The binary is unsigned (no code signing certificate). It's safe — click "More info" → "Run anyway".

**Q: Can I contribute?**
A: Yes. See [CONTRIBUTING.md](CONTRIBUTING.md).

### Troubleshooting

**App doesn't download / stuck on "queued":**
- Check the dependencies banner at startup. If yt-dlp is broken, click "Retry".
- Verify your internet connection.

**Audio comes out without video (or vice versa):**
- ffmpeg is not in PATH. On Windows download from [ffmpeg.org](https://ffmpeg.org/download.html) and add to PATH. On Linux: `sudo apt install ffmpeg`.

**Linux: app won't open / crashes at launch:**
- Run from terminal to see the error: `easy-downloader`
- Install the deps listed in `package.json:linux.deb.depends`.

### License

MIT — see [LICENSE](LICENSE).

### Support the project

EasyDownloader is free and always will be. If you find it useful, consider supporting development:

- **Windows certificate ($300/year)**: Let's remove the SmartScreen warning together
- **Goal**: 60 people x $5 = certificate purchased

| Crypto | Address / ID |
|--------|-------------|
| USDT (TRC20) | `TFRHPxCaSs5aMkEmA7kuuwnS5Md2CMXkHL` |
| Binance Pay | `57018184` |

---

## Tech stack

- **Frontend**: React 18 + TypeScript + Tailwind CSS + framer-motion
- **Backend**: Electron 42 + electron-vite
- **Downloads**: yt-dlp-wrap (yt-dlp), spotify-url-info (Spotify metadata)
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
│   │   ├── downloader/    # yt-dlp / Spotify / ffmpeg management
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
├── .github/workflows/     # CI: build & release
├── package.json
└── README.md
```

## Releases & versioning

We follow [Semantic Versioning](https://semver.org/). Releases are tagged `vX.Y.Z` and built automatically by `.github/workflows/build.yml`. The same workflow uploads artifacts to the GitHub Release and updates the auto-updater manifest (`latest.yml`).

For full release notes see [CHANGELOG.md](CHANGELOG.md).
