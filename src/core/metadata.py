from yt_dlp import YoutubeDL

def fetch_metadata(url: str) -> dict:
    """Obtiene metadata sin descargar. Maneja playlists y videos individuales."""
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'extract_flat': True,  # Faster for large playlists
        'playlistend': 1       # We only need the first item to detect if it's a playlist for the general info
    }
    
    with YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=False)
        
    return {
        'is_playlist': 'entries' in info or info.get('playlist_count', 0) > 1,
        'title': info.get('title', 'Untitled'),
        'count': info.get('playlist_count', 1),
        'duration': info.get('duration', 0),
        'uploader': info.get('uploader', 'Unknown'),
        'entries': info.get('entries', [info]) if 'entries' in info else [info]
    }
