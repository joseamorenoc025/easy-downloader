"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const child_process = require("child_process");
const YtDlpWrap$3 = require("yt-dlp-wrap");
const crypto = require("crypto");
const https = require("node:https");
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
const { default: Store } = require("electron-store");
const isPortable = process.argv.includes("--portable") || process.env.EASYDOWNLOADER_PORTABLE === "1" || path.dirname(electron.app.getPath("exe")).toLowerCase().includes("portable");
if (isPortable) {
  electron.app.setPath("userData", path.join(path.dirname(electron.app.getPath("exe")), "data"));
}
const store = new Store({
  defaults: {
    downloadPath: electron.app.getPath("downloads"),
    themeMode: "system",
    downloadQueue: [],
    fetchMetadata: true,
    incognitoMode: false,
    globalPause: false,
    maxConcurrent: 3,
    cookiesPath: "",
    notificationsEnabled: true
  }
});
function createWindow() {
  const mainWindow2 = new electron.BrowserWindow({
    width: 960,
    height: 700,
    minWidth: 700,
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
  mainWindow2.on("ready-to-show", () => {
    mainWindow2.show();
  });
  mainWindow2.webContents.setWindowOpenHandler(({ url }) => {
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
    mainWindow2.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow2.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
  return mainWindow2;
}
const { default: YtDlpWrap$2 } = require("yt-dlp-wrap");
async function fetchMetadata(url) {
  const ytDlp = new YtDlpWrap$2();
  try {
    const stdout = await ytDlp.execPromise(["--dump-json", "--flat-playlist", "--no-warnings", url]);
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
    throw new Error(`Failed to fetch metadata: ${err.message}`, { cause: err });
  }
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
const { autoUpdater: autoUpdater$1 } = require("electron-updater");
const sessionHistory = [];
const SESSION_HISTORY_MAX = 200;
function setupIPC(deps) {
  const {
    getMainWindow: getMainWindow2,
    getDownloadManager: getDownloadManager2,
    getSpotifyManager: getSpotifyManager2,
    getIsUpdateDownloaded: getIsUpdateDownloaded2,
    setIsUpdateDownloaded: setIsUpdateDownloaded2,
    setIsQuitting: setIsQuitting2
  } = deps;
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
    const dm = getDownloadManager2();
    if (!dm) return null;
    const settings = store.get("settings");
    const incognito = settings?.incognitoMode || false;
    return dm.addToQueue({ ...options, incognito });
  });
  electron.ipcMain.handle("cancel-download", async (_event, itemId) => {
    if (itemId.startsWith("spot-")) {
      getSpotifyManager2()?.cancelItem(itemId);
    } else {
      getDownloadManager2()?.cancelItem(itemId);
    }
  });
  electron.ipcMain.handle("cancel-all", async () => {
    getDownloadManager2()?.cancelAll();
    getSpotifyManager2()?.cancelAll();
  });
  electron.ipcMain.handle("get-queue", async () => {
    const ytQueue = getDownloadManager2()?.getQueue() || [];
    const spotQueue = getSpotifyManager2()?.getQueue() || [];
    return [...ytQueue, ...spotQueue];
  });
  electron.ipcMain.handle("select-directory", async () => {
    const result = await electron.dialog.showOpenDialog(getMainWindow2(), {
      properties: ["openDirectory"]
    });
    if (!result.canceled && result.filePaths.length > 0) {
      const newPath = result.filePaths[0];
      store.set("downloadPath", newPath);
      getDownloadManager2()?.setDownloadPath(newPath);
      getSpotifyManager2()?.setDownloadPath(newPath);
      return newPath;
    }
    return null;
  });
  electron.ipcMain.handle("get-settings", async () => {
    return {
      downloadPath: store.get("downloadPath"),
      themeMode: store.get("themeMode"),
      fetchMetadata: store.get("fetchMetadata"),
      incognitoMode: store.get("incognitoMode"),
      globalPause: store.get("globalPause"),
      maxConcurrent: store.get("maxConcurrent"),
      cookiesPath: store.get("cookiesPath"),
      notificationsEnabled: store.get("notificationsEnabled")
    };
  });
  electron.ipcMain.handle("select-cookies-file", async () => {
    const result = await electron.dialog.showOpenDialog(getMainWindow2(), {
      properties: ["openFile"],
      filters: [
        { name: "Netscape Cookie File", extensions: ["txt"] },
        { name: "All Files", extensions: ["*"] }
      ]
    });
    if (!result.canceled && result.filePaths.length > 0) {
      store.set("cookiesPath", result.filePaths[0]);
      return result.filePaths[0];
    }
    return null;
  });
  electron.ipcMain.handle("set-cookies-path", async (_event, path2) => {
    store.set("cookiesPath", path2);
    getDownloadManager2()?.setCookiesPath(path2);
    getSpotifyManager2()?.setCookiesPath(path2);
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
  electron.ipcMain.handle("set-notifications", async (_event, enabled) => {
    store.set("notificationsEnabled", enabled);
  });
  electron.ipcMain.handle("set-max-concurrent", async (_event, value) => {
    const clamped = Math.max(1, Math.min(8, Math.round(value)));
    store.set("maxConcurrent", clamped);
    getDownloadManager2()?.setMaxConcurrent(clamped);
  });
  electron.ipcMain.handle("set-global-pause", async (_event, enabled) => {
    store.set("globalPause", enabled);
    if (enabled) {
      getDownloadManager2()?.pauseAll();
      getSpotifyManager2()?.pauseAll();
    } else {
      getDownloadManager2()?.resumeAll();
      getSpotifyManager2()?.resumeAll();
    }
  });
  electron.ipcMain.handle("pause-all", async () => {
    store.set("globalPause", true);
    getDownloadManager2()?.pauseAll();
    getSpotifyManager2()?.pauseAll();
  });
  electron.ipcMain.handle("resume-all", async () => {
    store.set("globalPause", false);
    getDownloadManager2()?.resumeAll();
    getSpotifyManager2()?.resumeAll();
  });
  electron.ipcMain.handle("check-ffmpeg", async () => {
    return checkFfmpegInstalled();
  });
  electron.ipcMain.handle("extract-metadata", async (_event, url) => {
    try {
      const ytDlp = new YtDlpWrap$3();
      await getDownloadManager2()?.ensureBinary();
      const isWin = process.platform === "win32";
      const binaryName = isWin ? "yt-dlp.exe" : "yt-dlp";
      const { join } = await import("path");
      const { existsSync: existsSync2 } = await import("fs");
      const { app: electronApp2 } = await import("electron");
      const binaryPath = join(electronApp2.getPath("userData"), binaryName);
      if (existsSync2(binaryPath)) {
        ytDlp.setBinaryPath(binaryPath);
      }
      const stdout = await ytDlp.execRaw([
        url,
        "--dump-json",
        "--no-warnings",
        "--no-playlist",
        "--skip-download"
      ]);
      const data = JSON.parse(stdout);
      return {
        title: data.title || data.fulltitle || "",
        artist: data.artist || data.uploader || data.channel || "",
        album: data.album || "",
        year: data.upload_year?.toString() || data.release_year?.toString() || "",
        genre: data.genres?.[0] || data.tags?.[0] || "",
        track: data.track || data.playlist_index?.toString() || "",
        thumbnail: data.thumbnail || data.thumbnails?.[data.thumbnails.length - 1]?.url || ""
      };
    } catch (err) {
      return {
        title: "",
        artist: "",
        album: "",
        year: "",
        genre: "",
        track: "",
        thumbnail: ""
      };
    }
  });
  electron.ipcMain.handle("add-spotify-download", async (_event, url, quality) => {
    if (!isValidHttpUrl(url)) {
      throw new Error("URL inválida: solo http/https");
    }
    const sm = getSpotifyManager2();
    if (!sm) return null;
    return sm.addSpotifyUrl(url, quality);
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
    return true;
  });
  electron.ipcMain.handle(
    "save-queue",
    async (_event, queue) => {
      store.set("downloadQueue", queue);
    }
  );
  electron.ipcMain.handle("get-saved-queue", async () => {
    return store.get("downloadQueue");
  });
  electron.ipcMain.handle("check-for-updates", async () => {
    return autoUpdater$1.checkForUpdates().catch(() => null);
  });
  electron.ipcMain.handle("check-ytdlp", async () => {
    const dm = getDownloadManager2();
    if (!dm) return false;
    try {
      await dm.ensureBinary();
      return true;
    } catch {
      return false;
    }
  });
  electron.ipcMain.handle("check-dependencies", async () => {
    const ffmpegOk = checkFfmpegInstalled();
    const spotdlOk = true;
    const dm = getDownloadManager2();
    const ytdlpOk = dm ? await (async () => {
      try {
        await dm.ensureBinary();
        return true;
      } catch {
        return false;
      }
    })() : false;
    return { ffmpeg: ffmpegOk, spotdl: spotdlOk, ytdlp: ytdlpOk };
  });
  electron.ipcMain.handle("quit-and-install", async () => {
    if (!getIsUpdateDownloaded2()) {
      console.warn("quit-and-install called but no update is downloaded; ignoring");
      return;
    }
    setIsUpdateDownloaded2(false);
    autoUpdater$1.quitAndInstall();
  });
  electron.ipcMain.handle("get-history", async () => {
    return sessionHistory;
  });
  electron.ipcMain.handle("add-history-entry", async (_event, entry) => {
    sessionHistory.unshift(entry);
    if (sessionHistory.length > SESSION_HISTORY_MAX) {
      sessionHistory.length = SESSION_HISTORY_MAX;
    }
  });
  electron.ipcMain.handle("clear-history", async () => {
    sessionHistory.length = 0;
  });
  electron.ipcMain.handle("check-file-exists", async (_event, filePath) => {
    try {
      return fs.existsSync(filePath);
    } catch {
      return false;
    }
  });
  electron.ipcMain.handle("show-in-folder", async (_event, filePath) => {
    try {
      electron.shell.showItemInFolder(filePath);
    } catch (err) {
      console.error("show-in-folder failed:", err);
    }
  });
  electron.ipcMain.handle("quit-app", async () => {
    setIsQuitting2(true);
    electron.app.quit();
  });
}
function setupTray(getMainWindow2) {
  const iconPath = electron.app.isPackaged ? path.join(process.resourcesPath, "icon.png") : path.join(__dirname, "../../resources/icon.png");
  try {
    const tray = new electron.Tray(iconPath);
    tray.setToolTip("EasyDownloader");
    const contextMenu = electron.Menu.buildFromTemplate([
      {
        label: "Show EasyDownloader",
        click: () => {
          const win = getMainWindow2();
          win?.show();
          win?.focus();
        }
      },
      { type: "separator" },
      {
        label: "Exit",
        click: () => {
          tray.destroy();
          electron.app.quit();
        }
      }
    ]);
    tray.setContextMenu(contextMenu);
    tray.on("double-click", () => {
      const win = getMainWindow2();
      if (win?.isVisible()) {
        win.hide();
      } else {
        win?.show();
        win?.focus();
      }
    });
    return tray;
  } catch {
    return null;
  }
}
const { autoUpdater } = require("electron-updater");
function setupAutoUpdater(deps) {
  const { getMainWindow: getMainWindow2, getIsUpdateDownloaded: getIsUpdateDownloaded2, setIsUpdateDownloaded: setIsUpdateDownloaded2 } = deps;
  const isPackaged = electron.app.isPackaged;
  autoUpdater.autoDownload = isPackaged;
  autoUpdater.autoInstallOnAppQuit = isPackaged;
  autoUpdater.on("update-available", () => {
    const win = getMainWindow2();
    if (win && electron.Notification.isSupported()) {
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
    setIsUpdateDownloaded2(true);
    const win = getMainWindow2();
    if (win && electron.Notification.isSupported()) {
      const notif = new electron.Notification({
        title: "Update Ready",
        body: "A new version is ready. Restart to apply.",
        silent: false
      });
      notif.show();
      notif.on("click", () => {
        if (getIsUpdateDownloaded2()) {
          setIsUpdateDownloaded2(false);
          autoUpdater.quitAndInstall();
        }
      });
    }
  });
  autoUpdater.on("update-cancelled", () => {
    setIsUpdateDownloaded2(false);
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
}
const VIDEO_FORMAT_MAP = {
  "best": "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
  "2160p": "bestvideo[height<=2160][ext=mp4]+bestaudio[ext=m4a]/best[height<=2160][ext=mp4]/best",
  "1440p": "bestvideo[height<=1440][ext=mp4]+bestaudio[ext=m4a]/best[height<=1440][ext=mp4]/best",
  "1080p": "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]/best",
  "720p": "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best",
  "480p": "bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480][ext=mp4]/best"
};
const AUDIO_FORMAT_MAP = {
  "320": "bestaudio[abr<=320]/bestaudio[ext=m4a]/best",
  "256": "bestaudio[abr<=256]/bestaudio[ext=m4a]/best",
  "192": "bestaudio[abr<=192]/bestaudio[ext=m4a]/best",
  "128": "bestaudio[abr<=128]/bestaudio[ext=m4a]/best"
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
function classifyYtDlpError(stderr, exitCode) {
  const s = (stderr || "").toLowerCase();
  if (s.includes("sign in to confirm") || s.includes("confirm your age") || s.includes("not a bot")) {
    return { category: "signIn", raw: stderr, exitCode };
  }
  if (s.includes("video unavailable") || s.includes("private video") || s.includes("this video is not available") || s.includes("has been removed")) {
    return { category: "unavailable", raw: stderr, exitCode };
  }
  if (s.includes("http error 403") || s.includes("http error 404")) {
    return { category: "unavailable", raw: stderr, exitCode };
  }
  if (s.includes("getaddrinfo enotfound") || s.includes("econnreset") || s.includes("etimedout") || s.includes("network is unreachable") || s.includes("connection refused")) {
    return { category: "network", raw: stderr, exitCode };
  }
  if (s.includes("socket timeout") || s.includes("read timed out") || s.includes("timed out")) {
    return { category: "network", raw: stderr, exitCode };
  }
  if (s.includes("no space left") || s.includes("enospc")) {
    return { category: "diskFull", raw: stderr, exitCode };
  }
  if (s.includes("permission denied") || s.includes("eacces")) {
    return { category: "permission", raw: stderr, exitCode };
  }
  if (s.includes("requested format not available") || s.includes("no video formats found") || s.includes("format not available")) {
    return { category: "format", raw: stderr, exitCode };
  }
  if (s.includes("unsupported url") || s.includes("no extractor") || s.includes("no suitable extractor")) {
    return { category: "unsupported", raw: stderr, exitCode };
  }
  if (s.includes("no such file") && s.includes("yt-dlp")) {
    return { category: "binary", raw: stderr, exitCode };
  }
  return { category: "unknown", raw: stderr, exitCode };
}
const { default: YtDlpWrap$1 } = require("yt-dlp-wrap");
function parseSize(str) {
  if (!str) return 0;
  const match = str.match(/([\d.]+)\s*(B|KB|MB|GB|TB|KiB|MiB|GiB|TiB)/i);
  if (!match) return 0;
  const val = parseFloat(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers = {
    b: 1,
    kb: 1024,
    kib: 1024,
    mb: 1024 * 1024,
    mib: 1024 * 1024,
    gb: 1024 * 1024 * 1024,
    gib: 1024 * 1024 * 1024,
    tb: 1024 * 1024 * 1024 * 1024,
    tib: 1024 * 1024 * 1024 * 1024
  };
  return val * (multipliers[unit] || 1);
}
class BaseDownloadManager {
  queue = [];
  activeItems = /* @__PURE__ */ new Map();
  maxConcurrent = 3;
  ytDlp;
  binaryReady = false;
  downloadPath;
  paused = false;
  /** Acumulador de stderr por item, para clasificar el error al cierre. */
  stderrBuffers = /* @__PURE__ */ new Map();
  /** Throttle: timestamp del último envío de progreso por item (ms). */
  lastProgressSent = /* @__PURE__ */ new Map();
  static PROGRESS_THROTTLE_MS = 200;
  onProgress;
  onComplete;
  onError;
  cookiesPath = "";
  constructor(downloadPath, onProgress, onComplete, onError) {
    this.downloadPath = downloadPath;
    this.ytDlp = new YtDlpWrap$1();
    this.onProgress = onProgress;
    this.onComplete = onComplete;
    this.onError = onError;
  }
  setDownloadPath(path2) {
    this.downloadPath = path2;
  }
  async ensureBinary() {
    if (this.binaryReady) return;
    const isWin = process.platform === "win32";
    const binaryName = isWin ? "yt-dlp.exe" : "yt-dlp";
    const ytDlpPath = path.join(electron.app.getPath("userData"), binaryName);
    if (fs.existsSync(ytDlpPath)) {
      this.ytDlp.setBinaryPath(ytDlpPath);
      this.binaryReady = true;
      return;
    }
    try {
      const binPath = this.ytDlp.getBinaryPath();
      if (fs.existsSync(binPath)) {
        this.binaryReady = true;
        return;
      }
    } catch {
    }
    await YtDlpWrap$1.downloadFromGithub(ytDlpPath);
    this.ytDlp.setBinaryPath(ytDlpPath);
    this.binaryReady = true;
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
  getQueue() {
    return [...this.queue];
  }
  cleanQueue() {
    this.queue = this.queue.filter(
      (i) => i.status !== "completed" && i.status !== "cancelled" && i.status !== "error"
    );
  }
  processQueue() {
    if (this.paused) return;
    const slots = this.maxConcurrent - this.activeItems.size;
    if (slots <= 0) return;
    const queued = this.queue.filter((i) => i.status === "queued").slice(0, slots);
    if (queued.length === 0) return;
    for (const item of queued) {
      this.startDownload(item);
    }
  }
  setupEmitterListeners(emitter, item, attempt, context) {
    const progressRegex = /\[download\]\s+([\d.]+)%\s+of\s+~?([\d.]+\s*\w+)\s+at\s+([\d.]+\s*\w+\/s)\s+ETA\s+(\S+)/;
    const throttledOnProgress = (data) => {
      const now = Date.now();
      const last = this.lastProgressSent.get(item.id) ?? 0;
      if (now - last >= BaseDownloadManager.PROGRESS_THROTTLE_MS) {
        this.lastProgressSent.set(item.id, now);
        this.onProgress(data);
      }
    };
    emitter.on("ytDlpEvent", (eventType, eventData) => {
      if (eventType === "Destination") {
        const filePath = eventData.trim();
        const fileName = filePath.split(/[\\/]/).pop() || "";
        item.title = fileName.replace(/\.[^.]+$/, "");
        item.outputPath = filePath;
        this.onProgress({
          id: item.id,
          percentage: item.progress.toString(),
          speed: item.speed,
          eta: item.eta,
          downloaded: "",
          total: "",
          title: item.title
        });
      }
      if (eventType === "ExtractAudio") {
        item.speed = "Procesando audio...";
        item.eta = "FFmpeg";
        this.onProgress({
          id: item.id,
          percentage: "100",
          speed: item.speed,
          eta: item.eta,
          downloaded: "",
          total: "",
          title: item.title
        });
      }
      if (eventType === "download" || eventType === "progress") {
        const rawLine = `[download] ${eventData}`;
        const match = rawLine.match(progressRegex);
        if (match) {
          const pct = parseFloat(match[1]);
          const totalSizeStr = match[2].trim();
          const speedStr = match[3].trim();
          const etaStr = match[4].trim();
          const totalBytes = parseSize(totalSizeStr);
          const downloadedBytes = totalBytes > 0 ? Math.round(pct / 100 * totalBytes) : 0;
          item.progress = pct;
          item.speed = speedStr;
          item.eta = etaStr;
          throttledOnProgress({
            id: item.id,
            percentage: pct.toFixed(1),
            speed: item.speed,
            eta: item.eta,
            downloaded: downloadedBytes > 0 ? `${downloadedBytes} B` : "",
            total: totalSizeStr,
            title: item.title,
            totalSize: totalSizeStr
          });
        }
      }
      if (typeof eventData === "string" && (eventType === "error" || eventType === "stderr" || /error|warning/i.test(eventType))) {
        const buf = this.stderrBuffers.get(item.id) || "";
        this.stderrBuffers.set(item.id, buf + eventData + "\n");
      }
    });
    emitter.on("close", (code) => {
      this.activeItems.delete(item.id);
      const stderr = this.stderrBuffers.get(item.id) || "";
      this.stderrBuffers.delete(item.id);
      const classified = classifyYtDlpError(stderr, code);
      if (code === 0) {
        item.status = "completed";
        item.progress = 100;
        this.lastProgressSent.delete(item.id);
        this.onComplete(item);
        this.cleanQueue();
        setTimeout(() => this.processQueue(), 100);
      } else if (item.status !== "cancelled") {
        if (context) console.error(`[${context}] Download failed (code=${code}): ${item.url}`);
        if (attempt < 3 && !this.paused) {
          item.speed = `Reintentando (${attempt}/3)...`;
          this.onProgress({
            id: item.id,
            percentage: item.progress.toString(),
            speed: item.speed,
            eta: "",
            downloaded: "",
            total: "",
            title: item.title
          });
          setTimeout(() => this.startDownload(item, attempt + 1), 3e3);
        } else {
          const details = stderr || `Process exited with code ${code}`;
          item.status = "error";
          item.error = details;
          item.errorCategory = classified.category;
          item.errorDetails = details;
          this.lastProgressSent.delete(item.id);
          this.onError(item.id, classified.category, details);
          this.cleanQueue();
          setTimeout(() => this.processQueue(), 100);
        }
      }
    });
    emitter.on("error", (err) => {
      this.activeItems.delete(item.id);
      const stderr = this.stderrBuffers.get(item.id) || err.message || "";
      this.stderrBuffers.delete(item.id);
      const classified = classifyYtDlpError(stderr);
      if (context) console.error(`[${context}] Download error: ${err.message} for ${item.url}`);
      if (item.status !== "cancelled") {
        if (attempt < 3 && !this.paused) {
          item.speed = `Reintentando (${attempt}/3)...`;
          this.onProgress({
            id: item.id,
            percentage: item.progress.toString(),
            speed: item.speed,
            eta: "",
            downloaded: "",
            total: "",
            title: item.title
          });
          setTimeout(() => this.startDownload(item, attempt + 1), 3e3);
        } else {
          item.status = "error";
          item.error = stderr || err.message;
          item.errorCategory = classified.category;
          item.errorDetails = stderr || err.message;
          this.lastProgressSent.delete(item.id);
          this.onError(item.id, classified.category, stderr || err.message);
          this.cleanQueue();
          setTimeout(() => this.processQueue(), 100);
        }
      }
    });
  }
  validateUrl(url) {
    if (!isValidHttpUrl(url)) {
      return false;
    }
    return true;
  }
}
class DownloadManager extends BaseDownloadManager {
  progressTimers = /* @__PURE__ */ new Map();
  lastProgressUpdate = /* @__PURE__ */ new Map();
  PROGRESS_THROTTLE_MS = 100;
  constructor(downloadPath, onProgress, onComplete, onError) {
    super(downloadPath, onProgress, onComplete, onError);
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
      source: "youtube",
      incognito: options.incognito || false,
      writeSubtitles: options.writeSubtitles || false,
      metadata: options.metadata
    };
    this.queue.push(item);
    this.processQueue();
    return item;
  }
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
  resumeAll() {
    this.paused = false;
    const queuedItems = this.queue.filter((i) => i.status === "queued" && i.speed === "Pausado");
    for (const item of queuedItems) {
      item.status = "queued";
      item.speed = "";
    }
    this.processQueue();
  }
  setMaxConcurrent(value) {
    this.maxConcurrent = Math.max(1, Math.min(8, Math.round(value)));
    this.processQueue();
  }
  setCookiesPath(path2) {
    this.cookiesPath = path2;
  }
  startDownload(item, attempt = 1) {
    if (!this.validateUrl(item.url)) {
      item.status = "error";
      item.error = "URL inválida: solo se permiten http y https";
      item.errorCategory = "unsupported";
      item.errorDetails = item.error;
      this.onError(item.id, "unsupported", item.error);
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
      ...item.format === "audio" ? [
        "--extract-audio",
        "--audio-format",
        "mp3",
        "--audio-quality",
        item.quality,
        "--embed-thumbnail",
        "--add-metadata"
      ] : ["--write-subs", "--sub-langs", "en,es", "--embed-subs"],
      ...this.cookiesPath ? ["--cookies", this.cookiesPath] : [],
      ...item.metadata ? [
        ...item.metadata.title ? ["--replace-in-metadata", "title", ".*", item.metadata.title] : [],
        ...item.metadata.artist ? ["--replace-in-metadata", "artist", ".*", item.metadata.artist] : [],
        ...item.metadata.album ? ["--replace-in-metadata", "album", ".*", item.metadata.album] : [],
        ...item.metadata.year ? ["--replace-in-metadata", "upload_year", ".*", item.metadata.year] : [],
        ...item.metadata.genre ? ["--replace-in-metadata", "genre", ".*", item.metadata.genre] : [],
        ...item.metadata.track ? ["--replace-in-metadata", "track", ".*", item.metadata.track] : []
      ] : []
    ];
    try {
      const emitter = this.ytDlp.exec(args);
      this.activeItems.set(item.id, { item, emitter });
      this.setupEmitterListeners(emitter, item, attempt);
      emitter.on("ytDlpEvent", (eventType, eventData) => {
        if (eventType === "Merger") {
          item.speed = "Fusionando (FFmpeg)...";
          item.eta = "FFmpeg";
          this.onProgress({
            id: item.id,
            percentage: "100",
            speed: item.speed,
            eta: item.eta,
            downloaded: "",
            total: "",
            title: item.title
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
              total: "",
              title: item.title
            });
          }
        }
      });
    } catch (err) {
      item.status = "error";
      item.error = err.message;
      item.errorCategory = "unknown";
      item.errorDetails = err.message;
      this.onError(item.id, "unknown", err.message);
    }
  }
}
function parseDuration(text) {
  const parts = text.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}
function extractText(runs) {
  if (!runs) return "";
  if (typeof runs === "string") return runs;
  if (Array.isArray(runs)) return runs.map((r) => r.text || "").join("");
  if (runs.runs) return runs.runs.map((r) => r.text || "").join("");
  return runs.simpleText || "";
}
function httpsGet(url, headers) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, (res) => {
      if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
      res.on("error", reject);
    });
    req.on("error", reject);
    req.setTimeout(15e3, () => {
      req.destroy();
      reject(new Error("Timeout"));
    });
  });
}
class YtdlpSearchProvider {
  cache = /* @__PURE__ */ new Map();
  MAX_CACHE = 100;
  async searchFirst(artist, title) {
    const query = `${artist} - ${title}`;
    const cacheKey = query.toLowerCase();
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      return cached.length > 0 ? cached[0] : null;
    }
    const candidates = await this.fetchCandidates(query);
    if (this.cache.size >= this.MAX_CACHE) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(cacheKey, candidates);
    return candidates.length > 0 ? candidates[0] : null;
  }
  async fetchCandidates(query) {
    try {
      const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
      const html = await httpsGet(url, {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept": "text/html,application/xhtml+xml"
      });
      const match = html.match(/ytInitialData\s*=\s*({.+?});\s*<\/script>/);
      if (!match) return [];
      const data = JSON.parse(match[1]);
      const contents = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];
      const results = [];
      for (const section of contents) {
        const items = section?.itemSectionRenderer?.contents || [];
        for (const item of items) {
          const r = item?.videoRenderer;
          if (!r || !r.videoId) continue;
          results.push({
            id: r.videoId,
            title: extractText(r.title),
            uploader: extractText(r.ownerText || r.shortBylineText),
            duration: parseDuration(r.lengthText?.simpleText || ""),
            url: `https://www.youtube.com/watch?v=${r.videoId}`
          });
          if (results.length >= 5) break;
        }
        if (results.length >= 5) break;
      }
      return results;
    } catch (err) {
      console.error("[yt-search] Failed:", err);
      return [];
    }
  }
}
const factory = require("spotify-url-info");
function sanitizeFilename(name) {
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "").replace(/\s+/g, " ").trim();
}
const MAX_FILENAME_LENGTH = 200;
class SpotifyDownloadManager extends BaseDownloadManager {
  searcher;
  onTrackError;
  spotifyUrlInfo = factory(globalThis.fetch);
  constructor(downloadPath, onProgress, onComplete, onError, onTrackError) {
    super(downloadPath, onProgress, onComplete, onError);
    this.searcher = new YtdlpSearchProvider();
    this.onTrackError = onTrackError;
  }
  async addSpotifyUrl(url, quality) {
    await this.ensureBinary();
    const addedItems = [];
    try {
      const resolved = await this.resolveSpotifyUrl(url);
      if (resolved.tracks.length === 0) {
        const item = this.createItem(url, "No tracks found");
        item.status = "error";
        item.error = "No se encontraron canciones en la URL de Spotify";
        this.onError(item.id, "unavailable", item.error);
        return [item];
      }
      for (const track of resolved.tracks) {
        const title = `${track.artist} - ${track.name}`;
        const item = this.createItem(url, title);
        item.spotifyTrack = track;
        if (quality) item.quality = quality;
        if (resolved.playlistName) {
          ;
          item.playlistName = resolved.playlistName;
        }
        this.queue.push(item);
        addedItems.push(item);
      }
      this.processQueue();
    } catch (err) {
      const item = this.createItem(url, "Fetching from Spotify...");
      item.status = "error";
      item.error = err.message;
      this.onError(item.id, item.error);
      addedItems.push(item);
    }
    return addedItems;
  }
  createItem(url, title) {
    return {
      id: `spot-${crypto.randomUUID()}`,
      url,
      title,
      status: "queued",
      progress: 0,
      speed: "",
      eta: "",
      totalBytes: 0,
      downloadedBytes: 0,
      format: "audio",
      quality: "128",
      source: "spotify"
    };
  }
  async resolveSpotifyUrl(url) {
    try {
      const data = await this.spotifyUrlInfo.getData(url);
      const type = data.uri?.split(":")[1];
      if (type === "track") {
        const preview2 = this.spotifyUrlInfo.getPreview ? await this.spotifyUrlInfo.getPreview(url) : null;
        const trackData = data;
        const artist = trackData.artists?.map((a) => a.name).join(", ") || preview2?.artist || "Unknown";
        const name = trackData.name || preview2?.track || "Unknown";
        return { tracks: [{ name, artist, duration: trackData.duration_ms, uri: trackData.uri }] };
      }
      const playlistName = data.name || "Playlist";
      if (type === "playlist" || type === "album") {
        const tracksResult = await this.spotifyUrlInfo.getTracks(url);
        const tracks = tracksResult.map((t) => ({
          name: t.name,
          artist: t.artist,
          duration: t.duration,
          uri: t.uri
        }));
        return { playlistName, tracks };
      }
      const preview = await this.spotifyUrlInfo.getPreview(url);
      return { tracks: [{ name: preview.track, artist: preview.artist, uri: url }] };
    } catch (err) {
      throw new Error(`Error al obtener metadata de Spotify: ${err.message}`, {
        cause: err
      });
    }
  }
  startDownload(item, attempt = 1) {
    if (!this.validateUrl(item.url)) {
      item.status = "error";
      item.error = "URL inválida: solo se permiten http y https";
      this.onError(item.id, "unsupported", item.error);
      return;
    }
    item.status = "downloading";
    const spotifyTrack = item.spotifyTrack;
    const executeDownload = (youtubeUrl) => {
      const playlistName = item.playlistName;
      const sanitizedArtist = spotifyTrack ? sanitizeFilename(spotifyTrack.artist) : "";
      const sanitizedTitle = spotifyTrack ? sanitizeFilename(spotifyTrack.name) : `track-${item.id}`;
      const trackFilename = `${sanitizedArtist} - ${sanitizedTitle}`.slice(0, MAX_FILENAME_LENGTH);
      let outputDir = this.downloadPath;
      if (playlistName) {
        const sanitizedPlaylist = sanitizeFilename(playlistName).slice(0, 100);
        outputDir = path.join(this.downloadPath, sanitizedPlaylist);
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }
      }
      const outTemplate = path.join(outputDir, `${trackFilename}.%(ext)s`);
      const quality = item.quality || "128";
      const formatStr = AUDIO_FORMAT_MAP[quality] || AUDIO_FORMAT_MAP["128"];
      const args = [
        youtubeUrl,
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
        formatStr,
        "-o",
        outTemplate,
        "--extract-audio",
        "--audio-format",
        "mp3",
        "--audio-quality",
        quality,
        ...this.cookiesPath ? ["--cookies", this.cookiesPath] : []
      ];
      try {
        const emitter = this.ytDlp.exec(args);
        this.activeItems.set(item.id, { item, emitter });
        this.setupEmitterListeners(emitter, item, attempt, "spotify");
        const originalComplete = this.onComplete;
        const wrappedOnComplete = (completedItem) => {
          if (spotifyTrack) {
            completedItem.title = `${spotifyTrack.artist} - ${spotifyTrack.name}`;
          }
          originalComplete(completedItem);
        };
        this.onComplete = wrappedOnComplete;
        emitter.on("close", () => {
          this.onComplete = originalComplete;
        });
      } catch (err) {
        item.status = "error";
        item.error = err.message;
        this.onError(item.id, "unknown", err.message);
      }
    };
    if (spotifyTrack) {
      this.searcher.searchFirst(spotifyTrack.artist, spotifyTrack.name).then((match) => {
        if (!match) {
          const trackName = `${spotifyTrack.artist} - ${spotifyTrack.name}`;
          item.status = "error";
          item.error = `No se encontró en YouTube: ${trackName}`;
          this.onTrackError(item.id, trackName);
          this.onError(item.id, "unavailable", item.error);
          this.cleanQueue();
          setTimeout(() => this.processQueue(), 100);
          return;
        }
        executeDownload(match.url);
      }).catch((err) => {
        item.status = "error";
        item.error = err.message;
        this.onError(item.id, "unknown", item.error);
        this.cleanQueue();
        setTimeout(() => this.processQueue(), 100);
      });
    } else {
      executeDownload(item.url);
    }
  }
}
const { default: YtDlpWrap } = require("yt-dlp-wrap");
class YtDlpUpdater {
  lastCheck = 0;
  isUpdating = false;
  async checkAndUpdate() {
    const now = Date.now();
    if (now - this.lastCheck < 24 * 60 * 60 * 1e3) return;
    if (this.isUpdating) return;
    this.isUpdating = true;
    this.lastCheck = now;
    try {
      const currentVersion = this.getVersion();
      if (!currentVersion) {
        await this.downloadStandalone();
        return;
      }
      const latestVersion = await this.getLatestVersion();
      if (!latestVersion) {
        return;
      }
      if (currentVersion === latestVersion) {
        return;
      }
      if (this.isPipInstalled()) {
        await this.updateViaPip();
      } else {
        await this.downloadStandalone();
      }
    } catch (err) {
      console.error("[yt-dlp] Update failed:", err);
    } finally {
      this.isUpdating = false;
    }
  }
  getVersion() {
    try {
      const isWin = process.platform === "win32";
      const binaryName = isWin ? "yt-dlp.exe" : "yt-dlp";
      const binaryPath = path.join(electron.app.getPath("userData"), binaryName);
      return child_process.execSync(`"${binaryPath}" --version`, { stdio: "pipe", timeout: 1e4 }).toString().trim();
    } catch {
      return null;
    }
  }
  async getLatestVersion() {
    try {
      const releases = await YtDlpWrap.getGithubReleases("yt-dlp", "yt-dlp", 1);
      if (releases && releases.length > 0) {
        return releases[0].tag_name?.replace(/^v/, "") || null;
      }
    } catch {
    }
    try {
      const pipOutput = child_process.execSync("pip index versions yt-dlp", {
        stdio: "pipe",
        timeout: 15e3
      }).toString();
      const match = pipOutput.match(/yt-dlp\s+\(([^)]+)\)/);
      if (match) return match[1];
    } catch {
    }
    return null;
  }
  isPipInstalled() {
    try {
      child_process.execSync("pip show yt-dlp", { stdio: "ignore", timeout: 5e3 });
      return true;
    } catch {
      return false;
    }
  }
  async updateViaPip() {
    child_process.execSync("pip install -U yt-dlp", { stdio: "pipe", timeout: 12e4 });
  }
  async downloadStandalone() {
    const isWin = process.platform === "win32";
    const binaryName = isWin ? "yt-dlp.exe" : "yt-dlp";
    const binaryPath = path.join(electron.app.getPath("userData"), binaryName);
    await YtDlpWrap.downloadFromGithub(binaryPath);
  }
}
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
});
let mainWindow = null;
let downloadManager = null;
let spotifyManager = null;
let isQuitting = false;
let isUpdateDownloaded = false;
const isTestMode = process.env.EASYDOWNLOADER_TEST === "1";
function getMainWindow() {
  return mainWindow;
}
function getDownloadManager() {
  return downloadManager;
}
function getSpotifyManager() {
  return spotifyManager;
}
function getIsUpdateDownloaded() {
  return isUpdateDownloaded;
}
function setIsUpdateDownloaded(v) {
  isUpdateDownloaded = v;
}
function setIsQuitting(v) {
  isQuitting = v;
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
      const globalIncognito = store.get("incognitoMode") || false;
      if (item.incognito || globalIncognito) return;
      if (item.status === "completed") {
        const entry = {
          id: item.id,
          url: item.url,
          title: item.title,
          format: item.format,
          quality: item.quality,
          source: item.source,
          outputPath: item.outputPath,
          completedAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        sessionHistory.unshift(entry);
        if (sessionHistory.length > 200) sessionHistory.length = 200;
        mainWindow?.webContents.send("history-entry-added", entry);
        if (electron.Notification.isSupported() && store.get("notificationsEnabled")) {
          const notif = new electron.Notification({
            title: "Download Complete",
            body: item.title || "Your download has finished",
            silent: true
          });
          notif.show();
        }
      }
    },
    (itemId, errorCategory, errorDetails) => {
      mainWindow?.webContents.send("download-error", {
        itemId,
        error: errorCategory,
        category: errorCategory,
        details: errorDetails
      });
    }
  );
  const cookiesPath = store.get("cookiesPath") || "";
  if (cookiesPath) {
    downloadManager.setCookiesPath(cookiesPath);
  }
}
function initSpotifyManager() {
  const dlPath = store.get("downloadPath") || electron.app.getPath("downloads");
  spotifyManager = new SpotifyDownloadManager(
    dlPath,
    (progress) => {
      mainWindow?.webContents.send("download-progress", progress);
    },
    (item) => {
      mainWindow?.webContents.send("download-complete", item);
      const globalIncognito = store.get("incognitoMode") || false;
      if (item.incognito || globalIncognito) return;
      if (item.status === "completed") {
        const entry = {
          id: item.id,
          url: item.url,
          title: item.title,
          format: item.format,
          quality: item.quality,
          source: item.source,
          outputPath: item.outputPath,
          completedAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        sessionHistory.unshift(entry);
        if (sessionHistory.length > 200) sessionHistory.length = 200;
        mainWindow?.webContents.send("history-entry-added", entry);
        if (electron.Notification.isSupported() && store.get("notificationsEnabled")) {
          const notif = new electron.Notification({
            title: "Spotify Download Complete",
            body: item.title || "Your Spotify download has finished",
            silent: true
          });
          notif.show();
        }
      }
    },
    (itemId, errorCategory, errorDetails) => {
      mainWindow?.webContents.send("download-error", {
        itemId,
        error: errorCategory,
        category: errorCategory,
        details: errorDetails
      });
    },
    (itemId, trackTitle) => {
      mainWindow?.webContents.send("spotify-track-error", { itemId, trackTitle });
    }
  );
  const cookiesPath = store.get("cookiesPath") || "";
  if (cookiesPath) {
    spotifyManager.setCookiesPath(cookiesPath);
  }
}
electron.app.whenReady().then(() => {
  electronApp.setAppUserModelId("com.easydownloader");
  electron.app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });
  const template = [{ role: "editMenu" }, { role: "viewMenu" }, { role: "windowMenu" }];
  if (process.platform === "darwin") {
    template.unshift({ role: "appMenu" });
  }
  const menu = electron.Menu.buildFromTemplate(template);
  electron.Menu.setApplicationMenu(menu);
  const themeMode = store.get("themeMode");
  if (themeMode === "dark") electron.nativeTheme.themeSource = "dark";
  else if (themeMode === "light") electron.nativeTheme.themeSource = "light";
  else electron.nativeTheme.themeSource = "system";
  store.set("globalPause", false);
  initDownloadManager();
  initSpotifyManager();
  setupIPC({
    getMainWindow,
    getDownloadManager,
    getSpotifyManager,
    getIsUpdateDownloaded,
    setIsUpdateDownloaded,
    setIsQuitting
  });
  mainWindow = createWindow();
  if (!isTestMode) {
    mainWindow.webContents.on("context-menu", (_, params) => {
      const template2 = [];
      if (params.selectionText) {
        template2.push({ role: "copy" });
        template2.push({ type: "separator" });
      }
      if (params.isEditable) {
        template2.push({
          label: "Pegar",
          accelerator: "CmdOrCtrl+V",
          click: () => {
            const text = electron.clipboard.readText();
            if (text) {
              mainWindow?.webContents.send("context-paste", { text, autoGo: false });
            }
          }
        });
        template2.push({
          label: "Pegar e ir",
          click: () => {
            const text = electron.clipboard.readText();
            if (text) {
              mainWindow?.webContents.send("context-paste", { text, autoGo: true });
            }
          }
        });
        template2.push({ type: "separator" });
        template2.push({ role: "cut" });
        template2.push({ role: "selectAll" });
      }
      if (template2.length > 0) {
        electron.Menu.buildFromTemplate(template2).popup();
      }
    });
  }
  setupTray(getMainWindow);
  if (!isTestMode) {
    mainWindow.on("close", (event) => {
      if (!electron.app.isQuitting) {
        event.preventDefault();
        mainWindow?.hide();
      }
    });
  }
  if (!isTestMode) {
    downloadManager?.ensureBinary().catch(() => {
      console.error("Failed to download yt-dlp binary");
    });
    const ytDlpUpdater = new YtDlpUpdater();
    ytDlpUpdater.checkAndUpdate().catch((err) => console.error(err));
    setInterval(
      () => {
        ytDlpUpdater.checkAndUpdate().catch((err) => console.error(err));
      },
      24 * 60 * 60 * 1e3
    );
  }
  if (!isTestMode) {
    setupAutoUpdater({ getMainWindow, getIsUpdateDownloaded, setIsUpdateDownloaded });
  }
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
    }
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
