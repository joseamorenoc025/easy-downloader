"use strict";
const electron = require("electron");
const path = require("path");
const crypto = require("crypto");
const fs = require("fs");
const child_process = require("child_process");
const is = {
  dev: !electron.app.isPackaged
};
const platform = {
  isWindows: process.platform === "win32",
  isMacOS: process.platform === "darwin",
  isLinux: process.platform === "linux"
};
const electronApp = {
  setAppUserModelId(id) {
    if (platform.isWindows)
      electron.app.setAppUserModelId(is.dev ? process.execPath : id);
  },
  setAutoLaunch(auto) {
    if (platform.isLinux)
      return false;
    const isOpenAtLogin = () => {
      return electron.app.getLoginItemSettings().openAtLogin;
    };
    if (isOpenAtLogin() !== auto) {
      electron.app.setLoginItemSettings({
        openAtLogin: auto,
        path: process.execPath
      });
      return isOpenAtLogin() === auto;
    } else {
      return true;
    }
  },
  skipProxy() {
    return electron.session.defaultSession.setProxy({ mode: "direct" });
  }
};
const optimizer = {
  watchWindowShortcuts(window, shortcutOptions) {
    if (!window)
      return;
    const { webContents } = window;
    const { escToCloseWindow = false, zoom = false } = shortcutOptions || {};
    webContents.on("before-input-event", (event, input) => {
      if (input.type === "keyDown") {
        if (!is.dev) {
          if (input.code === "KeyR" && (input.control || input.meta))
            event.preventDefault();
        } else {
          if (input.code === "F12") {
            if (webContents.isDevToolsOpened()) {
              webContents.closeDevTools();
            } else {
              webContents.openDevTools({ mode: "undocked" });
              console.log("Open dev tool...");
            }
          }
        }
        if (escToCloseWindow) {
          if (input.code === "Escape" && input.key !== "Process") {
            window.close();
            event.preventDefault();
          }
        }
        if (!zoom) {
          if (input.code === "Minus" && (input.control || input.meta))
            event.preventDefault();
          if (input.code === "Equal" && input.shift && (input.control || input.meta))
            event.preventDefault();
        }
      }
    });
  },
  registerFramelessWindowIpc() {
    electron.ipcMain.on("win:invoke", (event, action) => {
      const win = electron.BrowserWindow.fromWebContents(event.sender);
      if (win) {
        if (action === "show") {
          win.show();
        } else if (action === "showInactive") {
          win.showInactive();
        } else if (action === "min") {
          win.minimize();
        } else if (action === "max") {
          const isMaximized = win.isMaximized();
          if (isMaximized) {
            win.unmaximize();
          } else {
            win.maximize();
          }
        } else if (action === "close") {
          win.close();
        }
      }
    });
  }
};
const VIDEO_FORMAT_MAP = {
  "best": "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
  "2160p": "bestvideo[height<=2160][ext=mp4]+bestaudio[ext=m4a]/best[height<=2160][ext=mp4]/best",
  "1440p": "bestvideo[height<=1440][ext=mp4]+bestaudio[ext=m4a]/best[height<=1440][ext=mp4]/best",
  "1080p": "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]/best",
  "720p": "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best",
  "480p": "bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480][ext=mp4]/best"
};
const AUDIO_FORMAT_MAP = {
  "320": "bestaudio[abr<=320]/bestaudio",
  "256": "bestaudio[abr<=256]/bestaudio",
  "192": "bestaudio[abr<=192]/bestaudio",
  "128": "bestaudio[abr<=128]/bestaudio"
};
function getDefaultOutputDir() {
  return electron.app.getPath("downloads");
}
function buildDownloadOptions(options) {
  const isAudio = options.format === "audio";
  const formatMap = isAudio ? AUDIO_FORMAT_MAP : VIDEO_FORMAT_MAP;
  const formatStr = formatMap[options.quality] || formatMap["best"];
  const outputDir = options.outputDir || getDefaultOutputDir();
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  const isPlaylist = options.url.includes("list=");
  const outtmpl = isPlaylist ? `${outputDir}/%(playlist_title)s/%(title)s.%(ext)s` : `${outputDir}/%(title)s.%(ext)s`;
  const ytDlpOptions = {
    format: formatStr,
    outtmpl,
    progress_hooks: [],
    quiet: true,
    no_warnings: true,
    embed_thumbnail: isAudio,
    embed_metadata: true
  };
  if (isAudio) {
    ytDlpOptions.postprocessors = [
      {
        key: "FFmpegExtractAudio",
        preferredcodec: "mp3",
        preferredquality: options.quality
      }
    ];
  }
  return ytDlpOptions;
}
let cachedFfmpegPath = null;
function findBundledFfmpeg() {
  if (cachedFfmpegPath) return cachedFfmpegPath;
  if (electron.app.isPackaged) {
    const ext = process.platform === "win32" ? ".exe" : "";
    const resourcePath = path.join(process.resourcesPath, "ffmpeg", `ffmpeg${ext}`);
    if (fs.existsSync(resourcePath)) {
      cachedFfmpegPath = resourcePath;
      return resourcePath;
    }
  } else {
    try {
      const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
      if (ffmpegPath && fs.existsSync(ffmpegPath)) {
        cachedFfmpegPath = ffmpegPath;
        return ffmpegPath;
      }
    } catch {
    }
  }
  return null;
}
function getFfmpegPath() {
  return findBundledFfmpeg() || "ffmpeg";
}
function checkFfmpegInstalled() {
  const ffmpegPath = findBundledFfmpeg();
  if (ffmpegPath) return true;
  try {
    child_process.execSync("ffmpeg -version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
function isValidHttpUrl(url) {
  if (typeof url !== "string" || url.length === 0) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
const { default: YtDlpWrap$1 } = require("yt-dlp-wrap");
class DownloadManager {
  queue = [];
  activeItems = /* @__PURE__ */ new Map();
  maxConcurrent = 3;
  ytDlp;
  binaryReady = false;
  downloadPath;
  paused = false;
  // Nuevo: estado de pausa global
  onProgress;
  onComplete;
  onError;
  // Throttling para eventos de progreso - balance entre rendimiento y feedback visual
  // En Windows con múltiples descargas, reducir a 100ms mejora la percepción de velocidad
  progressTimers = /* @__PURE__ */ new Map();
  lastProgressUpdate = /* @__PURE__ */ new Map();
  PROGRESS_THROTTLE_MS = 100;
  // 10 actualizaciones/segundo - óptimo para Windows
  constructor(downloadPath, onProgress, onComplete, onError) {
    this.downloadPath = downloadPath;
    this.ytDlp = new YtDlpWrap$1();
    this.onProgress = onProgress;
    this.onComplete = onComplete;
    this.onError = onError;
  }
  async ensureBinary() {
    if (this.binaryReady) return;
    const isWin = process.platform === "win32";
    const binaryName = isWin ? "yt-dlp.exe" : "yt-dlp";
    const ytDlpPath = path.join(electron.app.getPath("userData"), binaryName);
    try {
      this.ytDlp.getBinaryPath();
      this.binaryReady = true;
    } catch {
      await YtDlpWrap$1.downloadFromGithub(ytDlpPath);
      this.ytDlp.setBinaryPath(ytDlpPath);
      this.binaryReady = true;
    }
  }
  async addToQueue(options) {
    await this.ensureBinary();
    const item = {
      id: crypto.randomUUID(),
      url: options.url,
      title: "Queued...",
      status: "queued",
      progress: 0,
      speed: "",
      eta: "",
      totalBytes: 0,
      downloadedBytes: 0,
      format: options.format,
      quality: options.quality,
      incognito: options.incognito || false
      // Marcar como incógnito si corresponde
    };
    this.queue.push(item);
    this.processQueue();
    return item;
  }
  cancelItem(itemId) {
    const active = this.activeItems.get(itemId);
    if (active) {
      active.emitter.ytDlpProcess?.kill("SIGTERM");
      active.item.status = "cancelled";
      this.onComplete(active.item);
      this.activeItems.delete(itemId);
      this.cleanQueue();
      setTimeout(() => this.processQueue(), 100);
      return;
    }
    const item = this.queue.find((i) => i.id === itemId);
    if (item) {
      item.status = "cancelled";
      this.onComplete(item);
      this.queue = this.queue.filter((i) => i.id !== itemId);
    }
  }
  cancelAll() {
    for (const [, active] of this.activeItems) {
      active.emitter.ytDlpProcess?.kill("SIGTERM");
      active.item.status = "cancelled";
      this.onComplete(active.item);
    }
    this.activeItems.clear();
    this.queue.forEach((item) => {
      if (item.status === "queued") {
        item.status = "cancelled";
        this.onComplete(item);
      }
    });
    this.queue = [];
  }
  // Nuevo: pausar todas las descargas activas
  pauseAll() {
    this.paused = true;
    for (const [, active] of this.activeItems) {
      active.emitter.ytDlpProcess?.kill("SIGTERM");
      active.item.status = "queued";
      active.item.speed = "Pausado";
      this.onProgress({
        id: active.item.id,
        percentage: active.item.progress.toString(),
        speed: "Pausado",
        eta: "",
        downloaded: "",
        total: ""
      });
    }
  }
  // Nuevo: reanudar todas las descargas pausadas
  resumeAll() {
    this.paused = false;
    const queuedItems = this.queue.filter((i) => i.status === "queued" && i.speed === "Pausado");
    for (const item of queuedItems) {
      item.status = "queued";
      item.speed = "";
    }
    this.processQueue();
  }
  getQueue() {
    return [...this.queue];
  }
  cleanQueue() {
    this.queue = this.queue.filter(
      (i) => i.status !== "completed" && i.status !== "cancelled" && i.status !== "error"
    );
  }
  processQueue() {
    const slots = this.maxConcurrent - this.activeItems.size;
    if (slots <= 0) return;
    const queued = this.queue.filter((i) => i.status === "queued").slice(0, slots);
    if (queued.length === 0) return;
    for (const item of queued) {
      this.startDownload(item);
    }
  }
  startDownload(item, attempt = 1) {
    if (!isValidHttpUrl(item.url)) {
      item.status = "error";
      item.error = "URL inválida: solo se permiten http y https";
      this.onError(item.id, item.error);
      return;
    }
    item.status = "downloading";
    const opts = buildDownloadOptions({
      url: item.url,
      format: item.format,
      quality: item.quality,
      outputDir: this.downloadPath
    });
    const args = [
      ...item.url.includes("list=") ? ["--yes-playlist"] : ["--no-playlist"],
      item.url,
      "--no-warnings",
      "--newline",
      "--progress",
      "--socket-timeout",
      "20",
      "--retries",
      "3",
      "--ffmpeg-location",
      getFfmpegPath(),
      "-f",
      String(opts.format),
      "-o",
      String(opts.outtmpl),
      ...item.format === "audio" ? ["--extract-audio", "--audio-format", "mp3", "--audio-quality", item.quality] : []
    ];
    try {
      const emitter = this.ytDlp.exec(args);
      this.activeItems.set(item.id, { item, emitter });
      const sendProgress = () => {
        this.lastProgressUpdate.delete(item.id);
        this.onProgress({
          id: item.id,
          percentage: item.progress.toFixed(1),
          speed: item.speed,
          eta: item.eta,
          downloaded: "",
          total: ""
        });
      };
      emitter.on("progress", (progress) => {
        const pct = progress.percent ?? 0;
        item.progress = pct;
        item.speed = progress.currentSpeed ?? "";
        item.eta = progress.eta ?? "";
        if (progress.totalSize) {
          const sizeStr = progress.totalSize.replace("~", "");
          const sizeMatch = sizeStr.match(/^([\d.]+)\s*(MiB|GiB|KiB)/);
          if (sizeMatch) {
            const val = parseFloat(sizeMatch[1]);
            const unit = sizeMatch[2];
            item.totalBytes = unit === "GiB" ? val * 1024 * 1024 * 1024 : unit === "MiB" ? val * 1024 * 1024 : val * 1024;
          }
        }
        const now = Date.now();
        const lastUpdate = this.lastProgressUpdate.get(item.id) || 0;
        if (now - lastUpdate >= this.PROGRESS_THROTTLE_MS) {
          this.lastProgressUpdate.set(item.id, now);
          sendProgress();
        } else {
          const existingTimer = this.progressTimers.get(item.id);
          if (existingTimer) clearTimeout(existingTimer);
          const timer = setTimeout(() => {
            this.lastProgressUpdate.set(item.id, Date.now());
            sendProgress();
          }, this.PROGRESS_THROTTLE_MS - (now - lastUpdate));
          this.progressTimers.set(item.id, timer);
        }
      });
      emitter.on("ytDlpEvent", (eventType, eventData) => {
        if (eventType === "Destination") {
          const filePath = eventData.trim();
          const fileName = filePath.split(/[\\/]/).pop() || "";
          item.title = fileName.replace(/\.[^.]+$/, "");
          item.outputPath = filePath;
        }
        if (eventType === "ExtractAudio") {
          item.title = eventData.trim();
          item.speed = "Procesando audio...";
          item.eta = "FFmpeg";
          this.onProgress({
            id: item.id,
            percentage: "100",
            speed: item.speed,
            eta: item.eta,
            downloaded: "",
            total: ""
          });
        }
        if (eventType === "Merger") {
          item.speed = "Fusionando (FFmpeg)...";
          item.eta = "FFmpeg";
          this.onProgress({
            id: item.id,
            percentage: "100",
            speed: item.speed,
            eta: item.eta,
            downloaded: "",
            total: ""
          });
        }
        if (eventType === "download" && eventData.includes("Downloading video")) {
          const match = eventData.match(/Downloading video (\d+) of (\d+)/);
          if (match) {
            item.title = `[Video ${match[1]}/${match[2]}] ${item.title.replace(/^\[Video \d+\/\d+\] /, "")}`;
            this.onProgress({
              id: item.id,
              percentage: item.progress.toString(),
              speed: item.speed,
              eta: item.eta,
              downloaded: "",
              total: ""
            });
          }
        }
      });
      emitter.on("close", (code) => {
        this.activeItems.delete(item.id);
        if (code === 0) {
          item.status = "completed";
          item.progress = 100;
          this.onComplete(item);
          this.cleanQueue();
          setTimeout(() => this.processQueue(), 100);
        } else if (item.status !== "cancelled") {
          if (attempt < 3) {
            item.speed = `Reintentando (${attempt}/3)...`;
            this.onProgress({
              id: item.id,
              percentage: item.progress.toString(),
              speed: item.speed,
              eta: "",
              downloaded: "",
              total: ""
            });
            setTimeout(() => this.startDownload(item, attempt + 1), 3e3);
          } else {
            item.status = "error";
            item.error = `Process exited with code ${code}`;
            this.onError(item.id, item.error);
            this.cleanQueue();
            setTimeout(() => this.processQueue(), 100);
          }
        }
      });
      emitter.on("error", (err) => {
        this.activeItems.delete(item.id);
        if (item.status !== "cancelled") {
          if (attempt < 3) {
            item.speed = `Reintentando (${attempt}/3)...`;
            this.onProgress({
              id: item.id,
              percentage: item.progress.toString(),
              speed: item.speed,
              eta: "",
              downloaded: "",
              total: ""
            });
            setTimeout(() => this.startDownload(item, attempt + 1), 3e3);
          } else {
            item.status = "error";
            item.error = err.message;
            this.onError(item.id, err.message);
            this.cleanQueue();
            setTimeout(() => this.processQueue(), 100);
          }
        }
      });
    } catch (err) {
      item.status = "error";
      item.error = err.message;
      this.onError(item.id, err.message);
    }
  }
}
class SpotifyDownloadManager {
  queue = [];
  currentItem = null;
  currentProcess = null;
  onComplete;
  onError;
  paused = false;
  // Nuevo: estado de pausa global
  // Throttling para output de spotdl - evita floods en Windows
  // Reducir intervalo mejora la percepción de velocidad en playlists grandes
  outputBuffer = [];
  flushTimer = null;
  FLUSH_INTERVAL_MS = 150;
  // Más rápido para mejor feedback en Windows
  constructor(onComplete, onError) {
    this.onComplete = onComplete;
    this.onError = onError;
  }
  async addToQueue(url, downloadPath, incognito = false) {
    const item = {
      id: `spot-${crypto.randomUUID()}`,
      url,
      title: "Fetching from Spotify...",
      status: "queued",
      progress: 0,
      speed: "",
      eta: "",
      totalBytes: 0,
      downloadedBytes: 0,
      format: "audio",
      quality: "128",
      source: "spotify",
      incognito
      // Marcar como incógnito si corresponde
    };
    this.queue.push(item);
    this.processQueue(downloadPath);
    return item;
  }
  cancelItem(itemId) {
    const item = this.queue.find((i) => i.id === itemId);
    if (!item) return;
    if (this.currentItem?.id === itemId && this.currentProcess) {
      this.currentProcess.kill("SIGTERM");
    }
    item.status = "cancelled";
    this.currentItem = null;
    this.currentProcess = null;
    this.onComplete(item);
    this.queue = this.queue.filter((i) => i.id !== itemId);
  }
  cancelAll() {
    if (this.currentProcess) {
      this.currentProcess.kill("SIGTERM");
    }
    this.queue.forEach((item) => item.status = "cancelled");
    this.queue = [];
    this.currentItem = null;
    this.currentProcess = null;
  }
  // Nuevo: pausar descarga activa de Spotify
  pauseAll() {
    this.paused = true;
    if (this.currentProcess && this.currentItem) {
      this.currentProcess.kill("SIGTERM");
      this.currentItem.status = "queued";
      this.currentItem.speed = "Pausado";
    }
  }
  // Nuevo: reanudar descarga de Spotify
  resumeAll() {
    this.paused = false;
    if (this.currentItem && this.currentItem.speed === "Pausado") {
      this.currentItem.status = "queued";
      this.currentItem.speed = "";
    }
  }
  processQueue(downloadPath) {
    if (this.currentItem || this.queue.length === 0) return;
    const item = this.queue.find((i) => i.status === "queued");
    if (!item) return;
    this.currentItem = item;
    item.status = "downloading";
    try {
      if (!fs.existsSync(downloadPath)) {
        fs.mkdirSync(downloadPath, { recursive: true });
      }
    } catch {
      item.status = "error";
      item.error = `Cannot create output directory: ${downloadPath}`;
      this.onError(item.id, item.error);
      this.currentItem = null;
      this.currentProcess = null;
      return;
    }
    const isWin = process.platform === "win32";
    const spotdlCmd = isWin ? "spotdl" : "spotdl";
    try {
      if (!isValidHttpUrl(item.url)) {
        item.status = "error";
        item.error = `URL inválida: solo se permiten http y https`;
        this.onError(item.id, item.error);
        this.currentItem = null;
        this.currentProcess = null;
        this.queue = this.queue.filter((i) => i.id !== item.id);
        return;
      }
      this.currentProcess = child_process.spawn(spotdlCmd, [
        item.url,
        "--output",
        downloadPath,
        "--format",
        "mp3",
        "--bitrate",
        "128k",
        "--ffmpeg",
        getFfmpegPath()
      ], { shell: false });
      let fullOutput = "";
      this.currentProcess.stdout?.on("data", (data) => {
        const text = data.toString();
        this.outputBuffer.push(text);
        if (item.title === "Fetching from Spotify...") {
          const match = text.match(/:?\s*(.+?)\s*$/m);
          if (match && match[1].trim()) {
            item.title = match[1].trim();
          }
        }
        if (!this.flushTimer) {
          this.flushTimer = setTimeout(() => {
            this.outputBuffer = [];
            this.flushTimer = null;
          }, this.FLUSH_INTERVAL_MS);
        }
      });
      this.currentProcess.stderr?.on("data", (data) => {
        this.outputBuffer.push(data.toString());
      });
      this.currentProcess.on("close", (code) => {
        if (item.status === "cancelled") return;
        if (code === 0) {
          item.status = "completed";
          item.progress = 100;
          this.onComplete(item);
          this.currentItem = null;
          this.currentProcess = null;
          this.queue = this.queue.filter((i) => i.id !== item.id);
          setTimeout(() => this.processQueue(downloadPath), 100);
        } else {
          const lower = fullOutput.toLowerCase();
          const notFound = lower.includes("not recognized") || lower.includes("no se reconoce") || lower.includes("command not found") || lower.includes("not found") || lower.includes("no encontrado");
          if (notFound) {
            item.status = "error";
            item.error = "spotdl is not installed. Run: pip install spotdl";
            this.onError(item.id, item.error);
            this.currentItem = null;
            this.currentProcess = null;
            this.queue = this.queue.filter((i) => i.id !== item.id);
            setTimeout(() => this.processQueue(downloadPath), 100);
          } else {
            const retries = item.retries || 0;
            if (retries < 3) {
              ;
              item.retries = retries + 1;
              item.status = "queued";
              this.currentItem = null;
              this.currentProcess = null;
              setTimeout(() => this.processQueue(downloadPath), 3e3);
            } else {
              item.status = "error";
              item.error = fullOutput.split("\n").filter((l) => l.trim()).slice(-3).join("; ") || `Process exited with code ${code}`;
              this.onError(item.id, item.error);
              this.currentItem = null;
              this.currentProcess = null;
              this.queue = this.queue.filter((i) => i.id !== item.id);
              setTimeout(() => this.processQueue(downloadPath), 100);
            }
          }
        }
      });
      this.currentProcess.on("error", (err) => {
        if (item.status === "cancelled") return;
        const isEnoent = err.message.includes("ENOENT");
        if (isEnoent) {
          item.status = "error";
          item.error = "spotdl is not installed. Run: pip install spotdl";
          this.onError(item.id, item.error);
          this.currentItem = null;
          this.currentProcess = null;
          this.queue = this.queue.filter((i) => i.id !== item.id);
          setTimeout(() => this.processQueue(downloadPath), 100);
        } else {
          const retries = item.retries || 0;
          if (retries < 3) {
            ;
            item.retries = retries + 1;
            item.status = "queued";
            this.currentItem = null;
            this.currentProcess = null;
            setTimeout(() => this.processQueue(downloadPath), 3e3);
          } else {
            item.status = "error";
            item.error = err.message;
            this.onError(item.id, item.error);
            this.currentItem = null;
            this.currentProcess = null;
            this.queue = this.queue.filter((i) => i.id !== item.id);
            setTimeout(() => this.processQueue(downloadPath), 100);
          }
        }
      });
    } catch (err) {
      item.status = "error";
      item.error = err.message;
      this.onError(item.id, item.error);
      this.currentItem = null;
      this.currentProcess = null;
    }
  }
}
const { default: YtDlpWrap } = require("yt-dlp-wrap");
async function fetchMetadata(url) {
  const ytDlp = new YtDlpWrap();
  try {
    const stdout = await ytDlp.execPromise([
      "--dump-json",
      "--flat-playlist",
      "--no-warnings",
      url
    ]);
    const lines = stdout.trim().split("\n");
    const firstLine = lines[0];
    if (!firstLine) throw new Error("No metadata returned");
    const data = JSON.parse(firstLine);
    const isPlaylist = data._type === "playlist" || !!data.entries || lines.length > 1;
    if (isPlaylist) {
      const entries = lines.map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return null;
        }
      }).filter(Boolean);
      return {
        title: data.title || "Playlist",
        duration: data.duration || 0,
        uploader: data.uploader,
        isPlaylist: true,
        playlistCount: data.playlist_count || entries.length,
        thumbnail: data.thumbnail
      };
    }
    return {
      title: data.title || "Unknown",
      duration: data.duration || 0,
      uploader: data.uploader,
      isPlaylist: false,
      thumbnail: data.thumbnail,
      formats: (data.formats || []).filter((f) => f.vcodec !== "none" || f.acodec !== "none").map((f) => ({
        id: String(f.format_id || ""),
        ext: String(f.ext || ""),
        resolution: f.resolution ? String(f.resolution) : void 0,
        filesize: f.filesize ? Number(f.filesize) : void 0,
        format_note: f.format_note ? String(f.format_note) : void 0,
        vcodec: String(f.vcodec || ""),
        acodec: String(f.acodec || ""),
        tbr: f.tbr ? Number(f.tbr) : void 0
      }))
    };
  } catch (err) {
    throw new Error(`Failed to fetch metadata: ${err.message}`);
  }
}
const { default: Store } = require("electron-store");
const { autoUpdater } = require("electron-updater");
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
});
const store = new Store({
  defaults: {
    downloadPath: electron.app.getPath("downloads"),
    themeMode: "system",
    downloadQueue: [],
    fetchMetadata: true,
    incognitoMode: false,
    globalPause: false
    // Nuevo: estado inicial del toggle global pause
  }
});
let mainWindow = null;
let downloadManager = null;
let spotifyManager = null;
let tray = null;
let isQuitting = false;
function createWindow() {
  mainWindow = new electron.BrowserWindow({
    width: 800,
    height: 700,
    minWidth: 600,
    minHeight: 500,
    show: false,
    autoHideMenuBar: true,
    title: "EasyDownloader",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.on("ready-to-show", () => {
    mainWindow?.show();
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return { action: "deny" };
      }
    } catch {
      return { action: "deny" };
    }
    electron.shell.openExternal(url);
    return { action: "deny" };
  });
  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}
