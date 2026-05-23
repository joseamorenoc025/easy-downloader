# 🚀 EasyDownloader

![Python](https://img.shields.io/badge/Python-3.10+-blue.svg)
![CustomTkinter](https://img.shields.io/badge/GUI-CustomTkinter-brightgreen.svg)
![yt-dlp](https://img.shields.io/badge/Backend-yt--dlp-red.svg)
![License](https://img.shields.io/badge/License-MIT-blue.svg)

**EasyDownloader** es una aplicación de escritorio sencilla, robusta y con una interfaz moderna para descargar videos y extraer audio de YouTube (y otros sitios soportados). Está construida en Python utilizando `CustomTkinter` para una interfaz de usuario elegante y minimalista, y `yt-dlp` junto con `ffmpeg` para un rendimiento de descarga y conversión de alta calidad.

---

## ✨ Características Principales

- 📥 **Sistema de Cola (Queue)**: Añade múltiples videos o listas de reproducción para descargar de forma secuencial, sin congelar ni sobrecargar tu PC.
- 🎵 **Modos de Audio y Video**: Descarga videos en formato **MP4** o extrae únicamente el audio en formato **MP3**.
- ⚙️ **Selección de Calidad**: Elige tu resolución preferida para videos (ej. 1080p, 720p) o la mejor calidad de audio disponible.
- 📊 **Estimaciones en Tiempo Real**: Visualiza el tamaño estimado del archivo, el progreso y la velocidad de descarga en tiempo real.
- 🦋 **Diseño Ligero y Moderno**: Interfaz de usuario con modo oscuro/claro y bajo consumo de recursos gracias a `CustomTkinter`.

---

## 🛠️ Requisitos del Sistema

- **Python**: Versión 3.10 o superior.
- **FFmpeg**: Es **obligatorio** tener `ffmpeg` instalado y agregado al PATH de tu sistema operativo. Es necesario para la extracción de audio y el ensamblaje de video y audio de alta calidad.
  - [Descargar FFmpeg](https://ffmpeg.org/download.html)

---

## 🚀 Instalación y Configuración

Sigue estos pasos para ejecutar el proyecto en tu máquina local:

1. **Clonar el repositorio**:
   ```bash
   git clone https://github.com/tu-usuario/EasyDownloader.git
   cd EasyDownloader
   ```

2. **Crear un entorno virtual** (Recomendado):
   ```bash
   python -m venv venv
   ```

3. **Activar el entorno virtual**:
   - **Windows**:
     ```bash
     venv\Scripts\activate
     ```
   - **Linux/Mac**:
     ```bash
     source venv/bin/activate
     ```

4. **Instalar las dependencias**:
   ```bash
   pip install -r requirements.txt
   ```

5. **Configuración opcional**:
   Puedes copiar el archivo de ejemplo de variables de entorno para personalizar ajustes básicos:
   ```bash
   cp .env.example .env
   ```
   *(Nota: La aplicación funciona perfectamente sin esto, utilizando tu carpeta de 'Descargas' por defecto).*

6. **Ejecutar la aplicación**:
   ```bash
   python src/main.py
   ```

---

## 📁 Estructura del Proyecto

```text
EasyDownloader/
├── src/
│   ├── main.py          # Punto de entrada de la aplicación
│   ├── config/          # Configuraciones y variables de entorno
│   ├── core/            # Lógica de descarga e integración con yt-dlp
│   ├── ui/              # Componentes de la interfaz gráfica (CustomTkinter)
│   └── utils/           # Funciones de utilidad y helpers
├── .env.example         # Ejemplo de variables de entorno
├── .gitignore           # Archivos y carpetas ignorados por Git
├── requirements.txt     # Dependencias de Python
└── README.md            # Este archivo
```

---

## 🤝 Contribuciones

¡Las contribuciones son bienvenidas! Si deseas mejorar este proyecto:
1. Haz un *Fork* del repositorio.
2. Crea una rama para tu nueva característica (`git checkout -b feature/NuevaCaracteristica`).
3. Haz *Commit* de tus cambios (`git commit -m 'Añade nueva característica'`).
4. Haz *Push* a la rama (`git push origin feature/NuevaCaracteristica`).
5. Abre un *Pull Request*.

---

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Consulta el archivo `LICENSE` para más detalles.
