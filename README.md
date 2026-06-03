# EasyDownloader

Desktop app to download videos and extract audio from YouTube and Spotify. Built with Electron + React + Tailwind.

## Features

- **YouTube**: Download videos up to 4K, extract MP3 audio, full playlist support
- **Spotify**: Download tracks and playlists as MP3 (requires spotdl)
- **Queue**: Add multiple downloads, up to 3 concurrent
- **Metadata Preview**: See thumbnail, title, duration before downloading
- **History**: Searchable history with re-download and open folder
- **i18n**: Spanish and English UI
- **Dark/Light theme**: System-aware theme toggle
- **System tray**: Minimizes to tray, double-click to toggle
- **Auto-updater**: Checks GitHub Releases on startup
- **Drag & drop**: Paste or drag URLs, Ctrl+V auto-fills the input
- **Persistent queue**: Queue survives app restarts

## Download

Download the latest installer from [Releases](https://github.com/joseamorenoc025/easy-downloader/releases).

| Platform | Format |
|----------|--------|
| Windows | `EasyDownloader-Setup-*.exe` (NSIS) |
| Linux | `EasyDownloader-*.AppImage` or `.deb` |

## Requirements

| Dependency | Needed for | How to get |
|------------|-----------|------------|
| **yt-dlp** | YouTube downloads | Auto-downloaded on first launch |
| **ffmpeg** | Audio conversion to MP3 | Bundled with the installer |
| **spotdl** | Spotify downloads | `pip install spotdl` |

## Development

```bash
git clone https://github.com/joseamorenoc025/easy-downloader.git
cd easy-downloader
npm install
npm run dev
```

### Build for distribution

```bash
npm run dist:win      # Windows (NSIS)
npm run dist:linux    # Linux (AppImage + deb)
```

### Tech stack

- **Frontend**: React 18 + TypeScript + Tailwind CSS
- **Backend**: Electron 42 + electron-vite
- **Downloads**: yt-dlp-wrap (yt-dlp), spotdl (Spotify)
- **Packaging**: electron-builder + electron-updater
- **Storage**: electron-store

## Project structure

```
easy-downloader/
├── src/
│   ├── main/           # Electron main process
│   │   ├── downloader/ # yt-dlp/spotdl/ffmpeg management
│   │   ├── index.ts    # Window, tray, IPC setup
│   │   └── ...
│   ├── preload/        # Context bridge (IPC)
│   ├── renderer/       # React UI
│   │   ├── components/ # UI components
│   │   ├── i18n/       # es.json, en.json
│   │   ├── hooks/      # Custom React hooks
│   │   └── ...
│   └── types/          # TypeScript type definitions
├── resources/          # App icons
├── package.json
└── README.md
```

## License

MIT
