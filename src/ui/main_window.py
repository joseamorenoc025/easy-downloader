import customtkinter as ctk
import threading
import os
import re
import webbrowser
from tkinter import filedialog
from core.metadata import fetch_metadata
from core.downloader import build_download_options
from core.ffmpeg_utils import check_ffmpeg_installed
from utils.threading_utils import DownloadWorker
from utils.validators import is_valid_url
from utils.formatters import estimate_filesize, format_duration
from ui.dialogs import show_error, show_info, ask_yes_no
from config.settings import settings

LINK_COLOR = "#5dade2"  # Lighter, more readable blue for dark themes

class QueueItemFrame(ctk.CTkFrame):
    def __init__(self, master, title, status, output_path=None, **kwargs):
        super().__init__(master, **kwargs)
        self.output_path = output_path
        
        # Upper area with title and Open button
        top_frame = ctk.CTkFrame(self, fg_color="transparent")
        top_frame.pack(fill="x", padx=10, pady=(5, 0))
        
        self.title_label = ctk.CTkLabel(top_frame, text=title[:60] + "..." if len(title) > 60 else title, anchor="w", font=("Inter", 14, "bold"))
        self.title_label.pack(side="left", fill="x", expand=True)
        
        if self.output_path:
            open_btn = ctk.CTkButton(top_frame, text="📁 Abrir", width=60, height=25, 
                                     fg_color="transparent", hover_color="gray", border_width=1,
                                     font=("Inter", 12), command=self.open_location)
            open_btn.pack(side="right")
        
        self.status_label = ctk.CTkLabel(self, text=status, anchor="w", text_color="lightgray", font=("Inter", 12))
        self.status_label.pack(fill="x", padx=10)
        
        self.progress_bar = ctk.CTkProgressBar(self, height=8)
        self.progress_bar.set(0)
        self.progress_bar.pack(fill="x", padx=10, pady=(5, 10))

    def update_progress(self, percent, text):
        self.progress_bar.set(percent)
        self.status_label.configure(text=text)
        
    def open_location(self):
        if self.output_path and os.path.exists(self.output_path):
            os.startfile(self.output_path)

