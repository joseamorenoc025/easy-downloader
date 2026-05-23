import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

class Settings:
    def __init__(self):
        # Default download path to user's Downloads folder if not specified
        default_dir = os.environ.get("DEFAULT_DOWNLOAD_PATH")
        if not default_dir:
            default_dir = str(Path.home() / "Downloads" / "EasyDownloader")
        
        self.download_path = Path(default_dir)
        self.theme_mode = os.environ.get("THEME_MODE", "System")
        
        # Ensure download directory exists
        self.download_path.mkdir(parents=True, exist_ok=True)

    def get_download_path(self) -> str:
        return str(self.download_path)

settings = Settings()