function setupIPC() {
  electron.ipcMain.handle("fetch-metadata", async (_event, url) => {
    if (!isValidHttpUrl(url)) {
      throw new Error("URL inválida: solo http/https");
    }
    return fetchMetadata(url);
  });
  electron.ipcMain.handle("add-download", async (_event, options) => {
    if (!options || !isValidHttpUrl(options?.url)) {
      throw new Error("URL inválida");
    }
    if (!downloadManager) return null;
    const settings = store.get("settings");
    const incognito = settings?.incognitoMode || false;
    return downloadManager.addToQueue({ ...options, incognito });
  });
  electron.ipcMain.handle("cancel-download", async (_event, itemId) => {
    downloadManager?.cancelItem(itemId);
  });
  electron.ipcMain.handle("cancel-all", async () => {
    downloadManager?.cancelAll();
  });
  electron.ipcMain.handle("get-queue", async () => {
    return downloadManager?.getQueue() || [];
  });
  electron.ipcMain.handle("select-directory", async () => {
    const result = await electron.dialog.showOpenDialog(mainWindow, {
      properties: ["openDirectory"]
    });
    if (!result.canceled && result.filePaths.length > 0) {
      store.set("downloadPath", result.filePaths[0]);
      return result.filePaths[0];
    }
    return null;
  });
  electron.ipcMain.handle("get-settings", async () => {
    return {
      downloadPath: store.get("downloadPath"),
      themeMode: store.get("themeMode"),
      fetchMetadata: store.get("fetchMetadata"),
      incognitoMode: store.get("incognitoMode"),
      globalPause: store.get("globalPause")
    };
  });
  electron.ipcMain.handle("set-theme", async (_event, mode) => {
    store.set("themeMode", mode);
    if (mode === "system") {
      electron.nativeTheme.themeSource = "system";
    } else {
      electron.nativeTheme.themeSource = mode;
    }
  });
  electron.ipcMain.handle("set-fetch-metadata", async (_event, enabled) => {
    store.set("fetchMetadata", enabled);
  });
  electron.ipcMain.handle("set-incognito-mode", async (_event, enabled) => {
    store.set("incognitoMode", enabled);
  });
  electron.ipcMain.handle("set-global-pause", async (_event, enabled) => {
    store.set("globalPause", enabled);
    if (enabled) {
      downloadManager?.pauseAll();
      spotifyManager?.pauseAll();
    } else {
      downloadManager?.resumeAll();
      spotifyManager?.resumeAll();
    }
  });
  electron.ipcMain.handle("pause-all", async () => {
    store.set("globalPause", true);
    downloadManager?.pauseAll();
    spotifyManager?.pauseAll();
  });
  electron.ipcMain.handle("resume-all", async () => {
    store.set("globalPause", false);
    downloadManager?.resumeAll();
    spotifyManager?.resumeAll();
  });
  electron.ipcMain.handle("check-ffmpeg", async () => {
    return checkFfmpegInstalled();
  });
  electron.ipcMain.handle("add-spotify-download", async (_event, url) => {
    if (!isValidHttpUrl(url)) {
      throw new Error("URL inválida: solo http/https");
    }
    if (!spotifyManager) return null;
    const settings = store.get("settings");
    const incognito = settings?.incognitoMode || false;
    const dlPath = store.get("downloadPath") || electron.app.getPath("downloads");
    return spotifyManager.addToQueue(url, dlPath, incognito);
  });
  electron.ipcMain.handle("open-folder", async (_event, folderPath) => {
    const storedPath = store.get("downloadPath") || electron.app.getPath("downloads");
    const target = folderPath || storedPath;
    if (folderPath && folderPath !== storedPath) {
      const resolved = path.resolve(folderPath);
      const root = path.resolve(storedPath);
      if (!resolved.startsWith(root + path.sep) && resolved !== root) {
        return;
      }
    }
    const result = await electron.shell.openPath(target);
    if (result) {
      console.error("Failed to open path:", result);
    }
  });
  electron.ipcMain.handle("check-spotdl", async () => {
    try {
      const { execSync } = require("child_process");
      execSync("spotdl --version", { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  });
  electron.ipcMain.handle("save-queue", async (_event, queue) => {
    store.set("downloadQueue", queue);
  });
  electron.ipcMain.handle("get-saved-queue", async () => {
    return store.get("downloadQueue");
  });
  electron.ipcMain.handle("check-for-updates", async () => {
    return autoUpdater.checkForUpdates().catch(() => null);
  });
  electron.ipcMain.handle("check-ytdlp", async () => {
    if (!downloadManager) return false;
    try {
      await downloadManager.ensureBinary();
      return true;
    } catch {
      return false;
    }
  });
  electron.ipcMain.handle("check-dependencies", async () => {
    const ffmpegOk = checkFfmpegInstalled();
    const spotdlOk = await (async () => {
      try {
        const { execSync } = require("child_process");
        execSync("spotdl --version", { stdio: "ignore" });
        return true;
      } catch {
        return false;
      }
    })();
    const ytdlpOk = downloadManager ? await (async () => {
      try {
        await downloadManager.ensureBinary();
        return true;
      } catch {
        return false;
      }
    })() : false;
    return { ffmpeg: ffmpegOk, spotdl: spotdlOk, ytdlp: ytdlpOk };
  });
  electron.ipcMain.handle("quit-and-install", async () => {
    if (!isUpdateDownloaded) {
      console.warn("quit-and-install called but no update is downloaded; ignoring");
      return;
    }
    isUpdateDownloaded = false;
    autoUpdater.quitAndInstall();
  });
  electron.ipcMain.handle("get-history", async () => {
    return store.get("downloadHistory", []);
  });
  electron.ipcMain.handle("add-history-entry", async (_event, entry) => {
    const history = store.get("downloadHistory", []);
    history.unshift(entry);
    store.set("downloadHistory", history.slice(0, 200));
  });
  electron.ipcMain.handle("clear-history", async () => {
    store.set("downloadHistory", []);
  });
  electron.ipcMain.handle("quit-app", async () => {
    isQuitting = true;
    electron.app.quit();
  });
}
function initDownloadManager() {
  const dlPath = store.get("downloadPath") || electron.app.getPath("downloads");
  downloadManager = new DownloadManager(
    dlPath,
    (progress) => {
      mainWindow?.webContents.send("download-progress", progress);
    },
    (item) => {
      mainWindow?.webContents.send("download-complete", item);
      const settings = store.get("settings");
      const globalIncognito = settings?.incognitoMode || false;
      if (item.incognito || globalIncognito) return;
      if (item.status === "completed") {
        const history = store.get("downloadHistory", []);
        history.unshift({
          id: item.id,
          url: item.url,
          title: item.title,
          format: item.format,
          quality: item.quality,
          source: item.source,
          outputPath: item.outputPath,
          completedAt: (/* @__PURE__ */ new Date()).toISOString()
        });
        store.set("downloadHistory", history.slice(0, 200));
        if (electron.Notification.isSupported()) {
          const notif = new electron.Notification({
            title: "Download Complete",
            body: item.title || "Your download has finished",
            silent: true
          });
          notif.show();
        }
      }
    },
    (itemId, error) => {
      mainWindow?.webContents.send("download-error", { itemId, error });
    }
  );
}
function initSpotifyManager() {
  spotifyManager = new SpotifyDownloadManager(
    (item) => {
      mainWindow?.webContents.send("download-complete", item);
      const settings = store.get("settings");
      const globalIncognito = settings?.incognitoMode || false;
      if (item.incognito || globalIncognito) return;
      if (item.status === "completed") {
        const history = store.get("downloadHistory", []);
        history.unshift({
          id: item.id,
          url: item.url,
          title: item.title,
          format: item.format,
          quality: item.quality,
          source: item.source,
          outputPath: item.outputPath,
          completedAt: (/* @__PURE__ */ new Date()).toISOString()
        });
        store.set("downloadHistory", history.slice(0, 200));
        if (electron.Notification.isSupported()) {
          const notif = new electron.Notification({
            title: "Spotify Download Complete",
            body: item.title || "Your Spotify download has finished",
            silent: true
          });
          notif.show();
        }
      }
    },
    (itemId, error) => {
      mainWindow?.webContents.send("download-error", { itemId, error });
    }
  );
}
function setupTray() {
  const iconPath = electron.app.isPackaged ? path.join(process.resourcesPath, "icon.png") : path.join(__dirname, "../../resources/icon.png");
  try {
    tray = new electron.Tray(iconPath);
    tray.setToolTip("EasyDownloader");
    const contextMenu = electron.Menu.buildFromTemplate([
      {
        label: "Show EasyDownloader",
        click: () => {
          mainWindow?.show();
          mainWindow?.focus();
        }
      },
      { type: "separator" },
      {
        label: "Exit",
        click: () => {
          tray?.destroy();
          tray = null;
          electron.app.quit();
        }
      }
    ]);
    tray.setContextMenu(contextMenu);
    tray.on("double-click", () => {
      if (mainWindow?.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow?.show();
        mainWindow?.focus();
      }
    });
  } catch {
  }
}
electron.app.whenReady().then(() => {
  electronApp.setAppUserModelId("com.easydownloader");
  electron.app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });
  const template = [
    { role: "editMenu" },
    { role: "viewMenu" },
    { role: "windowMenu" }
  ];
  if (process.platform === "darwin") {
    template.unshift({ role: "appMenu" });
  }
  const menu = electron.Menu.buildFromTemplate(template);
  electron.Menu.setApplicationMenu(menu);
  const themeMode = store.get("themeMode");
  if (themeMode === "dark") electron.nativeTheme.themeSource = "dark";
  else if (themeMode === "light") electron.nativeTheme.themeSource = "light";
  else electron.nativeTheme.themeSource = "system";
  setupIPC();
  createWindow();
  setupTray();
  initDownloadManager();
  initSpotifyManager();
  if (downloadManager) {
    downloadManager.ensureBinary().catch(() => {
      console.error("Failed to download yt-dlp binary");
    });
  }
  mainWindow?.on("close", (event) => {
    if (!electron.app.isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });
  const isPackaged = electron.app.isPackaged;
  let isUpdateDownloaded2 = false;
  autoUpdater.autoDownload = isPackaged;
  autoUpdater.autoInstallOnAppQuit = isPackaged;
  autoUpdater.on("update-available", () => {
    if (mainWindow && electron.Notification.isSupported()) {
      const notif = new electron.Notification({
        title: "Update Available",
        body: "A new version is being downloaded...",
        silent: true
      });
      notif.show();
    }
  });
  autoUpdater.on("update-not-available", () => {
  });
  autoUpdater.on("update-downloaded", () => {
    isUpdateDownloaded2 = true;
    if (mainWindow && electron.Notification.isSupported()) {
      const notif = new electron.Notification({
        title: "Update Ready",
        body: "A new version is ready. Restart to apply.",
        silent: false
      });
      notif.show();
      notif.on("click", () => {
        if (isUpdateDownloaded2) {
          isUpdateDownloaded2 = false;
          autoUpdater.quitAndInstall();
        }
      });
    }
  });
  autoUpdater.on("update-cancelled", () => {
    isUpdateDownloaded2 = false;
  });
  autoUpdater.on("error", (err) => {
    if (!isPackaged) return;
    console.error("Auto-updater error:", err);
  });
  if (isPackaged) {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch((err) => {
        console.error("checkForUpdates failed:", err);
      });
    }, 3e3);
  }
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
electron.app.on("before-quit", (event) => {
  if (isQuitting) return;
  isQuitting = true;
  event.preventDefault();
  try {
    downloadManager?.cancelAll();
    spotifyManager?.cancelAll();
  } catch (e) {
    console.error("Error during cancelAll on quit:", e);
  }
  setTimeout(() => electron.app.quit(), 500);
});
process.on("SIGTERM", () => {
  isQuitting = true;
  electron.app.quit();
});
process.on("SIGINT", () => {
  isQuitting = true;
  electron.app.quit();
});