class MainWindow(ctk.CTk):
    def __init__(self):
        super().__init__()
        self.title("🎬 EasyDownloader")
        self.geometry("850x700")  # Aumenté un poco el tamaño inicial de la ventana para que los elementos respiren
        ctk.set_appearance_mode(settings.theme_mode)
        
        self.queue_frames = {}
        self.current_download_dir = settings.get_download_path()
        
        self.worker = DownloadWorker(
            on_progress=self.on_download_progress,
            on_complete=self.on_download_complete,
            on_error=self.on_download_error
        )
        
        self._setup_ui()
        self._check_ffmpeg()

    def _check_ffmpeg(self):
        if not check_ffmpeg_installed():
            show_error("Dependencia Faltante", "FFmpeg no está instalado o no en PATH.\nLa extracción de audio y mezcla de video fallarán.", self)

    def _setup_ui(self):
        # Top Frame for Input
        self.input_frame = ctk.CTkFrame(self)
        self.input_frame.pack(fill="x", padx=20, pady=20)
        
        self.url_entry = ctk.CTkEntry(self.input_frame, placeholder_text="Pega la URL de YouTube aquí...", font=("Inter", 14), height=40)
        self.url_entry.pack(side="left", fill="x", expand=True, padx=(10, 10), pady=15)
        
        self.download_btn = ctk.CTkButton(self.input_frame, text="Descargar", width=120, height=40, font=("Inter", 14, "bold"), command=self.start_download_flow)
        self.download_btn.pack(side="right", padx=(0, 10), pady=15)
        
        # Info & Path Frame
        self.info_frame = ctk.CTkFrame(self)
        self.info_frame.pack(fill="x", padx=20, pady=(0, 20))
        
        # Path selection
        path_frame = ctk.CTkFrame(self.info_frame, fg_color="transparent")
        path_frame.pack(fill="x", padx=10, pady=10)
        
        ctk.CTkLabel(path_frame, text="Tus videos y canciones se guardarán aquí:", font=("Inter", 14, "bold")).pack(side="left")
        self.path_label = ctk.CTkLabel(path_frame, text=self.current_download_dir, font=("Inter", 14, "underline"), cursor="hand2", text_color=LINK_COLOR)
        self.path_label.pack(side="left", padx=10)
        self.path_label.bind("<Button-1>", lambda e: os.startfile(self.current_download_dir) if os.path.exists(self.current_download_dir) else None)
        
        self.change_path_btn = ctk.CTkButton(path_frame, text="Cambiar Ruta", width=100, height=30, font=("Inter", 12), command=self.change_download_dir)
        self.change_path_btn.pack(side="right")
        
        # Status Label
        self.status_info_label = ctk.CTkLabel(self.info_frame, text="Listo.", font=("Inter", 14))
        self.status_info_label.pack(anchor="w", padx=10, pady=(0, 10))
        
        # Options Frame
        self.opts_frame = ctk.CTkFrame(self)
        self.opts_frame.pack(fill="x", padx=20, pady=(0, 20))
        
        self.mode_var = ctk.StringVar(value="Video")
        self.mode_video = ctk.CTkRadioButton(self.opts_frame, text="Video", variable=self.mode_var, value="Video", font=("Inter", 14), command=self._update_quality_opts)
        self.mode_video.pack(side="left", padx=20, pady=15)
        
        self.mode_audio = ctk.CTkRadioButton(self.opts_frame, text="Audio", variable=self.mode_var, value="Audio", font=("Inter", 14), command=self._update_quality_opts)
        self.mode_audio.pack(side="left", padx=20, pady=15)
        
        self.quality_var = ctk.StringVar(value="Best")
        self.quality_combo = ctk.CTkComboBox(self.opts_frame, variable=self.quality_var, values=["Best", "1080p", "720p", "480p"], state="readonly", font=("Inter", 14), dropdown_font=("Inter", 14))
        self.quality_combo.pack(side="left", padx=20, pady=15)
        
        # Queue Frame
        self.queue_label = ctk.CTkLabel(self, text="Cola de Descargas", font=("Inter", 18, "bold"))
        self.queue_label.pack(anchor="w", padx=20)
        
        self.queue_frame = ctk.CTkScrollableFrame(self)
        self.queue_frame.pack(fill="both", expand=True, padx=20, pady=(5, 10))
        
        # Footer
        footer_frame = ctk.CTkFrame(self, fg_color="transparent")
        footer_frame.pack(fill="x", pady=(0, 10))
        
        footer_text = ctk.CTkLabel(footer_frame, text="Desarrollado por: José Moreno. Si te gusta deja una estrella en mi github ⭐", 
                                   font=("Inter", 13), cursor="hand2", text_color=LINK_COLOR)
        footer_text.pack()
        footer_text.bind("<Button-1>", lambda e: webbrowser.open("https://github.com/JoseMoreno20"))

    def change_download_dir(self):
        new_dir = filedialog.askdirectory(initialdir=self.current_download_dir)
        if new_dir:
            self.current_download_dir = os.path.normpath(new_dir)
            self.path_label.configure(text=self.current_download_dir)
            
    def _update_quality_opts(self):
        if self.mode_var.get() == "Audio":
            self.quality_combo.configure(values=["320kbps", "256kbps", "192kbps", "128kbps"])
            self.quality_var.set("192kbps")
        else:
            self.quality_combo.configure(values=["Best", "1080p", "720p", "480p"])
            self.quality_var.set("Best")

    def start_download_flow(self):
        url = self.url_entry.get().strip()
        if not is_valid_url(url):
            show_error("URL Inválida", "Por favor ingresa una URL válida de YouTube.", self)
            return
            
        self.download_btn.configure(state="disabled", text="Procesando...")
        self.status_info_label.configure(text="Obteniendo información del enlace...")
        
        threading.Thread(target=self._fetch_metadata_thread, args=(url,), daemon=True).start()

    def _fetch_metadata_thread(self, url):
        try:
            info = fetch_metadata(url)
            self.after(0, self._on_metadata_success, url, info)
        except Exception as e:
            self.after(0, self._on_metadata_error, str(e))

    def _on_metadata_success(self, url, info):
        title = info['title']
        target_dir = self.current_download_dir
        
        if info['is_playlist']:
            title = f"[Playlist] {title} ({info['count']} videos)"
            # Ask if they want a subfolder
            create_subfolder = ask_yes_no(
                "Playlist Detectada", 
                f"Has introducido una playlist.\n¿Deseas crear una carpeta llamada '{info['title']}' dentro de la ruta seleccionada para mayor organización?", 
                self
            )
            if create_subfolder:
                # Sanitize folder name
                safe_folder_name = "".join([c for c in info['title'] if c.isalpha() or c.isdigit() or c==' ']).rstrip()
                if not safe_folder_name:
                    safe_folder_name = "Playlist_Descargada"
                target_dir = os.path.join(self.current_download_dir, safe_folder_name)
                os.makedirs(target_dir, exist_ok=True)
                
        # Update details
        if not info['is_playlist']:
            dur = format_duration(info.get('duration', 0))
            self.status_info_label.configure(text=f"Añadido: {title} | Duración: {dur}")
        else:
            self.status_info_label.configure(text=f"Añadido: {title}")
            
        self._add_to_queue_internal(url, info, target_dir)
        
        self.download_btn.configure(state="normal", text="Descargar")
        self.url_entry.delete(0, 'end')

    def _on_metadata_error(self, error):
        self.status_info_label.configure(text="Error obteniendo información.")
        self.download_btn.configure(state="normal", text="Descargar")
        show_error("Error de Metadata", error, self)

    def _add_to_queue_internal(self, url, info, target_dir):
        mode = self.mode_var.get()
        quality = self.quality_var.get()
        
        output_template = '%(title)s.%(ext)s'
        opts = build_download_options(mode, quality, output_template, target_dir)
        
        title = info['title']
        if title in self.queue_frames:
            title += f" ({self.worker.get_queue_size()})"
            
        # Add UI item
        q_item = QueueItemFrame(self.queue_frame, title, "En cola...", output_path=target_dir)
        q_item.pack(fill="x", pady=2)
        self.queue_frames[title] = q_item
        
        # Add to worker queue
        self.worker.add_to_queue(url, opts, title)

    def on_download_progress(self, d, title):
        if title in self.queue_frames:
            q_item = self.queue_frames[title]
            
            if d['status'] == 'downloading':
                try:
                    percent_str = d.get('_percent_str', '0%').strip()
                    # Clean ANSI escape codes
                    percent_str = re.sub(r'\x1b\[[0-9;]*m', '', percent_str)
                    percent = float(percent_str.replace('%', '')) / 100.0
                    
                    # Simplificamos el texto para evitar que salten montos erráticos de velocidad/tamaño
                    text = f"Descargando: {percent_str}"
                    
                    self.after(0, q_item.update_progress, percent, text)
                except Exception:
                    pass

    def on_download_complete(self, title):
        if title in self.queue_frames:
            q_item = self.queue_frames[title]
            self.after(0, q_item.update_progress, 1.0, "¡Completado!")

    def on_download_error(self, title, error):
        if title in self.queue_frames:
            q_item = self.queue_frames[title]
            self.after(0, q_item.update_progress, 0, f"Error: {error}")
