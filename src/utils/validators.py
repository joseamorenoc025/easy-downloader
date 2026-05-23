import urllib.parse
from pathlib import Path

def is_valid_url(url: str) -> bool:
    """Basic validation to check if a string is a valid URL."""
    try:
        result = urllib.parse.urlparse(url)
        return all([result.scheme, result.netloc])
    except ValueError:
        return False

def is_valid_path(path_str: str) -> bool:
    """Checks if the path is a valid existing directory."""
    try:
        path = Path(path_str)
        return path.exists() and path.is_dir()
    except Exception:
        return False
