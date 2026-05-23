import subprocess
import os

def check_ffmpeg_installed() -> bool:
    """Checks if ffmpeg is available in the system PATH."""
    try:
        # Hide output window on Windows
        startupinfo = None
        if os.name == 'nt':
            startupinfo = subprocess.STARTUPINFO()
            startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW

        subprocess.run(['ffmpeg', '-version'], 
                       stdout=subprocess.PIPE, 
                       stderr=subprocess.PIPE, 
                       startupinfo=startupinfo,
                       check=True)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False
